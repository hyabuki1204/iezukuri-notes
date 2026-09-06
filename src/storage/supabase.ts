import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from './client.ts'
import type { Store } from './store.ts'
import {
  asAttachments,
  asDocKind,
  asStringList,
  asWho,
  emptyAppData,
  type AppData,
  type Assignee,
  type Attachment,
  type Decision,
  type Doc,
  type Idea,
  type Minute,
  type Question,
  type Status,
} from './types.ts'

type DecisionRow = {
  id: string
  household_id: string
  cat: string
  title: string
  body: string
  status: number
  drawn: boolean
  area: string | null
  cost: number | null
  due: string | null
  updated_at: string
  attachments: Attachment[]
  who?: string | null
}

type QuestionRow = {
  id: string
  household_id: string
  to: Assignee
  text: string
  answer: string
  done: boolean
  attachments: Attachment[]
  who?: string | null
}

type IdeaRow = {
  id: string
  household_id: string
  text: string
  tag: string
  url: string
  created_at: string
  attachments: Attachment[]
  who?: string | null
}

type MinuteRow = {
  id: string
  household_id: string
  date: string
  theme: string
  raw: string
  decided: string
  my_todo: string
  their_todo: string
  pending: string
  newq: string
  attachments: Attachment[]
  who?: string | null
  sent_decided?: unknown
  sent_newq?: unknown
}

type DocRow = {
  id: string
  household_id: string
  title: string
  kind: string
  note: string
  attachments: Attachment[]
  created_at: string
  who?: string | null
}

