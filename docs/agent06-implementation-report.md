# Agent06 implementation and verification

Scope: complete Hinglish and English scripts from ready Agent05 strategy, automatic iterations, regression testing and production merge. No staging. Production baseline commit 62c94b2c926a0b79fdbe390c7a59260f6f121470.

## Contract
Owner-scoped input must be the latest Agent05 READY_FOR_AGENT06 strategy, from a completed AGENT_05 execution and tied by hash to the latest approved Agent04 report. Latest Agent03 analysis and Agent02 review are rechecked; HOLD stops the run before and after paid work. Bilingual brief snapshot must match the parent report. Each evidence finding is verified against an actual Agent04 PASS decision; excluded findings cannot be cited.

Generate separate Hinglish and English scripts with title, opening, six or other approved sections, narration lines, on-screen text, generic visual cues, voice directions and closing CTA. Every spoken and on-screen line has passed finding IDs; section citations must belong to that section. Attach original passed evidence, populations, source IDs and limitations deterministically. Estimate duration from word count at 130 spoken words/minute. Language versions must use the same mapped evidence per section; source restrictions and excluded IDs flow to Agent07.

A separate automated audit evaluates every script/visual/voice field against its own cited evidence; a second independent call checks bilingual title, opening, per-section narration and on-screen text, and closing for meaning parity. No unverified dosage, medication change, guarantee, cure, unsupported numbers, invalid IDs or medical claims. Model output, audit coverage or parity errors fail closed. Up to two complete attempts with audit feedback and bounded retries for malformed audit batches. READY_FOR_AGENT07 is research-only; clinical and publishing approval remain false.

Additive script_dossiers table has owner-select RLS, no client-write policy and append-only update/delete trigger. JWT-protected script-writer function records provenance, input SHA256, versions, checks, token use and execution audit; existing reports and scripts are preserved. UI adds Script_writer tab and Agent05→Agent06 continuation, preserving existing workflow. Agent07 executor remains outside this scope.

## Initial verification
162 tests pass, including 139 previous and 23 new Agent06 policy, handler and frontend-orchestration regressions. Covered cases include auth/ownership, HOLD before/during run, tampered/superseded input, excluded findings, section-specific source mapping, both languages, unsafe instructions/numbers, complete audits, automatic revision and blocked parity mismatch. Frontend build passes using the actual public Supabase URL and a build-only placeholder key. RLS and append-only trigger verified. Script-writer v1 ACTIVE, source hash 728efd75c3cfef07a8ad15371c6a00b73bf5474196937c1bb7afb67a8d184764. Authenticated live run and production release evidence pending.
