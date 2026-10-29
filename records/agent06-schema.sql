create table public.script_dossiers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 content_item_id uuid not null references public.content_items(id),
 strategy_report_id uuid not null references public.content_strategy_reports(id),
 execution_id uuid not null references public.agent_executions(id),
 input_sha256 text not null check(length(input_sha256)=64),
 script_status text not null check(script_status in ('READY_FOR_AGENT07','REVISION_REQUIRED')),
 dossier jsonb not null,
 created_at timestamptz not null default now()
);
create index script_dossiers_owner_content_idx on public.script_dossiers(owner_id,content_item_id,created_at desc);
create index script_dossiers_strategy_idx on public.script_dossiers(strategy_report_id);
create index script_dossiers_execution_idx on public.script_dossiers(execution_id);
alter table public.script_dossiers enable row level security;
create policy "Owners read own script dossiers" on public.script_dossiers for select to authenticated using ((select auth.uid())=owner_id);
grant select on public.script_dossiers to authenticated;
create function public.prevent_script_dossier_mutation() returns trigger language plpgsql security invoker set search_path='' as $$ begin raise exception 'Script dossiers are append-only'; end $$;
revoke all on function public.prevent_script_dossier_mutation() from public,anon,authenticated;
create trigger script_dossiers_append_only before update or delete on public.script_dossiers for each row execute function public.prevent_script_dossier_mutation();
