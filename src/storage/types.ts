export type Status = 0 | 1 | 2 | 3

export const STATUS_LABEL = ['検討中', '仮', '確定', '変更不可'] as const

export const STATUS_BORDER = [
  'border-muted',
  'border-amber',
  'border-green',
  'border-blue',
] as const

export type Assignee = '営業' | '設計' | 'インテリア' | '外構' | '自分で調べる'

export type DocKind = '図面' | '見積' | '打ち合わせ' | 'その他'

export const DOC_KINDS: DocKind[] = ['図面', '見積', '打ち合わせ', 'その他']

export type Who = '自分' | '妻'

export const WHOS: Who[] = ['自分', '妻']

export interface Attachment {
  id: string
  name: string
  mime: string
  size: number
  path: string
  createdAt: string
  link?: boolean
}

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
  attachments: Attachment[]
  who: Who
}

export interface Question {
  id: string
  to: Assignee
  text: string
  answer: string
  done: boolean
  attachments: Attachment[]
  who: Who
}

export interface Idea {
  id: string
  text: string
  tag: string
  url: string
  createdAt: string
  attachments: Attachment[]
  who: Who
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
  attachments: Attachment[]
  sentDecided: string[]
  sentNewq: string[]
  who: Who
}

export interface Doc {
  id: string
  title: string
  kind: DocKind
  note: string
  attachments: Attachment[]
  createdAt: string
  who: Who
}

export interface AppData {
  decisions: Decision[]
  questions: Question[]
  ideas: Idea[]
  minutes: Minute[]
  docs: Doc[]
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
  return { decisions: [], questions: [], ideas: [], minutes: [], docs: [] }
}

export function asAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Partial<Attachment>
    if (!row.id || !row.name || !row.mime || !row.path) return []
    return [
      {
        id: String(row.id),
        name: String(row.name),
        mime: String(row.mime),
        size: typeof row.size === 'number' ? row.size : 0,
        path: String(row.path),
        createdAt: String(row.createdAt ?? ''),
        link: Boolean(row.link),
      },
    ]
  })
}

export function asDocKind(value: string): DocKind {
  return DOC_KINDS.includes(value as DocKind) ? (value as DocKind) : 'その他'
}

export function asWho(value: unknown): Who {
  return value === '妻' ? '妻' : '自分'
}

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function allAttachments(data: AppData): Attachment[] {
  return [
    ...data.decisions.flatMap((item) => item.attachments),
    ...data.questions.flatMap((item) => item.attachments),
    ...data.ideas.flatMap((item) => item.attachments),
    ...data.minutes.flatMap((item) => item.attachments),
    ...data.docs.flatMap((item) => item.attachments),
  ]
}
