import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const HOUSEHOLD_ID = '7e2a1c0a-0f3e-4b9a-9c1d-a1b2c3d4e5f6'
const UPDATED = '2026-09-06T00:00:00.000Z'

function loadEnv() {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(
    '\n',
  )) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

loadEnv()
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('missing env')

const decisions = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    cat: 'キッチン',
    title: '食洗機',
    body: 'フロントオープン（フルオープン）。譲れない条件。',
    status: 2,
    drawn: false,
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    cat: 'キッチン',
    title: '本体',
    body: 'パナソニックLクラス。グラフテクトと比較中。',
    status: 1,
    drawn: false,
    cost: 166.8,
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    cat: 'キッチン',
    title: '形状',
    body: 'ペニンシュラ',
    status: 2,
    drawn: true,
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    cat: 'キッチン',
    title: '扉の色',
    body: '濃いグレー〜ブラック系',
    status: 1,
    drawn: false,
  },
  {
    id: '11111111-1111-4111-8111-111111111105',
    cat: 'キッチン',
    title: 'カップボード',
    body: '背面3m離し。動線の実寸確認。',
    status: 1,
    drawn: false,
    cost: 46.2,
  },
  {
    id: '11111111-1111-4111-8111-111111111106',
    cat: '洗面・浴室・トイレ',
    title: '洗面台',
    body: '造作。アイカ・ミラタップのSR訪問後に決定。',
    status: 0,
    drawn: false,
    cost: 50,
  },
  {
    id: '11111111-1111-4111-8111-111111111107',
    cat: '外構',
    title: '前庭40坪',
    body: '人工芝＋コンクリ。割付・目地・排水勾配が未定。',
    status: 0,
    drawn: false,
    area: '前庭40坪',
  },
  {
    id: '11111111-1111-4111-8111-111111111108',
    cat: '外構',
    title: '駐車場ゾーニング',
    body: '台数・ドア開閉クリアランス・来客用。',
    status: 0,
    drawn: false,
    area: '駐車場',
  },
  {
    id: '11111111-1111-4111-8111-111111111109',
    cat: '外構',
    title: '東側袖壁',
    body: '高さ・幅・素材が未定。目隠しか意匠かを先に決める。',
    status: 0,
    drawn: false,
  },
]

const questions = [
  {
    id: '22222222-2222-4222-8222-222222222201',
    to: '営業',
    text: '各項目の変更締切はいつか（着工承諾／電気配線確定／外構確定）',
  },
  {
    id: '22222222-2222-4222-8222-222222222202',
    to: '営業',
    text: '外構は本体工事か別途か。施主支給の範囲',
  },
  {
    id: '22222222-2222-4222-8222-222222222203',
    to: '設計',
    text: '前庭の雨水排水、勾配と桝の位置',
  },
  {
    id: '22222222-2222-4222-8222-222222222204',
    to: '設計',
    text: '屋外コンセントの数と位置（前庭・デッキ・駐車場）',
  },
  {
    id: '22222222-2222-4222-8222-222222222205',
    to: '営業',
    text: '造作洗面を他社発注する場合の取合いと保証範囲',
  },
]

const client = createClient(url, key)

const { error: houseError } = await client
  .from('iezukuri_households')
  .upsert({ id: HOUSEHOLD_ID })
if (houseError) throw houseError

const { count: existing, error: countError } = await client
  .from('iezukuri_decisions')
  .select('id', { count: 'exact', head: true })
  .eq('household_id', HOUSEHOLD_ID)
if (countError) throw countError

if ((existing ?? 0) > 0) {
  console.log('already seeded', { decisions: existing })
  process.exit(0)
}

const { error: decError } = await client.from('iezukuri_decisions').upsert(
  decisions.map((item) => ({
    id: item.id,
    household_id: HOUSEHOLD_ID,
    cat: item.cat,
    title: item.title,
    body: item.body,
    status: item.status,
    drawn: item.drawn,
    area: item.area ?? null,
    cost: item.cost ?? null,
    due: null,
    updated_at: UPDATED,
  })),
)
if (decError) throw decError

const { error: qError } = await client.from('iezukuri_questions').upsert(
  questions.map((item) => ({
    id: item.id,
    household_id: HOUSEHOLD_ID,
    to: item.to,
    text: item.text,
    answer: '',
    done: false,
  })),
)
if (qError) throw qError

const { count: decCount } = await client
  .from('iezukuri_decisions')
  .select('id', { count: 'exact', head: true })
  .eq('household_id', HOUSEHOLD_ID)
const { count: qCount } = await client
  .from('iezukuri_questions')
  .select('id', { count: 'exact', head: true })
  .eq('household_id', HOUSEHOLD_ID)

console.log('seeded', { decisions: decCount, questions: qCount })
