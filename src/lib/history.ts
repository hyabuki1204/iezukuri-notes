import type { AppData, Decision, DecisionVersion } from '../storage/types.ts'

// 同じ決定を続けて直している間（前回の更新から10分以内）は1回の変更とみなす
export const SESSION_MS = 10 * 60 * 1000
export const MAX_VERSIONS = 30

export function versionOf(item: Decision): DecisionVersion {
  return {
    at: item.updatedAt,
    cat: item.cat,
    title: item.title,
    body: item.body,
    status: item.status,
    drawn: item.drawn,
    ...(item.cost !== undefined ? { cost: item.cost } : {}),
    ...(item.due ? { due: item.due } : {}),
  }
}

function sameVersion(a: DecisionVersion, b: DecisionVersion): boolean {
  return (
    a.cat === b.cat &&
    a.title === b.title &&
    a.body === b.body &&
    a.status === b.status &&
    a.drawn === b.drawn &&
    a.cost === b.cost &&
    a.due === b.due
  )
}

// 決定を直した時に、変更前の版を履歴に残す（新しい順）
export function recordDecisionChange(
  data: AppData,
  before: Decision,
  after: Decision,
  now = new Date(),
): AppData {
  const prev = versionOf(before)
  if (sameVersion(prev, versionOf(after))) return data
  const editedAt = new Date(before.updatedAt).getTime()
  if (Number.isFinite(editedAt) && now.getTime() - editedAt < SESSION_MS) return data
  const list = data.history[before.id] ?? []
  if (list[0] && sameVersion(list[0], prev)) return data
  return {
    ...data,
    history: { ...data.history, [before.id]: [prev, ...list].slice(0, MAX_VERSIONS) },
  }
}
