import { firstOf } from './lists.ts'

export type CategoryHint = {
  cat: string
  title: string
}

const CATEGORY_WORDS: Record<string, string[]> = {
  外観: [
    '外観',
    '外壁',
    '屋根',
    'サイディング',
    '軒天',
    '破風',
    '玄関ドア',
    'ベルバーン',
    'ガルバリウム',
    '塗り壁',
  ],
  外構: [
    '外構',
    '駐車場',
    '前庭',
    '人工芝',
    'コンクリート',
    'コンクリ',
    'アプローチ',
    '袖壁',
    'ウッドデッキ',
    'デッキ',
    'フェンス',
    '門柱',
    '境界',
    'カーポート',
    '目地',
    '割付',
  ],
  '間取り・寸法': [
    '間取り',
    '寸法',
    '動線',
    '天井高',
    '吹き抜け',
    '実寸',
    '廊下',
    '広さ',
  ],
  '窓・サッシ': [
    '窓',
    'サッシ',
    'シャッター',
    '掃き出し',
    'すべり出し',
    '高窓',
    'フィックス',
  ],
  '空調・給湯': [
    'エアコン',
    '空調',
    '給湯',
    'エコキュート',
    '床暖',
    '換気',
    '全館空調',
    'エコジョーズ',
  ],
  電気: [
    'コンセント',
    '照明',
    '電気',
    'ev充電',
    '配線',
    'スイッチ',
    'ダウンライト',
    '配電盤',
  ],
  キッチン: [
    'キッチン',
    '台所',
    '食洗',
    'カップボード',
    'ペニンシュラ',
    'アイランド',
    'コンロ',
    'シンク',
    'lクラス',
    'エルクラス',
    'グラフテクト',
    'ワークトップ',
    'レンジフード',
    '吊戸',
  ],
  '洗面・浴室・トイレ': [
    '洗面',
    '浴室',
    'トイレ',
    '風呂',
    'ユニットバス',
    '造作洗面',
    'シャワー',
    '浴槽',
    'ミラタップ',
    'アイカ',
    '洗面台',
  ],
  収納: [
    '収納',
    'クローゼット',
    'パントリー',
    'シューズクローク',
    'ウォークイン',
    'wic',
    '土間収納',
    '納戸',
  ],
  内装: [
    '内装',
    'クロス',
    'フローリング',
    '建具',
    '壁紙',
    '巾木',
    'アクセントクロス',
    '床材',
  ],
  外部設備: ['外部設備', '給湯器', '室外機', 'メーター', '太陽光', '蓄電池'],
  資金: ['資金', 'ローン', '金利', '着工金', '契約金', '事前審査', '借入'],
}

const ASSIGNEE_WORDS: Record<string, string[]> = {
  営業: [
    '見積',
    '保証',
    '締切',
    'ローン',
    '資金',
    '本体工事',
    '別途',
    '施主支給',
    '契約',
    '着工承諾',
    '事前審査',
  ],
  設計: [
    '図面',
    '寸法',
    '勾配',
    '桝',
    '排水',
    '間取り',
    'クリアランス',
    '窓',
    'サッシ',
    'コンセント',
    '配線',
  ],
  インテリア: [
    'インテリア',
    'サンプル',
    'クロス',
    '建具',
    'コーディネート',
    '扉色',
    '色味',
  ],
  外構: [
    '外構',
    '駐車場',
    '前庭',
    '人工芝',
    '袖壁',
    'デッキ',
    'フェンス',
    'アプローチ',
    '門柱',
  ],
  自分で調べる: ['調べ', 'ショールーム', 'sr訪問', '自分で'],
}

const AREA_WORDS: Record<string, string[]> = {
  '道路〜アプローチ': ['アプローチ', '道路'],
  駐車場: ['駐車場', 'カーポート'],
  前庭40坪: ['前庭'],
  東側ウッドデッキ: ['ウッドデッキ', 'デッキ', '袖壁'],
  建物外観: ['外観', '外壁'],
  サービスヤード: ['サービスヤード'],
  境界: ['境界', 'フェンス'],
}

export function guessCategory(
  text: string,
  categories: string[],
  hints: CategoryHint[] = [],
): string {
  return pickBest(
    text,
    categories,
    CATEGORY_WORDS,
    fallbackCategory(categories, hints),
    scoresFromHints(text, hints, categories),
  )
}

export function guessAssignee(text: string, assignees: string[]): string {
  return pickBest(
    text,
    assignees,
    ASSIGNEE_WORDS,
    firstOf(assignees, '営業'),
    undefined,
    10,
  )
}

export function guessArea(text: string, areas: string[]): string | undefined {
  if (areas.length === 0) return undefined
  const picked = pickBest(text, areas, AREA_WORDS, '')
  return picked || undefined
}

function fallbackCategory(categories: string[], hints: CategoryHint[]): string {
  const counts = new Map<string, number>()
  for (const item of hints) {
    if (!categories.includes(item.cat)) continue
    counts.set(item.cat, (counts.get(item.cat) ?? 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [cat, count] of counts) {
    if (count > bestCount) {
      best = cat
      bestCount = count
    }
  }
  return best || firstOf(categories, 'キッチン')
}

function scoresFromHints(
  text: string,
  hints: CategoryHint[],
  categories: string[],
): Map<string, number> {
  const norm = normalize(text)
  const scores = new Map<string, number>()
  if (!norm) return scores
  for (const item of hints) {
    if (!categories.includes(item.cat)) continue
    const title = normalize(item.title)
    if (title.length < 2) continue
    if (norm.includes(title) || (title.length <= 12 && title.includes(norm))) {
      scores.set(item.cat, (scores.get(item.cat) ?? 0) + 14 + Math.min(title.length, 10))
    }
  }
  return scores
}

function pickBest(
  text: string,
  options: string[],
  dictionary: Record<string, string[]>,
  fallback: string,
  extra?: Map<string, number>,
  nameBonus = 24,
): string {
  const norm = normalize(text)
  if (!norm || options.length === 0) return fallback

  let best = fallback
  let bestScore = 0
  for (const option of options) {
    let score = extra?.get(option) ?? 0
    const optionNorm = normalize(option)
    if (optionNorm && norm.includes(optionNorm)) {
      score += nameBonus + optionNorm.length
    }
    for (const part of option.split(/[・/／、]/)) {
      if (part === option) continue
      const piece = normalize(part)
      if (piece.length >= 2 && norm.includes(piece)) {
        score += 18 + piece.length
      }
    }
    for (const word of wordsFor(option, dictionary)) {
      const needle = normalize(word)
      if (needle.length >= 2 && norm.includes(needle)) {
        score += 8 + needle.length
      }
    }
    if (score > bestScore) {
      best = option
      bestScore = score
    }
  }
  return bestScore > 0 ? best : fallback
}

function wordsFor(option: string, dictionary: Record<string, string[]>): string[] {
  if (dictionary[option]) return dictionary[option]
  const collected: string[] = []
  for (const [key, words] of Object.entries(dictionary)) {
    if (option.includes(key) || key.includes(option)) collected.push(...words)
  }
  return collected
}

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}
