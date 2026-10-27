# Content Control Center — Agent-wise Task Register

Last consolidated: 27 October 2026 (India time)

Purpose: preserve the agreed agent responsibilities, dependencies and the latest implementation evidence available when this register was created. This is a reference and planning document; task entries are not an assertion that every responsibility is already implemented or verified. Review the linked reports and current code before using a historical status for a release.

## Project-wide decisions and operating rules

- Never create, prepare, configure or use staging. Development and testing use the authorized preview and existing production-connected backend, with shared-backend impacts considered.
- Preserve existing content, latest verified UI and previous dossiers. New reports and versions are append-only; do not silently overwrite historical output.
- User authorized autonomous iterations, DeepSeek consumption, regression tests and production merge for Agents 02–05. Authorization for future implementation must follow the user's instructions for that work.
- Automated research evidence and safety checks are research-scoped. They must never be represented as qualified clinician approval or permission to publish.
- Hinglish and separate English-only video versions are required. Conventional medical care remains primary; other approaches are complementary and evidence-bound.
- Respect owner-scoped access, existing Project Brain and original tracker. Do not impersonate another owner or create duplicate project memory.

## Pipeline and status at consolidation

| Stage | Role | Input → Output | Status/evidence at this checkpoint |
|---|---|---|---|
| Agent 00 | Content Director | Content request → workflow coordination | Existing component; full task inventory still requires confirmation. |
| Agent 01 | Topic Research / Topic Intelligence | Topic → versioned Topic Brief | Existing component with live Topic Brief; complete task inventory requires confirmation. |
| Agent 02 | Medical Research | Topic Brief → research dossier and research evidence review | Implemented; verified research handoff can include exclusions. See Agent 02 reports in `docs/`. |
| Agent 03 | Integrative Health Analysis | Approved Agent 02 packet → analysis and Agent 04 research packet | Implemented and production merged; see [Agent 03 implementation plan](agent03-implementation-plan.md). |
| Agent 04 | Medical Safety & Fact Checker | Agent 03 packet → safety report and Agent 05 packet | Implemented and production merged; see [Agent 04 implementation report](agent04-implementation-report.md). |
| Agent 05 | YouTube Content Strategist | Agent 04 report → content strategy and Agent 06 brief | Implemented and production merged; see [Agent 05 implementation report](agent05-implementation-report.md). |
| Agent 06 | Health YouTube Script Writer | Agent 05 brief → bilingual scripts and production handoff | Planned; Agent 05 packet is ready. Executor not implemented at this checkpoint. |
| Agent 07 | Visual Director | Script → visual direction | Future scope; responsibilities require detailed planning. |
| Agent 08 | Video Production Coordinator | Scripts and visual direction → production coordination | Future scope; responsibilities require detailed planning. |
| Agent 09 | Asset Generator | Production requirements → assets | Future scope; detailed implementation status needs confirmation. |
| Agent 10 | Video Assembly | Approved production materials → assembled video | Future scope; responsibilities require detailed planning. |

Agent 02–05 status above describes the released components, not proof that every task below has been independently verified for all inputs. Earlier reports are historical snapshots: their statements about later agents may have been superseded.

## Agent 01 — Topic Research / Topic Intelligence

**Input:** content topic and project context. **Output:** versioned Topic Brief for medical research.

- [Existing scope] Identify the audience problem, topic summary, why-now context and content angles.
- [Existing scope] Prepare research questions and search queries, audience and integrative-health scope.
- [Existing scope] Preserve language requirements, medical risk context and recommended next step.
- [Existing scope] Save a versioned brief and show it in the Topic Brief view.
- [To confirm] Document the complete original responsibility list, acceptance criteria and production verification evidence before using this as a comprehensive Agent 01 checklist.

## Agent 02 — Medical Research

**Input:** a versioned Topic Brief. **Output:** research dossier, source/claim review and research-only handoff, potentially with exclusions.

1. Verify owner, content item, Topic Brief version, HOLD and research configuration.
2. Search and retrieve source metadata and available abstracts within source and runtime limits.
3. Record source identity, bibliographic data, dates, retraction status and available abstracts.
4. Produce research claims with source IDs, applicable population, caveats and evidence gaps.
5. Avoid unsupported citations and metadata-only factual synthesis; keep the original draft and its verification state.
6. Independently evaluate source identity, abstract coverage, supporting passages, claims and applicability.
7. Allow research-scoped approval only against documented thresholds; exclude failed claims where policy permits.
8. Apply bounded extractive correction and repeat evidence review when appropriate.
9. Preserve execution, token usage, source checks, review decisions and immutable prior dossiers.
10. Provide accepted claims, source snapshots, limitations and gaps for Agent 03. Clinical/publishing approval remains separate.

