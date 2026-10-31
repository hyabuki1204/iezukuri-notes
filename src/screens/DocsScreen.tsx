import { useCallback, useState } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { SelectField, TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import { DangerZone, EditBar, ReadBlock, Tag, useOpenFromJump, useOpenSet } from '../components/ui.tsx'
import { moveToTrash } from '../lib/trash.ts'
import { useData } from '../app/DataProvider.tsx'
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
  const { openIds, setOpenIds, editingIds, toggle, toggleEdit } = useOpenSet()
  const openOne = useCallback(
    (id: string) => {
      setKindFilter('all')
      setOpenIds((current) => new Set(current).add(id))
    },
    [setOpenIds],
  )
  useOpenFromJump('docs', openOne)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Doc>(emptyDoc)

  const items = data.docs.filter(
    (item) => kindFilter === 'all' || item.kind === kindFilter,
  )

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
    if (!window.confirm('この資料をゴミ箱に移しますか？（30日間はメニューのゴミ箱から戻せます）')) return
    update((current) => moveToTrash(current, 'docs', item.id))
  }

  return (
    <div className="page">
      <p className="mb-3 text-[13px] text-muted">
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
        className="btn-ghost btn-wide mt-3 py-2.5"
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
        {items.map((item) => {
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
                  <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-ink">
                    {item.title}
                  </span>
                  <WhoStamp who={item.who} />
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Tag tone="blue">{item.kind}</Tag>
                  <span className="text-xs text-muted">{item.createdAt.slice(0, 10)}</span>
                </span>
                {!open && item.note ? (
                  <span className="mt-1.5 block text-[13px] leading-snug text-ink/70">
                    {firstLine(item.note, 60)}
                  </span>
                ) : null}
                {!open ? <AttachmentHint files={item.attachments} /> : null}
              </button>
              {open ? (
                <div className="space-y-3 border-t border-line px-4 py-3">
                  <EditBar editing={editing} onToggle={() => toggleEdit(item.id)} />
                  {editing ? (
                    <>
                      <DocFields value={item} onChange={(next) => patch(item.id, next)} />
                      <DangerZone onRemove={() => remove(item)} label="この資料を削除" />
                    </>
                  ) : (
                    <>
                      <ReadBlock label="メモ" text={item.note} />
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
