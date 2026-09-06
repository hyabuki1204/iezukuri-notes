export type DueUrgency = 'overdue' | 'soon'

const SOON_DAYS = 14

export function dueUrgency(
  due: string | undefined,
  now = new Date(),
): DueUrgency | null {
  if (!due) return null
  const end = new Date(`${due}T23:59:59`)
  if (Number.isNaN(end.getTime())) return null
  const ms = end.getTime() - now.getTime()
  if (ms < 0) return 'overdue'
  if (ms <= SOON_DAYS * 24 * 60 * 60 * 1000) return 'soon'
  return null
}
