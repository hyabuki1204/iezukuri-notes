import type { AppData } from './types.ts'
import { emptyAppData } from './types.ts'
import type { Store } from './store.ts'

export const STORAGE_KEY = 'iezukuri-notes:v1'

function readAppData(raw: string | null): AppData {
  if (!raw) return emptyAppData()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyAppData()
    const data = parsed as Partial<AppData>
    return {
      decisions: Array.isArray(data.decisions) ? data.decisions : [],
      questions: Array.isArray(data.questions) ? data.questions : [],
      ideas: Array.isArray(data.ideas) ? data.ideas : [],
      minutes: Array.isArray(data.minutes)
        ? data.minutes.map((minute) => ({
            ...minute,
            raw: minute.raw ?? '',
          }))
        : [],
    }
  } catch {
    return emptyAppData()
  }
}

export class LocalStore implements Store {
  private readonly storage: Storage

  constructor(storage: Storage = localStorage) {
    this.storage = storage
  }

  async load(): Promise<AppData> {
    return readAppData(this.storage.getItem(STORAGE_KEY))
  }

  async save(data: AppData): Promise<void> {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
