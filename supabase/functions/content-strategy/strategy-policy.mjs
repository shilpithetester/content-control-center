export const POLICY_VERSION='agent05-strategy-v1';
export const readiness=x=>['READY_FOR_AGENT05','READY_FOR_AGENT05_WITH_EXCLUSIONS'].includes(x);
const forbidden=s=>/\b(?:cures?|guarantee(?:d|s)?|miracle|prescribe|diagnos(?:e|is))\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|milligrams?|tablets?)\b|\b(?:stop|discontinue|replace|increase|reduce|start|take)\b.{0,45}\b(?:medication|medicine|drug|dose)\b/i.test(s);
export function safetyPacket(record,execution){
 const r=record?.report,h=r?.agent05_handoff;
 if(!readiness(record?.safety_status)||r?.safety_status!==record.safety_status||r?.approval_scope!=='RESEARCH_ONLY'||r?.clinical_approval!==false||r?.publishing_allowed!==false||!h||h.clinical_approval!==false||h.publishing_allowed!==false||h.mode!=='CONTENT_STRATEGY_RESEARCH_INPUT')throw Error('Ready research-only Agent04 handoff required');
 if(execution?.status!=='COMPLETED'||execution?.agent_code!=='AGENT_04'||execution?.output?.safety_report_id!==record.id||r?.provenance?.execution_id!==record.execution_id)throw Error('Agent04 execution provenance mismatch');
 const passed=(r.claim_decisions||[]).filter(c=>c.decision==='PASS'),allowed=h.allowed_claims;
 if(!Array.isArray(allowed)||allowed.length<3||allowed.length>40||JSON.stringify(allowed)!==JSON.stringify(passed))throw Error('Agent04 allowed findings mismatch');
 const excluded=new Set((r.claim_decisions||[]).filter(c=>c.decision!=='PASS').map(c=>c.finding_id)),seen=new Set();
 const sources=new Map((h.sources||[]).map(s=>[s.source_id,s]));
 const findings=allowed.map(f=>{if(!f.finding_id||seen.has(f.finding_id)||excluded.has(f.finding_id)||!f.statement||!Array.isArray(f.source_ids)||!f.source_ids.length||f.source_ids.some(id=>!sources.get(id)?.abstract_text))throw Error('Invalid or excluded Agent04 finding');seen.add(f.finding_id);return {finding_id:f.finding_id,domain:f.domain,statement:f.statement,claim_ids:f.claim_ids,source_ids:f.source_ids,populations:f.applicable_populations||[],limitations:f.limitations||[]};});
 return {context:h.context||{},findings,sources:[...sources.values()].filter(s=>findings.some(f=>f.source_ids.includes(s.source_id))).map(s=>({source_id:s.source_id,title:s.title,publication_date:s.publication_date})),mandatory_caveats:h.mandatory_caveats||[],prohibited_statements:h.prohibited_statements||[],unresolved_evidence_gaps:h.unresolved_evidence_gaps||[],excluded_ids:[...excluded]};
}
function collect(value,path='strategy'){
 if(typeof value==='string')return [{path,text:value}];if(Array.isArray(value))return value.flatMap((x,i)=>collect(x,path+'['+i+']'));if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>k==='finding_ids'?[]:collect(v,path+'.'+k));return [];
}
const nonempty=(x,max=500)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
export function validateStrategy(raw,packet){
 if(!raw||!raw.languages||!raw.strategy)throw Error('Strategy and both language plans required');
 for(const lang of ['hinglish','english']){const l=raw.languages[lang];if(!l||!Array.isArray(l.titles)||l.titles.length<2||l.titles.length>4||l.titles.some(x=>!nonempty(x,160))||!nonempty(l.hook,450)||!nonempty(l.description,900)||!nonempty(l.thumbnail_text,100)||!nonempty(l.cta,350))throw Error('Incomplete '+lang+' language strategy');}
 const s=raw.strategy;if(!nonempty(s.audience_problem)||!nonempty(s.objective)||!nonempty(s.angle)||!Array.isArray(s.keywords)||s.keywords.length<3||s.keywords.length>15||s.keywords.some(x=>!nonempty(x,100))||!Array.isArray(s.tags)||s.tags.length<3||s.tags.length>15||s.tags.some(x=>!nonempty(x,100))||!Array.isArray(s.sections)||s.sections.length<3||s.sections.length>8)throw Error('Invalid strategy outline');
 const allowed=new Map(packet.findings.map(f=>[f.finding_id,f]));const used=new Set();
 for(const section of s.sections){if(!nonempty(section.heading,160)||!nonempty(section.purpose,500)||!nonempty(section.visual_direction,500)||!nonempty(section.engagement,350)||!Array.isArray(section.finding_ids)||!section.finding_ids.length||section.finding_ids.some(id=>!allowed.has(id)))throw Error('Outline must cite only passed Agent04 findings');section.finding_ids.forEach(id=>used.add(id));}
 if(used.size<3||new Set([...used].map(id=>allowed.get(id).domain)).size<2)throw Error('At least three passed findings from two domains required');
 const texts=collect(raw);if(texts.length>150)throw Error('Too many editorial fields');const unsafeField=texts.find(t=>forbidden(t.text));if(unsafeField)throw Error('Forbidden medical promise or treatment wording in '+unsafeField.path+'; rewrite that field without cure, guarantee, diagnose, prescribe, medication-change or dosing words');
 const permittedNumbers=packet.findings.map(f=>f.statement).join(' ').match(/\d+(?:\.\d+)?/g)||[];
 for(const {text} of texts){for(const n of text.match(/\d+(?:\.\d+)?/g)||[])if(!permittedNumbers.includes(n))throw Error('Numeric detail is absent from approved findings in '+text.slice(0,0));if((text.match(/A03_[a-z_]+_\d+/gi)||[]).some(id=>!allowed.has(id)))throw Error('Excluded or unknown finding referenced');if((text.match(/PMID:\d+/gi)||[]).some(id=>!packet.sources.some(s=>s.source_id===id)))throw Error('Unknown source referenced');}
 const sections=s.sections.map((section,i)=>({...section,section_id:'S'+(i+1),approved_evidence:section.finding_ids.map(id=>allowed.get(id)),source_ids:[...new Set(section.finding_ids.flatMap(id=>allowed.get(id).source_ids))]}));
 return {languages:raw.languages,strategy:{audience_problem:s.audience_problem,objective:s.objective,angle:s.angle,keywords:s.keywords,tags:s.tags,chapters:sections.map(x=>({title:x.heading,section_id:x.section_id})),sections},audit_texts:texts,used_finding_ids:[...used]};
}
export function assessStrategy(candidate,audit,packet){
 if(!Array.isArray(audit?.checks)||audit.checks.length!==candidate.audit_texts.length)throw Error('Complete independent strategy audit required');
 const seen=new Set();for(const a of audit.checks){if(!candidate.audit_texts.some(t=>t.path===a.path)||seen.has(a.path)||!['PASS','REVISE'].includes(a.verdict)||!nonempty(a.reason,600))throw Error('Invalid strategy audit item');seen.add(a.path);}
 const failures=audit.checks.filter(x=>x.verdict!=='PASS');const ready=!failures.length;
 const base={policy_version:POLICY_VERSION,strategy_status:ready?'READY_FOR_AGENT06':'REVISION_REQUIRED',approval_scope:'RESEARCH_ONLY',clinical_approval:false,publishing_allowed:false,languages:candidate.languages,strategy:candidate.strategy,quality:{editorial_fields:candidate.audit_texts.length,reviewed_fields:audit.checks.length,supported_fields:audit.checks.length-failures.length,failed_fields:failures.length,approved_findings_used:candidate.used_finding_ids.length},independent_audit:audit.checks,keyword_research:{status:'ESTIMATED_NOT_LIVE',note:'Keyword suggestions are editorial estimates; no search-volume, ranking or trend data was verified.'},safety_boundaries:{audience:packet.context.target_audience||'',mandatory_caveats:packet.mandatory_caveats,prohibited_statements:packet.prohibited_statements,unresolved_evidence_gaps:packet.unresolved_evidence_gaps,excluded_finding_ids:packet.excluded_ids},sources:packet.sources};
 return {...base,agent06_handoff:ready?{mode:'SCRIPT_WRITING_RESEARCH_INPUT',languages:base.languages,strategy:base.strategy,safety_boundaries:base.safety_boundaries,sources:base.sources,keyword_research:base.keyword_research,clinical_approval:false,publishing_allowed:false}:null};
}
