import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {approvedPacket,validateAnalysis,assessAnalysis,DOMAINS} from './analysis-policy.mjs';
import {packet,raw} from './fixtures.mjs';
const reviewId='2e22c376-9002-4f7b-aa26-96c6889caa8b';
async function run({authorized=true,missing=false,hold=false,approved=true,badHash=false,superseded=false,action='RUN',unsupported=false,unsafeFirst=false,holdAfter=false,truncated=false}={}){
 const dossier={medical_claims:packet.claims,evidence_sources:packet.sources};
 const hash=[...new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(dossier))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const review={id:reviewId,dossier_id:'dossier-1',content_item_id:'item-1',decision:approved?'APPROVED':'REQUEST_REVISION',review_source:'AUTOMATED_RESEARCH_EVIDENCE',findings:{status:'APPROVED_FOR_RESEARCH',approval_scope:'RESEARCH_ONLY',research_handoff_allowed:true,clinical_approval:false,publishing_allowed:false,dossier_sha256:badHash?'wrong':hash,accepted_claim_ids:['C1','C2','C3'],execution_id:'review-execution',handoff:packet}};
 const writes=[],filters=[];let handler,network=0,generation=0,contentReads=0;
 const base={medical_research_dossiers:{id:'dossier-1',topic_brief_version:1,dossier},topic_briefs:{raw_output:{target_audience:'Adults'},topic_summary:'Routine'},llm_settings:{provider:'deepseek',model:'deepseek-flash'},integrative_analysis_dossiers:{id:'analysis-1'}};
 const admin={auth:{getUser:async()=>({data:{user:authorized?{id:'owner-1'}:null}})},from(table){let inserted=false;const q={select(){return q},eq(k,v){filters.push({table,k,v});return q},order(){return q},limit(){return q},insert(value){inserted=true;writes.push({table,action:'insert',value});return q},update(value){writes.push({table,action:'update',value});return q},maybeSingle:async()=>{
  if(table==='content_items')return {data:{id:'item-1',topic:'Routine',hold:hold||(holdAfter&&++contentReads>1)}};
  if(table==='medical_research_reviews')return {data:missing?null:{...review,id:superseded&&filters.filter(x=>x.table===table&&x.k==='dossier_id').length?'newer-review':reviewId}};
  if(table==='agent_executions')return {data:{id:'review-execution',status:'COMPLETED',agent_code:'AGENT_02_EVIDENCE_REVIEW',output:{review_id:reviewId}}};
  return {data:base[table]};
 },single:async()=>({data:table==='agent_executions'&&inserted?{id:'execution-1'}:base[table]}),then(resolve){resolve({data:[],error:null})}};return q}};
 const mockFetch=async(url,options)=>{network++;const body=JSON.parse(options.body);assert.equal(body.thinking.type,'disabled');assert.equal(body.response_format.type,'json_object');const isAudit=body.messages[0].content.includes('independent evidence-support');let output;
  if(isAudit)output={findings:JSON.parse(body.messages[1].content).findings.map(f=>({id:f.id,verdict:unsupported?'UNSUPPORTED':'SUPPORTED',reason:unsupported?'Not supported':'Matches accepted evidence'}))};
  else{generation++;output=raw();if(unsafeFirst&&generation===1)output.sections[1].findings[0].statement='Take 50 mg daily.';}
  return Response.json({usage:{total_tokens:100},choices:[{finish_reason:truncated?'length':'stop',message:{content:JSON.stringify(output)}}]});
 };
 const code=stripTypeScriptTypes(readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
 vm.runInNewContext(code,{createClient:()=>admin,approvedPacket,validateAnalysis,assessAnalysis,DOMAINS,crypto:webcrypto,TextEncoder,Date,Request,Response,AbortSignal,fetch:mockFetch,Deno:{env:{get:()=> 'test-only'},serve:fn=>handler=fn}});
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,review_id:reviewId,content_id:'HT-0003'})}));return {status:response.status,body:await response.json(),writes,filters,network,generation};
}
test('Agent03 authentication rejects before spending/writing',async()=>{const r=await run({authorized:false});assert.equal(r.status,401);assert.equal(r.network,0);assert.equal(r.writes.length,0)});
test('other-owner/missing review cannot leak or run',async()=>{const r=await run({missing:true});assert.equal(r.status,404);assert.equal(r.network,0);assert.ok(r.filters.some(f=>f.table==='medical_research_reviews'&&f.k==='owner_id'&&f.v==='owner-1'))});
test('unapproved, tampered or superseded packets fail before paid calls',async()=>{for(const options of [{approved:false},{badHash:true},{superseded:true}]){const r=await run(options);assert.ok([409,422].includes(r.status));assert.equal(r.network,0);assert.equal(r.writes.length,0)}});
test('HOLD rejects Agent03 execution',async()=>{const r=await run({hold:true});assert.equal(r.status,409);assert.equal(r.network,0)});
test('LIST is owner scoped and never spends tokens',async()=>{const r=await run({action:'LIST'});assert.equal(r.status,200);assert.equal(r.network,0);assert.ok(r.filters.some(f=>f.table==='integrative_analysis_dossiers'&&f.k==='owner_id'))});
test('full analysis and separate audit save immutable dossier plus Agent04 input',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.body.analysis_status,'READY_FOR_AGENT04');assert.equal(r.network,2);const w=r.writes.find(w=>w.table==='integrative_analysis_dossiers');assert.equal(w.action,'insert');assert.equal(w.value.dossier.agent04_handoff.clinical_approval,false);assert.equal(w.value.input_sha256.length,64);assert.equal(r.writes.some(w=>['content_items','medical_research_dossiers','medical_research_reviews'].includes(w.table)),false)});
test('invalid first attempt is repaired in bounded iteration',async()=>{const r=await run({unsafeFirst:true});assert.equal(r.status,200);assert.equal(r.generation,2);assert.equal(r.body.analysis_status,'READY_FOR_AGENT04')});
test('unsupported second audit never releases Agent04 handoff',async()=>{const r=await run({unsupported:true});assert.equal(r.status,200);assert.equal(r.generation,2);assert.equal(r.body.analysis_status,'REVISION_REQUIRED');assert.equal(r.writes.find(w=>w.table==='integrative_analysis_dossiers').value.dossier.agent04_handoff,null)});
test('HOLD changed during run prevents artifact persistence',async()=>{const r=await run({holdAfter:true});assert.equal(r.status,500);assert.equal(r.writes.filter(w=>w.table==='integrative_analysis_dossiers').length,0);assert.equal(r.writes.at(-1).value.status,'FAILED')});

test('truncated responses exhaust bounded retries without saving an analysis',async()=>{const r=await run({truncated:true});assert.equal(r.status,500);assert.equal(r.network,2);assert.equal(r.writes.some(w=>w.table==='integrative_analysis_dossiers'),false);assert.equal(r.writes.at(-1).value.status,'FAILED')});
