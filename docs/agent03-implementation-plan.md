# Agent 03 end-to-end implementation

Approved scope: approved Agent02 research packet -> integrative analysis -> deterministic citation/safety validation and separate support audit -> bounded revision -> immutable dossier and Agent04 input manifest. No staging, no clinical/publishing approval, no automatic medication change, no redesign.

## Contract
Input: exact owner-scoped Agent02 research review ID, approved research handoff, accepted claims/source snapshots, topic brief context. Recheck originating execution provenance, dossier hash, current approval and HOLD state. Reject unapproved or superseded packet before paid work.
Output: eight sections covering conventional-care context, nutrition, yoga/movement, sleep/lifestyle/hydration, naturopathy evidence, precautions, combined approach and evidence gaps. Each factual insight cites accepted claim IDs and exact supporting quote spans. Original population/caveats and source IDs are attached deterministically. No extrapolated combination efficacy, new prescribing/dosing, or imported excluded claims. Uncovered subjects generate focused research requests.

## Completion gates
All eight sections represented by supported findings or explicit gaps; every finding traceable to accepted input claims; numeric facts restricted to cited input; no forbidden clinical actions; separate DeepSeek support audit; at least three supported findings; Agent04 research-only handoff. Two generation/audit attempts maximum, with feedback incorporated. Failures persist as failed execution or revision artifact, never clinical approval.

## Verification and release
Unit and handler regression tests for input provenance, ownership, HOLD, excluded claim IDs, invented quotes, dosing/substitution, unsupported audit, missing sections, immutable history and bounded retries. Existing Agent02 tests retained. Frontend build and genuine authenticated browser E2E required. PR merge after checks, production rollout with prior frontend commit preserved for rollback. Record deployed function, migration, run/artifact IDs, metrics and residual limitations. Agent04 executor is separate; this scope creates its verified input packet only.
