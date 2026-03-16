-- routine-app schema v3
-- 친구 연동(방) + 권한 정책
-- 정책:
-- - 방 인원 1~6명
-- - 루틴 추가/수정/삭제: 방장(owner)만
-- - 인증 사진: 같은 방 멤버 전체 조회 가능
-- - 다시찍기(업데이트): 본인 인증 로그만 가능

create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  max_members int not null default 6 check (max_members between 1 and 6),
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'joined' check (status in ('invited', 'joined')),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_room_members_user on room_members(user_id, room_id);

create table if not exists room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists room_routines (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  title text not null,
  start_minute int not null check (start_minute between 0 and 1439),
  end_minute int not null check (end_minute between 0 and 1439),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_room_routines_room_active on room_routines(room_id, is_active);

create table if not exists room_challenge_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  routine_id uuid not null references room_routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_date date not null,
  done_at timestamptz not null default now(),
  proof_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, routine_id, user_id, challenge_date)
);

create index if not exists idx_room_logs_room_date on room_challenge_logs(room_id, challenge_date desc);
create index if not exists idx_room_logs_user_date on room_challenge_logs(user_id, challenge_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_room_routines_updated_at
before update on room_routines
for each row execute function public.set_updated_at();

create trigger trg_room_logs_updated_at
before update on room_challenge_logs
for each row execute function public.set_updated_at();

create or replace function public.check_room_member_limit()
returns trigger
language plpgsql
as $$
declare
  member_count int;
  room_max int;
begin
  select count(*) into member_count
  from room_members
  where room_id = new.room_id
    and status = 'joined';

  select max_members into room_max
  from rooms
  where id = new.room_id;

  if room_max is null then
    raise exception 'room not found';
  end if;

  if member_count >= room_max and new.status = 'joined' then
    raise exception 'room member limit exceeded: max %', room_max;
  end if;

  return new;
end;
$$;

create trigger trg_room_member_limit
before insert on room_members
for each row execute function public.check_room_member_limit();

alter table rooms enable row level security;
alter table room_members enable row level security;
alter table room_invites enable row level security;
alter table room_routines enable row level security;
alter table room_challenge_logs enable row level security;

-- rooms: owner 생성, 멤버 조회
create policy if not exists rooms_insert_owner on rooms
for insert with check (auth.uid() = owner_user_id);

create policy if not exists rooms_select_member on rooms
for select using (
  exists (
    select 1 from room_members rm
    where rm.room_id = rooms.id
      and rm.user_id = auth.uid()
      and rm.status = 'joined'
  )
);

create policy if not exists rooms_update_owner on rooms
for update using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

-- room_members: 같은 방 멤버만 조회, owner만 초대/제거
create policy if not exists room_members_select_member on room_members
for select using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_members.room_id
      and rm.user_id = auth.uid()
      and rm.status = 'joined'
  )
);

create policy if not exists room_members_insert_owner on room_members
for insert with check (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_members.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
);

create policy if not exists room_members_delete_owner on room_members
for delete using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_members.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
);

-- room_invites: owner만 생성/조회
create policy if not exists room_invites_select_owner on room_invites
for select using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_invites.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
);

create policy if not exists room_invites_insert_owner on room_invites
for insert with check (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_invites.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
  and auth.uid() = inviter_user_id
);

-- room_routines: 멤버 조회, owner만 추가/수정/삭제
create policy if not exists room_routines_select_member on room_routines
for select using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_routines.room_id
      and rm.user_id = auth.uid()
      and rm.status = 'joined'
  )
);

create policy if not exists room_routines_insert_owner on room_routines
for insert with check (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_routines.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
);

create policy if not exists room_routines_update_owner on room_routines
for update using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_routines.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
)
with check (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_routines.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
);

create policy if not exists room_routines_delete_owner on room_routines
for delete using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_routines.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
);

-- room_challenge_logs: 멤버 조회, 본인만 작성/다시찍기(update)
create policy if not exists room_logs_select_member on room_challenge_logs
for select using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_challenge_logs.room_id
      and rm.user_id = auth.uid()
      and rm.status = 'joined'
  )
);

create policy if not exists room_logs_insert_self on room_challenge_logs
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from room_members rm
    where rm.room_id = room_challenge_logs.room_id
      and rm.user_id = auth.uid()
      and rm.status = 'joined'
  )
);

create policy if not exists room_logs_update_self on room_challenge_logs
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists room_logs_delete_owner on room_challenge_logs
for delete using (
  exists (
    select 1 from room_members rm
    where rm.room_id = room_challenge_logs.room_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.status = 'joined'
  )
);
