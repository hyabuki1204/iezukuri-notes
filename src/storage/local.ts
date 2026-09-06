import type { AppData } from './types.ts'
import {
  asAttachments,
  asDocKind,
  asStringList,
  asWho,
  emptyAppData,
} from './types.ts'
import type { Store } from './store.ts'

export const STORAGE_KEY = 'iezukuri-notes:v1'

function normalize(data: Partial<AppData>): AppData {
  return {
    decisions: Array.isArray(data.decisions)
      ? data.decisions.map((item) => ({
          ...item,
          attachments: asAttachments(item.attachments),
          who: asWho(item.who),
        }))
      : [],
    questions: Array.isArray(data.questions)
      ? data.questions.map((item) => ({
          ...item,
          attachments: asAttachments(item.attachments),
          who: asWho(item.who),
        }))
      : [],
    ideas: Array.isArray(data.ideas)
      ? data.ideas.map((item) => ({
          ...item,
          attachments: asAttachments(item.attachments),
          who: asWho(item.who),
        }))
      : [],
    minutes: Array.isArray(data.minutes)
      ? data.minutes.map((minute) => ({
          ...minute,
          raw: minute.raw ?? '',
          attachments: asAttachments(minute.attachments),
          sentDecided: asStringList(minute.sentDecided),
          sentNewq: asStringList(minute.sentNewq),
          who: asWho(minute.who),
        }))
      : [],
    docs: Array.isArray(data.docs)
      ? data.docs.map((doc) => ({
          ...doc,
          kind: asDocKind(doc.kind),
          note: doc.note ?? '',
          attachments: asAttachments(doc.attachments),
          who: asWho(doc.who),
        }))
      : [],
  }
}

function hasAppDataKeys(value: unknown): value is Partial<AppData> {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Partial<AppData>
  return (
    Array.isArray(data.decisions) &&
    Array.isArray(data.questions) &&
    Array.isArray(data.ideas) &&
    Array.isArray(data.minutes)
  )
}

export function parseAppData(raw: string | null): AppData {
  if (!raw) return emptyAppData()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyAppData()
    return normalize(parsed as Partial<AppData>)
  } catch {
    return emptyAppData()
  }
}

export function parseImportedJson(text: string): AppData | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!hasAppDataKeys(parsed)) return null
    return normalize(parsed)
  } catch {
    return null
  }
}

export class LocalStore implements Store {
  private readonly storage: Storage

  constructor(storage: Storage = localStorage) {
    this.storage = storage
  }

  async load(): Promise<AppData> {
    return parseAppData(this.storage.getItem(STORAGE_KEY))
  }

  async save(data: AppData): Promise<void> {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
