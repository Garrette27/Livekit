import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

/** Keep remediation evidence separate from the failed baseline. */
const dir=process.env.THESIS_OUTPUT || 'docs/testing/evidence/2026-11-17-remediation';
mkdirSync(dir,{recursive:true});
const report={testedAt:new Date().toISOString(),node:process.version,baseCommit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),sourceState:'working tree remediation; release commit recorded in PR',checks:[]};
for (const [name,command,args] of [
  ['policy','npm',['run','test:security']],
  ['typecheck','npm',['run','typecheck']],
  ['lint','npm',['run','lint']],
  ['build','npm',['run','build']],
  ['rules','npx',['-y','firebase-tools@15.36.0','emulators:exec','--only','firestore,storage','--project','demo-livekit-security','--config','firebase.json','npm --prefix functions run test:rules']],
  ['application-audit','npm',['audit','--json']],
  ['functions-audit','npm',['--prefix','functions','audit','--json']],
]) {
  const start=performance.now();
  const r=spawnSync(command,args,{encoding:'utf8',timeout:240000,maxBuffer:10*1024*1024});
  writeFileSync(`${dir}/${name}.${name.includes('audit')?'json':'log'}`,(r.stdout||'')+(name.includes('audit')?'':r.stderr||''));
  report.checks.push({name,exitCode:r.status,durationMs:Math.round(performance.now()-start),status:r.status===0?'PASS':'FAIL'});
  console.log(report.checks.at(-1));
}
report.rulesSha256=createHash('sha256').update(readFileSync('firestore.rules')).digest('hex');
report.finishedAt=new Date().toISOString();
writeFileSync(`${dir}/verification.json`,JSON.stringify(report,null,2));
writeFileSync(`${dir}/sha256.json`,JSON.stringify(Object.fromEntries(readdirSync(dir).filter(f=>f!=='sha256.json').sort().map(f=>[f,createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex')])),null,2));
process.exitCode=report.checks.every(c=>c.status==='PASS')?0:1;
