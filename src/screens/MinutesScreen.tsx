import { useState } from 'react'
import { Modal } from '../components/Modal.tsx'
import { TextArea, TextField } from '../components/Field.tsx'
import { useData } from '../app/DataProvider.tsx'
import { newId, nowIso, todayIsoDate } from '../lib/ids.ts'
import { formatMinuteLetter, linesOf } from '../lib/minuteText.ts'
import {
  ASSIGNEES,
  CATEGORIES,
  type Decision,
  type Minute,
  type Question,
} from '../storage/types.ts'

function emptyMinute(): Minute {
  return {
    id: newId(),
    date: todayIsoDate(),
    theme: '',
    raw: '',
    decided: '',
    myTodo: '',
    theirTodo: '',
    pending: '',
    newq: '',
  }
}

export function MinutesScreen() {
  const { data, update } = useData()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Minute>(emptyMinute)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sendFor, setSendFor] = useState<Minute | null>(null)
  const [sendCat, setSendCat] = useState('キッチン')
  const [pickedDecided, setPickedDecided] = useState<string[]>([])
  const [pickedQuestions, setPickedQuestions] = useState<string[]>([])

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function patch(id: string, next: Minute) {
    update((current) => ({
      ...current,
      minutes: current.minutes.map((item) => (item.id === id ? next : item)),
    }))
  }

  function saveDraft() {
    if (!draft.theme.trim() && !draft.raw.trim() && !draft.decided.trim()) return
    const saved = { ...draft, theme: draft.theme.trim() }
    update((current) => ({
      ...current,
      minutes: [saved, ...current.minutes],
    }))
    setAdding(false)
    setDraft(emptyMinute())
    openSend(saved)
  }

  function openSend(minute: Minute) {
    const decided = linesOf(minute.decided)
    const questions = linesOf(minute.newq)
    if (decided.length === 0 && questions.length === 0) return
    setSendFor(minute)
    setSendCat('キッチン')
    setPickedDecided(decided)
    setPickedQuestions(questions)
  }

  function confirmSend() {
    if (!sendFor) return
    const decidedRows: Decision[] = pickedDecided.map((line) => ({
      id: newId(),
      cat: sendCat,
      title: line.slice(0, 40),
      body: line,
      status: 1,
      drawn: false,
      updatedAt: nowIso(),
    }))
    const questionRows: Question[] = pickedQuestions.map((line) => ({
      id: newId(),
      to: ASSIGNEES[0],
      text: line,
      answer: '',
      done: false,
    }))
    update((current) => ({
      ...current,
      decisions: [...decidedRows, ...current.decisions],
      questions: [...questionRows, ...current.questions],
    }))
    setSendFor(null)
  }

  async function copyLetter(minute: Minute) {
    await navigator.clipboard.writeText(formatMinuteLetter(minute))
    setCopiedId(minute.id)
  }

  return (
    <div className="px-4 py-4">
      <button
        type="button"
        className="w-full rounded-sm border border-line bg-card py-3 text-sm text-green"
        onClick={() => {
          setDraft(emptyMinute())
          setAdding((value) => !value)
        }}
      >
        {adding ? '作成を閉じる' : '＋ 議事録を追加'}
      </button>
      {adding ? (
        <article className="mt-2 rounded-sm border border-line bg-card p-3">
          <MinuteFields value={draft} onChange={setDraft} />
          <button
            type="button"
            className="mt-3 w-full rounded-sm bg-green py-2 text-sm text-card"
            onClick={saveDraft}
          >
            保存する
          </button>
        </article>
      ) : null}

      <ul className="mt-4 space-y-2">
        {data.minutes.map((item) => (
          <li key={item.id} className="rounded-sm border border-line bg-card">
            <button
              type="button"
              className="w-full px-3 py-3 text-left"
              onClick={() => toggle(item.id)}
            >
              <span className="block text-sm text-ink">
                {item.theme || '（テーマなし）'}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{item.date}</span>
            </button>
            {openIds.has(item.id) ? (
              <div className="border-t border-line px-3 py-3">
                <MinuteFields
                  value={item}
                  onChange={(next) => patch(item.id, next)}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-sm border border-line py-2 text-sm text-ink"
                    onClick={() => void copyLetter(item)}
                  >
                    {copiedId === item.id ? 'コピーした' : '担当者へ送る文面'}
                  </button>
                  <button
                    type="button"
                    className="rounded-sm border border-green py-2 text-sm text-green"
                    onClick={() => openSend(item)}
                  >
                    台帳へ送る
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {sendFor ? (
        <Modal title="台帳へ送る" onClose={() => setSendFor(null)}>
          <p className="mb-3 text-xs text-muted">
            改行ごとに1件。外したい行は外してください。大分類は一括です。
          </p>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-muted">決定の大分類</span>
            <select
              className="w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm"
              value={sendCat}
              onChange={(event) => setSendCat(event.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <LinePicks
            label="決まったこと → 決定"
            lines={linesOf(sendFor.decided)}
            picked={pickedDecided}
            onChange={setPickedDecided}
          />
          <LinePicks
            label="新たな疑問 → 質問"
            lines={linesOf(sendFor.newq)}
            picked={pickedQuestions}
            onChange={setPickedQuestions}
          />
          <button
            type="button"
            className="mt-3 w-full rounded-sm bg-green py-2 text-sm text-card"
            onClick={confirmSend}
          >
            送る
          </button>
        </Modal>
      ) : null}
    </div>
  )
}

function MinuteFields({
  value,
  onChange,
}: {
  value: Minute
  onChange: (next: Minute) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="日付"
          type="date"
          value={value.date}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
        />
        <TextField
          label="テーマ"
          value={value.theme}
          onChange={(event) => onChange({ ...value, theme: event.target.value })}
        />
      </div>
      <TextArea
        label="原文（積水のAI議事録など）"
        value={value.raw}
        onChange={(event) => onChange({ ...value, raw: event.target.value })}
      />
      <p className="text-xs text-muted">
        原文からの抽出は LLM 未接続です。今は5項目を手で直せます。
      </p>
      <TextArea
        label="決まったこと"
        value={value.decided}
        onChange={(event) => onChange({ ...value, decided: event.target.value })}
      />
      <TextArea
        label="自分の宿題"
        value={value.myTodo}
        onChange={(event) => onChange({ ...value, myTodo: event.target.value })}
      />
      <TextArea
        label="先方の宿題"
        value={value.theirTodo}
        onChange={(event) =>
          onChange({ ...value, theirTodo: event.target.value })
        }
      />
      <TextArea
        label="保留"
        value={value.pending}
        onChange={(event) => onChange({ ...value, pending: event.target.value })}
      />
      <TextArea
        label="新たな疑問"
        value={value.newq}
        onChange={(event) => onChange({ ...value, newq: event.target.value })}
      />
    </div>
  )
}

function LinePicks({
  label,
  lines,
  picked,
  onChange,
}: {
  label: string
  lines: string[]
  picked: string[]
  onChange: (next: string[]) => void
}) {
  if (lines.length === 0) {
    return <p className="mb-2 text-xs text-muted">{label}：なし</p>
  }
  return (
    <fieldset className="mb-3">
      <legend className="mb-1 text-xs text-muted">{label}</legend>
      <ul className="space-y-1">
        {lines.map((line) => {
          const checked = picked.includes(line)
          return (
            <li key={line}>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) onChange([...picked, line])
                    else onChange(picked.filter((item) => item !== line))
                  }}
                />
                <span>{line}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
