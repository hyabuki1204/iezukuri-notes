import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { Modal } from '../components/Modal.tsx'
import { SelectField, TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import {
  DangerZone,
  EditBar,
  Tag,
  useOpenFromJump,
  useOpenSet,
} from '../components/ui.tsx'
import { useData } from '../app/DataProvider.tsx'
import { TodosView } from '../components/Todos.tsx'
import { openTodoCount } from '../lib/todos.ts'
import { keepPaths, removeAttachments } from '../lib/files.ts'
import { newId, nowIso } from '../lib/ids.ts'
import { firstLine } from '../lib/preview.ts'
import { guessCategory } from '../lib/guessAllocate.ts'
import { firstOf, optionsFor } from '../lib/lists.ts'
import { type Question, type Who } from '../storage/types.ts'

export function QuestionsScreen() {
  const { data, update } = useData()
  const { openIds, setOpenIds, editingIds, toggle, toggleEdit } = useOpenSet()
  const [showDone, setShowDone] = useState(false)
  const [byAssignee, setByAssignee] = useState(true)
  const [view, setView] = useState<'questions' | 'todos'>('questions')
  const todoCount = openTodoCount(data)
  const { jump, consumeJump } = useData()
  useEffect(() => {
    if (jump?.tab === 'questions' && jump.view) {
      setView(jump.view)
      if (!jump.openId) consumeJump()
    }
  }, [jump, consumeJump])
  const [justDone, setJustDone] = useState<Question | null>(null)
  const toastTimer = useRef(0)
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

  const openOne = useCallback(
    (id: string) => {
      if (data.questions.find((item) => item.id === id)?.done) setShowDone(true)
      setOpenIds((current) => new Set(current).add(id))
    },
    [data.questions, setOpenIds],
  )
  useOpenFromJump('questions', openOne)

  const groups = useMemo(() => {
    if (!byAssignee) return [['', openItems]] as const
    const order = [
      ...data.lists.assignees,
      ...openItems.map((item) => item.to).filter((to) => !data.lists.assignees.includes(to)),
    ]
    return [...new Set(order)]
      .map((to) => [to, openItems.filter((item) => item.to === to)] as const)
      .filter(([, list]) => list.length > 0)
  }, [byAssignee, openItems, data.lists.assignees])

  function markDone(item: Question, done: boolean) {
    patch(item.id, { done })
    setJustDone(done ? item : null)
    window.clearTimeout(toastTimer.current)
    if (done) toastTimer.current = window.setTimeout(() => setJustDone(null), 6000)
    if (done) {
      setOpenIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
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
      <div className="mb-3 grid grid-cols-2 rounded-sm border border-line bg-card p-1">
        {(
          [
            ['questions', '質問', openItems.length],
            ['todos', '宿題', todoCount],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={`rounded-[9px] py-2 text-sm ${view === id ? 'bg-blue font-bold text-card' : 'text-muted'}`}
            onClick={() => setView(id)}
          >
            {label}
            <span className={`ml-1 text-xs ${view === id ? 'text-card/80' : ''}`}>{count}</span>
          </button>
        ))}
      </div>
      {view === 'todos' ? <TodosView /> : null}
      {view === 'questions' ? (
        <>
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

      {justDone ? (
        <div className="mt-3 flex items-center gap-3 rounded-sm bg-ink px-4 py-2.5 text-card">
          <p className="min-w-0 flex-1 truncate text-sm">「{justDone.text}」を回答済にしました</p>
          <button
            type="button"
            className="shrink-0 text-sm font-bold text-card underline underline-offset-4"
            onClick={() => markDone(justDone, false)}
          >
            元に戻す
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[13px] text-muted">未回答 {openItems.length}件</p>
        <div className="flex rounded-full border border-line bg-card p-0.5 text-[13px]">
          {(
            [
              [true, '宛先ごと'],
              [false, '一覧'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              className={`rounded-full px-3 py-1 ${byAssignee === value ? 'bg-blue font-bold text-card' : 'text-muted'}`}
              onClick={() => setByAssignee(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {groups.map(([to, list]) => (
        <section key={to || 'all'} className="mt-4">
          {to ? (
            <h2 className="section-title">
              {to}に聞く <span className="font-normal">{list.length}件</span>
            </h2>
          ) : null}
          <ul className="card-list mt-2">
            {list.map((item) => (
              <QuestionCard
                key={item.id}
                item={item}
                open={openIds.has(item.id)}
                editing={editingIds.has(item.id)}
                onToggle={() => toggle(item.id)}
                onToggleEdit={() => toggleEdit(item.id)}
                onPatch={(partial) => patch(item.id, partial)}
                onDone={(done) => markDone(item, done)}
                onPromote={() => startPromote(item)}
                onRemove={() => remove(item.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      <button
        type="button"
        className="btn-ghost mt-6 w-full py-2.5 text-muted"
        onClick={() => setShowDone((value) => !value)}
      >
        回答済 {doneItems.length}件{showDone ? 'を閉じる' : 'を見る'}
      </button>
      {showDone ? (
        <ul className="card-list mt-2">
          {doneItems.map((item) => (
            <QuestionCard
              key={item.id}
              item={item}
              open={openIds.has(item.id)}
              editing={editingIds.has(item.id)}
              onToggle={() => toggle(item.id)}
              onToggleEdit={() => toggleEdit(item.id)}
              onPatch={(partial) => patch(item.id, partial)}
              onDone={(done) => markDone(item, done)}
              onPromote={() => startPromote(item)}
              onRemove={() => remove(item.id)}
            />
          ))}
        </ul>
      ) : null}

        </>
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
  editing,
  onToggle,
  onToggleEdit,
  onPatch,
  onDone,
  onPromote,
  onRemove,
}: {
  item: Question
  open: boolean
  editing: boolean
  onToggle: () => void
  onToggleEdit: () => void
  onPatch: (partial: Partial<Question>) => void
  onDone: (done: boolean) => void
  onPromote: () => void
  onRemove: () => void
}) {
  const { data } = useData()
  return (
    <li id={`item-${item.id}`} className={`note-card scroll-mt-24 ${open ? 'md:col-span-2' : ''}`}>
      <div className="flex items-stretch">
        <button
          type="button"
          className="block min-w-0 flex-1 px-4 py-3 text-left"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="flex items-start gap-2">
            <span
              className={`min-w-0 flex-1 text-[15px] leading-snug ${item.done ? 'text-muted line-through decoration-1' : 'text-ink'}`}
            >
              {item.text}
            </span>
            <WhoStamp who={item.who} />
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Tag tone="blue">{item.to}</Tag>
            {item.done ? <Tag tone="green">回答済</Tag> : null}
          </span>
          {!open && item.answer ? (
            <span className="mt-1.5 block text-[13px] leading-snug text-ink/70">
              回答：{firstLine(item.answer, 60)}
            </span>
          ) : null}
          {!open ? <AttachmentHint files={item.attachments} /> : null}
        </button>
        {!item.done ? (
          <button
            type="button"
            className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-line text-green"
            onClick={() => onDone(true)}
            aria-label="回答済にする"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="m8 12.5 2.7 2.7L16.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold">済にする</span>
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-3 border-t border-line px-4 py-3">
          <EditBar editing={editing} onToggle={onToggleEdit}>
            <span className="text-[13px] text-muted">
              {editing ? '質問文・宛先・写真を直せます' : '回答はその場で書けます'}
            </span>
          </EditBar>
          {editing ? (
            <>
              <TextArea
                label="質問"
                value={item.text}
                onChange={(event) => onPatch({ text: event.target.value })}
              />
              <SelectField
                label="宛先"
                value={item.to}
                onChange={(event) => onPatch({ to: event.target.value })}
              >
                {optionsFor(data.lists.assignees, item.to).map((to) => (
                  <option key={to} value={to}>
                    {to}
                  </option>
                ))}
              </SelectField>
              <WhoField value={item.who} onChange={(who) => onPatch({ who })} />
              <Attachments
                files={item.attachments}
                ownerId={item.id}
                onChange={(attachments) => onPatch({ attachments })}
              />
              <DangerZone onRemove={onRemove} label="この質問を削除" />
            </>
          ) : (
            <>
              <TextArea
                label="回答"
                value={item.answer}
                placeholder="聞いた答えをメモ"
                onChange={(event) => onPatch({ answer: event.target.value })}
              />
              <Attachments
                files={item.attachments}
                ownerId={item.id}
                readOnly
                onChange={(attachments) => onPatch({ attachments })}
              />
              {item.done ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-ghost" onClick={() => onDone(false)}>
                    未回答に戻す
                  </button>
                  <button type="button" className="btn-primary" onClick={onPromote}>
                    決定台帳へ送る
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-wide bg-green text-card"
                  onClick={() => onDone(true)}
                >
                  回答済にする
                </button>
              )}
            </>
          )}
        </div>
      ) : null}
    </li>
  )
}
