-- routine-app low-cost schema v1 (Supabase/Postgres)
-- 목표: 친구와 함께 루틴 관리 MVP에 필요한 최소 스키마

create extension if not exists pgcrypto;

-- 1) 그룹(2인~소규모)
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 2) 그룹 멤버
create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 3) 루틴
create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4) 루틴 완료 로그 (1인/1루틴/1일 1개)
create table if not exists routine_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  is_done boolean not null default true,
  created_at timestamptz not null default now(),
  unique (routine_id, user_id, log_date)
);

-- 인덱스(비용 대비 체감 큰 것만)
create index if not exists idx_routine_logs_user_date on routine_logs(user_id, log_date desc);
create index if not exists idx_routine_logs_group_date on routine_logs(group_id, log_date desc);

-- RLS
alter table groups enable row level security;
alter table group_members enable row level security;
alter table routines enable row level security;
alter table routine_logs enable row level security;

-- groups: 내가 멤버인 그룹만 조회
create policy if not exists groups_select_member on groups
for select using (
  exists (
    select 1 from group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid()
  )
);

-- groups: 인증 사용자는 생성 가능
create policy if not exists groups_insert_auth on groups
for insert with check (auth.uid() = created_by);

-- group_members: 내가 속한 그룹 멤버 조회
create policy if not exists group_members_select_member on group_members
for select using (
  exists (
    select 1 from group_members gm
    where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
  )
);

-- group_members: owner가 멤버 추가
create policy if not exists group_members_insert_owner on group_members
for insert with check (
  exists (
    select 1 from group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'owner'
  )
);

-- routines: 그룹 멤버 조회/생성/수정
create policy if not exists routines_select_member on routines
for select using (
  exists (
    select 1 from group_members gm
    where gm.group_id = routines.group_id and gm.user_id = auth.uid()
  )
);

create policy if not exists routines_insert_member on routines
for insert with check (
  exists (
    select 1 from group_members gm
    where gm.group_id = routines.group_id and gm.user_id = auth.uid()
  )
  and created_by = auth.uid()
);

create policy if not exists routines_update_member on routines
for update using (
  exists (
    select 1 from group_members gm
    where gm.group_id = routines.group_id and gm.user_id = auth.uid()
  )
);

-- routine_logs: 그룹 멤버 조회/작성, 본인 로그만 수정
create policy if not exists routine_logs_select_member on routine_logs
for select using (
  exists (
    select 1 from group_members gm
    where gm.group_id = routine_logs.group_id and gm.user_id = auth.uid()
  )
);

create policy if not exists routine_logs_insert_self_member on routine_logs
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from group_members gm
    where gm.group_id = routine_logs.group_id and gm.user_id = auth.uid()
  )
);

create policy if not exists routine_logs_update_self on routine_logs
for update using (user_id = auth.uid());

-- 초대코드 생성 헬퍼(6자리)
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;
  return code;
end;
$$;
