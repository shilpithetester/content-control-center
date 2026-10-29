// Run in an authenticated test environment. Never persist or print credentials.
import assert from 'node:assert/strict';
const staging='https://rfkuznuwytvcpdhmnqzg.supabase.co';
const production='https://gkiojrkdfgbnxjrnqvfc.supabase.co';
const origin=process.env.AGENT02_TEST_URL || staging;
const token=process.env.AGENT02_TEST_ACCESS_TOKEN;
const key=process.env.AGENT02_TEST_PUBLISHABLE_KEY;
const contentId=process.env.AGENT02_TEST_CONTENT_ID;
const version=Number(process.env.AGENT02_TEST_BRIEF_VERSION);
if(![staging,production].includes(origin))throw Error('Unknown test project');
if(origin===production && !process.argv.includes('--production'))throw Error('Production execution requires --production');
if(!token||!key||!/^HT-\d+$/.test(contentId||'')||!Number.isSafeInteger(version)||version<1){
 console.error('BLOCKED: authenticated test context, publishable key, content ID and immutable brief version are required. No request sent.');process.exit(2);
}
async function call(body){
 const response=await fetch(origin+'/functions/v1/medical-research',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,apikey:key},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
 const data=await response.json();if(!response.ok)throw Error('Agent 02 HTTP '+response.status);return data;
}
const before=await call({action:'LIST_DOSSIERS',content_id:contentId});
const run=await call({content_id:contentId,topic_brief_version:version,contract_version:1,research_mode:'EVIDENCE_FIRST',max_sources:12});
assert.equal(run.medical_review_required,true);assert.equal(run.research_status,'NEEDS_SOURCE_VERIFICATION');
const after=await call({action:'LIST_DOSSIERS',content_id:contentId});
const saved=after.dossiers.find(x=>x.id===run.dossier_id);assert.ok(saved,'Persisted dossier must be readable');
const d=saved.dossier;assert.equal(d.agent03_handoff_allowed,false);assert.equal(d.requires_medical_review,true);
assert.ok(d.medical_claims.length>0);assert.ok(d.medical_claims.every(c=>c.verification_status==='UNVERIFIED'));
const ids=new Set(d.evidence_sources.map(x=>x.source_id));assert.ok(d.medical_claims.every(c=>c.source_ids.length>0&&c.source_ids.every(x=>ids.has(x))));
assert.ok(d.evidence_sources.some(x=>x.abstract_text?.trim()));
console.log(JSON.stringify({result:'PASS_DRAFT_INTEGRITY_ONLY',dossier_id:run.dossier_id,source_count:run.source_count,prior_visible_dossiers:before.dossiers.length,medical_approval:'QUALIFIED_HUMAN_REVIEW_REQUIRED'}));
