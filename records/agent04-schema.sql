create table public.medical_safety_reports (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 content_item_id uuid not null references public.content_items(id),
 analysis_id uuid not null references public.integrative_analysis_dossiers(id),
 execution_id uuid not null references public.agent_executions(id),
 input_sha256 text not null check(length(input_sha256)=64),
 safety_status text not null check(safety_status in ('READY_FOR_AGENT05','READY_FOR_AGENT05_WITH_EXCLUSIONS','REVISION_REQUIRED')),
 report jsonb not null,
 created_at timestamptz not null default now()
);
create index medical_safety_owner_content_idx on public.medical_safety_reports(owner_id,content_item_id,created_at desc);
create index medical_safety_analysis_idx on public.medical_safety_reports(analysis_id);
create index medical_safety_execution_idx on public.medical_safety_reports(execution_id);
alter table public.medical_safety_reports enable row level security;
create policy "Owners read own medical safety reports" on public.medical_safety_reports for select to authenticated using ((select auth.uid())=owner_id);
grant select on public.medical_safety_reports to authenticated;
create function public.prevent_medical_safety_mutation() returns trigger language plpgsql security invoker set search_path='' as $$ begin raise exception 'Medical safety reports are append-only'; end $$;
revoke all on function public.prevent_medical_safety_mutation() from public,anon,authenticated;
create trigger medical_safety_append_only before update or delete on public.medical_safety_reports for each row execute function public.prevent_medical_safety_mutation();
