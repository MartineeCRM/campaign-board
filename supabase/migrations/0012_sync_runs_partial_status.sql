alter table public.sync_runs
  drop constraint if exists sync_runs_status_check;

alter table public.sync_runs
  add constraint sync_runs_status_check
  check (status in ('running', 'success', 'partial', 'error'));
