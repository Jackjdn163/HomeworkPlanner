create table if not exists public.planner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schedule jsonb not null default '{}'::jsonb,
  assignments jsonb not null default '[]'::jsonb,
  busy jsonb not null default '[]'::jsonb,
  planner_settings jsonb not null default '{}'::jsonb,
  week_offset integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.planner_profiles enable row level security;

drop policy if exists "Users can read their own planner profile" on public.planner_profiles;
create policy "Users can read their own planner profile"
on public.planner_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own planner profile" on public.planner_profiles;
create policy "Users can insert their own planner profile"
on public.planner_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own planner profile" on public.planner_profiles;
create policy "Users can update their own planner profile"
on public.planner_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own planner profile" on public.planner_profiles;
create policy "Users can delete their own planner profile"
on public.planner_profiles
for delete
using (auth.uid() = user_id);

create or replace function public.set_planner_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists planner_profiles_set_updated_at on public.planner_profiles;
create trigger planner_profiles_set_updated_at
before update on public.planner_profiles
for each row
execute function public.set_planner_profile_updated_at();