**Evidence:** Agent 02 implementation, live verification and research approval reports are in `docs/`. Some older reports describe superseded rules or historical environments; current `AGENTS.md` and later production records take precedence.

## Agent 03 — Integrative Health Analysis

**Input:** approved Agent 02 research review and accepted packet. **Output:** integrative research analysis and Agent 04 input.

1. Verify owner, Agent 02 approval and execution, input hash, latest review and HOLD.
2. Use accepted claims and source snapshots only; exclude claims rejected upstream.
3. Cover conventional care, nutrition, yoga/movement, sleep/lifestyle, naturopathy, precautions, combined approach and evidence gaps.
4. Map each finding to accepted claims, source IDs, populations, caveats and supporting input.
5. Require all accepted input claims to be represented; identify domains without findings as research gaps.
6. Preserve association versus causation, historical guidance and study/population limitations.
7. Separate serious and mild adverse-event findings; block invented numbers, dosing, treatment substitution and unsupported combined efficacy.
8. Run a separate automated support audit and use bounded revision and re-audit.
9. Save owner-scoped immutable analysis, provenance, usage and quality results.
10. Produce research-only Agent 04 handoff with findings, context, sources, gaps and follow-up research requests.

## Agent 04 — Medical Safety & Fact Checker

**Input:** ready Agent 03 analysis and original accepted research evidence. **Output:** claim-level safety report and research-only Agent 05 packet.

1. Verify ownership, latest Agent 03 analysis, execution provenance, Agent 02 approval and input integrity.
2. Recheck PubMed source identity, retraction indicators and availability of abstracts.
3. Check medical fact support, numeric details, units, rates and denominators.
4. Assess population applicability, evidence quality, abstract limitations and historical guidance.
5. Check association versus causation and prevent unsupported treatment efficacy or guarantees.
6. Protect conventional care; flag unsupported medication changes, dosages, supplement or interaction claims.
7. Check applicable contraindications, vulnerable populations, red flags and escalation needs against available evidence; record missing information as gaps.
8. Check that combined interventions are not presented as proven without direct evidence.
9. Assign each finding PASS, REVISE, EXCLUDE or INSUFFICIENT_EVIDENCE with reasons and safety checks.
10. Use bounded automatic revision and a separate re-audit; unresolved findings remain excluded or block handoff under the documented policy.
11. Record research requests for excluded or unresolved findings and preserve report, sources, checks and provenance.
12. Send only PASS findings to Agent 05, together with audience restrictions, limitations, prohibited statements and gaps.

### Agent 04 — full previously discussed responsibilities

1. Input and provenance: verify content, owner, Topic Brief version, Agent 02 approval and Agent 03 output integrity.
2. Medical fact checking: compare each factual statement, number, unit, percentage and study conclusion with cited evidence.
3. Evidence quality: distinguish guidelines, reviews, trials and observational evidence; identify old, abstract-only or limited sources.
4. Population applicability: prevent results for a specific group being widened to a general audience.
5. Association versus causation: prevent an association becoming a prevention, treatment or guaranteed-benefit claim.
6. Conventional-care protection: prevent yoga, nutrition or naturopathy replacing treatment, screening or medical care.
7. Medication and supplement safety: flag unsupported changes to medication, dose, supplements or interactions.
8. Contraindications and precautions: identify relevant evidence-backed precautions and record unavailable information as a gap.
9. Vulnerable populations: check relevance and restrictions for pregnancy, children, older adults and chronic conditions.
10. Red flags and escalation: identify relevant urgent symptoms/guidance and verify against authoritative evidence.
11. Integrative-combination safety: prevent unsupported combination efficacy or safety conclusions.
12. Risk and denominators: distinguish serious/mild, absolute/relative risk, incidence/prevalence and statistical denominators.
13. Claim-level disposition: PASS, REVISE, EXCLUDE or INSUFFICIENT_EVIDENCE, with reasons and evidence.
14. Missing-evidence routing: route research gaps to Agent 02 and synthesis corrections to Agent 03.
15. Automatic revision and recheck: use bounded retries; hold unresolved findings back.
16. Agent 05 handoff: provide allowed claims, prohibited statements, required caveats, audience restrictions and safe wording.
17. Audit and history: preserve checks, decisions, sources, versions, iterations and executions.

**Live evidence at checkpoint:** latest reported HT-0002 run reviewed 15 findings, passed 13 and excluded 2. These metrics are automated research checks, not clinical approval.

## Agent 05 — YouTube Content Strategist

