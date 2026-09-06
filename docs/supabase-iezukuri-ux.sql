-- 既存の iezukuri-notes に「書いた人」と議事録の送信済行を足す。
-- SQL Editor で1回実行する。他プロジェクトでは実行しない。

alter table public.iezukuri_decisions
  add column if not exists who text not null default '自分';
alter table public.iezukuri_questions
  add column if not exists who text not null default '自分';
alter table public.iezukuri_ideas
  add column if not exists who text not null default '自分';
alter table public.iezukuri_minutes
  add column if not exists who text not null default '自分';
alter table public.iezukuri_docs
  add column if not exists who text not null default '自分';

alter table public.iezukuri_minutes
  add column if not exists sent_decided jsonb not null default '[]'::jsonb;
alter table public.iezukuri_minutes
  add column if not exists sent_newq jsonb not null default '[]'::jsonb;
