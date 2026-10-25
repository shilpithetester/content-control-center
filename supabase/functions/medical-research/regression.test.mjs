import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { parseAbstracts, fetchEvidence } from './evidence-utils.mjs';
import { validateClaims, handoffAllowed, validateSourceLimit } from './safety-gate.mjs';

test('empty citation array is rejected', () => assert.throws(() => validateClaims({ medical_summary:'x', medical_claims:[{statement:'x',source_ids:[]}] }, [{source_id:'PMID:1'}])));
test('empty claims cannot approve handoff', () => assert.equal(handoffAllowed({ research_status:'APPROVED_FOR_HANDOFF', requires_medical_review:false, medical_claims:[] }), false));
test('empty claims cannot become a completed research draft', () => assert.throws(() => validateClaims({medical_summary:'x',medical_claims:[]}, [{source_id:'PMID:1'}])));
test('boolean is not a source limit', () => assert.throws(() => validateSourceLimit(true)));

export async function harness({body, authorized=true, hold=false, fetchImpl=async()=>{throw Error('unexpected network')}, dataOverrides={}}={}) {
  const writes=[];
  const filters=[];
  let handler;
  const base={content_items:{id:'item-1',topic:'Healthy Daily Routine',hold},topic_briefs:{research_questions:['What helps healthy adults?'],search_queries:['healthy adults routine']},llm_settings:{provider:'deepseek',model:'deepseek-chat'},agent_executions:{id:'execution-1'},medical_research_dossiers:{id:'dossier-1',created_at:'2026-10-25'}};
  const client={auth:{getUser:async()=>({data:{user:authorized?{id:'owner-1'}:null},error:null})},from(table){
    const q={select(){return q},eq(column,value){filters.push({table,column,value});return q},order(){return q},limit(){return q},insert(value){writes.push({table,action:'insert',value});return q},update(value){writes.push({table,action:'update',value});return q},maybeSingle:async()=>({data:Object.hasOwn(dataOverrides,table)?dataOverrides[table]:base[table],error:null}),single:async()=>({data:base[table],error:null}),then(resolve){resolve({data:[],error:null})}};return q;
  }};
  let source=readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  source=stripTypeScriptTypes(source);
  const ctx={createClient:()=>client,validateClaims,validateSourceLimit,parseAbstracts,fetchEvidence:(url,opts)=>fetchEvidence(url,opts,{fetcher:fetchImpl,sleep:async()=>{}}),AbortSignal,Request,Response,URLSearchParams,AbortController,setTimeout,clearTimeout,console,fetch:fetchImpl,Deno:{env:{get:(key)=>key==='DEEPSEEK_API_KEY'?'test-key':'test'},serve:fn=>{handler=fn}}};
  vm.runInNewContext(source,ctx);
  const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify(body === undefined ? {} : body)}));
  return {status:response.status,body:await response.json(),writes,filters};
}
const valid={content_id:'HT-0002',topic_brief_version:6,contract_version:1,research_mode:'EVIDENCE_FIRST',max_sources:12};
test('unauthorized request never calls research or writes',async()=>{const r=await harness({body:valid,authorized:false});assert.equal(r.status,401);assert.equal(r.writes.length,0)});
test('HOLD rejects execution before writes',async()=>{const r=await harness({body:valid,hold:true});assert.equal(r.status,409);assert.equal(r.writes.length,0)});
test('unsupported contract is rejected before writes',async()=>{const r=await harness({body:{...valid,contract_version:2}});assert.equal(r.status,400);assert.equal(r.writes.length,0)});
test('calendar overflow date rejected before writes',async()=>{const r=await harness({body:{...valid,evidence_cutoff_date:'2026-02-31'}});assert.equal(r.status,400);assert.equal(r.writes.length,0)});
test('null request returns validation error',async()=>{const r=await harness({body:null});assert.equal(r.status,400);assert.equal(r.writes.length,0)});
test('upstream outage fails execution without storing dossier',async()=>{const r=await harness({body:valid});assert.equal(r.status,500);assert.equal(r.writes.filter(x=>x.table==='medical_research_dossiers').length,0);assert.equal(r.writes.at(-1).value.status,'FAILED')});

