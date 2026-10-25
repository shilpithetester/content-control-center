import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateClaims, validateSourceLimit } from "./safety-gate.mjs";
import { parseAbstracts, fetchEvidence, routineSourceEligible } from "./evidence-utils.mjs";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const now = () => new Date().toISOString();
const RUNTIME_REVISION = "agent02-routine-quality-20261026";
type Source = { source_id: string; title: string; authors_or_organization: string; publisher_or_journal: string; publication_date: string; accessed_at: string; url: string; doi_or_identifier: string; document_type: string; verification_status: "METADATA_VERIFIED"; verification_method: string; limitations: string; abstract_text?: string; abstract_retrieval_status?: string };
function asStrings(x: unknown): string[] { return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : []; }
function parseModel(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid model object");
  return parsed;
}
async function pubmedSearch(query: string, max: number, cutoff: string): Promise<Source[]> {
  const params = new URLSearchParams({ db: "pubmed", term: query, retmode: "json", retmax: String(max), sort: "relevance", datetype: "pdat", mindate: "1900/01/01", maxdate: cutoff.replaceAll("-", "/") });
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const search = await fetchEvidence("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + params, { signal: controller.signal });
    if (!search.ok) throw new Error("PubMed search HTTP " + search.status);
    const ids = asStrings((await search.json())?.esearchresult?.idlist).slice(0, max);
    if (!ids.length) return [];
    const summary = await fetchEvidence("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?" + new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" }), { signal: controller.signal });
    if (!summary.ok) throw new Error("PubMed metadata HTTP " + summary.status);
    const result = (await summary.json())?.result || {};
    return ids.flatMap((id): Source[] => {
      const item = result[id]; if (!item || !item.title) return [];
      const doi = (item.articleids || []).find((v: { idtype?: string }) => v.idtype === "doi")?.value || "";
      return [{ source_id: "PMID:" + id, title: String(item.title), authors_or_organization: (item.authors || []).map((a: { name?: string }) => a.name || "").filter(Boolean).join(", "), publisher_or_journal: String(item.fulljournalname || item.source || ""), publication_date: String(item.pubdate || ""), accessed_at: now(), url: "https://pubmed.ncbi.nlm.nih.gov/" + id + "/", doi_or_identifier: doi ? "DOI:" + doi : "PMID:" + id, document_type: String(item.pubtype?.join(", ") || "PubMed indexed publication"), verification_status: "METADATA_VERIFIED", verification_method: "NCBI E-utilities esearch+esummary; content-level claim verification NOT performed", limitations: "Bibliographic metadata verified only; not proof that the paper supports a specific claim" }];
    });
  } finally { clearTimeout(timeout); }
}
async function enrichAbstracts(sources: Source[]): Promise<Source[]> {
  if (!sources.length) return sources;
  const ids = sources.map(s => s.source_id.replace("PMID:", "")).filter(id => /^\d+$/.test(id));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchEvidence("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" +
      new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "xml" }), { signal: controller.signal });
    if (!response.ok) throw new Error("PubMed abstract HTTP " + response.status);
    const xml = await response.text();
    const abstractById = parseAbstracts(xml);
    return sources.map(source => ({ ...source, abstract_text: abstractById.get(source.source_id) || "",
      abstract_retrieval_status: abstractById.has(source.source_id) ? "ABSTRACT_RETRIEVED_UNVERIFIED" : "ABSTRACT_UNAVAILABLE" }));
  } catch {
    return sources.map(source => ({ ...source, abstract_text: "", abstract_retrieval_status: "ABSTRACT_FETCH_FAILED" }));
  } finally { clearTimeout(timeout); }
}
async function synthesize(apiKey: string, model: string, topic: string, questions: string[], sources: Source[]) {
  const system = "You are a medical literature research assistant. Return only strict compact JSON. Use ONLY supplied bibliographic metadata and explicitly provided PubMed abstracts when available; never claim to have read full texts. Abstracts are not independent verification. No diagnosis, prescribing, dosing or clinical approval. Every claim must be UNVERIFIED until content-level evidence is independently checked. If uncertain say so. No invented citations. Keep output concise: at most 12 claims, one or two per covered domain; avoid repeating source metadata or safety disclaimers in every field. Keep each string under 600 characters.";
  const prompt = JSON.stringify({ topic, questions: questions.slice(0, 8), sources, output_shape: { medical_summary: "string", medical_claims: [{ claim_id: "C1", statement: "string", source_ids: ["PMID:..."], evidence_strength: "UNKNOWN", verification_status: "UNVERIFIED", applicable_population: "string", caveats: "string", risk_flags: [] }], clinical_guidelines: [], contraindications: [], drug_interactions_or_precautions: [], vulnerable_populations: [], red_flags: [], evidence_gaps: [], research_confidence: "LOW" } });
  const response = await fetch("https://api.deepseek.com/chat/completions", { signal: AbortSignal.timeout(75000), method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model, temperature: 0.1, max_tokens: 8000, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }) });
  const data = await response.json(); if (!response.ok) throw new Error("DeepSeek failed: " + (data.error?.message || response.status));
  if (data.choices?.[0]?.finish_reason === "length") throw new Error("Medical research output truncated");
  const usage = data.usage && typeof data.usage === "object" ? Object.fromEntries(["prompt_tokens", "completion_tokens", "total_tokens"].filter(k => Number.isSafeInteger(data.usage[k]) && data.usage[k] >= 0).map(k => [k, data.usage[k]])) : {};
  return { raw: parseModel(String(data.choices?.[0]?.message?.content || "")), usage };
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);
  const runStartedMs = Date.now();
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401);
  const owner = auth.user.id;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'JSON object required' }, 400);
  if (body.action === "LIST_DOSSIERS") {
    const contentId = String(body.content_id || "");
    if (!/^HT-[0-9]+$/.test(contentId)) return reply({ error: "Valid content_id required" }, 400);
    const { data: item, error: itemError } = await admin.from("content_items").select("id").eq("content_id", contentId).eq("owner_id", owner).maybeSingle();
    if (itemError || !item) return reply({ error: "Content not found" }, 404);
    const { data: dossiers, error: listError } = await admin.from("medical_research_dossiers").select("id,topic_brief_version,research_status,dossier,created_at").eq("owner_id", owner).eq("content_item_id", item.id).order("created_at", { ascending: false }).limit(5);
    if (listError) return reply({ error: "Dossier retrieval failed" }, 500);
    return reply({ ok: true, dossiers: dossiers || [] });
  }

  const contentId = String(body.content_id || "");
  const version = Number(body.topic_brief_version);
  if (!/^HT-[0-9]+$/.test(contentId) || !Number.isSafeInteger(version) || version < 1) return reply({ error: "Valid content_id and topic_brief_version required" }, 400);
  if (body.contract_version !== 1 || body.research_mode !== "EVIDENCE_FIRST") return reply({ error: "Unsupported contract or research mode" }, 400);
  const cutoff = String(body.evidence_cutoff_date || now().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || Number.isNaN(Date.parse(cutoff)) || new Date(cutoff).toISOString().slice(0, 10) !== cutoff || cutoff > now().slice(0, 10)) return reply({ error: "Invalid cutoff date" }, 400);
  let limit: number;
  try { limit = validateSourceLimit(body.max_sources); } catch (error) { return reply({ error: String(error) }, 400); }
  const { data: item } = await admin.from("content_items").select("id,content_id,topic,hold").eq("content_id", contentId).eq("owner_id", owner).maybeSingle();
  if (!item) return reply({ error: "Content not found" }, 404);
  if (item.hold) return reply({ error: "Content is on HOLD" }, 409);
  const { data: brief, error: briefError } = await admin.from("topic_briefs").select("*").eq("owner_id", owner).eq("content_item_id", item.id).eq("version", version).maybeSingle();
  if (briefError || !brief) return reply({ error: "Immutable Topic Brief version not found" }, 404);
  const questions = asStrings(brief.research_questions);
  const queries = asStrings(brief.search_queries);
  if (!questions.length || !queries.length) return reply({ error: "Topic Brief lacks research questions or search queries" }, 422);
  const { data: cfg } = await admin.from("llm_settings").select("provider,model").eq("owner_id", owner).maybeSingle();
  if (cfg?.provider !== "deepseek") return reply({ error: "Agent 02 draft runner supports DeepSeek only" }, 422);
  const key = Deno.env.get("DEEPSEEK_API_KEY"); if (!key) return reply({ error: "DeepSeek key unavailable" }, 503);
  const { data: execution, error: executionError } = await admin.from("agent_executions").insert({ owner_id: owner, content_item_id: item.id, agent_code: "AGENT_02", agent_name: "Medical Research", status: "RUNNING", started_at: now(), input: { contract_version: 1, topic_brief_version: version, evidence_cutoff_date: cutoff, max_sources: limit } }).select("id").single();
  if (executionError) return reply({ error: "Execution log creation failed: " + executionError.message }, 500);
  try {
    const unique = new Map<string, Source>();
    const retrievalFailures: string[] = [];
    // Balanced evidence retrieval: each category gets its own source allocation.
    // Do not let the first (often disease-specific) query consume the full source budget.
    const dailyRoutine = /daily routine|healthy routine|daily habits|दिनचर्या/i.test(String(item.topic));
    const evidenceDomains = dailyRoutine ? [
      { name: "physical_activity", query: '("physical activity" OR exercise) AND ("healthy adults" OR "general population") AND (guideline[pt] OR systematic review[pt])' },
      { name: "sleep", query: '("sleep duration"[Title] OR "sleep hygiene"[Title] OR "recommended amount of sleep"[Title]) AND adults AND (guideline[pt] OR systematic review[pt] OR consensus[Title])' },
      { name: "nutrition", query: '("healthy dietary patterns" OR "healthy diet") AND adults AND (systematic review[pt] OR guideline[pt])' },
      { name: "sedentary", query: '("sedentary behavior" OR "sitting breaks") AND adults AND (systematic review[pt] OR randomized controlled trial[pt])' },
      { name: "yoga_safety", query: 'yoga[Title] AND (safety[Title] OR adverse[Title] OR injuries[Title] OR contraindications[Title]) AND (systematic review[pt] OR review[pt])' },
      { name: "hydration", query: '("water intake" OR hydration) AND adults AND (systematic review[pt] OR review[pt])' }
    ] : queries.slice(0, 8).map((query, i) => ({ name: "topic_" + (i + 1), query }));
    const retrievalAudit: Record<string, { query: string; found: number; selected: number; error?: string }> = {};
    const selectedByDomain: Record<string, Source[]> = {};
    const domainResults = [];
    for (const domain of evidenceDomains) {
      const result = await (async () => {
      try {
        const found = await pubmedSearch(domain.query, 15, cutoff);
        const eligible = dailyRoutine
          ? found.filter(x => routineSourceEligible(x, domain.name, cutoff))
          : found;
        return { domain, found: found.length, selected: eligible.slice(0, 2) };
      } catch (error) { return { domain, found: 0, selected: [] as Source[], error: String(error) }; }
      })();
      domainResults.push(result);
    }
    for (const result of domainResults) {
      selectedByDomain[result.domain.name] = result.selected;
      retrievalAudit[result.domain.name] = { query: result.domain.query, found: result.found, selected: result.selected.length,
        ...(result.error ? { error: result.error } : {}) };
      if (result.error) retrievalFailures.push(result.domain.name + ": " + result.error);
    }
    // Round-robin prevents early domains from crowding out later domains.
    for (let round = 0; round < 2; round++) {
      for (const domain of evidenceDomains) {
        const source = selectedByDomain[domain.name]?.[round];
        if (source && unique.size < limit) unique.set(source.source_id, source);
      }
    }
    const sources = await enrichAbstracts([...unique.values()]);
    for (const domain of evidenceDomains) retrievalAudit[domain.name].selected = selectedByDomain[domain.name].filter(source => unique.has(source.source_id)).length;
    if (!sources.length) throw new Error("No retrievable PubMed sources. Research cannot be evidence verified.");
    const coverageGaps = evidenceDomains.filter(x => !retrievalAudit[x.name].selected).map(x => "No suitable PubMed source retained within the source budget for " + x.name + ".");
    const usableSources = sources.filter(source => Boolean(source.abstract_text?.trim()));
    if (!usableSources.length) throw new Error("No PubMed abstracts available; refusing metadata-only medical synthesis");
    const synthesis = await synthesize(key, String(cfg.model || "deepseek-chat"), String(item.topic), questions, usableSources);
    const clean = validateClaims(synthesis.raw, usableSources);
    const executionAudit = { runtime_revision: RUNTIME_REVISION, model: String(cfg.model || "deepseek-chat"), elapsed_ms: Date.now() - runStartedMs, usage: synthesis.usage, usage_available: Object.keys(synthesis.usage).length > 0, retrieved_sources: sources.length, abstract_bearing_sources: usableSources.length };
    const dossier = { execution_audit: executionAudit, contract_version: 1, content_id: contentId, topic_brief_version: version, evidence_cutoff_date: cutoff, medical_summary: clean.medical_summary, evidence_sources: sources, medical_claims: clean.medical_claims, clinical_guidelines: clean.clinical_guidelines, contraindications: clean.contraindications, drug_interactions_or_precautions: clean.drug_interactions_or_precautions, vulnerable_populations: clean.vulnerable_populations, red_flags: clean.red_flags, evidence_gaps: [...clean.evidence_gaps, ...coverageGaps, ...(retrievalFailures.length ? ["Some PubMed retrieval requests failed; source coverage may be incomplete."] : [])], retrieval_audit: retrievalAudit, research_confidence: "LOW", research_status: "NEEDS_SOURCE_VERIFICATION", requires_medical_review: true, recommended_next_step: "MANUAL_SOURCE_VERIFICATION", agent03_handoff_allowed: false };
    const { data: saved, error: saveError } = await admin.from("medical_research_dossiers").insert({ owner_id: owner, content_item_id: item.id, topic_brief_version: version, execution_id: execution.id, contract_version: 1, research_status: "NEEDS_SOURCE_VERIFICATION", dossier }).select("id,created_at").single();
    if (saveError) throw new Error("Dossier persistence failed: " + saveError.message);
    await admin.from("agent_executions").update({ status: "COMPLETED", finished_at: now(), model: "deepseek:" + cfg.model, output: { dossier_id: saved.id, research_status: dossier.research_status, execution_audit: executionAudit } }).eq("id", execution.id).eq("owner_id", owner);
    return reply({ ok: true, dossier_id: saved.id, research_status: dossier.research_status, medical_review_required: true, source_count: sources.length, next_stage: "MANUAL_SOURCE_VERIFICATION" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("agent_executions").update({ status: "FAILED", error_message: message, finished_at: now() }).eq("id", execution.id).eq("owner_id", owner);
    return reply({ error: message, execution_id: execution.id }, 500);
  }
});

