/**
 * Renders the ranked panel Q&A and the quick-answer page to PDF with headless
 * Chromium. The Markdown subset used by those two files (headings, paragraphs,
 * lists, tables, bold/italic/code, links) is converted here so the build needs
 * no extra dependency. Run: node scripts/thesis/render-panel-qa-pdf.mjs
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const DIR = 'docs/thesis-defense';
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => escape(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

function toHtml(md) {
  const lines = md.replace(/<!--.*?-->/g, '').split(/\r?\n/);
  const out = [];
  let list = null;
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { flush(); continue; }
    if (line.startsWith('```')) {
      flush();
      const code = [];
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      out.push(`<pre>${escape(code.join('\n'))}</pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,4}) (.*)$/);
    if (heading) { flush(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
    if (line.startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const [head, , ...body] = rows;
      out.push(`<table><thead><tr>${cells(head).map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body
        .map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const item = line.match(/^\s*(\d+\.|[-*]) (.*)$/);
    if (item) {
      if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
      const kind = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (list !== kind) { if (list) out.push(`</${list}>`); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(item[2])}</li>`);
      continue;
    }
    if (line.startsWith('> ')) { flush(); out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); continue; }
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

const css = `body{font:10.5pt/1.45 Georgia,serif;color:#111;margin:0}h1{font-size:18pt;color:#1e3a8a}h2{font-size:13pt;color:#1e3a8a;margin-top:1.2em}
h3{font-size:11.5pt;color:#1e3a8a;margin:1.1em 0 .3em;break-after:avoid}table{border-collapse:collapse;width:100%;margin:.5em 0;font-size:9.5pt;break-inside:avoid}
th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eff6ff}code{font-size:9pt;background:#f1f5f9;padding:0 2px}
pre{font-size:8.5pt;background:#f1f5f9;padding:6px;white-space:pre-wrap}blockquote{border-left:3px solid #93c5fd;margin:.5em 0;padding-left:.75em;color:#334155}`;

const browser = await chromium.launch();
for (const [source, target] of [
  ['panel-questions-and-answers.md', 'TeleConsole-Panel-Questions-and-Answers.pdf'],
  ['PANEL-QA-LATEST.md', 'TeleConsole-Panel-Quick-Answers.pdf'],
  ['TEAM-TEST-TOP-40.md', 'TeleConsole-Team-Test-Top-40.pdf'],
]) {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${toHtml(readFileSync(`${DIR}/${source}`, 'utf8'))}`);
  await page.pdf({
    path: `${DIR}/${target}`, format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#64748b">TeleConsole · panel preparation · 27 Nov 2026 · <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
  });
  await page.close();
  console.log(`Rendered ${target}`);
}
await browser.close();
