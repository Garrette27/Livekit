import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const r=spawnSync('npx',['-y','firebase-tools@latest','emulators:exec','--only','firestore,storage','--project','demo-livekit-security','--config','firebase.json','npm --prefix functions run test:rules; cd functions && node --test test/deployed-assessment.cjs'],{encoding:'utf8',timeout:180000});
writeFileSync('docs/testing/evidence/2026-11-17/rules.log',(r.stdout||'')+(r.stderr||''));
console.log({exitCode:r.status,output:'docs/testing/evidence/2026-11-17/rules.log'});
