import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir=process.env.THESIS_OUTPUT || 'docs/testing/evidence/2026-11-17-remediation';
const report=JSON.parse(readFileSync(`${dir}/verification.json`,'utf8'));
for (const [name,command,args] of [
  ['lint','npm',['run','lint']],
  ['policy','npm',['run','test:security']],
  ...(process.env.THESIS_E2E ? [['api-regressions','npx',['playwright','test','e2e/api-access-control.spec.ts','--project=mobile-chromium']]] : []),
]) {
  const start=performance.now();
  const result=spawnSync(command,args,{encoding:'utf8',timeout:240000,maxBuffer:10*1024*1024});
  writeFileSync(`${dir}/${name}.log`,(result.stdout||'')+(result.stderr||''));
  const check={name,exitCode:result.status,status:result.status===0?'PASS':'FAIL',durationMs:Math.round(performance.now()-start)};
  report.checks=report.checks.filter(c=>c.name!==name).concat(check);
}
report.sourceHashes=Object.fromEntries(['firestore.rules','package.json','package-lock.json','functions/package.json','functions/package-lock.json','app/patient/login/page.tsx','functions/test/security-rules.test.cjs','eslint.config.mjs',
  'app/patient/dashboard/page.tsx','hooks/useWaitingQueue.ts','lib/waiting-room/waiting-queue-coordinator.ts',
  'lib/services/transcription/openai-audio-transcriber.ts','app/api/session-transcription/chunks/route.ts',
  'app/room/[room]/components/shared/SessionTranscriptionBridge.tsx','app/room/[room]/doctor/components/WaitingRoomPanel.tsx',
  'app/doctor/invitations/components/WaitingPatientsList.tsx','tests/queue-and-auth-regressions.test.mjs',
  'app/invite/[token]/page.tsx','app/invite/[token]/components/PatientLiveKitRoom.tsx',
  'app/room/[room]/patient/page.tsx',
].map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
report.finalizedAt=new Date().toISOString();
writeFileSync(`${dir}/verification.json`,JSON.stringify(report,null,2));
writeFileSync(`${dir}/sha256.json`,JSON.stringify(Object.fromEntries(readdirSync(dir).filter(f=>f!=='sha256.json').sort().map(f=>[f,createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex')])),null,2));
console.log(report.checks);
process.exitCode=report.checks.every(c=>c.status==='PASS')?0:1;
