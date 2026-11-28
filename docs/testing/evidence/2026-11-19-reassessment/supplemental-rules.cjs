/* Verify consultation integrity with synthetic emulator identities only. */
const {createRequire}=require('node:module');
const r=createRequire('/home/ret/Livekit/functions/package.json');
const {initializeTestEnvironment}=r('@firebase/rules-unit-testing');
const {doc,setDoc,updateDoc,getDoc}=r('firebase/firestore');
const {readFileSync,writeFileSync}=require('node:fs');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-livekit-security',firestore:{rules:JSON.parse(readFileSync('/tmp/teleconsole-2026-11-19/deployed-firestore-rules.json','utf8')).source}});
 const results=[];
 try{
  await env.clearFirestore();
  const patient=env.authenticatedContext('synthetic-patient-1',{role:'patient',email:'patient1@example.test'}).firestore();
  const target=doc(patient,'consultations/synthetic-injected-record');
  let allowed=false;try{await setDoc(target,{createdBy:'synthetic-patient-1',patientUserId:'synthetic-patient-2',roomName:'synthetic-injected-record',status:'completed'});allowed=true;}catch{}
  let visibleToOtherPatient=false;if(allowed){const other=env.authenticatedContext('synthetic-patient-2',{role:'patient'}).firestore();try{visibleToOtherPatient=(await getDoc(doc(other,'consultations/synthetic-injected-record'))).exists();}catch{}}
  results.push({id:'ADD01',criterion:'A patient cannot bypass server role checks to create a consultation attributed to another patient',writeAllowed:allowed,readableByTargetPatient:visibleToOtherPatient,status:allowed?'FAIL':'PASS'});
  await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'consultations/synthetic-owner-record'),{createdBy:'synthetic-doctor-1',patientUserId:'synthetic-patient-1',roomName:'synthetic-owner-record',status:'active'});});
  const doctor=env.authenticatedContext('synthetic-doctor-1',{role:'doctor'}).firestore();
  let reassignmentAllowed=false;try{await updateDoc(doc(doctor,'consultations/synthetic-owner-record'),{createdBy:'synthetic-doctor-2',patientUserId:'synthetic-patient-2'});reassignmentAllowed=true;}catch{}
  results.push({id:'ADD02',criterion:'An existing consultation owner cannot reassign trusted doctor/patient identity fields through a direct client update',reassignmentAllowed,status:reassignmentAllowed?'FAIL':'PASS'});
  writeFileSync('/tmp/teleconsole-2026-11-19/supplemental-rules.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Firestore emulator, demo-livekit-security',source:'retrieved active production rules; normalized SHA-256 c1300f7431b5f3da03203a59f3ac838b879eabe9f216065a02aa0d9ef0c83cef',productionWrites:false,results},null,2));
  console.log(JSON.stringify(results,null,2));
  process.exitCode=results.some(result=>result.status==='FAIL')?1:0;
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e.name);process.exitCode=2;});
