import { useRef, useState, type ChangeEvent } from 'react'
import { useData } from '../app/DataProvider.tsx'
import { headerStats } from '../lib/stats.ts'
import { parseImportedJson } from '../storage/local.ts'

export function Header() {
  const { data, replace, cloud, cloudMessage } = useData()
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
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-mincho text-lg text-ink">家づくりメモ</h1>
          <p className="text-[10px] text-muted">
            {cloud === 'connected'
              ? '2台で共有中'
              : cloud === 'error'
                ? 'クラウド未接続（この端末のみ）'
                : 'この端末のみ'}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            className="rounded-sm border border-line px-2 py-1 text-sm text-muted"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            メニュー
          </button>
          {open ? (
            <div className="absolute right-0 z-30 mt-1 w-44 rounded-sm border border-line bg-card py-1">
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

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="未確定" value={stats.undecided} />
        <Stat label="図面未反映" value={stats.undrawn} />
        <Stat label="未質問" value={stats.openQuestions} />
      </dl>
      {message || cloudMessage ? (
        <p className="mt-2 text-xs text-muted">{message ?? cloudMessage}</p>
      ) : null}
    </header>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-line bg-card px-2 py-2 text-center">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className="font-mincho text-xl text-ink">{value}</dd>
    </div>
  )
}
