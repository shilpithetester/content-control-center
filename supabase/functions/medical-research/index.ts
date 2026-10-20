import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const now = () => new Date().toISOString();
const MAX_SOURCES = 12;
type Source = { source_id: string; title: string; authors_or_organization: string; publisher_or_journal: string; publication_date: string; accessed_at: string; url: string; doi_or_identifier: string; document_type: string; verification_status: "METADATA_VERIFIED"; verification_method: string; limitations: string };
function asStrings(x: unknown): string[] { return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : []; }
function parseModel(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid model object");
  return parsed;
}
async function pubmedSearch(query: string, max: number, cutoff: string): Promise<Source[]> {
  const params = new URLSearchParams({ db: "pubmed", term: query, retmode: "json", retmax: String(max), datetype: "pdat", mindate: "1900/01/01", maxdate: cutoff.replaceAll("-", "/") });
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const search = await fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + params, { signal: controller.signal });
    if (!search.ok) throw new Error("PubMed search HTTP " + search.status);
    const ids = asStrings((await search.json())?.esearchresult?.idlist).slice(0, max);
    if (!ids.length) return [];
    const summary = await fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?" + new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" }), { signal: controller.signal });
    if (!summary.ok) throw new Error("PubMed metadata HTTP " + summary.status);
    const result = (await summary.json())?.result || {};
    return ids.flatMap((id): Source[] => {
      const item = result[id]; if (!item || !item.title) return [];
      const doi = (item.articleids || []).find((v: { idtype?: string }) => v.idtype === "doi")?.value || "";
      return [{ source_id: "PMID:" + id, title: String(item.title), authors_or_organization: (item.authors || []).map((a: { name?: string }) => a.name || "").filter(Boolean).join(", "), publisher_or_journal: String(item.fulljournalname || item.source || ""), publication_date: String(item.pubdate || ""), accessed_at: now(), url: "https://pubmed.ncbi.nlm.nih.gov/" + id + "/", doi_or_identifier: doi ? "DOI:" + doi : "PMID:" + id, document_type: String(item.pubtype?.join(", ") || "PubMed indexed publication"), verification_status: "METADATA_VERIFIED", verification_method: "NCBI E-utilities esearch+esummary; content-level claim verification NOT performed", limitations: "Bibliographic metadata verified only; not proof that the paper supports a specific claim" }];
    });
  } finally { clearTimeout(timeout); }
}
async function synthesize(apiKey: string, model: string, topic: string, questions: string[], sources: Source[]) {
  const system = "You are a medical literature research assistant. Return only strict compact JSON. Use ONLY provided bibliographic metadata; never claim to have read full texts. No diagnosis, prescribing, dosing or clinical approval. Every claim must be UNVERIFIED until content-level evidence is independently checked. If uncertain say so. No invented citations.";
  const prompt = JSON.stringify({ topic, questions: questions.slice(0, 8), sources, output_shape: { medical_summary: "string", medical_claims: [{ claim_id: "C1", statement: "string", source_ids: ["PMID:..."], evidence_strength: "UNKNOWN", verification_status: "UNVERIFIED", applicable_population: "string", caveats: "string", risk_flags: [] }], clinical_guidelines: [], contraindications: [], drug_interactions_or_precautions: [], vulnerable_populations: [], red_flags: [], evidence_gaps: [], research_confidence: "LOW" } });
  const response = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model, temperature: 0.1, max_tokens: 4000, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }) });
  const data = await response.json(); if (!response.ok) throw new Error("DeepSeek failed: " + (data.error?.message || response.status));
  if (data.choices?.[0]?.finish_reason === "length") throw new Error("Medical research output truncated");
  return parseModel(String(data.choices?.[0]?.message?.content || ""));
}
function validate(raw: Record<string, unknown>, sources: Source[]) {
  const ids = new Set(sources.map(s => s.source_id));
  if (typeof raw.medical_summary !== "string" || !raw.medical_summary.trim()) throw new Error("Missing medical_summary");
  if (!Array.isArray(raw.medical_claims)) throw new Error("Missing medical_claims");
  const claims = raw.medical_claims.map((claim: Record<string, unknown>, index: number) => {
    if (!claim || typeof claim.statement !== "string" || !claim.statement.trim()) throw new Error("Invalid claim " + index);
    const references = asStrings(claim.source_ids);
    if (references.some(ref => !ids.has(ref))) throw new Error("Claim references unknown source");
    return { claim_id: "C" + (index + 1), statement: claim.statement, source_ids: references, evidence_strength: "UNKNOWN", verification_status: "UNVERIFIED", applicable_population: String(claim.applicable_population || ""), caveats: String(claim.caveats || ""), risk_flags: asStrings(claim.risk_flags) };
  });
  return { medical_summary: raw.medical_summary, medical_claims: claims, clinical_guidelines: [], contraindications: asStrings(raw.contraindications), drug_interactions_or_precautions: asStrings(raw.drug_interactions_or_precautions), vulnerable_populations: asStrings(raw.vulnerable_populations), red_flags: asStrings(raw.red_flags), evidence_gaps: asStrings(raw.evidence_gaps), research_confidence: "LOW" };
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401);
  const owner = auth.user.id;
  const body = await request.json().catch(() => ({}));
  const contentId = String(body.content_id || "");
  const version = Number(body.topic_brief_version);
  if (!/^HT-[0-9]+$/.test(contentId) || !Number.isSafeInteger(version) || version < 1) return reply({ error: "Valid content_id and topic_brief_version required" }, 400);
  if (body.contract_version !== 1 || body.research_mode !== "EVIDENCE_FIRST") return reply({ error: "Unsupported contract or research mode" }, 400);
  const cutoff = String(body.evidence_cutoff_date || now().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || Number.isNaN(Date.parse(cutoff))) return reply({ error: "Invalid cutoff date" }, 400);
  const limit = Math.min(MAX_SOURCES, Math.max(1, Number(body.max_sources) || 8));
  const { data: item } = await admin.from("content_items").select("id,topic,hold").eq("id", contentId).eq("owner_id", owner).maybeSingle();
  if (!item) return reply({ error: "Content not found" }, 404);
  if (item.hold) return reply({ error: "Content is on HOLD" }, 409);
  const { data: brief, error: briefError } = await admin.from("topic_briefs").select("*").eq("owner_id", owner).eq("content_item_id", contentId).eq("version", version).maybeSingle();
  if (briefError || !brief) return reply({ error: "Immutable Topic Brief version not found" }, 404);
  const questions = asStrings(brief.research_questions);
  const queries = asStrings(brief.search_queries);
  if (!questions.length || !queries.length) return reply({ error: "Topic Brief lacks research questions or search queries" }, 422);
  const { data: cfg } = await admin.from("llm_settings").select("provider,model").eq("owner_id", owner).maybeSingle();
  if (cfg?.provider !== "deepseek") return reply({ error: "Agent 02 draft runner supports DeepSeek only" }, 422);
  const key = Deno.env.get("DEEPSEEK_API_KEY"); if (!key) return reply({ error: "DeepSeek key unavailable" }, 503);
  const { data: execution, error: executionError } = await admin.from("agent_executions").insert({ owner_id: owner, content_item_id: contentId, agent_code: "AGENT_02", agent_name: "Medical Research", status: "RUNNING", started_at: now(), input: { contract_version: 1, topic_brief_version: version, evidence_cutoff_date: cutoff, max_sources: limit } }).select("id").single();
  if (executionError) return reply({ error: "Execution log creation failed: " + executionError.message }, 500);
  try {
    const unique = new Map<string, Source>();
    for (const query of queries.slice(0, 3)) {
      const found = await pubmedSearch(query, Math.min(5, limit), cutoff);
      for (const source of found) { if (unique.size < limit) unique.set(source.source_id, source); }
      if (unique.size >= limit) break;
    }
    const sources = [...unique.values()];
    if (!sources.length) throw new Error("No retrievable PubMed sources. Research cannot be evidence verified.");
    const raw = await synthesize(key, String(cfg.model || "deepseek-chat"), String(item.topic), questions, sources);
    const clean = validate(raw, sources);
    const dossier = { contract_version: 1, content_id: contentId, topic_brief_version: version, evidence_cutoff_date: cutoff, medical_summary: clean.medical_summary, evidence_sources: sources, medical_claims: clean.medical_claims, clinical_guidelines: clean.clinical_guidelines, contraindications: clean.contraindications, drug_interactions_or_precautions: clean.drug_interactions_or_precautions, vulnerable_populations: clean.vulnerable_populations, red_flags: clean.red_flags, evidence_gaps: clean.evidence_gaps, research_confidence: "LOW", research_status: "NEEDS_SOURCE_VERIFICATION", requires_medical_review: true, recommended_next_step: "INTEGRATIVE_ANALYSIS", agent03_handoff_allowed: false };
    const { data: saved, error: saveError } = await admin.from("medical_research_dossiers").insert({ owner_id: owner, content_item_id: contentId, topic_brief_version: version, execution_id: execution.id, contract_version: 1, research_status: "NEEDS_SOURCE_VERIFICATION", dossier }).select("id,created_at").single();
    if (saveError) throw new Error("Dossier persistence failed: " + saveError.message);
    await admin.from("agent_executions").update({ status: "COMPLETED", finished_at: now(), model: "deepseek:" + cfg.model, output: { dossier_id: saved.id, research_status: dossier.research_status } }).eq("id", execution.id).eq("owner_id", owner);
    return reply({ ok: true, dossier_id: saved.id, research_status: dossier.research_status, medical_review_required: true, source_count: sources.length, next_stage: "MANUAL_SOURCE_VERIFICATION" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("agent_executions").update({ status: "FAILED", error_message: message, finished_at: now() }).eq("id", execution.id).eq("owner_id", owner);
    return reply({ error: message, execution_id: execution.id }, 500);
  }
});
