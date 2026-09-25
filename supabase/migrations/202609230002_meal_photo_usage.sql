-- Run once in the Supabase SQL Editor, after the initial FORTIVA migration.
begin;
create table public.fortiva_photo_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  calls integer not null check (calls between 1 and 30),
  last_requested_at timestamptz not null,
  primary key (user_id, usage_day)
);
alter table public.fortiva_photo_usage enable row level security;
revoke all on public.fortiva_photo_usage from public, anon, authenticated;

create function public.fortiva_claim_photo_analysis() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  accepted boolean := false;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.fortiva_photo_usage(user_id, usage_day, calls, last_requested_at)
    values (caller, (now() at time zone 'UTC')::date, 1, now())
  on conflict (user_id, usage_day) do update
    set calls = fortiva_photo_usage.calls + 1, last_requested_at = now()
    where fortiva_photo_usage.calls < 30
      and fortiva_photo_usage.last_requested_at <= now() - interval '10 seconds'
  returning true into accepted;
  return coalesce(accepted, false);
end;
$$;
revoke all on function public.fortiva_claim_photo_analysis() from public, anon;
grant execute on function public.fortiva_claim_photo_analysis() to authenticated;
commit;
