import { useState } from 'react'
import { Modal } from '../components/Modal.tsx'
import { SelectField, TextArea, TextField } from '../components/Field.tsx'
import { useData } from '../app/DataProvider.tsx'
import { newId, nowIso } from '../lib/ids.ts'
import {
  ASSIGNEES,
  CATEGORIES,
  type Assignee,
  type Question,
} from '../storage/types.ts'

export function QuestionsScreen() {
  const { data, update } = useData()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ to: '営業' as Assignee, text: '' })
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

  function addDraft() {
    if (!draft.text.trim()) return
    update((current) => ({
      ...current,
      questions: [
        { id: newId(), to: draft.to, text: draft.text.trim(), answer: '', done: false },
        ...current.questions,
      ],
    }))
    setDraft({ to: '営業', text: '' })
    setAdding(false)
  }

  function startPromote(item: Question) {
    setPromote(item)
    setPromoteCat('キッチン')
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
        className="w-full border border-line bg-card py-3 text-sm tracking-[0.12em] text-ink md:w-auto md:px-8"
        onClick={() => setAdding((value) => !value)}
      >
        {adding ? '追加を閉じる' : '＋ 質問を追加'}
      </button>
      {adding ? (
        <div className="panel mt-2 space-y-3 p-3 md:max-w-xl md:p-5">
          <SelectField
            label="宛先"
            value={draft.to}
            onChange={(event) =>
              setDraft({ ...draft, to: event.target.value as Assignee })
            }
          >
            {ASSIGNEES.map((to) => (
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
          <button
            type="button"
            className="w-full bg-ink py-2 text-sm tracking-[0.12em] text-card md:w-auto md:px-8"
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
              {CATEGORIES.map((cat) => (
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
              className="w-full bg-ink py-2 text-sm tracking-[0.12em] text-card"
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
}: {
  item: Question
  open: boolean
  onToggle: () => void
  onPatch: (partial: Partial<Question>) => void
  onPromote: () => void
}) {
  return (
    <li className="border border-line bg-card">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
        onClick={onToggle}
      >
        <span>
          <span className="block text-sm text-ink">{item.text}</span>
          <span className="mt-0.5 block text-xs text-muted">{item.to}</span>
        </span>
        <span className="text-[10px] text-muted">{item.done ? '回答済' : '未'}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-line px-3 py-3">
          <SelectField
            label="宛先"
            value={item.to}
            onChange={(event) =>
              onPatch({ to: event.target.value as Assignee })
            }
          >
            {ASSIGNEES.map((to) => (
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
          {item.done ? (
            <button
              type="button"
              className="w-full border border-ink py-2 text-sm tracking-[0.12em] text-ink"
              onClick={onPromote}
            >
              決定台帳へ送る
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
