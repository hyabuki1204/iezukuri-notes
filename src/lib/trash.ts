import type { AppData, Attachment, TrashEntry, TrashKind } from '../storage/types.ts'

export const TRASH_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export const TRASH_KIND_LABEL: Record<TrashKind, string> = {
  decisions: '決定',
  questions: '質問',
  ideas: 'アイデア',
  minutes: '議事録',
  docs: '資料',
}

export function trashTitle(entry: TrashEntry): string {
  switch (entry.kind) {
    case 'decisions':
      return entry.item.title || '（項目名なし）'
    case 'questions':
      return entry.item.text || '（質問なし）'
    case 'ideas':
      return entry.item.text.split('\n')[0] || '（本文なし）'
    case 'minutes':
      return `${entry.item.date} ${entry.item.theme || '（テーマなし）'}`
    case 'docs':
      return entry.item.title || entry.item.kind
  }
}

// ゴミ箱に移す。一覧から外し、中身はゴミ箱にそのまま残す（写真も消さない）
export function moveToTrash(data: AppData, kind: TrashKind, id: string, now = new Date()): AppData {
  const list = data[kind] as { id: string }[]
  const item = list.find((row) => row.id === id)
  if (!item) return data
  const entry = { id: `${kind}:${id}:${now.getTime()}`, kind, item, deletedAt: now.toISOString() } as TrashEntry
  return {
    ...data,
    [kind]: list.filter((row) => row.id !== id),
    trash: [entry, ...data.trash],
  }
}

// 元に戻す。同じIDがもう一覧にあれば、ゴミ箱から外すだけ
export function restoreFromTrash(data: AppData, entryId: string): AppData {
  const entry = data.trash.find((row) => row.id === entryId)
  if (!entry) return data
  const list = data[entry.kind] as { id: string }[]
  const exists = list.some((row) => row.id === entry.item.id)
  return {
    ...data,
    [entry.kind]: exists ? list : [entry.item, ...list],
    trash: data.trash.filter((row) => row.id !== entryId),
  }
}

// 完全に削除する。消した項目の写真・PDFと、決定の変更履歴も返す/消す
export function purgeFromTrash(
  data: AppData,
  entryIds: string[],
): { data: AppData; files: Attachment[] } {
  const ids = new Set(entryIds)
  const purged = data.trash.filter((row) => ids.has(row.id))
  if (purged.length === 0) return { data, files: [] }
  const history = { ...data.history }
  for (const entry of purged) {
    if (entry.kind === 'decisions') delete history[entry.item.id]
  }
  return {
    data: { ...data, trash: data.trash.filter((row) => !ids.has(row.id)), history },
    files: purged.flatMap((entry) => entry.item.attachments),
  }
}

export function daysLeft(entry: TrashEntry, now = new Date()): number {
  const elapsed = now.getTime() - new Date(entry.deletedAt).getTime()
  return Math.max(0, Math.ceil(TRASH_DAYS - elapsed / DAY_MS))
}

export function expiredTrashIds(data: AppData, now = new Date()): string[] {
  return data.trash.filter((entry) => daysLeft(entry, now) === 0).map((entry) => entry.id)
}
