import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../app/page.js',import.meta.url),'utf8');
async function workflow({ready=true,safetyFails=false}={}){
 const calls=[],messages=[],tabs=[];
 const ctx={executeAgent05:async()=>{},item:{content_id:'HT-0002'},selectedId:'item',api:async(fn,input)=>{calls.push({fn,input});if(fn==='integrative-analysis')return {analysis_status:ready?'READY_FOR_AGENT04':'REVISION_REQUIRED',analysis_id:'exact-analysis',quality:{support_percent:ready?100:80}};if(fn==='medical-safety'){if(safetyFails)throw Error('provider unavailable');return {safety_status:'READY_FOR_AGENT05',quality:{passed_findings:3,findings_total:3}};}return {};},loadAnalyses:async()=>{},loadSafety:async()=>{},setAnalysisRunning:()=>{},setSafetyRunning:()=>{},setAnalysisMsg:x=>messages.push(x),setSafetyMsg:x=>messages.push(x),setDetail:()=>{},setTab:x=>tabs.push(x)};
 const code=['executeAgent04','executeAgent03'].map(name=>source.split('\n').find(line=>line.trim().startsWith('async function '+name+'('))).join('\n');
 vm.runInNewContext(code+';this.run=executeAgent03;',ctx);await ctx.run('exact-review');return {calls,messages,tabs};
}
test('approved Agent03 output automatically invokes Agent04 with exact saved ID',async()=>{const r=await workflow();const c=r.calls.find(c=>c.fn==='medical-safety');assert.equal(c.input.analysis_id,'exact-analysis');assert.equal(r.tabs.at(-1),'medical_safety')});
test('revision-required Agent03 never invokes Agent04',async()=>{const r=await workflow({ready:false});assert.equal(r.calls.some(c=>c.fn==='medical-safety'),false)});
test('Agent04 error remains visible without relabelling successful Agent03 as failed',async()=>{const r=await workflow({safetyFails:true});assert.ok(r.messages.some(x=>x==='Agent 04 failed: provider unavailable'));assert.equal(r.messages.some(x=>x.startsWith('Agent 03 failed:')),false);assert.equal(r.tabs.at(-1),'medical_safety')});