function mockResearch({abstract=true,unknownCitation=false,truncated=false}={}) {
 let searches=0;let modelCalls=0;
 const fetchImpl=async(url,options)=>{
  const u=new URL(url);
  if(u.pathname.endsWith('esearch.fcgi'))return Response.json({esearchresult:{idlist:[String(++searches)]}});
  if(u.pathname.endsWith('esummary.fcgi')){const id=u.searchParams.get('id');return Response.json({result:{[id]:{title:'Healthy adult routine systematic review '+id,authors:[],pubdate:'2025',pubtype:['Systematic Review']}}})}
  if(u.pathname.endsWith('efetch.fcgi'))return new Response('<PubmedArticleSet>'+u.searchParams.get('id').split(',').map(id=>'<PubmedArticle><PMID>'+id+'</PMID>'+(abstract?'<Abstract><AbstractText>Healthy adult routines were studied. Evidence is limited.</AbstractText></Abstract>':'')+'</PubmedArticle>').join('')+'</PubmedArticleSet>');
  if(u.hostname==='api.deepseek.com'){
   modelCalls++;const sent=JSON.parse(options.body);const context=JSON.parse(sent.messages[1].content);assert.ok(context.sources.every(x=>x.abstract_text));
   return Response.json({choices:[{finish_reason:truncated?'length':'stop',message:{content:JSON.stringify({medical_summary:'Draft research only',medical_claims:[{statement:'Evidence remains limited.',source_ids:[unknownCitation?'PMID:999':context.sources[0].source_id],verification_status:'VERIFIED',evidence_strength:'HIGH'}]})}}]});
  }throw Error('unexpected URL');
 };return {fetchImpl,get modelCalls(){return modelCalls}};
}
test('end-to-end draft persists sources and unverified claims, without approving content',async()=>{
 const mock=mockResearch();const r=await harness({body:valid,fetchImpl:mock.fetchImpl});assert.equal(r.status,200);assert.equal(r.body.source_count,6);assert.equal(mock.modelCalls,1);
 const d=r.writes.find(x=>x.table==='medical_research_dossiers').value.dossier;
 assert.equal(d.agent03_handoff_allowed,false);assert.equal(d.requires_medical_review,true);assert.equal(d.medical_claims[0].verification_status,'UNVERIFIED');assert.equal(d.recommended_next_step,'MANUAL_SOURCE_VERIFICATION');assert.ok(d.evidence_sources.every(x=>x.abstract_text));
 assert.equal(r.writes.filter(x=>['content_items','topic_briefs','pb_tasks'].includes(x.table)).length,0);assert.equal(r.writes.at(-1).value.status,'COMPLETED');
});
test('no abstracts blocks model spend and dossier persistence',async()=>{const mock=mockResearch({abstract:false});const r=await harness({body:valid,fetchImpl:mock.fetchImpl});assert.equal(r.status,500);assert.equal(mock.modelCalls,0);assert.equal(r.writes.filter(x=>x.table==='medical_research_dossiers').length,0)});
test('invented citation fails closed',async()=>{const mock=mockResearch({unknownCitation:true});const r=await harness({body:valid,fetchImpl:mock.fetchImpl});assert.equal(r.status,500);assert.equal(r.writes.at(-1).value.status,'FAILED');assert.equal(r.writes.filter(x=>x.table==='medical_research_dossiers').length,0)});
test('truncated model response fails closed',async()=>{const mock=mockResearch({truncated:true});const r=await harness({body:valid,fetchImpl:mock.fetchImpl});assert.equal(r.status,500);assert.equal(r.writes.filter(x=>x.table==='medical_research_dossiers').length,0)});
test('coverage audit counts only sources actually retained by budget',async()=>{const mock=mockResearch();const r=await harness({body:{...valid,max_sources:1},fetchImpl:mock.fetchImpl});assert.equal(r.status,200);const d=r.writes.find(x=>x.table==='medical_research_dossiers').value.dossier;assert.equal(Object.values(d.retrieval_audit).reduce((n,x)=>n+x.selected,0),1);assert.ok(d.evidence_gaps.length>=5)});

