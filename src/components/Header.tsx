import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useData } from '../app/DataProvider.tsx'
import { dueUrgency } from '../lib/due.ts'
import { headerStats } from '../lib/stats.ts'
import { parseImportedJson } from '../storage/local.ts'
import { NavIcon } from './NavIcon.tsx'
import { NavTabs } from './NavTabs.tsx'

export function Header({ onEditLists }: { onEditLists: () => void }) {
  const { data, replace, cloud, cloudMessage, go, tab, setTab } = useData()
  const stats = headerStats(data)
  const urgentCount = data.decisions.filter((item) => dueUrgency(item.due)).length
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        setCollapsed(window.scrollY > 40)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `家づくりメモ-バックアップ-${today}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const parsed = parseImportedJson(text)
    if (!parsed) {
      setMessage('バックアップのファイルではありません。保存したファイルを選んでください。')
      setOpen(false)
      return
    }
    const ok = window.confirm(
      '今のメモを、このバックアップの内容で置き換えます。今あるメモは消えます。よろしいですか？',
    )
    if (!ok) return
    replace(parsed)
    setMessage('バックアップから戻しました。')
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-blue text-card">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4.5 11 12 4.5 19.5 11v8a1.5 1.5 0 0 1-1.5 1.5h-4.5v-5h-3v5H6A1.5 1.5 0 0 1 4.5 19v-8Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-ink">家づくりメモ</h1>
            <p className="text-[11px] text-muted">
              {cloud === 'connected'
                ? '2台で共有中'
                : cloud === 'error'
                  ? 'クラウド未接続（この端末のみ）'
                  : 'この端末のみ'}
            </p>
          </div>
        </div>

        <nav className="hidden flex-1 justify-center md:flex">
          <NavTabs variant="header" />
        </nav>

        <div className="relative ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`flex h-10 w-10 items-center justify-center rounded-sm border ${
              tab === 'docs'
                ? 'border-blue bg-soft-blue text-blue'
                : 'border-line bg-paper text-ink'
            }`}
            aria-label="資料"
            onClick={() => setTab('docs')}
          >
            <NavIcon id="docs" className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-sm border border-line bg-paper px-3 py-2 text-xs font-medium text-ink"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            メニュー
          </button>
          {open ? (
            <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-sm border border-line bg-card py-1 shadow-sm top-full">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-ink"
                onClick={() => {
                  setOpen(false)
                  onEditLists()
                }}
              >
                分類を編集
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-ink"
                onClick={exportJson}
              >
                バックアップを保存
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-ink"
                onClick={() => fileRef.current?.click()}
              >
                バックアップから戻す
              </button>
            </div>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => void onPickFile(event)}
          />
        </div>
      </div>

      {collapsed ? null : (
        <>
          <dl className="mx-auto grid max-w-6xl grid-cols-3 gap-2 px-4 pb-3 md:px-8">
            <Stat
              label="未確定"
              value={stats.undecided}
              tone="text-blue"
              onClick={() => go({ tab: 'decisions', filter: 'undecided' })}
            />
            <Stat
              label="図面未反映"
              value={stats.undrawn}
              tone="text-orange"
              onClick={() => go({ tab: 'decisions', filter: 'undrawn' })}
            />
            <Stat
              label="未質問"
              value={stats.openQuestions}
              tone="text-purple"
              onClick={() => go({ tab: 'questions' })}
            />
          </dl>

          {urgentCount > 0 ? (
            <div className="mx-auto max-w-6xl px-4 pb-3 md:px-8">
              <button
                type="button"
                className="w-full rounded-sm bg-peach px-3 py-2 text-left text-sm text-timber"
                onClick={() => go({ tab: 'decisions', urgent: true })}
              >
                期限が近い・過ぎた決定が {urgentCount} 件あります
              </button>
            </div>
          ) : null}
        </>
      )}

      {message || cloudMessage ? (
        <p className="mx-auto max-w-6xl px-4 pb-3 text-xs text-muted md:px-8">
          {message ?? cloudMessage}
        </p>
      ) : null}
    </header>
  )
}

function Stat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string
  value: number
  tone: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="rounded-sm border border-line bg-paper px-2 py-2 text-center"
      onClick={onClick}
    >
      <span className="block text-[10px] text-muted">{label}</span>
      <span className={`block text-xl font-bold ${tone}`}>{value}</span>
    </button>
  )
}
