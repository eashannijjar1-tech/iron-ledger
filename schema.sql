-- Iron Ledger — database schema + row-level security.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It creates two tables and locks them so each signed-in user can only ever
-- read and write their OWN rows.

create table if not exists app_meta (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists workouts (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists workouts_user_idx on workouts(user_id);

-- Lock everything down
alter table app_meta enable row level security;
alter table workouts enable row level security;

-- app_meta: one row per user, only the owner touches it
drop policy if exists meta_select on app_meta;
drop policy if exists meta_insert on app_meta;
drop policy if exists meta_update on app_meta;
drop policy if exists meta_delete on app_meta;
create policy meta_select on app_meta for select using (auth.uid() = user_id);
create policy meta_insert on app_meta for insert with check (auth.uid() = user_id);
create policy meta_update on app_meta for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy meta_delete on app_meta for delete using (auth.uid() = user_id);

-- workouts: many rows per user, only the owner touches them
drop policy if exists wo_select on workouts;
drop policy if exists wo_insert on workouts;
drop policy if exists wo_update on workouts;
drop policy if exists wo_delete on workouts;
create policy wo_select on workouts for select using (auth.uid() = user_id);
create policy wo_insert on workouts for insert with check (auth.uid() = user_id);
create policy wo_update on workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy wo_delete on workouts for delete using (auth.uid() = user_id);