**Input:** latest ready Agent 04 research safety report. **Output:** bilingual video strategy and Agent 06 script brief.

1. Verify owner, latest report, Agent 04 execution, upstream analysis integrity and HOLD.
2. Use only passed Agent 04 findings; preserve excluded IDs and safety boundaries.
3. Define target audience, audience problem, video objective and evidence-aligned content angle.
4. Suggest relevant keywords and tags; mark them estimated when live search demand is not verified.
5. Create Hinglish and English title options, hooks, descriptions, thumbnail text and safe CTAs.
6. Build an outline with section purpose, approved finding IDs, sources, visual direction and engagement cues.
7. Prepare chapter suggestions and map section facts to the evidence actually assigned to each section.
8. Preserve source/population limitations, conventional-care boundary, uncertainty and excluded topics.
9. Check titles, hooks and visuals for unsupported effectiveness, medical advice, outcome guarantees and clickbait.
10. Audit every editorial field separately; use bounded feedback-driven revision and re-audit.
11. Save versioned owner-scoped strategy, input provenance, audit and usage without overwriting previous reports.
12. Provide Agent 06 with the strategy, accepted evidence, language requirements, restrictions and unresolved gaps.

### Agent 05 — full previously discussed responsibilities

1. Input verification: confirm latest Agent 04 report, owner, content, provenance and research handoff.
2. Approved evidence selection: use only passed findings and their references.
3. Audience definition: identify audience needs, language and knowledge level from the Topic Brief.
4. Video objective: specify what the viewer will understand and take away.
5. Content angle and positioning: choose an audience-relevant angle supported by the available evidence.
6. Search intent and keywords: prepare relevant terms; label them estimated when live search data is unavailable.
7. Title options: create clear, attractive, keyword-aware titles without unsupported health promises or clickbait.
8. Hook: create a factual opening connected to a real audience question.
9. Video outline: arrange introduction, main sections, transitions, recap and conclusion.
10. Section-wise claim mapping: attach approved finding IDs and source references to sections.
11. Integrative framing: present conventional care, nutrition, yoga and lifestyle within available evidence and limits.
12. Safety boundaries and caveats: carry population limits, precautions, evidence gaps and old-source qualifiers into the script brief.
13. Hinglish and English strategy: prepare language, terminology and audience guidance for both versions.
14. Retention and engagement: suggest appropriate questions, examples, recap and visual changes without new unsupported facts.
15. CTA strategy: prepare topic-appropriate safe calls to action without treatment-change instructions or guarantees.
16. Thumbnail and visual direction: suggest thumbnail text and section visuals without medical exaggeration.
17. Description and metadata: draft video description, source references, relevant tags and chapter suggestions.
18. Coverage and quality checks: ensure factual points map to approved evidence and exclude rejected findings.
19. Automatic revision: revise and recheck failed safety, coverage or format checks within defined limits.
20. Audit and history: preserve input report ID, strategy version, model usage, checks and revisions.
21. Agent 06 handoff: provide verified strategy, outline, approved claims, sources, caveats and script-writing instructions.

**Live evidence at checkpoint:** 53/53 editorial fields passed automated review, using 12 approved findings across 6 sections. The two Agent 04 exclusions remain outside the allowed findings. This does not establish clinical or publishing approval.

## Agent 06 — Health YouTube Script Writer: detailed task list

**Status:** planned; these are requirements discussed with the user, not claims of existing behavior. **Input:** Agent 05 research-only brief and safety boundaries. **Output:** Hinglish script, English-only script, mapping/quality report and Agent 07 handoff.

### A. Input and readiness

1. Take the latest ready Agent 05 packet for the same content item.
2. Verify Agent 05 report, Agent 04 safety report and Agent 03 analysis relationships and provenance.
3. Verify input report hash and completed execution status.
4. Reject superseded input if a newer safety report or strategy replaces it.
5. Check HOLD before generation and recheck before saving.
6. Select only Agent 04 PASS findings available through the approved strategy.
7. Prevent excluded claims or unsupported details from entering narration, examples, on-screen text and CTA.

### B. Planning and structure

8. Define the learning objective and expected viewer takeaway from the Agent 05 brief.
9. Match depth, language and examples to the approved audience and its boundaries.
10. Build the sequence: hook, introduction, main sections, recap, safe CTA.
11. State the purpose of each section.
12. Add natural transitions between movement, food, yoga, sleep and other applicable sections.
13. Remove unnecessary repetition while retaining important caveats.
14. Estimate narration word count and speaking duration; distinguish estimate from final edited duration.
15. Provide pacing, emphasis and pause suggestions where useful.

