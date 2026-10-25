import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {buildResearchDecision,normalize,POLICY_VERSION} from './review-policy.mjs';
import {parseAbstracts,fetchEvidence} from '../medical-research/evidence-utils.mjs';
const id='a57addc0-023c-430b-bd44-871393a5da10';
const abstract='Adults showed an association between activity and sleep; this observational study does not establish causality.';
async function run({authorized=true,missing=false,hold=false,action='REVIEW',truncated=false,badQuote=false}={}){
 const writes=[],filters=[];let handler;let network=0;
 const dossier={evidence_sources:[{source_id:'PMID:1',title:'Activity and sleep'}],medical_claims:[1,2,3].map(n=>({claim_id:'C'+n,statement:'Association only',source_ids:['PMID:1'],verification_status:'UNVERIFIED'})),evidence_gaps:[]};
 const base={medical_research_dossiers:missing?null:{id,content_item_id:'item-1',topic_brief_version:6,dossier},content_items:{id:'item-1',hold},llm_settings:{provider:'deepseek',model:'deepseek-flash'},agent_executions:{id:'run-1'},medical_research_reviews:{id:'review-1'}};
 const admin={auth:{getUser:async()=>({data:{user:authorized?{id:'owner-1'}:null}})},from(table){const q={select(){return q},eq(k,v){filters.push({table,k,v});return q},order(){return q},limit(){return q},insert(value){writes.push({table,action:'insert',value});return q},update(value){writes.push({table,action:'update',value});return q},maybeSingle:async()=>({data:base[table]}),single:async()=>({data:base[table]}),then(resolve){resolve({data:[],error:null})}};return q}};
 const mockFetch=async(url,opts)=>{
  network++;const u=new URL(url);
  if(u.pathname.endsWith('esummary.fcgi'))return Response.json({result:{1:{title:'Activity and sleep'}}});
  if(u.pathname.endsWith('efetch.fcgi'))return new Response('<PubmedArticle><PMID>1</PMID><AbstractText>'+abstract+'</AbstractText></PubmedArticle>');
  if(u.hostname==='api.deepseek.com')return Response.json({usage:{total_tokens:123},choices:[{finish_reason:truncated?'length':'stop',message:{content:JSON.stringify({claims:dossier.medical_claims.map(c=>({claim_id:c.claim_id,verdict:'SUPPORTED',applicability:'DIRECT',rationale:'Association in abstract',limitation:'Observational; not clinical approval',evidence_quotes:[{source_id:'PMID:1',quote:badQuote?'A fabricated supporting passage that does not exist.':abstract}]}))})}}]});
  throw Error('Unexpected URL');
 };
 const code=stripTypeScriptTypes(readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
 vm.runInNewContext(code,{createClient:()=>admin,buildResearchDecision,normalize,POLICY_VERSION,parseAbstracts,fetchEvidence:(url,opts)=>fetchEvidence(url,opts,{fetcher:mockFetch,sleep:async()=>{}}),fetch:mockFetch,Request,Response,URLSearchParams,AbortSignal,TextEncoder,crypto:webcrypto,Date,Deno:{env:{get:()=> 'test-value'},serve:fn=>handler=fn}});
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,dossier_id:id})}));
 return {status:response.status,body:await response.json(),writes,filters,network};
}
test('review handler rejects unauthenticated calls without network/writes',async()=>{const r=await run({authorized:false});assert.equal(r.status,401);assert.equal(r.network,0);assert.equal(r.writes.length,0)});
test('review handler rejects missing/other-owner dossier before paid work',async()=>{const r=await run({missing:true});assert.equal(r.status,404);assert.equal(r.network,0);assert.ok(r.filters.some(x=>x.table==='medical_research_dossiers'&&x.k==='owner_id'&&x.v==='owner-1'))});
test('review handler enforces HOLD',async()=>{const r=await run({hold:true});assert.equal(r.status,409);assert.equal(r.network,0);assert.equal(r.writes.length,0)});
test('read-only review lookup never spends tokens',async()=>{const r=await run({action:'GET_REVIEW'});assert.equal(r.status,200);assert.equal(r.network,0);assert.equal(r.writes.length,0);assert.ok(r.filters.some(x=>x.table==='medical_research_reviews'&&x.k==='owner_id'))});
test('end-to-end mocked review persists scoped research approval, hash and handoff without changing dossier/content',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.body.review.findings.status,'APPROVED_FOR_RESEARCH');assert.equal(r.body.review.findings.clinical_approval,false);assert.equal(r.body.review.findings.handoff.claims.length,3);assert.equal(r.body.review.findings.handoff.sources.length,1);assert.equal(r.body.review.findings.dossier_sha256.length,64);assert.equal(r.writes.filter(w=>['content_items','medical_research_dossiers'].includes(w.table)).length,0);assert.equal(r.writes.at(-1).value.status,'COMPLETED')});
test('fabricated support produces revision, never approval',async()=>{const r=await run({badQuote:true});assert.equal(r.status,200);assert.equal(r.body.review.decision,'REQUEST_REVISION');assert.equal(r.body.review.findings.handoff,null)});
test('truncated review fails without persisting review approval',async()=>{const r=await run({truncated:true});assert.equal(r.status,500);assert.equal(r.writes.filter(w=>w.table==='medical_research_reviews').length,0);assert.equal(r.writes.at(-1).value.status,'FAILED')});
