import type { AppData } from './types.ts'

// クラウドに送れていない変更がこの端末にあるかどうか。
// 繋がった時にクラウドの内容で上書きして消さないための目印。
const KEY = 'iezukuri-notes:unsynced'

export function hasUnsynced(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markUnsynced(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // ignore
  }
}

export function clearUnsynced(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteIds = new Set(remote.map((item) => item.id))
  const added = local.filter((item) => !remoteIds.has(item.id))
  return [...added, ...remote.map((item) => localById.get(item.id) ?? item)]
}

// クラウドの内容に、この端末だけにある追加・変更を重ねる（端末側を優先）。
// 端末で消したものはクラウドに残る（消えるよりは安全）。
export function mergeLocalIntoRemote(remote: AppData, local: AppData): AppData {
  return {
    decisions: mergeById(remote.decisions, local.decisions),
    questions: mergeById(remote.questions, local.questions),
    ideas: mergeById(remote.ideas, local.ideas),
    minutes: mergeById(remote.minutes, local.minutes),
    docs: mergeById(remote.docs, local.docs),
    lists: local.lists,
  }
}