function asStatus(value: number): Status {
  if (value === 0 || value === 1 || value === 2 || value === 3) return value
  return 0
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

export async function householdExists(id: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('iezukuri_households')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function ensureHousehold(id: string): Promise<void> {
  const exists = await householdExists(id)
  if (exists) return
  const { error } = await getSupabase()
    .from('iezukuri_households')
    .insert({ id })
  if (error) throw error
}

export class SupabaseStore implements Store {
  private snapshot = emptyAppData()
  private channel: RealtimeChannel | null = null
  private readonly householdId: string

  constructor(householdId: string) {
    this.householdId = householdId
  }

  adopt(data: AppData): void {
    this.snapshot = data
  }

  async load(): Promise<AppData> {
    const client = getSupabase()
    const hid = this.householdId
    const [decisions, questions, ideas, minutes, docs] = await Promise.all([
      client.from('iezukuri_decisions').select('*').eq('household_id', hid),
      client.from('iezukuri_questions').select('*').eq('household_id', hid),
      client.from('iezukuri_ideas').select('*').eq('household_id', hid),
      client.from('iezukuri_minutes').select('*').eq('household_id', hid),
      client.from('iezukuri_docs').select('*').eq('household_id', hid),
    ])
    const error =
      decisions.error ?? questions.error ?? ideas.error ?? minutes.error
    if (error) throw error
    if (docs.error && !isMissingTable(docs.error)) throw docs.error

    const data: AppData = {
      decisions: (decisions.data ?? []).map(rowToDecision),
      questions: (questions.data ?? []).map(rowToQuestion),
      ideas: (ideas.data ?? []).map(rowToIdea),
      minutes: (minutes.data ?? []).map(rowToMinute),
      docs: docs.error ? [] : (docs.data ?? []).map(rowToDoc),
    }
    this.snapshot = data
    return data
  }

  async save(data: AppData): Promise<void> {
    const client = getSupabase()
    const hid = this.householdId
    await Promise.all([
      syncCollection({
        table: 'iezukuri_decisions',
        next: data.decisions,
        prev: this.snapshot.decisions,
        toRow: (item) => decisionToRow(hid, item),
        client,
      }),
      syncCollection({
        table: 'iezukuri_questions',
        next: data.questions,
        prev: this.snapshot.questions,
        toRow: (item) => questionToRow(hid, item),
        client,
      }),
      syncCollection({
        table: 'iezukuri_ideas',
        next: data.ideas,
        prev: this.snapshot.ideas,
        toRow: (item) => ideaToRow(hid, item),
        client,
      }),
      syncCollection({
        table: 'iezukuri_minutes',
        next: data.minutes,
        prev: this.snapshot.minutes,
        toRow: (item) => minuteToRow(hid, item),
        client,
      }),
      syncCollection({
        table: 'iezukuri_docs',
        next: data.docs,
        prev: this.snapshot.docs,
        toRow: (item) => docToRow(hid, item),
        client,
      }),
    ])
    this.snapshot = data
  }

  subscribe(onChange: (data: AppData) => void): () => void {
    const client = getSupabase()
    const hid = this.householdId
    this.unsubscribe()
    const channel = client.channel(`iezukuri:${hid}:${crypto.randomUUID()}`)
    const reload = () => {
      void this.load().then(onChange)
    }
    for (const table of [
      'iezukuri_decisions',
      'iezukuri_questions',
      'iezukuri_ideas',
      'iezukuri_minutes',
      'iezukuri_docs',
    ]) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` },
        reload,
      )
    }
    channel.subscribe()
    this.channel = channel

    return () => this.unsubscribe()
  }

  unsubscribe(): void {
    if (this.channel) {
      void getSupabase().removeChannel(this.channel)
      this.channel = null
    }
  }
}

async function syncCollection<T extends { id: string }>({
  table,
  next,
  prev,
  toRow,
  client,
}: {
  table: string
  next: T[]
  prev: T[]
  toRow: (item: T) => Record<string, unknown>
  client: ReturnType<typeof getSupabase>
}): Promise<void> {
  const prevMap = byId(prev)
  const nextMap = byId(next)
  const upserts = next
    .filter((item) => !sameJson(item, prevMap.get(item.id)))
    .map(toRow)
  const deletes = prev
    .filter((item) => !nextMap.has(item.id))
    .map((item) => item.id)

  if (upserts.length > 0) {
    const { error } = await client.from(table).upsert(upserts)
    if (error) throw error
  }
  if (deletes.length > 0) {
    const { error } = await client.from(table).delete().in('id', deletes)
    if (error) throw error
  }
}

function rowToDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    cat: row.cat,
    title: row.title,
    body: row.body,
    status: asStatus(row.status),
    drawn: row.drawn,
    area: row.area ?? undefined,
    cost: row.cost ?? undefined,
    due: row.due ?? undefined,
    updatedAt: row.updated_at,
    attachments: asAttachments(row.attachments),
    who: asWho(row.who),
  }
}

function decisionToRow(householdId: string, item: Decision): DecisionRow {
  return {
    id: item.id,
    household_id: householdId,
    cat: item.cat,
    title: item.title,
    body: item.body,
    status: item.status,
    drawn: item.drawn,
    area: item.area ?? null,
    cost: item.cost ?? null,
    due: item.due ?? null,
    updated_at: item.updatedAt,
    attachments: item.attachments ?? [],
    who: item.who,
  }
}

function rowToQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    to: row.to,
    text: row.text,
    answer: row.answer,
    done: row.done,
    attachments: asAttachments(row.attachments),
    who: asWho(row.who),
  }
}

function questionToRow(householdId: string, item: Question): QuestionRow {
  return {
    id: item.id,
    household_id: householdId,
    to: item.to,
    text: item.text,
    answer: item.answer,
    done: item.done,
    attachments: item.attachments ?? [],
    who: item.who,
  }
}

function rowToIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    text: row.text,
    tag: row.tag,
    url: row.url,
    createdAt: row.created_at,
    attachments: asAttachments(row.attachments),
    who: asWho(row.who),
  }
}

function ideaToRow(householdId: string, item: Idea): IdeaRow {
  return {
    id: item.id,
    household_id: householdId,
    text: item.text,
    tag: item.tag,
    url: item.url,
    created_at: item.createdAt,
    attachments: item.attachments ?? [],
    who: item.who,
  }
}

function rowToMinute(row: MinuteRow): Minute {
  return {
    id: row.id,
    date: row.date,
    theme: row.theme,
    raw: row.raw ?? '',
    decided: row.decided,
    myTodo: row.my_todo,
    theirTodo: row.their_todo,
    pending: row.pending,
    newq: row.newq,
    attachments: asAttachments(row.attachments),
    who: asWho(row.who),
    sentDecided: asStringList(row.sent_decided),
    sentNewq: asStringList(row.sent_newq),
  }
}

function minuteToRow(householdId: string, item: Minute): MinuteRow {
  return {
    id: item.id,
    household_id: householdId,
    date: item.date,
    theme: item.theme,
    raw: item.raw,
    decided: item.decided,
    my_todo: item.myTodo,
    their_todo: item.theirTodo,
    pending: item.pending,
    newq: item.newq,
    attachments: item.attachments ?? [],
    who: item.who,
    sent_decided: item.sentDecided,
    sent_newq: item.sentNewq,
  }
}

function rowToDoc(row: DocRow): Doc {
  return {
    id: row.id,
    title: row.title,
    kind: asDocKind(row.kind),
    note: row.note ?? '',
    attachments: asAttachments(row.attachments),
    createdAt: row.created_at,
    who: asWho(row.who),
  }
}

function docToRow(householdId: string, item: Doc): DocRow {
  return {
    id: item.id,
    household_id: householdId,
    title: item.title,
    kind: item.kind,
    note: item.note,
    attachments: item.attachments ?? [],
    created_at: item.createdAt,
    who: item.who,
  }
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /iezukuri_docs/.test(error.message ?? '')
  )
}
