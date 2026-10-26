import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {inputPacket,assessBatch,validateRevision,report,AXES,POLICY_VERSION,norm} from './safety-policy.mjs';
import {approvedPacket} from '../integrative-analysis/analysis-policy.mjs';
import {claims,sources,findings,packet} from './fixtures.mjs';
const id='5d45477b-eef6-4dc1-b189-b6be6475793b';
async function run({authorized=true,missing=false,hold=false,holdAfter=false,stale=false,badHash=false,action='RUN',truncated=false,revise=false,sourceBad=false,wrongRelation=false}={}){
 const hash=async x=>[...new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(x))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const parent={id:'parent',topic_brief_version:6,dossier:{claims}};
 const accepted={claims,sources};const review={id:'review',dossier_id:wrongRelation?'other':'parent',content_item_id:'content',decision:'APPROVED',review_source:'AUTOMATED_RESEARCH_EVIDENCE',findings:{status:'APPROVED_FOR_RESEARCH',approval_scope:'RESEARCH_ONLY',research_handoff_allowed:true,clinical_approval:false,publishing_allowed:false,dossier_sha256:await hash(parent.dossier),execution_id:'review-origin',accepted_claim_ids:claims.map(c=>c.claim_id),handoff:accepted}};
 const record={id,content_item_id:'content',execution_id:'origin',research_review_id:'review',research_dossier_id:'parent',input_sha256:badHash?'bad':await hash({review_id:'review',packet:accepted,topic_brief_version:6}),analysis_status:'READY_FOR_AGENT04',dossier:{analysis_status:'READY_FOR_AGENT04',approval_scope:'RESEARCH_ONLY',clinical_approval:false,publishing_allowed:false,sections:findings.map(f=>({domain:f.domain,findings:[f]})),agent04_handoff:{accepted_input_claims:claims,sources,context:packet.context},evidence_gaps:packet.evidence_gaps}};
 const writes=[],filters=[];let handler,network=0,reads=0,audits=0;
 const db={auth:{getUser:async()=>({data:{user:authorized?{id:'owner'}:null}})},from(table){let selection='',currentFilters=[];const q={select(s){selection=s;return q},eq(k,v){filters.push({table,k,v});currentFilters.push({k,v});return q},order(){return q},limit(){return q},insert(value){writes.push({table,action:'insert',value});return q},update(value){writes.push({table,action:'update',value});return q},maybeSingle:async()=>{
 if(table==='content_items')return {data:{id:'content',hold:hold||(holdAfter&&++reads>1)}};
 if(table==='integrative_analysis_dossiers')return {data:missing?null:selection==='id'?{id:stale?'newer':id}:record};
 if(table==='medical_research_reviews')return {data:review};
 if(table==='medical_research_dossiers')return {data:parent};
 if(table==='agent_executions'){const reviewOrigin=currentFilters.some(f=>f.k==='id'&&f.v==='review-origin');return {data:{status:'COMPLETED',agent_code:reviewOrigin?'AGENT_02_EVIDENCE_REVIEW':'AGENT_03',output:reviewOrigin?{review_id:'review'}:{analysis_id:id}}}}
 if(table==='llm_settings')return {data:{provider:'deepseek',model:'deepseek-flash'}};
 return {data:null};},single:async()=>({data:{id:table==='agent_executions'?'safety-execution':'safety-report'}}),then(resolve){resolve({data:[],error:null})}};return q}};
 const mockFetch=async(url,options)=>{network++;const b=JSON.parse(options.body);assert.equal(b.thinking.type,'disabled');const input=JSON.parse(b.messages[1].content);let out;
 if(b.messages[0].content.includes('You revise'))out={findings:input.findings.map(f=>({id:f.id,statement:f.statement}))};
 else{audits++;out={findings:input.findings.map((f,i)=>({id:f.id,decision:revise&&audits===1&&i===0?'REVISE':'PASS',reason:'Supported with original caveats',checks:Object.fromEntries(AXES.map(k=>[k,'PASS']))}))};}
 return Response.json({usage:{total_tokens:10},choices:[{finish_reason:truncated?'length':'stop',message:{content:JSON.stringify(out)}}]});};
 const fetchEvidence=async url=>url.includes('esummary')?Response.json({result:Object.fromEntries(sources.map(s=>[s.source_id.slice(5),{title:sourceBad?'wrong':s.title,pubtype:[],pubdate:'2026'}]))}):new Response('xml');
 const code=stripTypeScriptTypes(readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
 vm.runInNewContext(code,{createClient:()=>db,inputPacket,assessBatch,validateRevision,report,AXES,POLICY_VERSION,norm,approvedPacket,fetchEvidence,parseAbstracts:()=>new Map(sources.map(s=>[s.source_id,s.abstract_text])),crypto:webcrypto,TextEncoder,Date,Request,Response,URLSearchParams,AbortSignal,fetch:mockFetch,Deno:{env:{get:()=> 'test-only'},serve:fn=>handler=fn}});
 const r=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,analysis_id:id,content_id:'HT-0002'})}));return {status:r.status,body:await r.json(),writes,filters,network,audits};
}
test('unauthenticated and missing/other-owner analysis spend nothing',async()=>{for(const args of [{authorized:false},{missing:true}]){const r=await run(args);assert.ok([401,404].includes(r.status));assert.equal(r.network,0);assert.equal(r.writes.length,0)}});
test('owner filters applied to analysis and report LIST has no paid call',async()=>{const r=await run({action:'LIST'});assert.equal(r.status,200);assert.equal(r.network,0);assert.ok(r.filters.some(f=>f.table==='medical_safety_reports'&&f.k==='owner_id'&&f.v==='owner'))});
test('HOLD, stale input and tampered hash rejected before paid calls',async()=>{for(const args of [{hold:true},{stale:true},{badHash:true}]){const r=await run(args);assert.ok([409,422].includes(r.status));assert.equal(r.network,0);assert.equal(r.writes.length,0)}});
test('full audit persists append-only research report and Agent05 packet',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.body.safety_status,'READY_FOR_AGENT05');const w=r.writes.find(w=>w.table==='medical_safety_reports');assert.equal(w.action,'insert');assert.equal(w.value.report.agent05_handoff.publishing_allowed,false);assert.equal(r.writes.some(w=>['content_items','integrative_analysis_dossiers','medical_research_dossiers'].includes(w.table)),false)});
test('revision is automatic and independently rechecked before release',async()=>{const r=await run({revise:true});assert.equal(r.status,200);assert.equal(r.audits,2);assert.equal(r.network,3);const report=r.writes.find(w=>w.table==='medical_safety_reports').value.report;assert.equal(report.iterations[0].passed,2);assert.equal(report.iterations[1].passed,3)});
test('fresh source mismatch fails before model calls',async()=>{const r=await run({sourceBad:true});assert.equal(r.status,500);assert.equal(r.network,0);assert.equal(r.writes.at(-1).value.status,'FAILED')});
test('truncated audit cannot persist a report',async()=>{const r=await run({truncated:true});assert.equal(r.status,500);assert.equal(r.network,2);assert.equal(r.writes.some(w=>w.table==='medical_safety_reports'),false)});
test('HOLD during execution prevents report persistence',async()=>{const r=await run({holdAfter:true});assert.equal(r.status,500);assert.equal(r.writes.some(w=>w.table==='medical_safety_reports'),false)});

test('cross-dossier review relationship rejected before paid work',async()=>{const r=await run({wrongRelation:true});assert.equal(r.status,422);assert.equal(r.network,0);assert.equal(r.writes.length,0)});
