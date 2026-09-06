import { useState } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { Modal } from '../components/Modal.tsx'
import { SelectField, TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import { useData } from '../app/DataProvider.tsx'
import { keepPaths, removeAttachments } from '../lib/files.ts'
import { newId, nowIso } from '../lib/ids.ts'
import { firstLine } from '../lib/preview.ts'
import { guessCategory } from '../lib/guessAllocate.ts'
import { firstOf, optionsFor } from '../lib/lists.ts'
import { type Question, type Who } from '../storage/types.ts'

export function QuestionsScreen() {
  const { data, update } = useData()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({
    id: newId(),
    to: '営業',
    text: '',
    attachments: [] as Question['attachments'],
    who: '自分' as Who,
  })
  const [promote, setPromote] = useState<Question | null>(null)
  const [promoteCat, setPromoteCat] = useState<string>('キッチン')
  const [promoteTitle, setPromoteTitle] = useState('')
  const [promoteBody, setPromoteBody] = useState('')

  const openItems = data.questions.filter((item) => !item.done)
  const doneItems = data.questions.filter((item) => item.done)

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function patch(id: string, partial: Partial<Question>) {
    update((current) => ({
      ...current,
      questions: current.questions.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }))
  }

  function remove(id: string) {
    if (!window.confirm('この質問を削除しますか？')) return
    const target = data.questions.find((item) => item.id === id)
    if (target) {
      const remaining = {
        ...data,
        questions: data.questions.filter((item) => item.id !== id),
      }
      void removeAttachments(target.attachments, keepPaths(remaining))
    }
    update((current) => ({
      ...current,
      questions: current.questions.filter((item) => item.id !== id),
    }))
  }

  function addDraft() {
    if (!draft.text.trim()) return
    update((current) => ({
      ...current,
      questions: [
        {
          id: draft.id,
          to: draft.to,
          text: draft.text.trim(),
          answer: '',
          done: false,
          attachments: draft.attachments,
          who: draft.who,
        },
        ...current.questions,
      ],
    }))
    setDraft({
      id: newId(),
      to: firstOf(data.lists.assignees, '営業'),
      text: '',
      attachments: [],
      who: '自分',
    })
    setAdding(false)
  }

  function startPromote(item: Question) {
    setPromote(item)
    setPromoteCat(
      guessCategory(
        `${item.text}\n${item.answer}`,
        data.lists.categories,
        data.decisions.map((row) => ({ cat: row.cat, title: row.title })),
      ),
    )
    setPromoteTitle(item.text)
    setPromoteBody(item.answer)
  }

  function confirmPromote() {
    if (!promote || !promoteTitle.trim()) return
    const sourceId = promote.id
    update((current) => ({
      ...current,
      questions: current.questions.filter((item) => item.id !== sourceId),
      decisions: [
        {
          id: newId(),
          cat: promoteCat,
          title: promoteTitle.trim(),
          body: promoteBody.trim(),
          status: 0,
          drawn: false,
          updatedAt: nowIso(),
          attachments: promote.attachments,
          who: promote.who,
        },
        ...current.decisions,
      ],
    }))
    setPromote(null)
  }

  return (
    <div className="page">
      <button
        type="button"
        className="btn-ghost btn-wide"
        onClick={() => setAdding((value) => !value)}
      >
        {adding ? '追加を閉じる' : '＋ 質問を追加'}
      </button>
      {adding ? (
        <div className="panel mt-3 space-y-3 md:max-w-xl">
          <WhoField
            value={draft.who}
            onChange={(who) => setDraft({ ...draft, who })}
          />
          <SelectField
            label="宛先"
            value={draft.to}
            onChange={(event) =>
              setDraft({ ...draft, to: event.target.value })
            }
          >
            {optionsFor(data.lists.assignees, draft.to).map((to) => (
              <option key={to} value={to}>
                {to}
              </option>
            ))}
          </SelectField>
          <TextArea
            label="質問"
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          />
          <Attachments
            files={draft.attachments}
            ownerId={draft.id}
            onChange={(attachments) => setDraft({ ...draft, attachments })}
          />
          <button
            type="button"
            className="btn btn-wide bg-orange text-card"
            onClick={addDraft}
          >
            追加する
          </button>
        </div>
      ) : null}

      <ul className="card-list">
        {openItems.map((item) => (
          <QuestionCard
            key={item.id}
            item={item}
            open={openIds.has(item.id)}
            onToggle={() => toggle(item.id)}
            onPatch={(partial) => patch(item.id, partial)}
            onPromote={() => startPromote(item)}
            onRemove={() => remove(item.id)}
          />
        ))}
      </ul>

      <button
        type="button"
        className="mt-5 w-full text-left text-sm text-muted"
        onClick={() => setShowDone((value) => !value)}
      >
        回答済 {doneItems.length}件 {showDone ? 'を閉じる' : 'を見る'}
      </button>
      {showDone ? (
        <ul className="card-list mt-2">
          {doneItems.map((item) => (
            <QuestionCard
              key={item.id}
              item={item}
              open={openIds.has(item.id)}
              onToggle={() => toggle(item.id)}
              onPatch={(partial) => patch(item.id, partial)}
              onPromote={() => startPromote(item)}
              onRemove={() => remove(item.id)}
            />
          ))}
        </ul>
      ) : null}

      {promote ? (
        <Modal title="決定台帳へ送る" onClose={() => setPromote(null)}>
          <div className="space-y-3">
            <SelectField
              label="大分類"
              value={promoteCat}
              onChange={(event) => setPromoteCat(event.target.value)}
            >
              {optionsFor(data.lists.categories, promoteCat).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectField>
            <TextField
              label="項目名"
              value={promoteTitle}
              onChange={(event) => setPromoteTitle(event.target.value)}
            />
            <TextArea
              label="決定内容"
              value={promoteBody}
              onChange={(event) => setPromoteBody(event.target.value)}
            />
            <button
              type="button"
              className="btn-primary w-full"
              onClick={confirmPromote}
            >
              送って質問を消す
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function QuestionCard({
  item,
  open,
  onToggle,
  onPatch,
  onPromote,
  onRemove,
}: {
  item: Question
  open: boolean
  onToggle: () => void
  onPatch: (partial: Partial<Question>) => void
  onPromote: () => void
  onRemove: () => void
}) {
  const { data } = useData()
  return (
    <li className={`note-card ${open ? 'md:col-span-2' : ''}`}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
        onClick={onToggle}
      >
        <span>
          <span className="flex items-start justify-between gap-3">
            <span className="block text-sm text-ink">{item.text}</span>
            <WhoStamp who={item.who} />
          </span>
          <span className="mt-0.5 block text-xs text-muted">{item.to}</span>
          {item.answer ? (
            <span className="mt-0.5 block text-xs text-muted">
              {firstLine(item.answer)}
            </span>
          ) : null}
          <AttachmentHint files={item.attachments} />
        </span>
        <span className="text-[10px] text-muted">{item.done ? '回答済' : '未'}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-line px-3 py-3">
          <WhoField
            value={item.who}
            onChange={(who) => onPatch({ who })}
          />
          <SelectField
            label="宛先"
            value={item.to}
            onChange={(event) =>
              onPatch({ to: event.target.value })
            }
          >
            {optionsFor(data.lists.assignees, item.to).map((to) => (
              <option key={to} value={to}>
                {to}
              </option>
            ))}
          </SelectField>
          <TextArea
            label="回答"
            value={item.answer}
            onChange={(event) => onPatch({ answer: event.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={item.done}
              onChange={(event) => onPatch({ done: event.target.checked })}
            />
            回答済
          </label>
          <Attachments
            files={item.attachments}
            ownerId={item.id}
            onChange={(attachments) => onPatch({ attachments })}
          />
          {item.done ? (
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={onPromote}
            >
              決定台帳へ送る
            </button>
          ) : null}
          <button
            type="button"
            className="text-sm text-timber"
            onClick={onRemove}
          >
            削除
          </button>
        </div>
      ) : null}
    </li>
  )
}
