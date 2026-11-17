/* eslint-disable @typescript-eslint/no-require-imports */
const {test, before, after} = require('node:test');
const {readFileSync} = require('node:fs');
const {initializeTestEnvironment, assertFails} = require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc} = require('firebase/firestore');
let env;
before(async()=>{
  const rules=JSON.parse(readFileSync(process.env.THESIS_DEPLOYED_RULES || '../docs/testing/evidence/2026-11-17/deployed-firestore-rules.json','utf8')).source;
  env=await initializeTestEnvironment({projectId:'demo-livekit-security',firestore:{rules}});
  await env.withSecurityRulesDisabled(async c=>{
    await setDoc(doc(c.firestore(),'users/assessment-patient'),{email:'patient@example.test',role:'patient'});
    await setDoc(doc(c.firestore(),'users/assessment-other'),{email:'other@example.test',role:'patient'});
  });
});
after(async()=>env?.cleanup());
test('deployed rules should deny reading another patient profile',async()=>{
  const db=env.authenticatedContext('assessment-patient').firestore();
  await assertFails(getDoc(doc(db,'users/assessment-other')));
});
test('deployed rules should deny changing patient role to doctor',async()=>{
  const db=env.authenticatedContext('assessment-patient').firestore();
  await assertFails(updateDoc(doc(db,'users/assessment-patient'),{role:'doctor'}));
});
