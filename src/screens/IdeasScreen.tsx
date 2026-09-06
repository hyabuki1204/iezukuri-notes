import { useState } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import { useData } from '../app/DataProvider.tsx'
import { keepPaths, removeAttachments } from '../lib/files.ts'
import { newId, nowIso } from '../lib/ids.ts'
import { firstLine } from '../lib/preview.ts'
import type { Attachment, Idea, Who } from '../storage/types.ts'

export function IdeasScreen() {
  const { data, update } = useData()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [draftId, setDraftId] = useState(newId)
  const [text, setText] = useState('')
  const [tag, setTag] = useState('')
  const [url, setUrl] = useState('')
  const [draftFiles, setDraftFiles] = useState<Attachment[]>([])
  const [who, setWho] = useState<Who>('自分')

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
          id: draftId,
          text: text.trim(),
          tag: tag.trim(),
          url: url.trim(),
          createdAt: nowIso(),
          attachments: draftFiles,
          who,
        },
        ...current.ideas,
      ],
    }))
    setDraftId(newId())
    setText('')
    setTag('')
    setUrl('')
    setDraftFiles([])
    setWho('自分')
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
    const target = data.ideas.find((item) => item.id === id)
    if (target) {
      const remaining = {
        ...data,
        ideas: data.ideas.filter((item) => item.id !== id),
      }
      void removeAttachments(target.attachments, keepPaths(remaining))
    }
    update((current) => ({
      ...current,
      ideas: current.ideas.filter((item) => item.id !== id),
    }))
  }

  return (
    <div className="page">
      <section className="panel space-y-3 md:max-w-2xl">
        <WhoField value={who} onChange={setWho} />
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
        <Attachments
          files={draftFiles}
          ownerId={draftId}
          onChange={setDraftFiles}
        />
        <button
          type="button"
          className="btn btn-wide bg-purple text-card"
          onClick={add}
        >
          放り込む
        </button>
      </section>

      <ul className="card-list">
        {data.ideas.map((item) => (
          <li
            key={item.id}
            className={`note-card ${openIds.has(item.id) ? 'md:col-span-2' : ''}`}
          >
            <button
              type="button"
              className="w-full px-3 py-3 text-left"
              onClick={() => toggle(item.id)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="block text-sm text-ink">{firstLine(item.text)}</span>
                <WhoStamp who={item.who} />
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {[item.tag, item.url].filter(Boolean).join(' · ') || 'タグなし'}
              </span>
              <AttachmentHint files={item.attachments} />
            </button>
            {openIds.has(item.id) ? (
              <div className="space-y-3 border-t border-line px-3 py-3">
                <WhoField
                  value={item.who}
                  onChange={(next) => patch(item.id, { who: next })}
                />
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
                <Attachments
                  files={item.attachments}
                  ownerId={item.id}
                  onChange={(attachments) => patch(item.id, { attachments })}
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
