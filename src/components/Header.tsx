import { useRef, useState, type ChangeEvent } from 'react'
import { TABS } from '../app/tabs.ts'
import { useData } from '../app/DataProvider.tsx'
import { headerStats } from '../lib/stats.ts'
import { parseImportedJson } from '../storage/local.ts'

export function Header() {
  const { data, replace, cloud, cloudMessage, tab, setTab } = useData()
  const stats = headerStats(data)
  const [open, setOpen] = useState(false)
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
    anchor.download = `iezukuri-notes-${today}.json`
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
      setMessage('JSONの形が違います。書き出したファイルを選んでください。')
      setOpen(false)
      return
    }
    const ok = window.confirm(
      '今のメモを、このファイルの内容で置き換えます。よろしいですか？',
    )
    if (!ok) return
    replace(parsed)
    setMessage('読み込みました。')
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 md:px-10 md:py-6">
        <div className="min-w-0">
          <p className="font-display text-[10px] tracking-[0.28em] text-ink uppercase">
            Iezukuri
          </p>
          <h1 className="text-sm tracking-[0.18em] text-ink md:text-base">
            家づくりメモ
          </h1>
          <p className="text-[10px] tracking-wider text-muted">
            {cloud === 'connected'
              ? '2台で共有中'
              : cloud === 'error'
                ? 'クラウド未接続（この端末のみ）'
                : 'この端末のみ'}
          </p>
        </div>

        <nav className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-7">
            {TABS.map((item) => {
              const active = tab === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`text-sm tracking-[0.14em] ${
                      active ? 'text-ink' : 'text-muted'
                    }`}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="relative ml-auto">
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-xs tracking-[0.16em] text-ink"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            メニュー
          </button>
          {open ? (
            <div className="absolute right-0 z-30 mt-1 w-44 border border-line bg-card py-1">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-ink"
                onClick={exportJson}
              >
                JSONを書き出す
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-ink"
                onClick={() => fileRef.current?.click()}
              >
                JSONを読み込む
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

      <dl className="grid grid-cols-3 border-t border-line">
        <Stat label="未確定" value={stats.undecided} />
        <Stat label="図面未反映" value={stats.undrawn} />
        <Stat label="未質問" value={stats.openQuestions} />
      </dl>
      {message || cloudMessage ? (
        <p className="mx-auto max-w-6xl px-4 py-2 text-xs text-muted md:px-10">
          {message ?? cloudMessage}
        </p>
      ) : null}
    </header>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-line px-2 py-2 text-center last:border-r-0 md:py-3">
      <dt className="text-[10px] tracking-[0.16em] text-muted">{label}</dt>
      <dd className="font-display text-xl text-ink md:text-2xl">{value}</dd>
    </div>
  )
}
