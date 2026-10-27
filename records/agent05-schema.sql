create table public.content_strategy_reports (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 content_item_id uuid not null references public.content_items(id),
 safety_report_id uuid not null references public.medical_safety_reports(id),
 execution_id uuid not null references public.agent_executions(id),
 input_sha256 text not null check(length(input_sha256)=64),
 strategy_status text not null check(strategy_status in ('READY_FOR_AGENT06','REVISION_REQUIRED')),
 report jsonb not null,
 created_at timestamptz not null default now()
);
create index content_strategy_owner_content_idx on public.content_strategy_reports(owner_id,content_item_id,created_at desc);
create index content_strategy_safety_idx on public.content_strategy_reports(safety_report_id);
create index content_strategy_execution_idx on public.content_strategy_reports(execution_id);
alter table public.content_strategy_reports enable row level security;
create policy "Owners read own content strategies" on public.content_strategy_reports for select to authenticated using ((select auth.uid())=owner_id);
grant select on public.content_strategy_reports to authenticated;
create function public.prevent_content_strategy_mutation() returns trigger language plpgsql security invoker set search_path='' as $$ begin raise exception 'Content strategy reports are append-only'; end $$;
revoke all on function public.prevent_content_strategy_mutation() from public,anon,authenticated;
create trigger content_strategy_append_only before update or delete on public.content_strategy_reports for each row execute function public.prevent_content_strategy_mutation();
