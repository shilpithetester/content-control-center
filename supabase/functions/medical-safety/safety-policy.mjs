export const POLICY_VERSION='agent04-safety-v2';
export const AXES=['evidence_support','numbers_and_risk','population','causality','care_substitution','medication_interactions','contraindications','vulnerable_groups','red_flags','combined_efficacy','source_limitations'];
export const norm=x=>String(x||'').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
export function inputPacket(record,execution){
 const d=record?.dossier;
 if(record?.analysis_status!=='READY_FOR_AGENT04'||d?.analysis_status!=='READY_FOR_AGENT04'||d?.approval_scope!=='RESEARCH_ONLY'||d?.clinical_approval!==false||d?.publishing_allowed!==false||!d?.agent04_handoff)throw Error('Ready research-only Agent03 packet required');
 if(execution?.status!=='COMPLETED'||execution?.agent_code!=='AGENT_03'||execution?.output?.analysis_id!==record.id)throw Error('Agent03 execution provenance mismatch');
 const p=d.agent04_handoff,claims=new Map((p.accepted_input_claims||[]).map(c=>[c.claim_id,c]));
 const findings=(d.sections||[]).flatMap(s=>(s.findings||[]).map(f=>({...f,domain:s.domain})));
 if(!findings.length||findings.length>40||!p.sources?.length||!claims.size)throw Error('Invalid Agent03 handoff');
 const ids=new Set();for(const f of findings){if(ids.has(f.id)||!f.id||!f.statement||!f.claim_ids?.length||f.claim_ids.some(id=>!claims.has(id)))throw Error('Invalid/excluded finding input');ids.add(f.id);const expected=[...new Set(f.claim_ids.flatMap(id=>claims.get(id).source_ids))];if(expected.some(id=>!p.sources.some(s=>s.source_id===id&&s.abstract_text)))throw Error('Missing accepted source');f.source_ids=expected;}
 return {findings,claims:[...claims.values()],sources:p.sources,context:p.context||d.context,evidence_gaps:d.evidence_gaps||[]};
}
export const forbidden=s=>/\b(cures?|guaranteed|prescribe|diagnose)\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|milligrams?|tablets?)\b|\b(?:stop|discontinue|replace|increase|reduce|start|take)\b.{0,45}\b(?:medication|medicine|drug|dose)\b/i.test(s);
export function assessBatch(findings,review,sources,claims){
 if(!Array.isArray(review?.findings)||review.findings.length!==findings.length)throw Error('Complete claim safety review required');
 const seen=new Set();return review.findings.map(r=>{
 const f=findings.find(f=>f.id===r.id);if(!f||seen.has(r.id))throw Error('Unknown/duplicate safety review ID');seen.add(r.id);
 if(!['PASS','REVISE','EXCLUDE','INSUFFICIENT_EVIDENCE'].includes(r.decision)||typeof r.reason!=='string'||!r.reason.trim())throw Error('Invalid safety decision');
 if(!r.checks||AXES.some(k=>!['PASS','NOT_APPLICABLE','REVISE','EXCLUDE','INSUFFICIENT_EVIDENCE'].includes(r.checks[k])))throw Error('All safety axes required');
 let decision=r.decision;const failures=[];
 if(forbidden(f.statement))failures.push('Forbidden prescribing, dosing, substitution or cure wording');
 if(/\bserious\b/i.test(f.statement)&&/\bmild\b/i.test(f.statement))failures.push('Mixed serious and mild event wording');
 const context=claims.filter(c=>f.claim_ids.includes(c.claim_id)).map(c=>c.statement).join(' ');
 if((f.statement.match(/\d+(?:\.\d+)?/g)||[]).some(n=>!new RegExp('(?:^|[^0-9])'+n.replace('.','\\.')+'(?:$|[^0-9])').test(context)))failures.push('Numeric value absent from accepted input');
 if(f.source_ids.some(id=>!sources.some(s=>s.source_id===id&&s.identity_verified&&!s.retracted&&s.abstract_text)))failures.push('Fresh source integrity failure');
 if(decision==='PASS'&&AXES.some(k=>!['PASS','NOT_APPLICABLE'].includes(r.checks[k])))decision='REVISE';
 if(failures.length)decision='EXCLUDE';
 if(/\b(?:HbA1c|LDL|triglycerides)\b/i.test(f.statement)&&/\(-?0\.\d+\)/.test(f.statement)&&!/(?:\bSMD\b|standardized|mean difference|mmol|mg\/|percentage points)/i.test(f.statement)){decision='REVISE';r.checks.numbers_and_risk='REVISE';failures.push('Effect-size numbers lack a stated unit or measure; remove values or use only evidence-supported measure wording');}
 return {finding_id:f.id,domain:f.domain,decision,reason:r.reason,deterministic_failures:failures,checks:r.checks,statement:f.statement,claim_ids:f.claim_ids,source_ids:f.source_ids,applicable_populations:f.applicable_populations||[],limitations:f.limitations||[],clinical_approval:false};
 });
}
export function validateRevision(raw,original,claims){
 if(!Array.isArray(raw?.findings)||raw.findings.length!==original.length)throw Error('Complete bounded revision required');
 const ids=new Set();return raw.findings.map(x=>{const f=original.find(f=>f.id===x.id);if(!f||ids.has(x.id)||typeof x.statement!=='string'||!x.statement.trim()||x.statement.length>900||forbidden(x.statement))throw Error('Invalid safety revision');ids.add(x.id);return {...f,statement:x.statement};});
}
export function report(packet,findings,decisions,sources,attempts){
 if(decisions.length!==findings.length)throw Error('Incomplete final review');
 const passed=decisions.filter(x=>x.decision==='PASS'),excluded=decisions.filter(x=>x.decision!=='PASS');
 const percent=Math.round(passed.length/findings.length*100),ready=passed.length>=3&&new Set(passed.map(x=>x.domain)).size>=3&&percent>=80;
 const caveats=[...new Set(passed.flatMap(f=>f.limitations))];
 const requests=excluded.map(f=>({target_agent:f.decision==='INSUFFICIENT_EVIDENCE'?'AGENT_02':'AGENT_03',status:'OPEN',finding_id:f.finding_id,reason:f.reason,required_checks:AXES.filter(k=>!['PASS','NOT_APPLICABLE'].includes(f.checks[k]))}));
 const boundaries={allowed_claims:passed,excluded_findings:excluded.map(f=>({finding_id:f.finding_id,reason:f.reason})),mandatory_caveats:caveats,audience:packet.context?.target_audience||'Use original population limits',prohibited_statements:['No prescribing, medication changes, dosing or guaranteed cures','No treatment replacement or unsupported combined-treatment efficacy','No widening study populations or causal claims from associations','Do not present old guidelines as confirmed current guidance'],unresolved_evidence_gaps:packet.evidence_gaps,scope:'AUTOMATED_RESEARCH_SAFETY',clinical_approval:false,publishing_allowed:false};
 return {policy_version:POLICY_VERSION,reviewer_type:'AUTOMATED_ABSTRACT_SAFETY_AUDIT',qualified_human:false,approval_scope:'RESEARCH_ONLY',clinical_approval:false,publishing_allowed:false,safety_status:ready?(excluded.length?'READY_FOR_AGENT05_WITH_EXCLUSIONS':'READY_FOR_AGENT05'):'REVISION_REQUIRED',quality:{findings_total:findings.length,passed_findings:passed.length,excluded_findings:excluded.length,review_coverage_percent:100,passed_percent:percent,required_pass_percent:80,source_identity_percent:Math.round(sources.filter(s=>s.identity_verified&&!s.retracted).length/sources.length*100)},claim_decisions:decisions,source_checks:sources.map(s=>({source_id:s.source_id,identity_verified:s.identity_verified,retracted:s.retracted,abstract_available:!!s.abstract_text,publication_date:s.publication_date})),safety_boundaries:boundaries,research_requests:requests,iterations:attempts,agent05_handoff:ready?{...boundaries,mode:'CONTENT_STRATEGY_RESEARCH_INPUT',context:packet.context,sources,accepted_input_claims:packet.claims.filter(c=>passed.some(f=>f.claim_ids.includes(c.claim_id)))}:null};
}
