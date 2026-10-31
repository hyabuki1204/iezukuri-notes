import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useData, type Tab } from '../app/DataProvider.tsx'
import { STATUS_LABEL, type AppData } from '../storage/types.ts'

type Hit = {
  tab: Tab
  id: string
  title: string
  meta: string
  snippet: string
}

const TAB_LABEL: Record<Tab, string> = {
  decisions: '決定',
  questions: '質問',
  ideas: 'アイデア',
  minutes: '議事録',
  docs: '資料',
}

function norm(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

function snippetOf(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const lower = norm(flat)
  let at = -1
  for (const term of terms) {
    at = lower.indexOf(term)
    if (at >= 0) break
  }
  if (at < 0) return flat.slice(0, 60)
  const start = Math.max(0, at - 20)
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 70)}${start + 70 < flat.length ? '…' : ''}`
}

function search(data: AppData, query: string): Hit[] {
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  const match = (...fields: (string | undefined)[]) => {
    const hay = norm(fields.filter(Boolean).join('\n'))
    return terms.every((term) => hay.includes(term))
  }
  const hits: Hit[] = []
  for (const item of data.decisions) {
    if (match(item.title, item.body, item.cat, item.area)) {
      hits.push({
        tab: 'decisions',
        id: item.id,
        title: item.title,
        meta: `${item.cat} · ${STATUS_LABEL[item.status]}`,
        snippet: snippetOf(item.body, terms),
      })
    }
  }
  for (const item of data.questions) {
    if (match(item.text, item.answer, item.to)) {
      hits.push({
        tab: 'questions',
        id: item.id,
        title: item.text,
        meta: `${item.to} · ${item.done ? '回答済' : '未回答'}`,
        snippet: item.answer ? snippetOf(item.answer, terms) : '',
      })
    }
  }
  for (const item of data.ideas) {
    if (match(item.text, item.tag, item.url)) {
      hits.push({
        tab: 'ideas',
        id: item.id,
        title: item.text.split('\n')[0] ?? '',
        meta: item.tag || 'タグなし',
        snippet: snippetOf(item.text, terms),
      })
    }
  }
  for (const item of data.minutes) {
    const fields = [item.decided, item.myTodo, item.theirTodo, item.pending, item.newq, item.raw]
    if (match(item.theme, ...fields)) {
      hits.push({
        tab: 'minutes',
        id: item.id,
        title: item.theme || '（テーマなし）',
        meta: item.date,
        snippet: snippetOf(fields.join('\n'), terms),
      })
    }
  }
  for (const item of data.docs) {
    if (match(item.title, item.note, item.kind)) {
      hits.push({
        tab: 'docs',
        id: item.id,
        title: item.title,
        meta: item.kind,
        snippet: snippetOf(item.note, terms),
      })
    }
  }
  return hits
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { data, go } = useData()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => search(data, query), [data, query])

  useEffect(() => {
    inputRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const groups = (Object.keys(TAB_LABEL) as Tab[])
    .map((tab) => [tab, hits.filter((hit) => hit.tab === tab)] as const)
    .filter(([, list]) => list.length > 0)

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="検索" className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="flex items-center gap-2 border-b border-line bg-card px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          className="min-w-0 flex-1 rounded-sm border border-line bg-paper px-3 py-2.5 text-base text-ink outline-none focus:border-blue"
          placeholder="食洗機、外構、締切 など"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="shrink-0 px-2 py-2 text-sm text-muted" onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(env(safe-area-inset-bottom),2rem)]">
        {!query.trim() ? (
          <p className="mt-6 text-center text-sm text-muted">
            決定・質問・アイデア・議事録・資料をまとめて探します。
          </p>
        ) : groups.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">見つかりませんでした。</p>
        ) : (
          groups.map(([tab, list]) => (
            <section key={tab} className="mb-5">
              <h2 className="mb-2 text-[13px] font-bold text-muted">
                {TAB_LABEL[tab]} <span className="font-normal">{list.length}件</span>
              </h2>
              <ul className="space-y-2">
                {list.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="w-full rounded-sm border border-line bg-card px-3 py-2.5 text-left"
                      onClick={() => {
                        go({ tab: hit.tab, openId: hit.id })
                        onClose()
                      }}
                    >
                      <span className="block text-[15px] text-ink">{hit.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{hit.meta}</span>
                      {hit.snippet ? (
                        <span className="mt-1 block text-[13px] leading-snug text-ink/70">
                          {hit.snippet}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>,
    document.body,
  )
}
