import { AREAS, ASSIGNEES, CATEGORIES } from '../src/storage/types.ts'
import {
  guessArea,
  guessAssignee,
  guessCategory,
} from '../src/lib/guessAllocate.ts'

const categories = [...CATEGORIES]
const assignees = [...ASSIGNEES]
const areas = [...AREAS]
const kitchenHints = [
  { cat: 'キッチン', title: '食洗機' },
  { cat: 'キッチン', title: '本体' },
  { cat: '外構', title: '前庭40坪' },
]

function expectEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

const categoryCases = [
  ['キッチン本体はパナソニックLクラスで決定', 'キッチン'],
  ['キッチン形状はペニンシュラで図面反映済み', 'キッチン'],
  ['食洗機はフロントオープン（フルオープン）', 'キッチン'],
  ['カップボード背面は3m離し案を継続', 'キッチン'],
  ['駐車場は家族2台＋来客1台', '外構'],
  ['前庭40坪は人工芝＋コンクリートの方針を維持', '外構'],
  ['東側袖壁の高さ・幅・素材は未決', '外構'],
  ['造作洗面はアイカ・ミラタップのSR後に決める', '洗面・浴室・トイレ'],
  ['屋外コンセントの数と位置', '電気'],
  ['住宅ローン事前審査の追加書類を提出する', '資金'],
  ['外壁はベルバーンで進める', '外観'],
  ['窓はすべり出しで統一', '窓・サッシ'],
]

for (const [line, cat] of categoryCases) {
  expectEq(guessCategory(line, categories, kitchenHints), cat, line)
}

expectEq(
  guessCategory('本体はパナソニックLクラスで決定', categories, kitchenHints),
  'キッチン',
  'existing title 本体',
)

expectEq(
  guessCategory('次回打合せは10月4日10時', categories, kitchenHints),
  'キッチン',
  'unmatched falls back to most common hint',
)

expectEq(
  guessCategory('次回打合せは10月4日10時', categories, []),
  '外観',
  'unmatched without hints uses first category',
)

const assigneeCases = [
  ['屋外コンセントの数と位置', '設計'],
  ['造作洗面を他社発注した場合の保証範囲', '営業'],
  ['外構は本体工事か別途か。施主支給の範囲', '営業'],
  ['前庭の雨水排水、勾配と桝の位置', '設計'],
  ['Lクラスの扉サンプルを次回持参', 'インテリア'],
  ['駐車場ゾーニング案を2パターン出す', '外構'],
  ['アイカとミラタップのショールームを訪問する', '自分で調べる'],
]

for (const [line, to] of assigneeCases) {
  expectEq(guessAssignee(line, assignees), to, line)
}

expectEq(guessArea('駐車場は家族2台', areas), '駐車場', 'area parking')
expectEq(guessArea('前庭の排水勾配', areas), '前庭40坪', 'area garden')
expectEq(guessArea('東側袖壁の高さ', areas), '東側ウッドデッキ', 'area deck')

console.log('guess allocate ok')
