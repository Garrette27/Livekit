import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, posix } from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);

/** Render the real workbench; only its external authenticated HTTP adapter is synthetic. */
export function appointmentBrowserFixture({ disabled = false, paged = false, scopedPage = false } = {}) {
  const entry = scopedPage ? 'app/doctor/appointments/page' : 'app/doctor/appointments/components/AppointmentWorkbench';
  assert.ok(existsSync(`${entry}.tsx`), 'Appointment workbench has not been implemented');
  const stubs = {
    react: readFileSync(resolve(dirname(require.resolve('react')), 'cjs/react.production.js'), 'utf8'),
    'react-dom': readFileSync(resolve(dirname(require.resolve('react-dom')), 'cjs/react-dom.production.js'), 'utf8'),
    'react-dom/client': readFileSync(resolve(dirname(require.resolve('react-dom')), 'cjs/react-dom-client.production.js'), 'utf8'),
    scheduler: readFileSync(resolve(dirname(require.resolve('scheduler')), 'cjs/scheduler.production.js'), 'utf8'),
    '@/lib/firebase': `const listeners=[];const user=uid=>({uid,getIdToken:async()=>uid});exports.auth={currentUser:user('doctor-a')};window.currentDoctorId='doctor-a';window.switchDoctor=uid=>{window.currentDoctorId=uid;exports.auth.currentUser=user(uid);listeners.forEach(fn=>fn(exports.auth.currentUser));};exports.listeners=listeners;`,
    'firebase/auth': `exports.onAuthStateChanged=(auth,listener)=>{const {listeners}=require('@/lib/firebase');listeners.push(listener);queueMicrotask(()=>listener(auth.currentUser));return()=>listeners.splice(listeners.indexOf(listener),1);};`,
    '@/lib/auth-utils': 'exports.getUserRole=async()=>"doctor";',
    '@/lib/auth/workspace-client': `exports.fetchWorkspaceAccess=async user=>{if(user.uid==='doctor-b'&&window.deferDoctorB)await new Promise(resolve=>window.resolveDoctorB=resolve);return{doctorAccess:true,administratorLevel:null,homePath:'/doctor/invitations'};};`,
    '@/components/doctor/DoctorAppHeader': 'module.exports=()=>null;',
    'next/navigation': 'exports.useRouter=()=>({replace(){}});',
    '@/lib/auth/authenticated-fetch': `
      const {parseAppointmentCommand} = require('@/lib/appointments/appointment-policy');
      let rows = [];
      if (${paged}) rows = [1,2,3].map(n=>({id:'00000000-0000-4000-8000-00000000000'+n,doctorUserId:'synthetic-doctor',patientName:'Synthetic '+n,patientEmail:null,startsAt:'2026-11-28T0'+n+':00:00Z',endsAt:'2026-11-28T0'+n+':30:00Z',displayTimeZone:'Asia/Manila',status:'booked',version:1}));
      window.bookingRequests = [];
      const response = (status, body) => ({status, ok:status===200, json:async()=>body});
      exports.authenticatedFetch = async (url, options={}, expectedUserId) => {
        if (${scopedPage}&&expectedUserId&&expectedUserId!==window.currentDoctorId) throw new Error('Account changed');
        window.bookingRequests.push({url, method:options.method||'GET'});
        if (!url.startsWith('/api/doctor/appointments')) throw new Error('Unexpected clinical side effect');
        if (${disabled}) return response(503,{success:false,code:'scheduling_disabled',error:'Appointments are not enabled in this deployment.'});
        if (!options.method || options.method==='GET') {
          const scopedRows=${scopedPage}?[{id:'11111111-1111-4111-8111-111111111111',patientName:window.currentDoctorId==='doctor-a'?'Private A':'Private B',patientEmail:null,startsAt:'2026-11-28T01:00:00Z',endsAt:'2026-11-28T01:30:00Z',displayTimeZone:'Asia/Manila',status:'booked',version:1}]:rows;
          const body={success:true,appointments:${paged}?url.includes('cursor=')?rows.slice(2):rows.slice(0,2):scopedRows,nextCursor:${paged}&&!url.includes('cursor=')?'fixture-next':null};
          if(window.deferNextBookingGet){window.deferNextBookingGet=false;return new Promise(resolve=>window.releaseOldBookingGet=()=>resolve(response(200,body)));}
          return response(200,body);
        }
        if(window.disableBookingWrites)return response(503,{success:false,code:'scheduling_disabled',error:'Appointments are not enabled in this deployment.'});
        const parsed = parseAppointmentCommand(JSON.parse(options.body), new Date('2026-11-27T00:00:00Z'));
        if (!parsed.ok) return response(400,{success:false,error:parsed.error.message});
        const command = parsed.data;
        if (window.forceBookingConflict) { window.forceBookingConflict=false; rows=rows.map(row=>({...row,version:row.version+1})); return response(409,{success:false,error:'This appointment changed. Refresh before trying again.'}); }
        const existing=rows.find(row=>row.id===command.id);
        const appointment=command.action==='cancel'?{...existing,status:'cancelled',version:existing.version+1}:{...command,doctorUserId:'synthetic-doctor',status:'booked',version:(existing?.version||0)+1,createdAt:'2026-11-27T00:00:00Z',updatedAt:'2026-11-27T00:00:00Z'};
        rows=[...rows.filter(row=>row.id!==command.id),appointment];
        return response(200,{success:true,appointment});
      };
    `,
  };
  const modules = {};
  function visit(id) {
    if (modules[id]) return;
    const code = stubs[id] ?? ts.transpileModule(readFileSync(`${id}.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    modules[id] = { code, dependencies: {} };
    for (const [, , name] of code.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      const dependency = name.startsWith('.') ? posix.normalize(posix.join(posix.dirname(id), name)) : stubs[name] !== undefined ? name : name.startsWith('@/') ? name.slice(2) : name;
      modules[id].dependencies[name] = dependency;
      if (stubs[dependency] === undefined && existsSync(`${dependency}.ts`)) stubs[dependency] = ts.transpileModule(readFileSync(`${dependency}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      visit(dependency);
    }
  }
  visit(entry); visit('react-dom/client');
  const factories = Object.entries(modules).map(([id, value]) => `${JSON.stringify(id)}:function(module,exports,require){${value.code}\n}`).join(',');
  return `window.process={env:{NODE_ENV:'production'}};const factories={${factories}},maps=${JSON.stringify(Object.fromEntries(Object.entries(modules).map(([id, value]) => [id, value.dependencies])))},cache={};function load(id){if(cache[id])return cache[id].exports;const record=cache[id]={exports:{}};factories[id](record,record.exports,name=>load(maps[id][name]));return record.exports;}const React=load('react');load('react-dom/client').createRoot(document.getElementById('root')).render(React.createElement(load(${JSON.stringify(entry)}).default,{doctorUserId:'synthetic-doctor'}));`;
}
