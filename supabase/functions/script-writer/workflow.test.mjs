import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../app/page.js',import.meta.url),'utf8');
async function workflow({ready=true,scriptFails=false}={}){
 const calls=[],messages=[],tabs=[];
 const ctx={item:{content_id:'HT-0002'},selectedId:'item',api:async(fn,input)=>{calls.push({fn,input});if(fn==='content-strategy')return {strategy_status:ready?'READY_FOR_AGENT06':'REVISION_REQUIRED',strategy_report_id:'exact-strategy',quality:{supported_fields:12,editorial_fields:12}};if(fn==='script-writer'){if(scriptFails)throw Error('provider unavailable');return {script_status:'READY_FOR_AGENT07',quality:{supported_fields:6,script_fields:6}};}return {};},loadStrategies:async()=>{},loadScriptDossiers:async()=>{},setStrategyRunning:()=>{},setScriptRunning:()=>{},setStrategyMsg:x=>messages.push(x),setScriptMsg:x=>messages.push(x),setDetail:()=>{},setTab:x=>tabs.push(x)};
 const code=['executeAgent06','executeAgent05'].map(name=>source.split('\n').find(line=>line.trim().startsWith('async function '+name+'('))).join('\n');vm.runInNewContext(code+';this.run=executeAgent05;',ctx);await ctx.run('exact-safety');return {calls,messages,tabs};
}
test('ready Agent05 strategy automatically invokes Agent06 with exact saved ID',async()=>{const r=await workflow();assert.equal(r.calls.find(c=>c.fn==='script-writer').input.strategy_report_id,'exact-strategy');assert.equal(r.tabs.at(-1),'script_writer')});
test('revision-required Agent05 does not invoke Agent06',async()=>{const r=await workflow({ready:false});assert.equal(r.calls.some(c=>c.fn==='script-writer'),false)});
test('Agent06 failure does not relabel successful Agent05 as failed',async()=>{const r=await workflow({scriptFails:true});assert.ok(r.messages.includes('Agent 06 failed: provider unavailable'));assert.equal(r.messages.some(x=>x.startsWith('Agent 05 failed:')),false);assert.equal(r.tabs.at(-1),'script_writer')});
