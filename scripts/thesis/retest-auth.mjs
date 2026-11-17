import {writeFileSync} from 'node:fs';
const results = [];
for (const [path, body] of [
  ['/api/waiting-room/check-admission', {invitationId: 'thesis-synthetic'}],
  ['/api/waiting-room/mark-left', {waitingPatientId: 'thesis-synthetic'}],
]) {
  const r = await fetch('https://livekit-frontend-tau.vercel.app' + path, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)});
  const b = await r.json();
  results.push({path,statusCode:r.status,successFalse:b.success===false,status:r.status===401&&b.success===false?'PASS':'FAIL'});
}
writeFileSync('docs/testing/evidence/2026-11-17/auth-retest.json',JSON.stringify({testedAt:new Date().toISOString(),reason:'Original empty bodies hit required-field validation before authorization. Retest uses syntactically valid synthetic identifiers.',results},null,2));
console.log(results);