### C. Hinglish script

16. Write natural Hinglish with familiar Hindi and necessary English terminology.
17. Use a conversational tone suited to the viewer rather than a research-report style.
18. Explain necessary medical or technical words in clear, short sentences.
19. Write a factual opening hook without fear, outcome promises or unsupported claims.
20. Produce complete speakable narration from approved findings and the Agent 05 outline.
21. Write a Hinglish recap, conclusion and safe CTA.

### D. English-only script

22. Write natural English narration rather than a mechanical word-for-word translation.
23. Keep factual meaning, audience limits and safety caveats consistent across languages.
24. Keep terminology consistent and understandable across both versions.
25. Produce English hook, conclusion and CTA suited to its audience.
26. Compare versions for newly introduced claims, numbers, changed risks or missing caveats.

### E. Evidence and medical safety

27. Map every factual sentence to approved finding IDs and source IDs.
28. Preserve relevant observational, abstract-only, historical and population-specific limitations.
29. Preserve association versus causation and uncertainty.
30. Verify numbers, units, study size and effect/risk values against approved findings.
31. Preserve severity, denominator and absolute/relative risk distinctions.
32. Do not present historical guidance as confirmed current without verification.
33. Keep conventional medical care, screening and prescribed treatment primary.
34. Block unsupported medication changes, starting/stopping medicines and dosing instructions.
35. Do not claim combined intervention efficacy without direct approved evidence.
36. Preserve boundaries for pregnancy, frailty, acute illness, chronic disease and other relevant groups.
37. Use verified, applicable precautions and red flags; record missing information instead of inventing it.
38. Remove guarantees, miracle/cure claims, fear-based language and misleading before/after promises.
39. Produce a claim-to-source and blocked-claim report.

### F. Viewer experience

40. Use audience-friendly examples that introduce no unsupported medical facts.
41. Add appropriate viewer questions, recaps and retention moments.
42. Provide voiceover tone, pronunciation, emphasis and pause guidance.
43. Create concise on-screen text subject to the same factual and safety checks.
44. Provide general visual cues for Agent 07, without inventing unapproved intervention details.
45. Check that the script fulfills its title and thumbnail framing without overpromising.
46. Support captions and accessibility with clear short sentences.

### G. Automated quality and revision

47. Check both language scripts for complete sections, hook, conclusion and CTA.
48. Independently audit generated factual statements against approved findings and source mappings.
49. Audit language parity for meaning, numbers, exclusions and limitations.
50. Audit audience scope, unsafe advice, medical overstatement and misleading framing.
51. Automatically revise failing sentences or sections using actionable feedback within defined limits.
52. Recheck revisions; never release an unsafe correction.
53. Mark important unresolved issues REVISION_REQUIRED and block downstream handoff.
54. Produce a scorecard for source mapping, factual coverage, safety, language parity and unresolved issues.

### H. Storage and handoff

55. Save linked, versioned Hinglish and English scripts.
56. Preserve old drafts and versions without overwriting them.
57. Record input IDs and hashes, model, runtime, usage, checks and revision history.
58. Send Agent 07 the script sections, narration, on-screen text, visual cues and approved source mappings.
59. Carry excluded findings and unresolved gaps forward as explicit boundaries.
60. Label checks as automated research checks; do not represent them as clinical or publishing approval.

**Agent 06 outputs:** complete Hinglish and English scripts; section-wise narration/on-screen/visual cue sheet; claim and source map; safety and quality scorecard; Agent 07 research-scoped handoff.

## Agents 07–10 — pending detailed definition

- **07 Visual Director:** develop visual direction from Agent 06 script and verified boundaries; full responsibilities and acceptance criteria remain to be agreed.
- **08 Video Production Coordinator:** coordinate approved scripts, visuals and production requirements; detailed scope remains to be agreed.
- **09 Asset Generator:** create assets from authorized production requirements; check existing implementation evidence before declaring its status or expanding scope.
- **10 Video Assembly:** assemble authorized production materials; final publishing is a separate decision and must not be inferred from a research handoff.

## Evidence and maintenance

- Implementation evidence: [Agent 02 reports](.), [Agent 03](agent03-implementation-plan.md), [Agent 04](agent04-implementation-report.md), [Agent 05](agent05-implementation-report.md), and repository `AGENTS.md`.
- This register preserves the discussion and known implementation summaries. For Agent 01 and Agents 07–10, lists marked as pending are placeholders rather than complete inventories.
- Update this register when agent scope, approval, implementation, validation or handoff changes. Preserve the source tracker and existing Project Brain; this file is a consolidated reference, not a replacement for either.
