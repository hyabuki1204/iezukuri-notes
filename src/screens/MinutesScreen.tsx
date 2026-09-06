import { useMemo, useState, type ReactNode } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import { useData } from '../app/DataProvider.tsx'
import { newId, nowIso, todayIsoDate } from '../lib/ids.ts'
import {
  extractedFieldsHaveContent,
  type ExtractedFields,
} from '../lib/extractMinute.ts'
import { firstLine } from '../lib/preview.ts'
import { firstOf } from '../lib/lists.ts'
import { formatMinuteLetter, linesOf } from '../lib/minuteText.ts'
import {
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
    attachments: [],
    sentDecided: [],
    sentNewq: [],
    who: '自分',
  }
}

export function MinutesScreen() {
  const { data, update } = useData()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Minute>(emptyMinute)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
    setOpenIds((current) => new Set(current).add(saved.id))
  }

  async function copyLetter(minute: Minute) {
    await navigator.clipboard.writeText(formatMinuteLetter(minute))
    setCopiedId(minute.id)
  }

  return (
    <div className="page">
      <button
        type="button"
        className="btn-ghost btn-wide"
        onClick={() => {
          setDraft(emptyMinute())
          setAdding((value) => !value)
        }}
      >
        {adding ? '作成を閉じる' : '＋ 議事録を追加'}
      </button>
      {adding ? (
        <article className="panel mt-3 md:max-w-2xl">
          <MinuteFields value={draft} onChange={setDraft} />
          <button
            type="button"
            className="btn btn-wide mt-3 bg-green text-card"
            onClick={saveDraft}
          >
            保存する
          </button>
        </article>
      ) : null}

      <ul className="card-list">
        {data.minutes.map((item) => {
          const preview = firstLine(item.decided || item.raw)
          return (
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
                  <span className="block text-sm text-ink">
                    {item.theme || '（テーマなし）'}
                  </span>
                  <WhoStamp who={item.who} />
                </span>
                <span className="mt-0.5 block text-xs text-muted">{item.date}</span>
                {preview ? (
                  <span className="mt-0.5 block text-xs text-muted">{preview}</span>
                ) : null}
                <AttachmentHint files={item.attachments} />
              </button>
              {openIds.has(item.id) ? (
                <div className="border-t border-line px-3 py-3">
                  <MinuteFields
                    value={item}
                    onChange={(next) => patch(item.id, next)}
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-wide mt-3"
                    onClick={() => void copyLetter(item)}
                  >
                    {copiedId === item.id ? 'コピーした' : '担当者へ送る文面'}
                  </button>
                  <AllocateBlock value={item} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
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
      <WhoField
        value={value.who}
        onChange={(who) => onChange({ ...value, who })}
      />
      <TextArea
        label="原文（積水のAI議事録など）"
        value={value.raw}
        onChange={(event) => onChange({ ...value, raw: event.target.value })}
      />
      <ExtractButton value={value} onChange={onChange} />
      <p className="text-xs text-muted">
        抽出したあとも、5項目は手で直せます。同じ画面で台帳へ振り分けられます。
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
      <Attachments
        files={value.attachments}
        ownerId={value.id}
        onChange={(attachments) => onChange({ ...value, attachments })}
      />
    </div>
  )
}

function ExtractButton({
  value,
  onChange,
}: {
  value: Minute
  onChange: (next: Minute) => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function extract() {
    if (!value.raw.trim()) {
      setMessage('原文を貼ってください。')
      return
    }
    if (
      extractedFieldsHaveContent(value) &&
      !window.confirm('5項目を原文からの抽出で置き換えます。よろしいですか？')
    ) {
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/extract-minute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw: value.raw }),
      })
      const payload = (await response.json()) as {
        fields?: ExtractedFields
        error?: string
      }
      if (!response.ok || !payload.fields) {
        throw new Error(payload.error ?? '抽出に失敗しました。')
      }
      onChange({ ...value, ...payload.fields })
      setMessage('抽出しました。内容を確認して直してください。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '抽出に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn-primary btn-wide"
        disabled={busy}
        onClick={() => void extract()}
      >
        {busy ? '抽出中…' : '原文から抽出'}
      </button>
      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
    </div>
  )
}

function AllocateBlock({ value }: { value: Minute }) {
  const { data, update } = useData()
  const categories = data.lists.categories
  const assignees = data.lists.assignees
  const defaultCat = firstOf(categories, 'キッチン')
  const defaultTo = firstOf(assignees, '営業')
  const decided = useMemo(() => linesOf(value.decided), [value.decided])
  const questions = useMemo(() => linesOf(value.newq), [value.newq])
  const sentD = useMemo(() => new Set(value.sentDecided), [value.sentDecided])
  const sentQ = useMemo(() => new Set(value.sentNewq), [value.sentNewq])
  const [pickedD, setPickedD] = useState<string[]>(() =>
    decided.filter((line) => !value.sentDecided.includes(line)),
  )
  const [pickedQ, setPickedQ] = useState<string[]>(() =>
    questions.filter((line) => !value.sentNewq.includes(line)),
  )
  const [cats, setCats] = useState<Record<string, string>>({})
  const [tos, setTos] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  if (decided.length === 0 && questions.length === 0) return null

  function send() {
    const toSendD = pickedD.filter((line) => decided.includes(line) && !sentD.has(line))
    const toSendQ = pickedQ.filter((line) => questions.includes(line) && !sentQ.has(line))
    if (toSendD.length === 0 && toSendQ.length === 0) {
      setMessage('まだ送っていない行を選んでください。')
      return
    }
    const decidedRows: Decision[] = toSendD.map((line) => ({
      id: newId(),
      cat: cats[line] ?? defaultCat,
      title: line.slice(0, 40),
      body: line,
      status: 1,
      drawn: false,
      updatedAt: nowIso(),
      attachments: [],
      who: value.who,
    }))
    const questionRows: Question[] = toSendQ.map((line) => ({
      id: newId(),
      to: tos[line] ?? defaultTo,
      text: line,
      answer: '',
      done: false,
      attachments: [],
      who: value.who,
    }))
    const nextMinute: Minute = {
      ...value,
      sentDecided: [...value.sentDecided, ...toSendD],
      sentNewq: [...value.sentNewq, ...toSendQ],
    }
    update((current) => ({
      ...current,
      minutes: current.minutes.map((item) =>
        item.id === value.id ? nextMinute : item,
      ),
      decisions: [...decidedRows, ...current.decisions],
      questions: [...questionRows, ...current.questions],
    }))
    setPickedD([])
    setPickedQ([])
    setMessage(`${toSendD.length + toSendQ.length}件送りました。`)
  }

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-3">
      <p className="text-xs text-muted">
        改行ごとに1件。大分類と宛先は行ごと。送った行は済になり、二重に送りません。
      </p>
      <AllocateLines
        label="決まったこと → 決定"
        lines={decided}
        sent={sentD}
        picked={pickedD}
        onToggle={(line, checked) => {
          setPickedD((current) =>
            checked ? [...current, line] : current.filter((item) => item !== line),
          )
        }}
        extra={(line) => (
          <select
            className="mt-1 w-full rounded-sm border border-line bg-paper px-2 py-2 text-sm"
            value={cats[line] ?? defaultCat}
            disabled={sentD.has(line)}
            onChange={(event) =>
              setCats((current) => ({ ...current, [line]: event.target.value }))
            }
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      />
      <AllocateLines
        label="新たな疑問 → 質問"
        lines={questions}
        sent={sentQ}
        picked={pickedQ}
        onToggle={(line, checked) => {
          setPickedQ((current) =>
            checked ? [...current, line] : current.filter((item) => item !== line),
          )
        }}
        extra={(line) => (
          <select
            className="mt-1 w-full rounded-sm border border-line bg-paper px-2 py-2 text-sm"
            value={tos[line] ?? defaultTo}
            disabled={sentQ.has(line)}
            onChange={(event) =>
              setTos((current) => ({
                ...current,
                [line]: event.target.value,
              }))
            }
          >
            {assignees.map((to) => (
              <option key={to} value={to}>
                {to}
              </option>
            ))}
          </select>
        )}
      />
      <button type="button" className="btn-primary btn-wide" onClick={send}>
        選んだ行を台帳へ送る
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  )
}

function AllocateLines({
  label,
  lines,
  sent,
  picked,
  onToggle,
  extra,
}: {
  label: string
  lines: string[]
  sent: Set<string>
  picked: string[]
  onToggle: (line: string, checked: boolean) => void
  extra: (line: string) => ReactNode
}) {
  if (lines.length === 0) {
    return <p className="text-xs text-muted">{label}：なし</p>
  }
  return (
    <fieldset>
      <legend className="mb-1 text-xs text-muted">{label}</legend>
      <ul className="space-y-2">
        {lines.map((line) => {
          const done = sent.has(line)
          return (
            <li key={line} className="rounded-sm border border-line bg-paper px-2 py-2">
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={done || picked.includes(line)}
                  disabled={done}
                  onChange={(event) => onToggle(line, event.target.checked)}
                />
                <span className="flex-1">{line}</span>
                {done ? <span className="text-[10px] text-green">済</span> : null}
              </label>
              {extra(line)}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
