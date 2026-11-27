-- Clarofin 2.0 Cloud Edition: estado financeiro privado por usuário.
-- O snapshot versionado preserva as entidades já existentes no aplicativo e
-- permite sincronização atômica entre dispositivos sem expor dados de terceiros.

create table public.clarofin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clarofin_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object' and state ? 'transactions'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clarofin_sync_metadata (
  user_id uuid primary key references auth.users(id) on delete cascade,
  local_imported_at timestamptz,
  last_confirmed_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clarofin_states_updated_at_idx on public.clarofin_states (updated_at desc);

create function public.clarofin_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clarofin_profiles_set_updated_at before update on public.clarofin_profiles for each row execute function public.clarofin_set_updated_at();
create trigger clarofin_states_set_updated_at before update on public.clarofin_states for each row execute function public.clarofin_set_updated_at();
create trigger clarofin_sync_metadata_set_updated_at before update on public.clarofin_sync_metadata for each row execute function public.clarofin_set_updated_at();

alter table public.clarofin_profiles enable row level security;
alter table public.clarofin_states enable row level security;
alter table public.clarofin_sync_metadata enable row level security;

grant select, insert, update, delete on public.clarofin_profiles to authenticated;
grant select, insert, update, delete on public.clarofin_states to authenticated;
grant select, insert, update, delete on public.clarofin_sync_metadata to authenticated;
revoke all on public.clarofin_profiles, public.clarofin_states, public.clarofin_sync_metadata from anon;

create policy "clarofin_profiles_select_own" on public.clarofin_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "clarofin_profiles_insert_own" on public.clarofin_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clarofin_profiles_update_own" on public.clarofin_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "clarofin_profiles_delete_own" on public.clarofin_profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "clarofin_states_select_own" on public.clarofin_states for select to authenticated using ((select auth.uid()) = user_id);
create policy "clarofin_states_insert_own" on public.clarofin_states for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clarofin_states_update_own" on public.clarofin_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "clarofin_states_delete_own" on public.clarofin_states for delete to authenticated using ((select auth.uid()) = user_id);

create policy "clarofin_sync_select_own" on public.clarofin_sync_metadata for select to authenticated using ((select auth.uid()) = user_id);
create policy "clarofin_sync_insert_own" on public.clarofin_sync_metadata for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clarofin_sync_update_own" on public.clarofin_sync_metadata for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "clarofin_sync_delete_own" on public.clarofin_sync_metadata for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.clarofin_states;
revoke execute on function public.clarofin_set_updated_at() from public;

