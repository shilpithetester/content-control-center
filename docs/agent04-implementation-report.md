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

Live run and production deployment evidence pending; do not treat initial verification as final completion.
