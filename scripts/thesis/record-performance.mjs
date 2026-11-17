import {readFileSync,writeFileSync} from 'node:fs';

/** Validate researcher-entered trials without converting missing evidence into a pass. */
const path=process.argv[2];
if(!path) throw new Error('Provide the completed JSON observations file; see performance-observations.json');
const input=JSON.parse(readFileSync(path,'utf8'));
const kinds=['media','capacity','documentation'];
const result={recordedAt:new Date().toISOString(),results:[]};
for(const kind of kinds){
  const trials=input[kind];
  if(!Array.isArray(trials)) throw new Error(`${kind} must be an array`);
  for(const t of trials){
    if(!t.runId||!t.evidenceFile||!t.condition||typeof t.measuredAt!=='string'||!Number.isFinite(Date.parse(t.measuredAt))) throw new Error('Every trial requires runId, evidenceFile, condition, and measuredAt');
    if(kind==='documentation' && !['manualSeconds','aiGenerationSeconds','reviewAndCorrectionSeconds'].every(k=>Number.isFinite(t[k])&&t[k]>=0)) throw new Error('Documentation trials need all three measured times');
  }
  result.results.push({kind,n:trials.length,status:trials.length?'RECORDED_REQUIRES_REVIEW':'NOT_TESTED',reason:trials.length?'Check acceptance thresholds, independent runs, source evidence, and clinical accuracy before assigning PASS.':'No measured trials supplied.'});
}
writeFileSync(path.replace(/\.json$/,'.summary.json'),JSON.stringify(result,null,2));
console.log(result);
