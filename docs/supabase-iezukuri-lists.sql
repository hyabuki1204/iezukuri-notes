-- 大分類・外構エリア・宛先を家ごとに編集する。
-- SQL Editor で1回実行する。他プロジェクトでは実行しない。

alter table public.iezukuri_households
  add column if not exists lists jsonb not null default '{
    "categories": ["外観","外構","間取り・寸法","窓・サッシ","空調・給湯","電気","キッチン","洗面・浴室・トイレ","収納","内装","外部設備","資金"],
    "areas": ["道路〜アプローチ","駐車場","前庭40坪","東側ウッドデッキ","建物外観","サービスヤード","境界"],
    "assignees": ["営業","設計","インテリア","外構","自分で調べる"]
  }'::jsonb;

do $$
begin
  alter publication supabase_realtime add table public.iezukuri_households;
exception
  when duplicate_object then null;
end $$;
