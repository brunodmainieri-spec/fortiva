-- FORTIVA: run the complete file in the Supabase SQL Editor.
-- Transactional saves, optimistic concurrency, and isolation by auth.uid().
begin;
create table public.fortiva_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null check (jsonb_typeof(document) = 'object'),
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.fortiva_profiles enable row level security;
revoke all on public.fortiva_profiles from anon, authenticated;
grant select on public.fortiva_profiles to authenticated;
create policy own_profile on public.fortiva_profiles for select to authenticated using (user_id = (select auth.uid()));

create table public.fortiva_meals (
 user_id uuid not null references public.fortiva_profiles(user_id) on delete cascade,
 id text not null,
 position integer not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
 primary key (user_id, id)
);
alter table public.fortiva_meals enable row level security;
revoke all on public.fortiva_meals from anon, authenticated;
grant select on public.fortiva_meals to authenticated;
create policy own_records on public.fortiva_meals for select to authenticated using (user_id = (select auth.uid()));
create index fortiva_meals_date on public.fortiva_meals (user_id, (payload->>'date'));

create table public.fortiva_goals (
 user_id uuid not null references public.fortiva_profiles(user_id) on delete cascade,
 id text not null,
 position integer not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'date' = id),
 primary key (user_id, id)
);
alter table public.fortiva_goals enable row level security;
revoke all on public.fortiva_goals from anon, authenticated;
grant select on public.fortiva_goals to authenticated;
create policy own_records on public.fortiva_goals for select to authenticated using (user_id = (select auth.uid()));
create index fortiva_goals_date on public.fortiva_goals (user_id, (payload->>'date'));

create table public.fortiva_measurements (
 user_id uuid not null references public.fortiva_profiles(user_id) on delete cascade,
 id text not null,
 position integer not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
 primary key (user_id, id)
);
alter table public.fortiva_measurements enable row level security;
revoke all on public.fortiva_measurements from anon, authenticated;
grant select on public.fortiva_measurements to authenticated;
create policy own_records on public.fortiva_measurements for select to authenticated using (user_id = (select auth.uid()));
create index fortiva_measurements_date on public.fortiva_measurements (user_id, (payload->>'date'));

create table public.fortiva_plans (
 user_id uuid not null references public.fortiva_profiles(user_id) on delete cascade,
 id text not null,
 position integer not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
 primary key (user_id, id)
);
alter table public.fortiva_plans enable row level security;
revoke all on public.fortiva_plans from anon, authenticated;
grant select on public.fortiva_plans to authenticated;
create policy own_records on public.fortiva_plans for select to authenticated using (user_id = (select auth.uid()));
create index fortiva_plans_date on public.fortiva_plans (user_id, (payload->>'date'));

create table public.fortiva_sessions (
 user_id uuid not null references public.fortiva_profiles(user_id) on delete cascade,
 id text not null,
 position integer not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
 primary key (user_id, id)
);
alter table public.fortiva_sessions enable row level security;
revoke all on public.fortiva_sessions from anon, authenticated;
grant select on public.fortiva_sessions to authenticated;
create policy own_records on public.fortiva_sessions for select to authenticated using (user_id = (select auth.uid()));
create index fortiva_sessions_date on public.fortiva_sessions (user_id, (payload->>'date'));

create table public.fortiva_energy (
 user_id uuid not null references public.fortiva_profiles(user_id) on delete cascade,
 id text not null,
 position integer not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
 primary key (user_id, id)
);
alter table public.fortiva_energy enable row level security;
revoke all on public.fortiva_energy from anon, authenticated;
grant select on public.fortiva_energy to authenticated;
create policy own_records on public.fortiva_energy for select to authenticated using (user_id = (select auth.uid()));
create index fortiva_energy_date on public.fortiva_energy (user_id, (payload->>'date'));

