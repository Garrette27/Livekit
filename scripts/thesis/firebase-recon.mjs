import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

/** Use the official Firebase MCP over stdio; discovery prints schemas only. */
const child = spawn('npx', ['-y', 'firebase-tools@latest', 'mcp', '--only', 'firestore,core', '--dir', process.cwd()], { stdio: ['pipe', 'pipe', 'pipe'] });
let nextId = 1;
let buffer = '';
const pending = new Map();
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  while (buffer.includes('\n')) {
    const end = buffer.indexOf('\n');
    const line = buffer.slice(0, end);
    buffer = buffer.slice(end + 1);
    try {
      const message = JSON.parse(line);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    } catch { /* CLI diagnostics are never treated as protocol data. */ }
  }
});
child.stderr.resume();
const timer = setTimeout(() => { child.kill(); process.exit(2); }, 90_000);

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

try {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'teleconsole-read-only-assessment', version: '1.0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const call = async (name, args) => {
    const result = await rpc('tools/call', {name, arguments: args});
    if (result.error || result.result?.isError) throw new Error(`Read failed for ${name}`);
    if (result.result.structuredContent) return result.result.structuredContent;
    const text = result.result.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
    if (name === 'firebase_get_security_rules') return {source:text};
    try { return JSON.parse(text); } catch { return yaml.load(text); }
  };
  const parent = 'projects/livekit-5eef6/databases/(default)';
  const summary = {project: 'livekit-5eef6', database: '(default)', readAt: new Date().toISOString(), collections: {}};
  for (const collectionId of (process.env.THESIS_RULES_ONLY ? [] : ['invitations', 'waitingPatients', 'consultationSessions', 'consultations', 'call-summaries', 'users', 'summaryJobs', 'securityRateLimits'])) {
    let pageToken;
    const counts = {count: 0, complete: true, states: {}, missingExpiry: 0, expiredActive: 0, missingConsentVersion: 0};
    for (let page = 0; page < 10; page++) {
      const result = await call('firestore_list_documents', {parent: parent + '/documents', collectionId, pageSize: 200, ...(pageToken ? {pageToken} : {}), mask: {fieldPaths: ['status', 'summaryStatus', 'expiresAt', 'consentVersion']}});
      const data = result.result || result;
      if (!Array.isArray(data.documents) && Object.keys(data).some(x => !['nextPageToken'].includes(x))) {
        console.log(JSON.stringify({collectionId, responseKeys: Object.keys(data)}));
        throw new Error('Unexpected read response shape; no document content was printed.');
      }
      for (const doc of data.documents || []) {
        counts.count++;
        const f = doc.fields || {};
        const state = f.status?.stringValue || f.summaryStatus?.stringValue || 'missing';
        const safeState = ['active','expired','revoked','waiting','admitted','left','rejected','completed','processing','ready','reviewed','failed','unavailable','pending'].includes(state) ? state : 'other_or_missing';
        counts.states[safeState] = (counts.states[safeState] || 0) + 1;
        if (!f.expiresAt) counts.missingExpiry++;
        if (state === 'active' && f.expiresAt?.timestampValue && Date.parse(f.expiresAt.timestampValue) < Date.now()) counts.expiredActive++;
        if (!f.consentVersion) counts.missingConsentVersion++;
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
      if (page === 9) counts.complete = false;
    }
    summary.collections[collectionId] = counts;
  }
  const dir = process.env.THESIS_OUTPUT || 'docs/testing/evidence/2026-11-17';
  mkdirSync(dir, {recursive:true});
  for (const type of ['firestore','storage']) {
    try {
    const rules = await call('firebase_get_security_rules', {type});
    const serialized = JSON.stringify(rules);
    summary[type + 'Rules'] = {sha256: createHash('sha256').update(serialized).digest('hex'), matchesRepository: rules.source?.replace(/\r/g,'').trim() === readFileSync(type === 'firestore' ? 'firestore.rules' : 'storage.rules','utf8').replace(/\r/g,'').trim()};
    writeFileSync(`${dir}/deployed-${type}-rules.json`, JSON.stringify(rules,null,2));
    } catch { summary[type + 'Rules'] = {status:'BLOCKED',reason:'The authenticated rules read failed; no deployed rule result is asserted.'}; }
  }
  writeFileSync(`${dir}/firestore-aggregates.json`, JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
} finally {
  clearTimeout(timer);
  child.kill();
}
