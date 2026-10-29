import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {scriptPacket,validateScript,assessScript,POLICY_VERSION} from './script-policy.mjs';
import {record,origin,safety,raw} from './fixtures.mjs';
async function run({authorized=true,missing=false,hold=false,holdAfter=false,stale=false,badHash=false,action='RUN',unsafe=false,auditRevision=false,truncated=false,changedReview=false,parityFail=false}={}){
 const hash=async x=>[...new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(x))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const rec=structuredClone(record);rec.input_sha256=badHash?'bad':await hash(safety.report);const analysis={id:'analysis',research_review_id:'review',research_dossier_id:'parent'};
 const writes=[],filters=[],prompts=[];let handler,network=0,reads=0,generation=0,auditCount=0;
 const db={auth:{getUser:async()=>({data:{user:authorized?{id:'owner'}:null}})},from(table){let selection='';const q={select(s){selection=s;return q},eq(k,v){filters.push({table,k,v});return q},order(){return q},limit(){return q},insert(value){writes.push({table,action:'insert',value});return q},update(value){writes.push({table,action:'update',value});return q},maybeSingle:async()=>{
 if(table==='content_items')return {data:{id:'item',hold:hold||(holdAfter&&++reads>1)}};
 if(table==='content_strategy_reports')return {data:missing?null:selection==='id'?{id:stale?'newer':rec.id}:rec};
 if(table==='medical_safety_reports')return {data:selection==='id'?{id:'safety'}:safety};
 if(table==='integrative_analysis_dossiers')return {data:selection==='id'?{id:'analysis'}:analysis};
 if(table==='medical_research_reviews')return {data:{id:changedReview?'newer':'review'}};
 if(table==='agent_executions')return {data:origin};
 if(table==='llm_settings')return {data:{provider:'deepseek',model:'deepseek-flash'}};
 return {data:null};},single:async()=>({data:{id:table==='agent_executions'?'script-execution':'script-dossier'}}),then(resolve){resolve({data:[],error:null})}};return q}};
 const mockFetch=async(url,options)=>{network++;const b=JSON.parse(options.body);assert.equal(b.thinking.type,'disabled');const data=JSON.parse(b.messages[1].content);prompts.push(data);let out;
 if(b.messages[0].content.includes('separate evidence and health-safety')){auditCount++;out={checks:data.fields.map(x=>({path:x.path,verdict:auditRevision&&generation===1&&auditCount===1?'REVISE':'PASS',reason:'Within approved evidence'}))};}
 else if(b.messages[0].content.includes('independent bilingual script'))out={checks:data.pairs.map(x=>({path:x.path,verdict:parityFail?'REVISE':'PASS',reason:'Reviewed parity'}))};
 else {generation++;out=raw();if(unsafe&&generation===1)out.languages.english.sections[0].lines[0].text='Take 50 mg daily.';}
 return Response.json({usage:{total_tokens:10},choices:[{finish_reason:truncated?'length':'stop',message:{content:JSON.stringify(out)}}]});};
 const code=stripTypeScriptTypes(readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
 vm.runInNewContext(code,{createClient:()=>db,scriptPacket,validateScript,assessScript,POLICY_VERSION,crypto:webcrypto,TextEncoder,Date,Request,Response,AbortSignal,fetch:mockFetch,Deno:{env:{get:()=> 'test-only'},serve:fn=>handler=fn}});
 const r=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,strategy_report_id:rec.id,content_id:'HT-0002'})}));return {status:r.status,body:await r.json(),writes,filters,network,generation,prompts};
}
test('unauthenticated or other-owner input cannot run or write',async()=>{for(const x of [{authorized:false},{missing:true}]){const r=await run(x);assert.ok([401,404].includes(r.status));assert.equal(r.network,0);assert.equal(r.writes.length,0)}});
test('LIST is owner scoped and never makes paid calls',async()=>{const r=await run({action:'LIST'});assert.equal(r.status,200);assert.equal(r.network,0);assert.ok(r.filters.some(f=>f.table==='script_dossiers'&&f.k==='owner_id'&&f.v==='owner'))});
test('HOLD, tamper and superseded report or review reject before paid calls',async()=>{for(const x of [{hold:true},{badHash:true},{stale:true},{changedReview:true}]){const r=await run(x);assert.ok([409,422].includes(r.status));assert.equal(r.network,0);assert.equal(r.writes.length,0)}});
test('full script and parity audits persist an immutable research handoff',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.body.script_status,'READY_FOR_AGENT07');const w=r.writes.find(w=>w.table==='script_dossiers');assert.equal(w.action,'insert');assert.equal(w.value.dossier.agent07_handoff.publishing_allowed,false);assert.equal(r.writes.some(w=>['content_items','content_strategy_reports','medical_safety_reports'].includes(w.table)),false)});
test('unsafe initial script is revised automatically',async()=>{const r=await run({unsafe:true});assert.equal(r.status,200);assert.equal(r.generation,2);assert.equal(r.body.script_status,'READY_FOR_AGENT07')});
test('audit failure causes rewrite and full independent recheck',async()=>{const r=await run({auditRevision:true});assert.equal(r.status,200);assert.equal(r.generation,2);assert.equal(r.body.script_status,'READY_FOR_AGENT07');const drafts=r.prompts.filter(p=>p.brief);assert.equal(drafts[0].previous_draft,null);assert.deepEqual(drafts[1].previous_draft,raw());assert.match(drafts[1].feedback,/REVISE/)});
test('parity failure is recorded as revision and never hands off',async()=>{const r=await run({parityFail:true});assert.equal(r.status,200);assert.equal(r.generation,2);assert.equal(r.body.script_status,'REVISION_REQUIRED');assert.equal(r.writes.find(w=>w.table==='script_dossiers').value.dossier.agent07_handoff,null)});
test('truncated model response never persists dossier',async()=>{const r=await run({truncated:true});assert.equal(r.status,500);assert.equal(r.network,2);assert.equal(r.writes.some(w=>w.table==='script_dossiers'),false)});
test('HOLD changed during execution prevents persistence',async()=>{const r=await run({holdAfter:true});assert.equal(r.status,500);assert.equal(r.writes.some(w=>w.table==='script_dossiers'),false)});
