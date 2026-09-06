-- white-tee-ec 専用。kanemasa-fabric-os では実行しない。
-- 既存テーブルは触らない。iezukuri_ 接頭辞のみ新規作成。
-- Supabase SQL Editor で1回実行する。

create table if not exists public.iezukuri_households (
  id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.iezukuri_decisions (
  id uuid primary key,
  household_id uuid not null references public.iezukuri_households (id) on delete cascade,
  cat text not null,
  title text not null,
  body text not null default '',
  status smallint not null,
  drawn boolean not null default false,
  area text,
  cost numeric,
  due date,
  updated_at timestamptz not null
);

create table if not exists public.iezukuri_questions (
  id uuid primary key,
  household_id uuid not null references public.iezukuri_households (id) on delete cascade,
  "to" text not null,
  text text not null,
  answer text not null default '',
  done boolean not null default false
);

create table if not exists public.iezukuri_ideas (
  id uuid primary key,
  household_id uuid not null references public.iezukuri_households (id) on delete cascade,
  text text not null,
  tag text not null default '',
  url text not null default '',
  created_at timestamptz not null
);

create table if not exists public.iezukuri_minutes (
  id uuid primary key,
  household_id uuid not null references public.iezukuri_households (id) on delete cascade,
  date date not null,
  theme text not null default '',
  raw text not null default '',
  decided text not null default '',
  my_todo text not null default '',
  their_todo text not null default '',
  pending text not null default '',
  newq text not null default ''
);

create index if not exists iezukuri_decisions_household_idx
  on public.iezukuri_decisions (household_id);
create index if not exists iezukuri_questions_household_idx
  on public.iezukuri_questions (household_id);
create index if not exists iezukuri_ideas_household_idx
  on public.iezukuri_ideas (household_id);
create index if not exists iezukuri_minutes_household_idx
  on public.iezukuri_minutes (household_id);

alter table public.iezukuri_households enable row level security;
alter table public.iezukuri_decisions enable row level security;
alter table public.iezukuri_questions enable row level security;
alter table public.iezukuri_ideas enable row level security;
alter table public.iezukuri_minutes enable row level security;

drop policy if exists iezukuri_households_anon on public.iezukuri_households;
drop policy if exists iezukuri_decisions_anon on public.iezukuri_decisions;
drop policy if exists iezukuri_questions_anon on public.iezukuri_questions;
drop policy if exists iezukuri_ideas_anon on public.iezukuri_ideas;
drop policy if exists iezukuri_minutes_anon on public.iezukuri_minutes;

-- ログインなし。世帯UUIDを知っている端末だけが UI から触る。
-- anon key があれば API 直叩きで全件読める点は、white-tee-ec を
-- 公開ECにする前に締める（docs/backlog.md）。
create policy iezukuri_households_anon on public.iezukuri_households
  for all to anon using (true) with check (true);
create policy iezukuri_decisions_anon on public.iezukuri_decisions
  for all to anon using (true) with check (true);
create policy iezukuri_questions_anon on public.iezukuri_questions
  for all to anon using (true) with check (true);
create policy iezukuri_ideas_anon on public.iezukuri_ideas
  for all to anon using (true) with check (true);
create policy iezukuri_minutes_anon on public.iezukuri_minutes
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.iezukuri_households to anon;
grant select, insert, update, delete on public.iezukuri_decisions to anon;
grant select, insert, update, delete on public.iezukuri_questions to anon;
grant select, insert, update, delete on public.iezukuri_ideas to anon;
grant select, insert, update, delete on public.iezukuri_minutes to anon;

alter publication supabase_realtime add table public.iezukuri_decisions;
alter publication supabase_realtime add table public.iezukuri_questions;
alter publication supabase_realtime add table public.iezukuri_ideas;
alter publication supabase_realtime add table public.iezukuri_minutes;
