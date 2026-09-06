import { useState } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { SelectField, TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import { useData } from '../app/DataProvider.tsx'
import { keepPaths, removeAttachments } from '../lib/files.ts'
import { newId, nowIso } from '../lib/ids.ts'
import { firstLine } from '../lib/preview.ts'
import { DOC_KINDS, type Doc, type DocKind } from '../storage/types.ts'

function emptyDoc(): Doc {
  return {
    id: newId(),
    title: '',
    kind: '図面',
    note: '',
    attachments: [],
    createdAt: nowIso(),
    who: '自分',
  }
}

export function DocsScreen() {
  const { data, update } = useData()
  const [kindFilter, setKindFilter] = useState<DocKind | 'all'>('all')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Doc>(emptyDoc)

  const items = data.docs.filter(
    (item) => kindFilter === 'all' || item.kind === kindFilter,
  )

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function patch(id: string, partial: Partial<Doc>) {
    update((current) => ({
      ...current,
      docs: current.docs.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }))
  }

  function addDraft() {
    if (!draft.title.trim() && draft.attachments.length === 0) return
    update((current) => ({
      ...current,
      docs: [
        {
          ...draft,
          title: draft.title.trim() || draft.kind,
          createdAt: nowIso(),
        },
        ...current.docs,
      ],
    }))
    setDraft(emptyDoc())
    setAdding(false)
  }

  function remove(item: Doc) {
    if (!window.confirm('この資料を削除しますか？')) return
    const remaining = {
      ...data,
      docs: data.docs.filter((row) => row.id !== item.id),
    }
    void removeAttachments(item.attachments, keepPaths(remaining))
    update((current) => ({
      ...current,
      docs: current.docs.filter((row) => row.id !== item.id),
    }))
  }

  return (
    <div className="page">
      <p className="mb-3 text-sm text-muted">
        図面・見積・以前の打ち合わせ資料はここに置きます。各メモにも写真とPDFを付けられます。
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`chip ${kindFilter === 'all' ? 'chip-on' : ''}`}
          onClick={() => setKindFilter('all')}
        >
          すべて
        </button>
        {DOC_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`chip ${kindFilter === kind ? 'chip-on' : ''}`}
            onClick={() => setKindFilter(kind)}
          >
            {kind}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn-ghost btn-wide mt-4"
        onClick={() => {
          setDraft(emptyDoc())
          setAdding((value) => !value)
        }}
      >
        {adding ? '追加を閉じる' : '＋ 資料を追加'}
      </button>
      {adding ? (
        <article className="panel mt-3 md:max-w-2xl">
          <DocFields value={draft} onChange={setDraft} />
          <button type="button" className="btn-primary btn-wide mt-3" onClick={addDraft}>
            追加する
          </button>
        </article>
      ) : null}

      <ul className="card-list">
        {items.map((item) => (
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
                <span className="block text-sm text-ink">{item.title}</span>
                <WhoStamp who={item.who} />
              </span>
              <span className="mt-0.5 block text-xs text-muted">{item.kind}</span>
              {item.note ? (
                <span className="mt-0.5 block text-xs text-muted">
                  {firstLine(item.note)}
                </span>
              ) : null}
              <AttachmentHint files={item.attachments} />
            </button>
            {openIds.has(item.id) ? (
              <div className="space-y-3 border-t border-line px-3 py-3">
                <DocFields
                  value={item}
                  onChange={(next) => patch(item.id, next)}
                />
                <button
                  type="button"
                  className="text-sm text-timber"
                  onClick={() => remove(item)}
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

function DocFields({
  value,
  onChange,
}: {
  value: Doc
  onChange: (next: Doc) => void
}) {
  return (
    <div className="space-y-3">
      <WhoField
        value={value.who}
        onChange={(who) => onChange({ ...value, who })}
      />
      <SelectField
        label="種類"
        value={value.kind}
        onChange={(event) =>
          onChange({ ...value, kind: event.target.value as DocKind })
        }
      >
        {DOC_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {kind}
          </option>
        ))}
      </SelectField>
      <TextField
        label="名前"
        value={value.title}
        onChange={(event) => onChange({ ...value, title: event.target.value })}
      />
      <TextArea
        label="メモ"
        value={value.note}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
      />
      <Attachments
        files={value.attachments}
        ownerId={value.id}
        onChange={(attachments) => onChange({ ...value, attachments })}
      />
    </div>
  )
}
