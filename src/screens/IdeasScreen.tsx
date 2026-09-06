import { useState } from 'react'
import { TextArea, TextField } from '../components/Field.tsx'
import { useData } from '../app/DataProvider.tsx'
import { newId, nowIso } from '../lib/ids.ts'
import type { Idea } from '../storage/types.ts'

export function IdeasScreen() {
  const { data, update } = useData()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')
  const [tag, setTag] = useState('')
  const [url, setUrl] = useState('')

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function add() {
    if (!text.trim()) return
    update((current) => ({
      ...current,
      ideas: [
        {
          id: newId(),
          text: text.trim(),
          tag: tag.trim(),
          url: url.trim(),
          createdAt: nowIso(),
        },
        ...current.ideas,
      ],
    }))
    setText('')
    setTag('')
    setUrl('')
  }

  function patch(id: string, partial: Partial<Idea>) {
    update((current) => ({
      ...current,
      ideas: current.ideas.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }))
  }

  function remove(id: string) {
    if (!window.confirm('このアイデアを削除しますか？')) return
    update((current) => ({
      ...current,
      ideas: current.ideas.filter((item) => item.id !== id),
    }))
  }

  return (
    <div className="page">
      <section className="panel space-y-3 p-3 md:max-w-2xl md:p-5">
        <TextArea
          label="思いついたこと"
          value={text}
          placeholder="判断しなくていい。放り込むだけ。"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="タグ"
            value={tag}
            placeholder="外構 など"
            onChange={(event) => setTag(event.target.value)}
          />
          <TextField
            label="URL"
            value={url}
            inputMode="url"
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="w-full bg-ink py-2 text-sm tracking-[0.12em] text-card md:w-auto md:px-8"
          onClick={add}
        >
          放り込む
        </button>
      </section>

      <ul className="card-list">
        {data.ideas.map((item) => (
          <li
            key={item.id}
            className={`border border-line bg-card ${openIds.has(item.id) ? 'md:col-span-2' : ''}`}
          >
            <button
              type="button"
              className="w-full px-3 py-3 text-left"
              onClick={() => toggle(item.id)}
            >
              <span className="block text-sm text-ink">{item.text}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {[item.tag, item.url].filter(Boolean).join(' · ') || 'タグなし'}
              </span>
            </button>
            {openIds.has(item.id) ? (
              <div className="space-y-3 border-t border-line px-3 py-3">
                <TextArea
                  label="本文"
                  value={item.text}
                  onChange={(event) => patch(item.id, { text: event.target.value })}
                />
                <TextField
                  label="タグ"
                  value={item.tag}
                  onChange={(event) => patch(item.id, { tag: event.target.value })}
                />
                <TextField
                  label="URL"
                  value={item.url}
                  onChange={(event) => patch(item.id, { url: event.target.value })}
                />
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm text-ink underline underline-offset-4"
                  >
                    リンクを開く
                  </a>
                ) : null}
                <button
                  type="button"
                  className="text-sm text-timber"
                  onClick={() => remove(item.id)}
                >
                  削除
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
