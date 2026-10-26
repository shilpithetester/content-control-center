export const CONTRACT_VERSION=1;
export const DOMAINS=['conventional_care','nutrition','yoga_movement','sleep_lifestyle','naturopathy','precautions','combined_approach','evidence_gaps'];
export const norm=x=>String(x||'').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
export function approvedPacket(review,execution,currentHash){
 const f=review?.findings;
 if(review?.decision!=='APPROVED'||review?.review_source!=='AUTOMATED_RESEARCH_EVIDENCE'||!['APPROVED_FOR_RESEARCH','APPROVED_FOR_RESEARCH_WITH_EXCLUSIONS'].includes(f?.status)||f?.approval_scope!=='RESEARCH_ONLY'||f?.research_handoff_allowed!==true||f?.clinical_approval!==false||f?.publishing_allowed!==false)throw Error('Approved research handoff required');
 if(execution?.status!=='COMPLETED'||execution?.agent_code!=='AGENT_02_EVIDENCE_REVIEW'||execution?.output?.review_id!==review.id)throw Error('Research execution provenance mismatch');
 if(f.dossier_sha256!==currentHash)throw Error('Research dossier integrity mismatch');
 const p=f.handoff;if(!Array.isArray(p?.claims)||p.claims.length<1||p.claims.length>30||!Array.isArray(p.sources))throw Error('Invalid research packet');
 const allowed=new Set(f.accepted_claim_ids||[]),ids=new Set();const sources=new Map(p.sources.map(s=>[s.source_id,s]));
 for(const c of p.claims){if(!c?.claim_id||ids.has(c.claim_id)||!allowed.has(c.claim_id)||typeof c.statement!=='string'||!c.statement.trim())throw Error('Excluded/duplicate/invalid input claim');ids.add(c.claim_id);if(!Array.isArray(c.source_ids)||!c.source_ids.length||c.source_ids.some(id=>!sources.get(id)?.abstract_text))throw Error('Input citation/abstract missing');}
 return p;
}
const dangerous=s=>/\b(cures?|guaranteed|prescribe|diagnose)\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|milligrams?|tablets?)\b|\b(?:stop|discontinue|replace|increase|reduce|start|take)\b.{0,45}\b(?:medication|medicine|drug|dose)\b/i.test(s);
export function validateAnalysis(raw,packet){
 if(!Array.isArray(raw?.sections)||raw.sections.length!==DOMAINS.length)throw Error('All eight analysis sections required');
 const domains=new Set(),findingIds=new Set(),claimMap=new Map(packet.claims.map(c=>[c.claim_id,c]));
 const sections=raw.sections.map(section=>{
  if(!DOMAINS.includes(section.domain)||domains.has(section.domain))throw Error('Unknown/duplicate analysis domain');domains.add(section.domain);
  if(!Array.isArray(section.findings)||section.findings.length>4)throw Error('Invalid findings');
  const gaps=Array.isArray(section.gaps)?section.gaps.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.slice(0,600)):[];
  if(!section.findings.length&&!gaps.length)throw Error('Empty section must identify evidence gap');
  const findings=section.findings.map(f=>{
   if(typeof f.id!=='string'||!f.id.trim()||findingIds.has(f.id))throw Error('Duplicate/invalid finding ID');findingIds.add(f.id);
   if(typeof f.statement!=='string'||!f.statement.trim()||f.statement.length>900||dangerous(f.statement))throw Error('Unsafe or invalid analysis statement');
   if(!Array.isArray(f.claim_ids)||!f.claim_ids.length||f.claim_ids.some(id=>!claimMap.has(id)))throw Error('Unsupported input claim reference');
   const claims=[...new Set(f.claim_ids)].map(id=>claimMap.get(id));
   if(!Array.isArray(f.support_quotes)||!f.support_quotes.length||f.support_quotes.some(q=>!f.claim_ids.includes(q.claim_id)||norm(q.quote).length<25||!norm(claimMap.get(q.claim_id)?.statement).includes(norm(q.quote)))||f.claim_ids.some(id=>!f.support_quotes.some(q=>q.claim_id===id)))throw Error('Supporting quote mismatch');
   const context=claims.map(c=>c.statement).join(' '),numbers=f.statement.match(/\d+(?:\.\d+)?/g)||[];
   if(numbers.some(n=>!new RegExp('(?:^|[^0-9])'+n.replace('.','\\.')+'(?:$|[^0-9])').test(context)))throw Error('Invented numeric fact');
   return {id:f.id,statement:f.statement,claim_ids:[...new Set(f.claim_ids)],support_quotes:f.support_quotes,source_ids:[...new Set(claims.flatMap(c=>c.source_ids))],applicable_populations:[...new Set(claims.map(c=>c.applicable_population).filter(Boolean))],limitations:[...new Set(claims.map(c=>c.caveats).filter(Boolean))],clinical_approval:false};
  });return {domain:section.domain,findings,gaps};
 });
 const findings=sections.flatMap(s=>s.findings);if(findings.length<3||sections.filter(s=>s.findings.length).length<3)throw Error('Insufficient supported analysis coverage');
 return {contract_version:CONTRACT_VERSION,approval_scope:'RESEARCH_ONLY',clinical_approval:false,publishing_allowed:false,sections,evidence_gaps:[...(packet.evidence_gaps||[]),...sections.flatMap(s=>s.gaps)],research_requests:sections.filter(s=>s.gaps.length).map(s=>({target_agent:'AGENT_02',status:'OPEN',domain:s.domain,questions:s.gaps})),combined_effect_claim_approved:false,care_boundary:'Complementary research analysis; no medication change or replacement of conventional medical care is authorized.'};
}
export function assessAnalysis(analysis,audit){
 const findings=analysis.sections.flatMap(s=>s.findings);
 if(!Array.isArray(audit?.findings)||audit.findings.length!==findings.length)throw Error('Complete support audit required');
 const ids=new Set();for(const a of audit.findings){if(ids.has(a.id)||!findings.some(f=>f.id===a.id)||typeof a.reason!=='string'||!a.reason.trim())throw Error('Invalid audit finding');ids.add(a.id);}
 const failed=audit.findings.filter(a=>a.verdict!=='SUPPORTED');const ready=failed.length===0;
 return {...analysis,analysis_status:ready?'READY_FOR_AGENT04':'REVISION_REQUIRED',quality:{domains_covered:analysis.sections.length,findings_total:findings.length,supported_findings:findings.length-failed.length,support_percent:Math.round((findings.length-failed.length)/findings.length*100),required_support_percent:100,citation_integrity_percent:100},support_audit:audit.findings,agent04_handoff:ready?{mode:'RESEARCH_SAFETY_REVIEW',analysis_sections:analysis.sections,evidence_gaps:analysis.evidence_gaps,research_requests:analysis.research_requests,clinical_approval:false,publishing_allowed:false}:null};
}
