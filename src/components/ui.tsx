import { useEffect, useState, type ReactNode } from 'react'
import { useData, type Tab } from '../app/DataProvider.tsx'
import { STATUS_LABEL, type Status } from '../storage/types.ts'

const STATUS_BADGE = [
  'border-line bg-paper text-muted',
  'border-amber/40 bg-soft-orange text-orange',
  'border-green/40 bg-soft-green text-green',
  'border-blue/40 bg-soft-blue text-blue',
] as const

export const STATUS_BUTTON_ON = [
  'border-muted bg-paper text-ink',
  'border-orange bg-soft-orange text-orange',
  'border-green bg-soft-green text-green',
  'border-blue bg-soft-blue text-blue',
] as const

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'green' | 'blue' | 'orange' | 'red' | 'purple' }) {
  const cls = {
    muted: 'bg-paper text-muted border-line',
    green: 'bg-soft-green text-green border-green/30',
    blue: 'bg-soft-blue text-blue border-blue/30',
    orange: 'bg-soft-orange text-orange border-orange/30',
    red: 'bg-peach text-timber border-timber/30',
    purple: 'bg-soft-purple text-purple border-purple/30',
  }[tone]
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  )
}

// 読む表示の1項目。中身が空なら出さない。
export function ReadBlock({ label, text, empty }: { label: string; text: string; empty?: string }) {
  if (!text.trim() && !empty) return null
  return (
    <div>
      <p className="mb-0.5 text-[13px] font-bold text-muted">{label}</p>
      {text.trim() ? (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{text}</p>
      ) : (
        <p className="text-[15px] text-muted">{empty}</p>
      )}
    </div>
  )
}

export function EditBar({
  editing,
  onToggle,
  children,
}: {
  editing: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
      <button
        type="button"
        className={`shrink-0 rounded-sm border px-4 py-2 text-sm font-bold ${
          editing ? 'border-blue bg-blue text-card' : 'border-line bg-card text-ink'
        }`}
        onClick={onToggle}
      >
        {editing ? '完了' : '編集'}
      </button>
    </div>
  )
}

export function DangerZone({ onRemove, label = '削除' }: { onRemove: () => void; label?: string }) {
  return (
    <div className="mt-6 border-t border-dashed border-line pt-3 text-right">
      <button type="button" className="px-2 py-1.5 text-sm text-timber" onClick={onRemove}>
        {label}
      </button>
    </div>
  )
}

export function Disclosure({
  label,
  defaultOpen = false,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-sm border border-line">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-ink"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span aria-hidden className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open ? <div className="space-y-3 border-t border-line px-3 py-3">{children}</div> : null}
    </div>
  )
}

// 検索などから「この項目を開いて」と飛んできた時に開いてスクロールする
export function useOpenFromJump(tab: Tab, open: (id: string) => void) {
  const { jump, consumeJump } = useData()
  useEffect(() => {
    if (!jump || jump.tab !== tab || !jump.openId) return
    const id = jump.openId
    open(id)
    consumeJump()
    window.setTimeout(() => {
      document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }, [jump, tab, open, consumeJump])
}

// 開いているカードのIDの集合
export function useOpenSet() {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const toggle = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setEditingIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }
  const toggleEdit = (id: string) => {
    setEditingIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  return { openIds, setOpenIds, editingIds, setEditingIds, toggle, toggleEdit }
}
