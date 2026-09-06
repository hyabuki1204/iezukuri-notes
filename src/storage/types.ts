export type Status = 0 | 1 | 2 | 3

export const STATUS_LABEL = ['検討中', '仮', '確定', '変更不可'] as const

export const STATUS_BORDER = [
  'border-muted',
  'border-amber',
  'border-green',
  'border-ink',
] as const

export type Assignee = '営業' | '設計' | 'インテリア' | '外構' | '自分で調べる'

export interface Decision {
  id: string
  cat: string
  title: string
  body: string
  status: Status
  drawn: boolean
  area?: string
  cost?: number
  due?: string
  updatedAt: string
}

export interface Question {
  id: string
  to: Assignee
  text: string
  answer: string
  done: boolean
}

export interface Idea {
  id: string
  text: string
  tag: string
  url: string
  createdAt: string
}

export interface Minute {
  id: string
  date: string
  theme: string
  raw: string
  decided: string
  myTodo: string
  theirTodo: string
  pending: string
  newq: string
}

export interface AppData {
  decisions: Decision[]
  questions: Question[]
  ideas: Idea[]
  minutes: Minute[]
}

export const CATEGORIES = [
  '外観',
  '外構',
  '間取り・寸法',
  '窓・サッシ',
  '空調・給湯',
  '電気',
  'キッチン',
  '洗面・浴室・トイレ',
  '収納',
  '内装',
  '外部設備',
  '資金',
] as const

export const AREAS = [
  '道路〜アプローチ',
  '駐車場',
  '前庭40坪',
  '東側ウッドデッキ',
  '建物外観',
  'サービスヤード',
  '境界',
] as const

export const ASSIGNEES: Assignee[] = [
  '営業',
  '設計',
  'インテリア',
  '外構',
  '自分で調べる',
]

export function emptyAppData(): AppData {
  return { decisions: [], questions: [], ideas: [], minutes: [] }
}