create function public.fortiva_load() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('revision', p.revision, 'document', p.document || jsonb_build_object(
 'meals', coalesce((select jsonb_agg(t.payload order by t.position) from public.fortiva_meals t where t.user_id = p.user_id), '[]'::jsonb),
 'goals', coalesce((select jsonb_agg(t.payload order by t.position) from public.fortiva_goals t where t.user_id = p.user_id), '[]'::jsonb),
 'measurements', coalesce((select jsonb_agg(t.payload order by t.position) from public.fortiva_measurements t where t.user_id = p.user_id), '[]'::jsonb),
 'plans', coalesce((select jsonb_agg(t.payload order by t.position) from public.fortiva_plans t where t.user_id = p.user_id), '[]'::jsonb),
 'sessions', coalesce((select jsonb_agg(t.payload order by t.position) from public.fortiva_sessions t where t.user_id = p.user_id), '[]'::jsonb),
 'energy', coalesce((select jsonb_agg(t.payload order by t.position) from public.fortiva_energy t where t.user_id = p.user_id), '[]'::jsonb)
 )) from public.fortiva_profiles p where p.user_id = auth.uid();
$$;

-- Only this RPC can write. The owner comes exclusively from the JWT, never a parameter.
create function public.fortiva_save(document jsonb, expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
 owner_id uuid := auth.uid();
 current_revision bigint;
 header jsonb;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if expected_revision is null or expected_revision < 0 then raise exception 'Invalid revision'; end if;
 if document->>'version' is distinct from '1' or jsonb_typeof(document->'profile') is distinct from 'object' then
  raise exception 'Invalid document';
 end if;
 if jsonb_typeof(document->'meals') is distinct from 'array' then raise exception 'Invalid meals'; end if;
 if jsonb_typeof(document->'goals') is distinct from 'array' then raise exception 'Invalid goals'; end if;
 if jsonb_typeof(document->'measurements') is distinct from 'array' then raise exception 'Invalid measurements'; end if;
 if jsonb_typeof(document->'plans') is distinct from 'array' then raise exception 'Invalid plans'; end if;
 if jsonb_typeof(document->'sessions') is distinct from 'array' then raise exception 'Invalid sessions'; end if;
 if jsonb_typeof(document->'energy') is distinct from 'array' then raise exception 'Invalid energy'; end if;
 if exists (select 1 from jsonb_array_elements(document->'energy') e where e->>'simulated' is distinct from 'false') then
  raise exception 'Simulated energy is not allowed';
 end if;
 if (select count(distinct nullif(e->>'id', '')) from jsonb_array_elements(document->'meals') e) <> jsonb_array_length(document->'meals') then raise exception 'Invalid or duplicate meals identifier'; end if;
 if (select count(distinct nullif(e->>'date', '')) from jsonb_array_elements(document->'goals') e) <> jsonb_array_length(document->'goals') then raise exception 'Invalid or duplicate goals identifier'; end if;
 if (select count(distinct nullif(e->>'id', '')) from jsonb_array_elements(document->'measurements') e) <> jsonb_array_length(document->'measurements') then raise exception 'Invalid or duplicate measurements identifier'; end if;
 if (select count(distinct nullif(e->>'id', '')) from jsonb_array_elements(document->'plans') e) <> jsonb_array_length(document->'plans') then raise exception 'Invalid or duplicate plans identifier'; end if;
 if (select count(distinct nullif(e->>'id', '')) from jsonb_array_elements(document->'sessions') e) <> jsonb_array_length(document->'sessions') then raise exception 'Invalid or duplicate sessions identifier'; end if;
 if (select count(distinct nullif(e->>'id', '')) from jsonb_array_elements(document->'energy') e) <> jsonb_array_length(document->'energy') then raise exception 'Invalid or duplicate energy identifier'; end if;
 header := document - array['meals','goals','measurements','plans','sessions','energy'];
 header := jsonb_set(header, '{profile,email}', to_jsonb(coalesce(auth.jwt()->>'email', '')));
 insert into public.fortiva_profiles(user_id, document) values (owner_id, header) on conflict do nothing;
 select revision into current_revision from public.fortiva_profiles where user_id = owner_id for update;
 if current_revision <> expected_revision then
  raise exception 'Concurrent update' using errcode = '40001';
 end if;

 delete from public.fortiva_meals where user_id = owner_id
 and id not in (select e->>'id' from jsonb_array_elements(document->'meals') e);
 insert into public.fortiva_meals(user_id, id, position, payload)
 select owner_id, e->>'id', ord::integer, e from jsonb_array_elements(document->'meals') with ordinality a(e, ord)
 on conflict (user_id, id) do update set payload = excluded.payload, position = excluded.position
 where fortiva_meals.payload is distinct from excluded.payload or fortiva_meals.position <> excluded.position;

 delete from public.fortiva_goals where user_id = owner_id
 and id not in (select e->>'date' from jsonb_array_elements(document->'goals') e);
 insert into public.fortiva_goals(user_id, id, position, payload)
 select owner_id, e->>'date', ord::integer, e from jsonb_array_elements(document->'goals') with ordinality a(e, ord)
 on conflict (user_id, id) do update set payload = excluded.payload, position = excluded.position
 where fortiva_goals.payload is distinct from excluded.payload or fortiva_goals.position <> excluded.position;

 delete from public.fortiva_measurements where user_id = owner_id
 and id not in (select e->>'id' from jsonb_array_elements(document->'measurements') e);
 insert into public.fortiva_measurements(user_id, id, position, payload)
 select owner_id, e->>'id', ord::integer, e from jsonb_array_elements(document->'measurements') with ordinality a(e, ord)
 on conflict (user_id, id) do update set payload = excluded.payload, position = excluded.position
 where fortiva_measurements.payload is distinct from excluded.payload or fortiva_measurements.position <> excluded.position;

 delete from public.fortiva_plans where user_id = owner_id
 and id not in (select e->>'id' from jsonb_array_elements(document->'plans') e);
 insert into public.fortiva_plans(user_id, id, position, payload)
 select owner_id, e->>'id', ord::integer, e from jsonb_array_elements(document->'plans') with ordinality a(e, ord)
 on conflict (user_id, id) do update set payload = excluded.payload, position = excluded.position
 where fortiva_plans.payload is distinct from excluded.payload or fortiva_plans.position <> excluded.position;

 delete from public.fortiva_sessions where user_id = owner_id
 and id not in (select e->>'id' from jsonb_array_elements(document->'sessions') e);
 insert into public.fortiva_sessions(user_id, id, position, payload)
 select owner_id, e->>'id', ord::integer, e from jsonb_array_elements(document->'sessions') with ordinality a(e, ord)
 on conflict (user_id, id) do update set payload = excluded.payload, position = excluded.position
 where fortiva_sessions.payload is distinct from excluded.payload or fortiva_sessions.position <> excluded.position;

 delete from public.fortiva_energy where user_id = owner_id
 and id not in (select e->>'id' from jsonb_array_elements(document->'energy') e);
 insert into public.fortiva_energy(user_id, id, position, payload)
 select owner_id, e->>'id', ord::integer, e from jsonb_array_elements(document->'energy') with ordinality a(e, ord)
 on conflict (user_id, id) do update set payload = excluded.payload, position = excluded.position
 where fortiva_energy.payload is distinct from excluded.payload or fortiva_energy.position <> excluded.position;

 update public.fortiva_profiles set document = header, revision = current_revision + 1, updated_at = now() where user_id = owner_id;
 return current_revision + 1;
end;
$$;
revoke all on function public.fortiva_load() from public, anon;
revoke all on function public.fortiva_save(jsonb, bigint) from public, anon;
grant execute on function public.fortiva_load() to authenticated;
grant execute on function public.fortiva_save(jsonb, bigint) to authenticated;
commit;
