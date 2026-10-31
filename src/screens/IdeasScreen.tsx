import { useCallback, useState } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import { DangerZone, EditBar, Tag, useOpenFromJump, useOpenSet } from '../components/ui.tsx'
import { useData } from '../app/DataProvider.tsx'
import { keepPaths, removeAttachments } from '../lib/files.ts'
import { newId, nowIso } from '../lib/ids.ts'
import { firstLine } from '../lib/preview.ts'
import type { Attachment, Idea, Who } from '../storage/types.ts'

export function IdeasScreen() {
  const { data, update } = useData()
  const { openIds, setOpenIds, editingIds, toggle, toggleEdit } = useOpenSet()
  const [detail, setDetail] = useState(false)
  const openOne = useCallback(
    (id: string) => setOpenIds((current) => new Set(current).add(id)),
    [setOpenIds],
  )
  useOpenFromJump('ideas', openOne)
  const [draftId, setDraftId] = useState(newId)
  const [text, setText] = useState('')
  const [tag, setTag] = useState('')
  const [url, setUrl] = useState('')
  const [draftFiles, setDraftFiles] = useState<Attachment[]>([])
  const [who, setWho] = useState<Who>('自分')

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
    setDetail(false)
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
        <textarea
          aria-label="思いついたこと"
          rows={2}
          className="w-full resize-none rounded-sm border border-line bg-paper px-3 py-2.5 text-base leading-relaxed text-ink outline-none focus:border-blue"
          value={text}
          placeholder="思いついたことを放り込む（判断しなくていい）"
          onChange={(event) => setText(event.target.value)}
        />
        {detail ? (
          <div className="space-y-3">
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
            <WhoField value={who} onChange={setWho} />
            <Attachments files={draftFiles} ownerId={draftId} onChange={setDraftFiles} />
          </div>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost shrink-0 px-3 text-muted"
            onClick={() => setDetail((value) => !value)}
            aria-expanded={detail}
          >
            {detail ? '詳細を閉じる' : 'タグ・URL・写真'}
          </button>
          <button
            type="button"
            className="btn flex-1 bg-purple text-card disabled:opacity-40"
            disabled={!text.trim()}
            onClick={add}
          >
            放り込む
          </button>
        </div>
      </section>

      <p className="mt-4 text-[13px] text-muted">{data.ideas.length}件</p>
      <ul className="card-list mt-2">
        {data.ideas.map((item) => {
          const open = openIds.has(item.id)
          const editing = editingIds.has(item.id)
          return (
            <li
              key={item.id}
              id={`item-${item.id}`}
              className={`note-card scroll-mt-24 ${open ? 'md:col-span-2' : ''}`}
            >
              <button
                type="button"
                className="block w-full px-4 py-3 text-left"
                onClick={() => toggle(item.id)}
                aria-expanded={open}
              >
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">
                    {firstLine(item.text, 60)}
                  </span>
                  <WhoStamp who={item.who} />
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.tag ? <Tag tone="purple">{item.tag}</Tag> : null}
                  {item.url ? <Tag>リンクあり</Tag> : null}
                  <span className="text-xs text-muted">{item.createdAt.slice(0, 10)}</span>
                </span>
                {!open ? <AttachmentHint files={item.attachments} /> : null}
              </button>
              {open ? (
                <div className="space-y-3 border-t border-line px-4 py-3">
                  <EditBar editing={editing} onToggle={() => toggleEdit(item.id)} />
                  {editing ? (
                    <>
                      <TextArea
                        label="本文"
                        value={item.text}
                        onChange={(event) => patch(item.id, { text: event.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <TextField
                          label="タグ"
                          value={item.tag}
                          onChange={(event) => patch(item.id, { tag: event.target.value })}
                        />
                        <TextField
                          label="URL"
                          value={item.url}
                          inputMode="url"
                          onChange={(event) => patch(item.id, { url: event.target.value })}
                        />
                      </div>
                      <WhoField
                        value={item.who}
                        onChange={(next) => patch(item.id, { who: next })}
                      />
                      <Attachments
                        files={item.attachments}
                        ownerId={item.id}
                        onChange={(attachments) => patch(item.id, { attachments })}
                      />
                      <DangerZone onRemove={() => remove(item.id)} label="このアイデアを削除" />
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
                        {item.text}
                      </p>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm text-blue underline underline-offset-4"
                        >
                          {item.url}
                        </a>
                      ) : null}
                      <Attachments
                        files={item.attachments}
                        ownerId={item.id}
                        readOnly
                        onChange={(attachments) => patch(item.id, { attachments })}
                      />
                    </>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
