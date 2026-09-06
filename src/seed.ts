import type { AppData, Decision, Question } from './storage/types.ts'

const UPDATED = '2026-09-06T00:00:00.000Z'

function decision(
  partial: Omit<Decision, 'updatedAt' | 'drawn'> & { drawn?: boolean },
): Decision {
  return { drawn: false, updatedAt: UPDATED, ...partial }
}

function question(partial: Omit<Question, 'answer' | 'done'>): Question {
  return { answer: '', done: false, ...partial }
}

export function seedData(): AppData {
  return {
    decisions: [
      decision({
        id: 'dec-dishwasher',
        cat: 'キッチン',
        title: '食洗機',
        body: 'フロントオープン（フルオープン）。譲れない条件。',
        status: 2,
      }),
      decision({
        id: 'dec-kitchen-body',
        cat: 'キッチン',
        title: '本体',
        body: 'パナソニックLクラス。グラフテクトと比較中。',
        status: 1,
        cost: 166.8,
      }),
      decision({
        id: 'dec-kitchen-shape',
        cat: 'キッチン',
        title: '形状',
        body: 'ペニンシュラ',
        status: 2,
        drawn: true,
      }),
      decision({
        id: 'dec-kitchen-door',
        cat: 'キッチン',
        title: '扉の色',
        body: '濃いグレー〜ブラック系',
        status: 1,
      }),
      decision({
        id: 'dec-cupboard',
        cat: 'キッチン',
        title: 'カップボード',
        body: '背面3m離し。動線の実寸確認。',
        status: 1,
        cost: 46.2,
      }),
      decision({
        id: 'dec-vanity',
        cat: '洗面・浴室・トイレ',
        title: '洗面台',
        body: '造作。アイカ・ミラタップのSR訪問後に決定。',
        status: 0,
        cost: 50,
      }),
      decision({
        id: 'dec-front-garden',
        cat: '外構',
        title: '前庭40坪',
        body: '人工芝＋コンクリ。割付・目地・排水勾配が未定。',
        status: 0,
        area: '前庭40坪',
      }),
      decision({
        id: 'dec-parking',
        cat: '外構',
        title: '駐車場ゾーニング',
        body: '台数・ドア開閉クリアランス・来客用。',
        status: 0,
        area: '駐車場',
      }),
      decision({
        id: 'dec-east-wall',
        cat: '外構',
        title: '東側袖壁',
        body: '高さ・幅・素材が未定。目隠しか意匠かを先に決める。',
        status: 0,
      }),
    ],
    questions: [
      question({
        id: 'q-deadlines',
        to: '営業',
        text: '各項目の変更締切はいつか（着工承諾／電気配線確定／外構確定）',
      }),
      question({
        id: 'q-exteria-scope',
        to: '営業',
        text: '外構は本体工事か別途か。施主支給の範囲',
      }),
      question({
        id: 'q-drainage',
        to: '設計',
        text: '前庭の雨水排水、勾配と桝の位置',
      }),
      question({
        id: 'q-outlets',
        to: '設計',
        text: '屋外コンセントの数と位置（前庭・デッキ・駐車場）',
      }),
      question({
        id: 'q-vanity-warranty',
        to: '営業',
        text: '造作洗面を他社発注する場合の取合いと保証範囲',
      }),
    ],
    ideas: [],
    minutes: [],
  }
}

export function isEmptyData(data: AppData): boolean {
  return (
    data.decisions.length === 0 &&
    data.questions.length === 0 &&
    data.ideas.length === 0 &&
    data.minutes.length === 0
  )
}
