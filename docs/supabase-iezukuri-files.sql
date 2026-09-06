-- 既存の iezukuri-notes にファイル添付を足す。SQL Editor で1回実行。
-- 他プロジェクトでは実行しない。

alter table public.iezukuri_decisions
  add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.iezukuri_questions
  add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.iezukuri_ideas
  add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.iezukuri_minutes
  add column if not exists attachments jsonb not null default '[]'::jsonb;

create table if not exists public.iezukuri_docs (
  id uuid primary key,
  household_id uuid not null references public.iezukuri_households (id) on delete cascade,
  title text not null default '',
  kind text not null default 'その他',
  note text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null
);

create index if not exists iezukuri_docs_household_idx
  on public.iezukuri_docs (household_id);

alter table public.iezukuri_docs enable row level security;
drop policy if exists iezukuri_docs_anon on public.iezukuri_docs;
create policy iezukuri_docs_anon on public.iezukuri_docs
  for all to anon using (true) with check (true);
grant select, insert, update, delete on public.iezukuri_docs to anon;

alter publication supabase_realtime add table public.iezukuri_docs;

insert into storage.buckets (id, name, public)
values ('iezukuri', 'iezukuri', true)
on conflict (id) do nothing;

drop policy if exists iezukuri_storage_anon on storage.objects;
create policy iezukuri_storage_anon on storage.objects
  for all to anon
  using (bucket_id = 'iezukuri')
  with check (bucket_id = 'iezukuri');
