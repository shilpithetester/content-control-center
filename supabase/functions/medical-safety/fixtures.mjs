import {AXES} from './safety-policy.mjs';
export const claims=[1,2,3].map(n=>({claim_id:'C'+n,statement:'Adult observational research found association '+n+' with outcomes.',source_ids:['PMID:'+n]}));
export const sources=claims.map((c,i)=>({source_id:c.source_ids[0],title:'Source '+i,identity_verified:true,retracted:false,abstract_text:c.statement}));
export const findings=claims.map((c,i)=>({id:'F'+i,domain:['nutrition','yoga_movement','sleep_lifestyle'][i],statement:c.statement,claim_ids:[c.claim_id],source_ids:c.source_ids,limitations:['Observational only'],applicable_populations:['Adults']}));
export const packet={findings,claims,sources,context:{target_audience:'Adults'},evidence_gaps:['No combination efficacy']};
export const audit=()=>({findings:findings.map(f=>({id:f.id,decision:'PASS',reason:'Supported association with attached caveat',checks:Object.fromEntries(AXES.map(k=>[k,'PASS']))}))});
