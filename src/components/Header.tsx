import { useRef, useState, type ChangeEvent } from 'react'
import { useData } from '../app/DataProvider.tsx'
import { dueUrgency } from '../lib/due.ts'
import { headerStats } from '../lib/stats.ts'
import { parseImportedJson } from '../storage/local.ts'
import { SearchOverlay } from './SearchOverlay.tsx'
import { NavTabs } from './NavTabs.tsx'

export function Header({ onEditLists }: { onEditLists: () => void }) {
  const { data, replace, cloud, cloudMessage, unsynced, retry, go } = useData()
  const stats = headerStats(data)
  const urgentCount = data.decisions.filter((item) => dueUrgency(item.due)).length
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
    <>
      <header className="app-chrome sticky top-0 z-20 border-b border-line bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-blue text-card sm:flex">
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
              <p
                className={`text-xs ${cloud === 'error' ? 'font-bold text-timber' : 'text-muted'}`}
              >
                {cloud === 'connected'
                  ? unsynced
                    ? '保存中…'
                    : '2台で共有中'
                  : cloud === 'error'
                    ? 'クラウド未接続'
                    : 'この端末のみ'}
              </p>
            </div>
          </div>

          <nav className="hidden flex-1 justify-center md:flex">
            <NavTabs variant="header" />
          </nav>

          <div className="relative ml-auto flex items-center gap-1.5">
            <button
              type="button"
              className="flex h-10 items-center gap-1 rounded-sm border border-line bg-paper px-2.5 text-xs font-medium whitespace-nowrap text-ink"
              onClick={() => setSearching(true)}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              検索
            </button>
            <a
              href="/ldk/"
              className="flex h-10 items-center gap-1 rounded-sm border border-line bg-paper px-2.5 text-xs font-medium text-ink"
              aria-label="LDK 3D ウォークスルーを開く"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18m8-13.5-8 4.5-8-4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              3D
            </a>
            <button
              type="button"
              className="flex h-10 items-center rounded-sm border border-line bg-paper px-2.5 text-xs font-medium whitespace-nowrap text-ink"
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
        {cloud === 'error' ? (
          <div className="flex items-center gap-3 bg-timber px-4 py-2.5 text-card md:px-8">
            <p className="flex-1 text-[13px] leading-snug" title={cloudMessage ?? undefined}>
              <span className="font-bold">クラウドに繋がっていません。</span>
              入力した内容はこの端末にだけ保存中です。繋がり次第、自動で送ります。
            </p>
            <button
              type="button"
              className="shrink-0 rounded-sm bg-card px-3 py-2 text-xs font-bold text-timber"
              onClick={retry}
            >
              再接続
            </button>
          </div>
        ) : null}
      </header>
      {searching ? <SearchOverlay onClose={() => setSearching(false)} /> : null}

      <section className="border-b border-line bg-card">
        <dl className="mx-auto grid max-w-6xl grid-cols-3 gap-2 px-4 py-3 md:px-8">
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

        {message ? (
          <p className="mx-auto max-w-6xl px-4 pb-3 text-xs text-muted md:px-8">
            {message}
          </p>
        ) : null}
      </section>
    </>
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
      <span className="block text-xs text-muted">{label}</span>
      <span className={`block text-xl font-bold ${tone}`}>{value}</span>
    </button>
  )
}
