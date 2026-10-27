export const POLICY_VERSION='agent06-script-v1';
const nonempty=(x,max=1200)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const forbidden=s=>/\b(?:cures?|guarantee(?:d|s)?|miracle|prescribe|diagnos(?:e|is))\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|milligrams?|tablets?)\b|\b(?:stop|discontinue|replace|increase|reduce|start|take)\b.{0,45}\b(?:medication|medicine|drug|dose)\b/i.test(s);
export function scriptPacket(record,origin,safety){
 const r=record?.report,h=r?.agent06_handoff;
 if(record?.strategy_status!=='READY_FOR_AGENT06'||r?.strategy_status!=='READY_FOR_AGENT06'||r?.approval_scope!=='RESEARCH_ONLY'||r?.clinical_approval!==false||r?.publishing_allowed!==false||!h||h.mode!=='SCRIPT_WRITING_RESEARCH_INPUT'||h.clinical_approval!==false||h.publishing_allowed!==false)throw Error('Ready research-only Agent05 brief required');
 if(JSON.stringify(h.strategy)!==JSON.stringify(r.strategy)||JSON.stringify(h.languages)!==JSON.stringify(r.languages)||JSON.stringify(h.safety_boundaries)!==JSON.stringify(r.safety_boundaries))throw Error('Agent05 brief snapshot mismatch');
 if(origin?.status!=='COMPLETED'||origin?.agent_code!=='AGENT_05'||origin?.output?.strategy_report_id!==record.id||r?.provenance?.execution_id!==record.execution_id)throw Error('Agent05 execution provenance mismatch');
 if(!['READY_FOR_AGENT05','READY_FOR_AGENT05_WITH_EXCLUSIONS'].includes(safety?.safety_status)||safety?.report?.clinical_approval!==false||safety?.report?.publishing_allowed!==false||!safety.report?.agent05_handoff)throw Error('Agent04 safety handoff required');
 const pass=new Map((safety.report.claim_decisions||[]).filter(x=>x.decision==='PASS').map(x=>[x.finding_id,x]));
 const excluded=(safety.report.claim_decisions||[]).filter(x=>x.decision!=='PASS').map(x=>x.finding_id);
 if(!Array.isArray(h.strategy?.sections)||h.strategy.sections.length<3||h.strategy.sections.length>8||!h.languages?.hinglish||!h.languages?.english)throw Error('Complete bilingual section brief required');
 const seen=new Set();const sections=h.strategy.sections.map(section=>{
  if(!section.section_id||seen.has(section.section_id)||!Array.isArray(section.finding_ids)||!section.finding_ids.length)throw Error('Invalid brief section');seen.add(section.section_id);
  const facts=section.finding_ids.map(id=>{const safe=pass.get(id),brief=section.approved_evidence?.find(e=>e.finding_id===id);if(!safe||!brief||safe.statement!==brief.statement||JSON.stringify(safe.source_ids)!==JSON.stringify(brief.source_ids))throw Error('Brief references excluded or mismatched finding');return {finding_id:id,statement:safe.statement,source_ids:safe.source_ids,claim_ids:safe.claim_ids,populations:safe.applicable_populations||[],limitations:safe.limitations||[],domain:safe.domain};});
  return {section_id:section.section_id,heading:section.heading,purpose:section.purpose,visual_direction:section.visual_direction,engagement:section.engagement,findings:facts};
 });
 return {context:h.context||{},languages:h.languages,sections,safety_boundaries:{...h.safety_boundaries,excluded_finding_ids:excluded},sources:h.sources||[]};
}
function unit(text,path,ids,allowed,facts){
 if(!nonempty(text,1200)||!Array.isArray(ids)||!ids.length||ids.some(id=>!allowed.has(id)))throw Error('Every spoken/on-screen line needs approved mapped finding IDs: '+path);
 if(forbidden(text))throw Error('Unsafe prescribing, dosage or cure language in '+path);if((text.match(/A03_[a-z_]+_\d+/gi)||[]).some(id=>!ids.includes(id)))throw Error('Excluded or unknown finding reference in '+path);
 const allowedNums=facts.filter(f=>ids.includes(f.finding_id)).map(f=>f.statement).join(' ').match(/\d+(?:\.\d+)?/g)||[];
 if((text.match(/\d+(?:\.\d+)?/g)||[]).some(n=>!allowedNums.includes(n)))throw Error('Unapproved number in '+path);
 return {path,text,finding_ids:[...new Set(ids)]};
}
export function validateScript(raw,packet){
 if(!raw?.languages?.hinglish||!raw?.languages?.english)throw Error('Both language scripts required');
 const allFacts=[...new Map(packet.sections.flatMap(s=>s.findings).map(f=>[f.finding_id,f])).values()],allIds=new Set(allFacts.map(f=>f.finding_id));
 const scripts={},auditable=[];
 for(const lang of ['hinglish','english']){
  const l=raw.languages[lang];if(!nonempty(l.title,180)||!Array.isArray(l.sections)||l.sections.length!==packet.sections.length||!l.opening||!l.closing)throw Error('Incomplete '+lang+' script');
  if(/\b(?:works? better|proven effective|guidelines? (?:say|recommend)|guidance says)\b|kya (?:sach mein )?kaam karta hai/i.test(l.title))throw Error('Unsupported effect or current-guideline framing in '+lang+' title');const title=unit(l.title,lang+'.title',l.opening.finding_ids,allIds,allFacts);auditable.push({...title,kind:'title'});
  const opening=unit(l.opening.text,lang+'.opening',l.opening.finding_ids,allIds,allFacts);auditable.push({...opening,kind:'narration'});
  const closing=unit(l.closing.text,lang+'.closing',l.closing.finding_ids,allIds,allFacts);auditable.push({...closing,kind:'narration'});
  const seen=new Set();const sections=l.sections.map((s,i)=>{
   const brief=packet.sections.find(b=>b.section_id===s.section_id);if(!brief||seen.has(s.section_id))throw Error('Unknown/duplicate script section');seen.add(s.section_id);
   if(!Array.isArray(s.lines)||s.lines.length<2||s.lines.length>8||!Array.isArray(s.onscreen)||s.onscreen.length>4||!nonempty(s.visual_cue,500)||!nonempty(s.voice_direction,300))throw Error('Invalid script section content');
   const allowed=new Set(brief.findings.map(f=>f.finding_id));
   const lines=s.lines.map((x,j)=>unit(x.text,lang+'.sections.'+s.section_id+'.lines.'+j,x.finding_ids,allowed,brief.findings));
   const onscreen=s.onscreen.map((x,j)=>unit(x.text,lang+'.sections.'+s.section_id+'.onscreen.'+j,x.finding_ids,allowed,brief.findings));
   if(forbidden(s.visual_cue)||forbidden(s.voice_direction)||/\b(?:vegetables|legumes|whole grains|healthy fats)\b/i.test(s.visual_cue)&&!brief.findings.some(f=>/\b(?:vegetables|legumes|whole grains|healthy fats)\b/i.test(f.statement)))throw Error('Unapproved visual or voice direction');
   if([s.visual_cue,s.voice_direction].some(text=>(text.match(/A03_[a-z_]+_\d+/gi)||[]).some(id=>!allowed.has(id))))throw Error('Excluded or unknown visual finding reference');const controls=[{path:lang+'.sections.'+s.section_id+'.visual_cue',text:s.visual_cue,finding_ids:brief.findings.map(f=>f.finding_id),kind:'visual'}, {path:lang+'.sections.'+s.section_id+'.voice_direction',text:s.voice_direction,finding_ids:brief.findings.map(f=>f.finding_id),kind:'voice'}];
   auditable.push(...lines.map(x=>({...x,kind:'narration'})),...onscreen.map(x=>({...x,kind:'onscreen'})),...controls);
   const used=[...new Set([...lines,...onscreen].flatMap(x=>x.finding_ids))],facts=brief.findings.filter(f=>used.includes(f.finding_id));
   return {section_id:s.section_id,heading:brief.heading,lines,onscreen,visual_cue:s.visual_cue,voice_direction:s.voice_direction,approved_evidence:facts,source_ids:[...new Set(facts.flatMap(f=>f.source_ids))]};
  });
  const words=[l.opening.text,...sections.flatMap(s=>s.lines.map(x=>x.text)),l.closing.text].join(' ').trim().split(/\s+/).length;
  const referenced=new Set([...opening.finding_ids,...closing.finding_ids,...sections.flatMap(s=>[...s.lines,...s.onscreen].flatMap(x=>x.finding_ids))]);scripts[lang]={language:lang,title:l.title,opening,sections,closing,approved_evidence:allFacts.filter(f=>referenced.has(f.finding_id)),word_count:words,estimated_duration_seconds:Math.ceil(words/130*60),duration_note:'Estimate at 130 spoken words per minute; actual narration and edit may differ.'};
 }
 for(const en of scripts.english.sections){const hi=scripts.hinglish.sections.find(s=>s.section_id===en.section_id);const ids=x=>[...new Set([...x.lines,...x.onscreen].flatMap(v=>v.finding_ids))].sort().join('|');if(ids(en)!==ids(hi))throw Error('Language evidence mapping mismatch in '+en.section_id);}
 const parity=[{path:'title',hinglish:scripts.hinglish.title,english:scripts.english.title},{path:'opening',hinglish:scripts.hinglish.opening.text,english:scripts.english.opening.text},...packet.sections.map(s=>({path:s.section_id,hinglish:scripts.hinglish.sections.find(x=>x.section_id===s.section_id).lines.map(x=>x.text).join(' '),english:scripts.english.sections.find(x=>x.section_id===s.section_id).lines.map(x=>x.text).join(' '),hinglish_onscreen:scripts.hinglish.sections.find(x=>x.section_id===s.section_id).onscreen.map(x=>x.text).join(' '),english_onscreen:scripts.english.sections.find(x=>x.section_id===s.section_id).onscreen.map(x=>x.text).join(' ')})),{path:'closing',hinglish:scripts.hinglish.closing.text,english:scripts.english.closing.text}];
 return {scripts,auditable,parity,allFacts};
}
export function assessScript(checked,audit,parityAudit,packet){
 const verify=(items,expected,label)=>{if(!Array.isArray(items)||items.length!==expected.length)throw Error('Complete '+label+' audit required');const seen=new Set();for(const x of items){if(!expected.some(e=>e.path===x.path)||seen.has(x.path)||!['PASS','REVISE'].includes(x.verdict)||!nonempty(x.reason,600))throw Error('Invalid '+label+' audit item');seen.add(x.path);}};
 verify(audit?.checks,checked.auditable,'script');verify(parityAudit?.checks,checked.parity,'language parity');
 const failed=[...audit.checks,...parityAudit.checks].filter(x=>x.verdict!=='PASS'),ready=!failed.length;
 const result={policy_version:POLICY_VERSION,script_status:ready?'READY_FOR_AGENT07':'REVISION_REQUIRED',approval_scope:'RESEARCH_ONLY',clinical_approval:false,publishing_allowed:false,scripts:checked.scripts,quality:{script_fields:checked.auditable.length,audited_fields:audit.checks.length,supported_fields:audit.checks.filter(x=>x.verdict==='PASS').length,parity_sections:checked.parity.length,parity_passed:parityAudit.checks.filter(x=>x.verdict==='PASS').length,failed_checks:failed.length},script_audit:audit.checks,parity_audit:parityAudit.checks,safety_boundaries:packet.safety_boundaries,sources:packet.sources};
 return {...result,agent07_handoff:ready?{mode:'VISUAL_DIRECTION_RESEARCH_INPUT',scripts:result.scripts,safety_boundaries:result.safety_boundaries,sources:result.sources,clinical_approval:false,publishing_allowed:false}:null};
}
