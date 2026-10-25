export const POLICY_VERSION='research-evidence-v1';
export const normalize = x => String(x||'').normalize('NFKC').replace(/<[^>]+>/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
export function buildResearchDecision(dossier, liveSources, modelReview) {
 const claims=dossier?.medical_claims;
 if(!Array.isArray(claims)||!claims.length)throw Error('No claims to review');
 if(!Array.isArray(modelReview?.claims))throw Error('Invalid review contract');
 const sourceMap=new Map(liveSources.map(s=>[s.source_id,s]));
 const originalMap=new Map((dossier.evidence_sources||[]).map(s=>[s.source_id,s]));
 const seen=new Set();
 for(const r of modelReview.claims){if(!r||typeof r.claim_id!=='string'||seen.has(r.claim_id)||!claims.some(c=>c.claim_id===r.claim_id))throw Error('Duplicate or unknown reviewed claim');seen.add(r.claim_id);}
 if(seen.size!==claims.length)throw Error('Every claim must be reviewed');
 const results=claims.map(c=>{
  const r=modelReview.claims.find(x=>x.claim_id===c.claim_id);
  const ids=Array.isArray(c.source_ids)?c.source_ids:[];
  const cited=ids.map(id=>sourceMap.get(id));
  const identity=ids.length>0&&cited.every((s,i)=>s&&s.identity_verified===true&&normalize(s.title)===normalize(originalMap.get(ids[i])?.title)&&!s.retracted);
  const abstracts=identity&&cited.every(s=>typeof s.abstract_text==='string'&&s.abstract_text.trim().length>0);
  const quotes=Array.isArray(r.evidence_quotes)?r.evidence_quotes:[];
  const quotesValid=abstracts&&quotes.length>0&&quotes.every(q=>ids.includes(q.source_id)&&normalize(q.quote).length>=25&&normalize(sourceMap.get(q.source_id)?.abstract_text).includes(normalize(q.quote)))&&ids.every(id=>quotes.some(q=>q.source_id===id));
  const supported=r.verdict==='SUPPORTED'&&['DIRECT','LIMITED'].includes(r.applicability)&&typeof r.rationale==='string'&&r.rationale.trim().length>0&&typeof r.limitation==='string'&&r.limitation.trim().length>0;
  const reason=!identity?'SOURCE_IDENTITY_FAILED':!abstracts?'ABSTRACT_UNAVAILABLE':!quotesValid?'EVIDENCE_QUOTE_FAILED':!supported?'CLAIM_SUPPORT_OR_APPLICABILITY_FAILED':null;
  return {claim_id:c.claim_id,accepted:!reason,reason,identity_pass:identity,abstract_pass:abstracts,quote_pass:quotesValid,verdict:r.verdict,applicability:r.applicability,rationale:String(r.rationale||''),limitation:String(r.limitation||''),evidence_quotes:quotesValid?quotes:[]};
 });
 const accepted=results.filter(r=>r.accepted), excluded=results.filter(r=>!r.accepted);
 // Review policy approves a scoped evidence packet, never the original clinical claims.
 // At least 80% supported coverage and at least 3 claims prevents a token subset approval.
 const coverage=accepted.length/results.length;
 const pass=accepted.length>=Math.min(3,results.length)&&coverage>=0.8;
 const percent=n=>Math.round(n/results.length*100);
 return {policy_version:POLICY_VERSION,approval_scope:'RESEARCH_ONLY',clinical_approval:false,publishing_allowed:false,
  status:pass?(excluded.length?'APPROVED_FOR_RESEARCH_WITH_EXCLUSIONS':'APPROVED_FOR_RESEARCH'):'REVISION_REQUIRED',
  decision:pass?'APPROVED':'REQUEST_REVISION',research_handoff_allowed:pass,
  metrics:{claims_total:results.length,accepted_claims:accepted.length,excluded_claims:excluded.length,source_identity_percent:percent(results.filter(r=>r.identity_pass).length),abstract_coverage_percent:percent(results.filter(r=>r.abstract_pass).length),verified_quote_percent:percent(results.filter(r=>r.quote_pass).length),supported_claim_percent:percent(accepted.length),minimum_supported_percent:80},
  claims:results,accepted_claim_ids:pass?accepted.map(r=>r.claim_id):[],excluded_claim_ids:excluded.map(r=>r.claim_id),
  handoff:pass?{target:'AGENT_03',mode:'RESEARCH_ANALYSIS_ONLY',claims:claims.filter(c=>accepted.some(r=>r.claim_id===c.claim_id)),source_ids:[...new Set(claims.filter(c=>accepted.some(r=>r.claim_id===c.claim_id)).flatMap(c=>c.source_ids))],evidence_gaps:dossier.evidence_gaps||[],constraints:['Original claims remain UNVERIFIED; automated abstract-support review is not independent clinical verification.','Preserve population, age, observational-design and evidence-gap caveats.','No prescribing, medical approval, publishing, or automatic clinical workflow advancement.']}:null};
}

export function buildExtractiveRevision(dossier, findings, reviewId) {
 if(findings.status!=='REVISION_REQUIRED'||(dossier.revision_lineage?.auto_revision_count||0)>=1)return null;
 const rejected=findings.claims.filter(c=>!c.accepted);
 if(!rejected.length||rejected.some(c=>!c.identity_pass||!c.abstract_pass||!c.quote_pass||!c.evidence_quotes.length))return null;
 const claims=dossier.medical_claims.map(c=>{
  const issue=rejected.find(r=>r.claim_id===c.claim_id);if(!issue)return {...c};
  return {...c,statement:issue.evidence_quotes.map(q=>`${q.source_id} reports: “${q.quote}”`).join(' '),caveats:[c.caveats,issue.limitation,'Extractive source quotation; no additional causal or population inference.'].filter(Boolean).join(' '),verification_status:'UNVERIFIED',evidence_strength:'UNKNOWN',revision_reason:issue.rationale};
 });
 return {...dossier,medical_claims:claims,medical_summary:'Source-linked research revision. Preserve study populations, original evidence gaps and caveats. Corrected claims quote the supplied abstracts directly; automated support review is still required.',research_status:'NEEDS_SOURCE_VERIFICATION',research_confidence:'LOW',requires_medical_review:true,agent03_handoff_allowed:false,recommended_next_step:'AUTOMATED_RESEARCH_EVIDENCE_REVIEW',revision_lineage:{parent_review_id:reviewId,auto_revision_count:1,changed_claim_ids:rejected.map(c=>c.claim_id),method:'EXTRACTIVE_SOURCE_CORRECTION'}};
}
