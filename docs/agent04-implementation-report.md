# Agent04 implementation and verification

User authorized iterative implementation, regression testing and production merge on 26 October 2026. No staging. Existing Agent01–03 source and historical dossiers remain preserved.

## Contract and responsibilities
Authenticated owner-scoped Agent03 READY_FOR_AGENT04 analysis -> verify originating execution, Agent02 approval/hash and accepted packet, reject superseded input/HOLD -> refresh PubMed identity/retraction/abstract snapshots -> independent DeepSeek audit of every finding across 11 explicit axes (evidence, numbers/risk, population, causality, conventional-care substitution, medicines/interactions, contraindications, vulnerable groups, red flags, combined efficacy, limitations). Audit batches contain at most three findings, each call has one retry. Missing/duplicate decisions, source failure or truncated output fail closed.

Findings receive PASS / REVISE / EXCLUDE / INSUFFICIENT_EVIDENCE. REVISE findings get one bounded automatic rewrite, then a separate full audit. No parent artifact is changed. Unsupported medication/interaction/red-flag advice cannot be invented; absent information remains an explicit gap. The reviewer may mark an axis NOT_APPLICABLE only when that finding makes no relevant recommendation. Old guidelines are not confirmed current from abstracts.

Report and Agent05 handoff require at least 80% passing findings, at least three passing findings across three domains. Only PASS findings enter the packet; exclusions and original limitations remain explicit. Research approval is separate from clinical/publishing approval (both false). Research gaps are routed as OPEN Agent02/03 requests; those requests are not autonomous executions of those agents. Agent05 executor is outside this implementation.

## Storage and release
Additive medical_safety_reports table: authenticated SELECT owner RLS, no client-write policy, append-only update/delete trigger. Function medical-safety authenticates users and scopes every query. Saved report records exact input SHA256, parent IDs, source checks, decisions, revision snapshots, attempts, usage and execution provenance. Existing records are never overwritten. UI adds Medical_safety tab using existing layout and automatically runs Agent04 after approved Agent03 output. Standalone run and read-only refresh available.

## Initial verification
110 regression tests pass (93 existing + 17 Agent04 policy/handler tests). Tests cover ownership/auth, HOLD before/during run, tampered hash, superseded input, source failures, missing/duplicate safety decisions, all axes, numeric/dose/substitution rejection, partial exclusion, automatic revision/recheck, truncated output and immutable parent preservation. Local production build passes using actual public Supabase URL and a build-only placeholder publishable key. Production build must separately verify real deployed configuration.

Initial verification was followed by the live iterations below.

## Live iteration 1 and policy hardening
Authenticated preview execution 30096269-c448-4b96-96d7-0d06a786ddf1 created report a8b3d0bc-8c49-4d1f-a3a0-5d3fff251d63: 15 reviewed, 13 PASS, 2 excluded after automatic revision/recheck. Deterministic validation rejected newly introduced numbers and mixed serious/mild wording despite model PASS. Inspection identified unlabelled biomarker effect sizes passing model review; added deterministic REVISE rule and regression. Revision prompt now explicitly prohibits new confidence intervals and mixed serious/mild wording. Added explicit review/dossier/content relationship validation and prevented Agent04 errors being misreported as Agent03 failure. Final policy agent04-safety-v2; 112 tests pass and frontend build passes. Function v3 ACTIVE; stricter live verification in progress.

## Final stricter live verification
Execution `5cb08406-07ee-4320-ad97-ffcc53e3dcd8`, report `8ec0bed0-4a4c-49c8-9442-912c5508a4a2`, input Agent03 `5d45477b-eef6-4dc1-b189-b6be6475793b`. Policy `agent04-safety-v2`, medical-safety function v3 ACTIVE (source hash `152b29facce9c8b397b9e9f6567c241e8c4b2129b4e2a2e82476cba45d83af2e`).

All 15 findings reviewed across 11 axes. Automatic revision improved 12/15 to 13/15 PASS (87%); 2 remained REVISE and are excluded from Agent05 allowed_claims. The biomarker finding now removes unlabelled numerical effect sizes while retaining population and null-result caveats. Unresolved findings concern incomplete diet-risk uncertainty reporting and an incomplete yoga-risk summary; a separate serious-event precaution remains included. No unsupported finding was approved merely to force 100%. Agent05 receives exactly 13 PASS findings, original source snapshots/context, mandatory boundaries and explicit unresolved gaps; clinical/publishing approval remains false.

Runtime 32.997s; deepseek-flash; total tokens 43,861 (prompt 38,162; completion 5,699). Latest suite: 115 tests PASS, including actual frontend orchestration-function regressions for exact saved analysis ID, blocking revision-required input, and preserving Agent04 failure status. Frontend build PASS. Authenticated preview UI showed the persisted report and readiness. Full Agent02 regeneration was not repeated for this release; saved Agent03 -> fresh source audit -> automatic revision/recheck -> saved report -> UI is the live E2E exercised.

Security advisors show only the pre-existing leaked-password-protection warning; no new table/RLS warning. RLS and append-only trigger verified. Existing production source remains at 3f16992379829384409ca3969f9b8f260a4c188b until PR merge. Production deployment evidence recorded after release.

## Production release
PR #7 merged at `7d9ff98465dde536320016de0380129ce96264d8` to feature/ui-responsive-workspace. Production Vercel deployment `dpl_2U3151dT6GycufsMgrZLGFiR4tRk` READY, build duration ~10.5s, canonical alias https://content-control-center-sigma.vercel.app assigned without alias error. Canonical URL renders the expected sign-in page in the separate production-origin browser session (authentication protection intact). Authenticated preview against the same live backend verified final saved report readback plus Topic Brief, Medical_research, Executions and Medical_safety tabs; no fresh paid call on refresh. An authenticated production-origin run was not repeated.

Prior recorded three Agent02 dossier checksums remain unchanged: 813dcbcc-d316-48ed-b40b-c63c2d81088e d0760f3c28ecc3deb29340bcdc78d8f8; 2dc709ff-32f9-4f08-b2af-69b0893638be 42e10e260551d7110f90d07297bcd4ba; 2bc7fc93-fb96-496b-ae49-2eb0cb9a6db2 efb98c57f1a92ab092175ac5c81231c7.

Rollback source remains prior production commit `3f16992379829384409ca3969f9b8f260a4c188b`; frontend rollback does not require deleting additive safety-report history. Agent01–03 functions were not redeployed in this implementation. Runtime source, tests, schema SQL and this report are uploaded on the separate Agent04 work branch. No staging was created or used. Agent05 has its scoped input packet; Agent05 executor is not implemented here. Runtime error-log/drain inspection was not part of this static frontend smoke; functional backend results were verified through saved execution/report evidence.
