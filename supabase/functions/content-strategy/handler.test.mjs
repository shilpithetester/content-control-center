import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {safetyPacket,readiness,validateStrategy,assessStrategy,POLICY_VERSION} from './strategy-policy.mjs';
import {record,origin,raw} from './fixtures.mjs';
async function run({authorized=true,missing=false,hold=false,holdAfter=false,stale=false,badHash=false,action='RUN',unsafe=false,auditRevision=false,truncated=false,changedReview=false}={}){
 const hash=async x=>[...new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(x))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const analysis={id:'analysis',content_item_id:'item',research_dossier_id:'parent',research_review_id:'review',analysis_status:'READY_FOR_AGENT04',dossier:{original:'immutable'}};
 const rec=structuredClone(record);rec.input_sha256=badHash?'tampered':await hash(analysis.dossier);
 const writes=[],filters=[],prompts=[];let handler,network=0,reads=0,generation=0,auditCount=0;
 const db={auth:{getUser:async()=>({data:{user:authorized?{id:'owner'}:null}})},from(table){let selection='';const q={select(s){selection=s;return q},eq(k,v){filters.push({table,k,v});return q},order(){return q},limit(){return q},insert(value){writes.push({table,action:'insert',value});return q},update(value){writes.push({table,action:'update',value});return q},maybeSingle:async()=>{
 if(table==='content_items')return {data:{id:'item',hold:hold||(holdAfter&&++reads>1)}};
 if(table==='medical_safety_reports')return {data:missing?null:selection==='id'?{id:stale?'newer':rec.id}:rec};
 if(table==='integrative_analysis_dossiers')return {data:selection==='id'?{id:'analysis'}:analysis};
 if(table==='medical_research_reviews')return {data:{id:changedReview?'newer-review':'review'}};
 if(table==='agent_executions')return {data:origin};
 if(table==='llm_settings')return {data:{provider:'deepseek',model:'deepseek-flash'}};
 return {data:null};},single:async()=>({data:{id:table==='agent_executions'?'strategy-execution':'strategy-report'}}),then(resolve){resolve({data:[],error:null})}};return q}};
 const mockFetch=async(url,options)=>{network++;const b=JSON.parse(options.body);assert.equal(b.thinking.type,'disabled');const data=JSON.parse(b.messages[1].content);prompts.push(data);let out;
 if(b.messages[0].content.includes('independent content safety auditor')){assert.equal(data.outline_evidence.length,3);assert.equal(data.outline_evidence[0].approved_evidence[0].finding_id,'A03_nutrition_1');auditCount++;out={checks:data.fields.map(x=>({path:x.path,verdict:auditRevision&&generation===1&&auditCount===1?'REVISE':'PASS',reason:'Matches approved evidence'}))};}
 else {generation++;out=raw();if(unsafe&&generation===1)out.languages.english.titles[0]='A guaranteed cure';}
 return Response.json({usage:{total_tokens:10},choices:[{finish_reason:truncated?'length':'stop',message:{content:JSON.stringify(out)}}]});};
 const code=stripTypeScriptTypes(readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
 vm.runInNewContext(code,{createClient:()=>db,safetyPacket,readiness,validateStrategy,assessStrategy,POLICY_VERSION,crypto:webcrypto,TextEncoder,Date,Request,Response,AbortSignal,fetch:mockFetch,Deno:{env:{get:()=> 'test-only'},serve:fn=>handler=fn}});
 const r=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,safety_report_id:rec.id,content_id:'HT-0002'})}));return {status:r.status,body:await r.json(),writes,filters,network,generation,prompts};
}
test('unauthenticated or other-owner safety report spends nothing',async()=>{for(const x of [{authorized:false},{missing:true}]){const r=await run(x);assert.ok([401,404].includes(r.status));assert.equal(r.network,0);assert.equal(r.writes.length,0)}});
test('read-only report list is owner-scoped with no paid calls',async()=>{const r=await run({action:'LIST'});assert.equal(r.status,200);assert.equal(r.network,0);assert.ok(r.filters.some(f=>f.table==='content_strategy_reports'&&f.k==='owner_id'&&f.v==='owner'))});
test('HOLD, tampering, superseded safety or review rejected before spending',async()=>{for(const x of [{hold:true},{badHash:true},{stale:true},{changedReview:true}]){const r=await run(x);assert.ok([409,422].includes(r.status));assert.equal(r.network,0);assert.equal(r.writes.length,0)}});
test('complete audit stores immutable report and Agent06 packet without excluded input',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.body.strategy_status,'READY_FOR_AGENT06');const w=r.writes.find(w=>w.table==='content_strategy_reports');assert.equal(w.action,'insert');assert.equal(w.value.report.agent06_handoff.publishing_allowed,false);assert.equal(r.writes.some(w=>['content_items','medical_safety_reports','integrative_analysis_dossiers'].includes(w.table)),false);assert.equal(JSON.stringify(r.prompts).includes('A03_sleep_2'),false)});
test('invalid first draft triggers automatic retry and re-audit',async()=>{const r=await run({unsafe:true});assert.equal(r.status,200);assert.equal(r.generation,2);assert.equal(r.body.strategy_status,'READY_FOR_AGENT06')});
test('audit feedback triggers revision and complete re-audit',async()=>{const r=await run({auditRevision:true});assert.equal(r.status,200);assert.equal(r.generation,2);assert.equal(r.body.strategy_status,'READY_FOR_AGENT06')});
test('truncation never persists strategy',async()=>{const r=await run({truncated:true});assert.equal(r.status,500);assert.equal(r.network,2);assert.equal(r.writes.some(w=>w.table==='content_strategy_reports'),false)});
test('HOLD changed during execution prevents persistence',async()=>{const r=await run({holdAfter:true});assert.equal(r.status,500);assert.equal(r.writes.some(w=>w.table==='content_strategy_reports'),false)});
