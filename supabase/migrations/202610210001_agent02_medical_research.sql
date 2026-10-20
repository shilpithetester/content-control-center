-- Agent 02 draft schema: apply only after separate environment-specific migration approval.
create table if not exists public.medical_research_dossiers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 content_item_id uuid not null references public.content_items(id),
 topic_brief_version integer not null check (topic_brief_version > 0),
 execution_id uuid references public.agent_executions(id),
 contract_version integer not null default 1,
 research_status text not null check (research_status in ('NEEDS_SOURCE_VERIFICATION','NEEDS_REVIEW','APPROVED_FOR_HANDOFF','REJECTED','HOLD')),
 dossier jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists medical_research_dossiers_owner_content_idx on public.medical_research_dossiers(owner_id,content_item_id,created_at desc);
alter table public.medical_research_dossiers enable row level security;
create policy "Owners can read own medical research" on public.medical_research_dossiers for select to authenticated using (owner_id = auth.uid());
-- Deliberately no direct client write policy: authenticated Edge Function validates inputs and uses service role.
