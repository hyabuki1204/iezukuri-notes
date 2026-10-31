import type { AppData } from './types.ts'

function isEmpty(data: AppData): boolean {
  return (
    data.decisions.length === 0 &&
    data.questions.length === 0 &&
    data.ideas.length === 0 &&
    data.minutes.length === 0 &&
    data.docs.length === 0
  )
}

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
// 端末でゴミ箱に移したものは一覧から外す。ゴミ箱を通さずに消えたものはクラウドに残る（消えるよりは安全）。
export function mergeLocalIntoRemote(remote: AppData, local: AppData): AppData {
  const trashedHere = new Set(local.trash.map((entry) => entry.item.id))
  const merge = <T extends { id: string }>(a: T[], b: T[]) =>
    mergeById(a, b).filter((item) => !trashedHere.has(item.id))
  return {
    decisions: merge(remote.decisions, local.decisions),
    questions: merge(remote.questions, local.questions),
    ideas: merge(remote.ideas, local.ideas),
    minutes: merge(remote.minutes, local.minutes),
    docs: merge(remote.docs, local.docs),
    lists: local.lists,
    trash: mergeById(remote.trash, local.trash).filter(
      // 端末で元に戻した（ゴミ箱から出した）ものは、ゴミ箱に戻さない
      (entry) => !local[entry.kind].some((item) => item.id === entry.item.id),
    ),
    history: { ...remote.history, ...local.history },
  }
}

// クラウドに繋がった時に、どの内容で始めるかを決める。
// - クラウドが空：端末の内容（それも空なら見本データ）をクラウドへ
// - 端末に未送信の変更がある：クラウドに端末の分を重ねる
// - それ以外：クラウドの内容
export function resolveConnect(
  loaded: AppData,
  cached: AppData,
  unsynced: boolean,
  seed: () => AppData,
): AppData {
  if (isEmpty(loaded)) return isEmpty(cached) ? { ...seed(), lists: cached.lists } : cached
  if (unsynced && !isEmpty(cached)) return mergeLocalIntoRemote(loaded, cached)
  return loaded
}
