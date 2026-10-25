import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSourceLimit,validateClaims,handoffAllowed} from './safety-gate.mjs';
const source=[{source_id:'PMID:123'}];
const good={medical_summary:'Research summary',medical_claims:[{statement:'Tentative claim',source_ids:['PMID:123'],verification_status:'VERIFIED',evidence_strength:'HIGH'}]};
test('source limits',()=>{assert.equal(validateSourceLimit(8),8);for(const n of [0,-1,13,1.5,'abc'])assert.throws(()=>validateSourceLimit(n));});
test('unknown source',()=>assert.throws(()=>validateClaims({...good,medical_claims:[{statement:'x',source_ids:['PMID:999']}]},source)));
test('model cannot self-verify claims',()=>{const c=validateClaims(good,source).medical_claims[0];assert.equal(c.verification_status,'UNVERIFIED');assert.equal(c.evidence_strength,'UNKNOWN');});
test('metadata only cannot hand off',()=>assert.equal(handoffAllowed({research_status:'NEEDS_SOURCE_VERIFICATION',requires_medical_review:true,medical_claims:validateClaims(good,source).medical_claims}),false));
test('empty summary rejected',()=>assert.throws(()=>validateClaims({medical_summary:'',medical_claims:[]},source)));
test('too many claims rejected',()=>assert.throws(()=>validateClaims({medical_summary:'x',medical_claims:Array(31).fill(good.medical_claims[0])},source)));
test('unapproved handoff rejected',()=>assert.equal(handoffAllowed({research_status:'NEEDS_REVIEW',requires_medical_review:false,medical_claims:[]}),false));

test('missing source_ids rejected',()=>assert.throws(()=>validateClaims({...good,medical_claims:[{statement:'No refs'}]},source)));
test('duplicate source IDs deduplicated',()=>assert.deepEqual(validateClaims({...good,medical_claims:[{statement:'x',source_ids:['PMID:123','PMID:123']}]},source).medical_claims[0].source_ids,['PMID:123']));
test('verified claims still require review decision',()=>assert.equal(handoffAllowed({research_status:'APPROVED_FOR_HANDOFF',requires_medical_review:true,medical_claims:[{verification_status:'VERIFIED'}]}),false));
test('unverified claim blocks approved dossier',()=>assert.equal(handoffAllowed({research_status:'APPROVED_FOR_HANDOFF',requires_medical_review:false,medical_claims:[{verification_status:'UNVERIFIED'}]}),false));

