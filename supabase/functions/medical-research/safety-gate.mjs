export function validateSourceLimit(value) {
  if (typeof value === 'boolean' || (value != null && typeof value !== 'number' && typeof value !== 'string')) throw new Error('max_sources must be integer 1..12');
  const n = Number(value ?? 8);
  if (!Number.isSafeInteger(n) || n < 1 || n > 12) throw new Error('max_sources must be integer 1..12');
  return n;
}

export function validateClaims(raw, sources) {
  if (!raw || typeof raw.medical_summary !== 'string' || !raw.medical_summary.trim()) throw new Error('medical_summary required');
  if (!Array.isArray(raw.medical_claims) || raw.medical_claims.length === 0 || raw.medical_claims.length > 30) throw new Error('invalid claims array');
  const ids = new Set(sources.map(s => s.source_id));
  const claims = raw.medical_claims.map((c, i) => {
    if (!c || typeof c.statement !== 'string' || !c.statement.trim()) throw new Error('invalid claim');
    if (!Array.isArray(c.source_ids) || c.source_ids.length === 0 || !c.source_ids.every(id => typeof id === 'string' && ids.has(id))) throw new Error('claim must cite at least one retrieved source');
    return {
      claim_id: 'C' + (i + 1), statement: c.statement, source_ids: [...new Set(c.source_ids)],
      evidence_strength: 'UNKNOWN', verification_status: 'UNVERIFIED',
      applicable_population: String(c.applicable_population || ''), caveats: String(c.caveats || ''),
      risk_flags: Array.isArray(c.risk_flags) ? c.risk_flags.filter(x => typeof x === 'string') : []
    };
  });
  return {medical_summary: raw.medical_summary, medical_claims: claims, clinical_guidelines: [],
    contraindications: strings(raw.contraindications), drug_interactions_or_precautions: strings(raw.drug_interactions_or_precautions),
    vulnerable_populations: strings(raw.vulnerable_populations), red_flags: strings(raw.red_flags),
    evidence_gaps: strings(raw.evidence_gaps), research_confidence: 'LOW'};
}
function strings(v) { return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : []; }
export function handoffAllowed(dossier) {
  return dossier?.research_status === 'APPROVED_FOR_HANDOFF' && dossier?.requires_medical_review === false &&
    Array.isArray(dossier.medical_claims) && dossier.medical_claims.length > 0 && dossier.medical_claims.every(c => c?.verification_status === 'VERIFIED') &&
    dossier.medical_review?.decision === 'APPROVED' && dossier.medical_review?.qualified_human === true &&
    typeof dossier.medical_review?.reviewer_id === 'string' && dossier.medical_review.reviewer_id.trim().length > 0;
}

