-- schema_v4_friend_auth_p0.sql
-- P0: social login(카카오/애플) 기반 친구 연동 + 독려 푸시 데이터 모델

create extension if not exists pgcrypto;

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  friend_code text not null unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table challenge_logs
  add column if not exists proof_image_path text,
  add column if not exists visibility text default 'friends' check (visibility in ('private','friends'));

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apns','fcm')),
  device_token text not null unique,
  platform text not null check (platform in ('ios','android')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_push_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nudge_mode text not null default 'once' check (nudge_mode in ('off','once','twice')),
  quiet_hours_start smallint not null default 23 check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint not null default 8 check (quiet_hours_end between 0 and 23),
  updated_at timestamptz not null default now()
);

create table if not exists push_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  routine_key text not null,
  event_type text not null check (event_type in ('nudge_once','nudge_lastcall')),
  dedupe_key text not null unique,
  sent_at timestamptz not null default now()
);

create index if not exists idx_friendships_requester_status on friendships(requester_id, status);
create index if not exists idx_friendships_addressee_status on friendships(addressee_id, status);
create index if not exists idx_push_tokens_user_enabled on push_tokens(user_id, enabled);
create index if not exists idx_push_events_target_date on push_events(target_user_id, event_date);

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table push_tokens enable row level security;
alter table user_push_prefs enable row level security;
alter table push_events enable row level security;

-- profiles
create policy if not exists profiles_select_self_or_friend on profiles
for select using (
  auth.uid() = user_id
  or exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = profiles.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = profiles.user_id)
      )
  )
);

create policy if not exists profiles_insert_self on profiles
for insert with check (auth.uid() = user_id);

create policy if not exists profiles_update_self on profiles
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- friendships
create policy if not exists friendships_select_participant on friendships
for select using (auth.uid() in (requester_id, addressee_id));

create policy if not exists friendships_insert_requester on friendships
for insert with check (auth.uid() = requester_id);

create policy if not exists friendships_update_participant on friendships
for update using (auth.uid() in (requester_id, addressee_id))
with check (auth.uid() in (requester_id, addressee_id));

-- push_tokens
create policy if not exists push_tokens_select_self on push_tokens
for select using (auth.uid() = user_id);

create policy if not exists push_tokens_insert_self on push_tokens
for insert with check (auth.uid() = user_id);

create policy if not exists push_tokens_update_self on push_tokens
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists push_tokens_delete_self on push_tokens
for delete using (auth.uid() = user_id);

-- user_push_prefs
create policy if not exists user_push_prefs_select_self on user_push_prefs
for select using (auth.uid() = user_id);

create policy if not exists user_push_prefs_insert_self on user_push_prefs
for insert with check (auth.uid() = user_id);

create policy if not exists user_push_prefs_update_self on user_push_prefs
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- push_events
create policy if not exists push_events_select_participant on push_events
for select using (auth.uid() in (sender_user_id, target_user_id));
