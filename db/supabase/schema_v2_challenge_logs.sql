-- routine-app schema v2
-- 시간대 기반 루틴 챌린지 인증 로그 (1인/1루틴/1일 1회)

create table if not exists challenge_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_date date not null,
  routine_key text not null check (routine_key in ('wake', 'lunch', 'sleep')),
  done_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date, routine_key)
);

create index if not exists idx_challenge_logs_user_date
  on challenge_logs(user_id, challenge_date desc);

alter table challenge_logs enable row level security;

create policy if not exists challenge_logs_select_self on challenge_logs
for select using (auth.uid() = user_id);

create policy if not exists challenge_logs_insert_self on challenge_logs
for insert with check (auth.uid() = user_id);

create policy if not exists challenge_logs_update_self on challenge_logs
for update using (auth.uid() = user_id);
