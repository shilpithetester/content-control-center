# Agent 02 automated research approval plan

## User-directed scope
Human medical feedback is not a blocker for the current research/analysis stage. Implement automatic measured source/claim checks and research-only approval; retain a separate clinical/publishing boundary. No staging. No original dossier overwrite. No changes to T-017/T-021 or full UI redesign.

## End-to-end flow
1. Existing authenticated Agent02 run creates an immutable dossier.
2. Frontend automatically calls evidence-review REVIEW for that dossier.
3. Owner-scoped function checks HOLD, re-fetches PubMed identity/abstracts, then runs a separate DeepSeek evidence auditor with strict JSON output.
4. Deterministic policy verifies each cited publication identity, absence of retraction flag, available abstract, exact normalized contiguous supporting quote (>=25 normalized characters), and complete claim-review coverage.
5. Auditor assesses support and population applicability. SUPPORTED with DIRECT or explicitly LIMITED applicability, nonempty rationale and limitation is required per accepted claim. AI judgment remains fallible; exact quotes establish traceability, not clinical correctness.
6. >=80% accepted claim coverage and minimum scoped claim count -> APPROVED_FOR_RESEARCH (or WITH_EXCLUSIONS). Otherwise REQUEST_REVISION. Never force a passing score.
7. Insert review into existing medical_research_reviews with review_source AUTOMATED_RESEARCH_EVIDENCE, approval_scope RESEARCH_ONLY, clinical_approval=false, publishing_allowed=false, qualified_human=false, immutable dossier SHA256, metrics and usage audit.
8. Persist research-only Agent03 input manifest containing accepted original claims, refreshed source snapshots, caveats and gaps. Excluded claims omitted. This creates the input packet; it does not claim Agent03 analysis has executed.
9. Display status, metrics, exclusions and handoff in existing Medical Research UI. GET_REVIEW reads saved result without further paid calls.

## Gates and tests
- Auth/ownership/HOLD checks must precede paid work.
- Fabricated quotes, missing abstracts, unknown citations, title mismatch, retraction and malformed/incomplete reviews fail closed.
- Do not mark original medical claims VERIFIED, change clinical approvals, or publish medical content.
- No schema migration required: existing reviews table and constraints reused.
- Preserve prior dossiers and reviews; review function only inserts review/audit rows.
- 62 automated tests passed; frontend build passed prior to live rollout. Live results appended after actual execution.

## Runtime integration
New function evidence-review; existing medical-research v10 remains unchanged. All calls use existing Supabase project, user JWT and server-side DeepSeek configuration. No credential extraction. Rollback frontend to release commit 179e798 if needed; new function does not affect old frontend calls.

## Controlled live iteration
HT-0003 was created under the existing authenticated production owner; no HT-0002 ownership changes. Account provider was changed from unconfigured Anthropic to existing configured DeepSeek after the first pilot attempt failed for missing Anthropic key. Topic Brief v1 and Agent02 dossier f7d0d7c4-054b-4d8f-bb36-65d089f56d23 persisted. First whole-review output truncated and saved no approval. Batching introduced; measured review 80e7cd94-c9a3-4191-8d60-9c9c6262018f gave identity/abstract/quotes 100%, support 75% (9/12), correctly REQUEST_REVISION. Three wording errors documented; threshold remains 80%.

Bounded automatic correction: when failed claims have genuine exact source quotes, create a new unverified dossier with extractive source-linked wording, retain original dossier/review and lineage, then run a fresh evidence audit. One revision generation maximum. Missing/fabricated source evidence cannot be auto-corrected this way. Existing completed review provenance is required for the REVISE action. Frontend performs this loop without user clicks after a run. 68 tests and frontend build are the next verification gates.
