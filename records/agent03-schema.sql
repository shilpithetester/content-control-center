create table if not exists public.integrative_analysis_dossiers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 content_item_id uuid not null references public.content_items(id),
 research_review_id uuid not null references public.medical_research_reviews(id),
 research_dossier_id uuid not null references public.medical_research_dossiers(id),
 execution_id uuid not null references public.agent_executions(id),
 input_sha256 text not null check (length(input_sha256)=64),
 analysis_status text not null check (analysis_status in ('READY_FOR_AGENT04','REVISION_REQUIRED')),
 dossier jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists integrative_analysis_owner_content_idx on public.integrative_analysis_dossiers(owner_id,content_item_id,created_at desc);
alter table public.integrative_analysis_dossiers enable row level security;
create policy "Owners read own integrative analysis" on public.integrative_analysis_dossiers for select to authenticated using ((select auth.uid())=owner_id);
grant select on public.integrative_analysis_dossiers to authenticated;
-- No client insert/update/delete policies. Authenticated Edge Function performs scoped inserts only.
create or replace function public.prevent_integrative_analysis_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Integrative analysis artifacts are append-only'; end $$;
revoke all on function public.prevent_integrative_analysis_mutation() from public,anon,authenticated;
create trigger integrative_analysis_append_only before update or delete on public.integrative_analysis_dossiers for each row execute function public.prevent_integrative_analysis_mutation();
