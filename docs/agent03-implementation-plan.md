# Agent 03 end-to-end implementation

Approved scope: approved Agent02 research packet -> integrative analysis -> deterministic citation/safety validation and separate support audit -> bounded revision -> immutable dossier and Agent04 input manifest. No staging, no clinical/publishing approval, no automatic medication change, no redesign.

## Contract
Input: exact owner-scoped Agent02 research review ID, approved research handoff, accepted claims/source snapshots, topic brief context. Recheck originating execution provenance, dossier hash, current approval and HOLD state. Reject unapproved or superseded packet before paid work.
Output: eight sections covering conventional-care context, nutrition, yoga/movement, sleep/lifestyle/hydration, naturopathy evidence, precautions, combined approach and evidence gaps. Each factual insight cites accepted claim IDs and exact supporting quote spans. Original population/caveats and source IDs are attached deterministically. No extrapolated combination efficacy, new prescribing/dosing, or imported excluded claims. Uncovered subjects generate focused research requests.

## Completion gates
All eight sections represented by supported findings or explicit gaps; every finding traceable to accepted input claims; numeric facts restricted to cited input; no forbidden clinical actions; separate DeepSeek support audit; at least three supported findings; Agent04 research-only handoff. Two generation/audit attempts maximum, with feedback incorporated. Failures persist as failed execution or revision artifact, never clinical approval.

## Verification and release
Unit and handler regression tests for input provenance, ownership, HOLD, excluded claim IDs, invented quotes, dosing/substitution, unsupported audit, missing sections, immutable history and bounded retries. Existing Agent02 tests retained. Frontend build and genuine authenticated browser E2E required. PR merge after checks, production rollout with prior frontend commit preserved for rollback. Record deployed function, migration, run/artifact IDs, metrics and residual limitations. Agent04 executor is separate; this scope creates its verified input packet only.

## Verification iterations
Initial unit/handler suite: 88 tests passed; frontend build passed. Migration applied with RLS SELECT owner policy and append-only trigger verified. PR #5 merged; production commit bf7ea9b8e6a3aabff12de2780c6196ff72fa8e52 READY.
First authenticated HT-0002 run: execution 0c3be23c-194b-4c68-8913-f10943bbd0aa, artifact 6d4295cf-81f7-474d-9642-2a45104d8a0c, 5 findings across 8 sections, separate audit support 100%, citation integrity 100%, 47.077s. Output inspection found incomplete accepted-claim coverage and ambiguous serious-versus-mild adverse-event wording despite the model audit. Tightened deterministic policy to require every accepted claim and to separate severity categories; added two regressions. 90 tests pass. Historical v1 artifact remains preserved; new policy has explicit version agent03-grounded-v2.

Second live iteration failed safely on duplicate model finding IDs; no analysis artifact was persisted. Policy now generates deterministic finding IDs server-side and sends those exact IDs to the independent audit. All accepted input claims must be covered and serious/mild adverse-event findings kept separate. 90 regression tests passed after these corrections.
