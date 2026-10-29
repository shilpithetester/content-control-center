import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../app/page.js',import.meta.url),'utf8');
async function workflow({ready=true,strategyFails=false}={}){
 const calls=[],messages=[],tabs=[];
 const ctx={executeAgent06:async()=>{},item:{content_id:'HT-0002'},selectedId:'item',api:async(fn,input)=>{calls.push({fn,input});if(fn==='medical-safety')return {safety_status:ready?'READY_FOR_AGENT05_WITH_EXCLUSIONS':'REVISION_REQUIRED',safety_report_id:'exact-safety',quality:{passed_findings:13,findings_total:15}};if(fn==='content-strategy'){if(strategyFails)throw Error('provider unavailable');return {strategy_status:'READY_FOR_AGENT06',quality:{supported_fields:3,editorial_fields:3}};}return {};},loadSafety:async()=>{},loadStrategies:async()=>{},setSafetyRunning:()=>{},setStrategyRunning:()=>{},setSafetyMsg:x=>messages.push(x),setStrategyMsg:x=>messages.push(x),setDetail:()=>{},setTab:x=>tabs.push(x)};
 const code=['executeAgent05','executeAgent04'].map(name=>source.split('\n').find(line=>line.trim().startsWith('async function '+name+'('))).join('\n');vm.runInNewContext(code+';this.run=executeAgent04;',ctx);await ctx.run('exact-analysis');return {calls,messages,tabs};
}
test('Agent04 ready report automatically invokes Agent05 with exact saved ID',async()=>{const r=await workflow();assert.equal(r.calls.find(c=>c.fn==='content-strategy').input.safety_report_id,'exact-safety');assert.equal(r.tabs.at(-1),'content_strategy')});
test('Agent04 revision-required report never invokes Agent05',async()=>{const r=await workflow({ready:false});assert.equal(r.calls.some(c=>c.fn==='content-strategy'),false)});
test('Agent05 failure does not label completed Agent04 as failed',async()=>{const r=await workflow({strategyFails:true});assert.ok(r.messages.includes('Agent 05 failed: provider unavailable'));assert.equal(r.messages.some(x=>x.startsWith('Agent 04 failed:')),false);assert.equal(r.tabs.at(-1),'content_strategy')});