// Ownership and immutable-input regressions. These assert request predicates as well as outcomes.
test('unknown or other-owner content is rejected before execution',async()=>{
 const r=await harness({body:valid,dataOverrides:{content_items:null}});
 assert.equal(r.status,404);assert.equal(r.writes.length,0);
 assert.ok(r.filters.some(x=>x.table==='content_items'&&x.column==='owner_id'&&x.value==='owner-1'));
});
test('dossier reads are scoped to authenticated owner and resolved content UUID',async()=>{
 const r=await harness({body:{action:'LIST_DOSSIERS',content_id:'HT-0002'}});
 assert.equal(r.status,200);assert.equal(r.writes.length,0);
 for(const table of ['content_items','medical_research_dossiers'])assert.ok(r.filters.some(x=>x.table===table&&x.column==='owner_id'&&x.value==='owner-1'));
 assert.ok(r.filters.some(x=>x.table==='medical_research_dossiers'&&x.column==='content_item_id'&&x.value==='item-1'));
});
test('dossier read cannot disclose other-owner content',async()=>{
 const r=await harness({body:{action:'LIST_DOSSIERS',content_id:'HT-0002'},dataOverrides:{content_items:null}});
 assert.equal(r.status,404);assert.equal(r.writes.length,0);
});
test('missing immutable brief version rejects before paid work',async()=>{
 const r=await harness({body:valid,dataOverrides:{topic_briefs:null}});
 assert.equal(r.status,404);assert.equal(r.writes.length,0);
 assert.ok(r.filters.some(x=>x.table==='topic_briefs'&&x.column==='version'&&x.value===6));
 assert.ok(r.filters.some(x=>x.table==='topic_briefs'&&x.column==='owner_id'&&x.value==='owner-1'));
});
test('brief without queries is rejected',async()=>{const r=await harness({body:valid,dataOverrides:{topic_briefs:{research_questions:['x'],search_queries:[]}}});assert.equal(r.status,422);assert.equal(r.writes.length,0)});
test('wrong provider rejects before execution',async()=>{const r=await harness({body:valid,dataOverrides:{llm_settings:{provider:'other'}}});assert.equal(r.status,422);assert.equal(r.writes.length,0)});
test('future evidence cutoff rejected',async()=>{const r=await harness({body:{...valid,evidence_cutoff_date:'2999-01-01'}});assert.equal(r.status,400);assert.equal(r.writes.length,0)});
test('array request rejected',async()=>{const r=await harness({body:[]});assert.equal(r.status,400);assert.equal(r.writes.length,0)});
test('repeated PMID across domains is stored once',async()=>{
 const mock=mockResearch();const fetchImpl=(url,options)=>new URL(url).pathname.endsWith('esearch.fcgi')?Promise.resolve(Response.json({esearchresult:{idlist:['1']}})):mock.fetchImpl(url,options);
 const r=await harness({body:valid,fetchImpl});assert.equal(r.status,200);assert.equal(r.body.source_count,1);
 const dossierWrites=r.writes.filter(x=>x.table==='medical_research_dossiers');assert.equal(dossierWrites.length,1);assert.equal(dossierWrites[0].action,'insert');
});
test('invalid model JSON fails without dossier',async()=>{
 const mock=mockResearch();const fetchImpl=(url,options)=>new URL(url).hostname==='api.deepseek.com'?Promise.resolve(Response.json({choices:[{finish_reason:'stop',message:{content:'{invalid'}}]})):mock.fetchImpl(url,options);
 const r=await harness({body:valid,fetchImpl});assert.equal(r.status,500);assert.equal(r.writes.filter(x=>x.table==='medical_research_dossiers').length,0);assert.equal(r.writes.at(-1).value.status,'FAILED');
});
