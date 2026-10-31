import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import {
  DangerZone,
  EditBar,
  ReadBlock,
  Tag,
  useOpenFromJump,
  useOpenSet,
} from '../components/ui.tsx'
import { moveToTrash } from '../lib/trash.ts'
import { useData } from '../app/DataProvider.tsx'
import { newId, nowIso, todayIsoDate } from '../lib/ids.ts'
import {
  extractedFieldsHaveContent,
  type ExtractedFields,
} from '../lib/extractMinute.ts'
import { firstLine } from '../lib/preview.ts'
import { plainFirstLine } from '../lib/rawText.ts'
import { RawSection } from '../components/RawText.tsx'
import { MinuteTodoList } from '../components/Todos.tsx'
import { todosOf } from '../lib/todos.ts'
import { guessArea, guessAssignee, guessCategory } from '../lib/guessAllocate.ts'
import { usesAreas } from '../lib/lists.ts'
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
    doneTodos: [],
    who: '自分',
  }
}

const FIELD_DEFS = [
  ['decided', '決まったこと'],
  ['myTodo', '自分の宿題'],
  ['theirTodo', '先方の宿題'],
  ['pending', '保留'],
  ['newq', '新たな疑問'],
] as const

export function MinutesScreen() {
  const { data, update } = useData()
  const { openIds, setOpenIds, editingIds, toggle, toggleEdit } = useOpenSet()
  const [adding, setAdding] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const openOne = useCallback(
    (id: string) => setOpenIds((current) => new Set(current).add(id)),
    [setOpenIds],
  )
  useOpenFromJump('minutes', openOne)

  const sorted = useMemo(
    () =>
      data.minutes
        .map((item, index) => ({ item, index }))
        .toSorted((a, b) => b.item.date.localeCompare(a.item.date) || a.index - b.index)
        .map(({ item }) => item),
    [data.minutes],
  )

  function patch(id: string, next: Minute) {
    update((current) => ({
      ...current,
      minutes: current.minutes.map((item) => (item.id === id ? next : item)),
    }))
  }

  function save(minute: Minute) {
    const saved = { ...minute, theme: minute.theme.trim() }
    update((current) => ({
      ...current,
      minutes: [saved, ...current.minutes],
    }))
    setAdding(false)
    setOpenIds((current) => new Set(current).add(saved.id))
    window.setTimeout(() => {
      document.getElementById(`item-${saved.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function remove(minute: Minute) {
    if (!window.confirm('この議事録をゴミ箱に移しますか？（30日間はメニューのゴミ箱から戻せます）')) return
    update((current) => moveToTrash(current, 'minutes', minute.id))
  }

  async function copyLetter(minute: Minute) {
    await navigator.clipboard.writeText(formatMinuteLetter(minute))
    setCopiedId(minute.id)
  }

  return (
    <div className="page">
      {adding ? (
        <NewMinute onCancel={() => setAdding(false)} onSave={save} />
      ) : (
        <button
          type="button"
          className="btn-ghost btn-wide py-2.5"
          onClick={() => setAdding(true)}
        >
          ＋ 議事録を追加
        </button>
      )}

      <ul className="card-list">
        {sorted.map((item) => {
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
                <MinuteSummary item={item} open={open} />
              </button>
              {open ? (
                <div className="space-y-4 border-t border-line px-4 py-3">
                  <EditBar editing={editing} onToggle={() => toggleEdit(item.id)}>
                    <span className="text-[13px] text-muted">
                      {editing ? '変更はその場で保存されます' : ''}
                    </span>
                  </EditBar>
                  {editing ? (
                    <>
                      <MinuteFields value={item} onChange={(next) => patch(item.id, next)} />
                      <DangerZone onRemove={() => remove(item)} label="この議事録を削除" />
                    </>
                  ) : (
                    <>
                      {item.raw.trim() ? (
                        <RawSection
                          label="原文（AI議事録）"
                          title={[item.date, item.theme].filter(Boolean).join(' ') || '原文'}
                          value={item.raw}
                          onChange={(raw) => patch(item.id, { ...item, raw })}
                        />
                      ) : null}
                      {FIELD_DEFS.some(([key]) => item[key].trim()) ? (
                        <div className="space-y-3 rounded-sm border border-line px-4 py-3">
                          {FIELD_DEFS.map(([key, label]) =>
                            key === 'myTodo' || key === 'theirTodo' ? (
                              <MinuteTodoList
                                key={key}
                                minute={item}
                                kind={key === 'myTodo' ? 'my' : 'their'}
                                label={label}
                              />
                            ) : (
                              <ReadBlock key={key} label={label} text={item[key]} />
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-[13px] text-muted">
                          5項目はまだ空です。「編集」から原文の抽出ができます。
                        </p>
                      )}
                      <Attachments
                        files={item.attachments}
                        ownerId={item.id}
                        readOnly
                        onChange={(attachments) => patch(item.id, { ...item, attachments })}
                      />
                      <button
                        type="button"
                        className="btn-ghost btn-wide"
                        onClick={() => void copyLetter(item)}
                      >
                        {copiedId === item.id ? 'コピーした' : '担当者へ送る文面をコピー'}
                      </button>
                      <AllocateBlock value={item} />
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

function MinuteSummary({ item, open }: { item: Minute; open: boolean }) {
  const counts = FIELD_DEFS.map(([key, label]) =>
    key === 'myTodo' || key === 'theirTodo'
      ? ([`${label} 残`, todosOf(item, key === 'myTodo' ? 'my' : 'their').filter((todo) => !todo.done).length] as const)
      : ([label, linesOf(item[key]).length] as const),
  )
  const unsent =
    linesOf(item.decided).filter((line) => !item.sentDecided.includes(line)).length +
    linesOf(item.newq).filter((line) => !item.sentNewq.includes(line)).length
  const preview = item.decided.trim() ? firstLine(item.decided, 60) : plainFirstLine(item.raw, 60)
  return (
    <>
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-snug text-ink">
            {item.theme || '（テーマなし）'}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted">{item.date}</span>
        </span>
        <WhoStamp who={item.who} />
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {counts.map(([label, count]) =>
          count > 0 ? (
            <Tag key={label} tone={label === '新たな疑問' ? 'purple' : label === '決まったこと' ? 'green' : 'muted'}>
              {label}
              {label.endsWith('残') ? '' : ' '}
              {count}
            </Tag>
          ) : null,
        )}
        {unsent > 0 ? <Tag tone="orange">台帳へ未送り {unsent}</Tag> : null}
        {item.raw.trim() ? <Tag tone="blue">原文あり</Tag> : null}
      </span>
      {!open && preview ? (
        <span className="mt-1.5 block text-[13px] leading-snug text-ink/70">{preview}</span>
      ) : null}
      {!open ? <AttachmentHint files={item.attachments} /> : null}
    </>
  )
}

// 新規作成：① 日付・テーマ・原文 → ② 5項目を確認して保存
function NewMinute({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (minute: Minute) => void
}) {
  const [draft, setDraft] = useState<Minute>(emptyMinute)
  const [step, setStep] = useState<1 | 2>(1)
  const { busy, message, run } = useExtract()

  async function extractAndNext() {
    const fields = await run(draft)
    if (fields) {
      setDraft((current) => ({ ...current, ...fields }))
      setStep(2)
    }
  }

  const canSave = Boolean(draft.theme.trim() || draft.raw.trim() || draft.decided.trim())

  return (
    <article className="panel md:max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <ol className="flex items-center gap-2 text-[13px]">
          {(
            [
              [1, '原文を貼る'],
              [2, '5項目を確認'],
            ] as const
          ).map(([n, label]) => (
            <li
              key={n}
              className={`flex items-center gap-1.5 ${step === n ? 'font-bold text-blue' : 'text-muted'}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  step === n ? 'bg-blue text-card' : 'bg-paper text-muted'
                }`}
              >
                {n}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <button type="button" className="text-sm text-muted" onClick={onCancel}>
          やめる
        </button>
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="日付"
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
            <TextField
              label="テーマ"
              value={draft.theme}
              placeholder="例：外構の打ち合わせ"
              onChange={(event) => setDraft({ ...draft, theme: event.target.value })}
            />
          </div>
          <WhoField value={draft.who} onChange={(who) => setDraft({ ...draft, who })} />
          <RawSection
            label="原文（AI議事録）"
            title={[draft.date, draft.theme].filter(Boolean).join(' ') || '原文'}
            value={draft.raw}
            onChange={(raw) => setDraft({ ...draft, raw })}
            startEditing
          />
          <button
            type="button"
            className="btn-primary btn-wide disabled:opacity-40"
            disabled={busy || !draft.raw.trim()}
            onClick={() => void extractAndNext()}
          >
            {busy ? '抽出中…' : '原文から5項目を抽出して次へ'}
          </button>
          {message ? <p className="text-[13px] text-timber">{message}</p> : null}
          <button type="button" className="btn-ghost btn-wide" onClick={() => setStep(2)}>
            抽出せずに自分で書く
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-muted">
            {draft.theme || '（テーマなし）'}・{draft.date}。1行に1件で書くと、あとで台帳へ振り分けられます。
          </p>
          {FIELD_DEFS.map(([key, label]) => (
            <TextArea
              key={key}
              label={label}
              value={draft[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          ))}
          <Attachments
            files={draft.attachments}
            ownerId={draft.id}
            onChange={(attachments) => setDraft({ ...draft, attachments })}
          />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              戻る
            </button>
            <button
              type="button"
              className="btn bg-green text-card disabled:opacity-40"
              disabled={!canSave}
              onClick={() => onSave(draft)}
            >
              保存する
            </button>
          </div>
        </div>
      )}
    </article>
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
      <RawSection
        label="原文（AI議事録）"
        title={[value.date, value.theme].filter(Boolean).join(' ') || '原文'}
        value={value.raw}
        onChange={(raw) => onChange({ ...value, raw })}
      />
      <ExtractButton value={value} onChange={onChange} />
      {FIELD_DEFS.map(([key, label]) => (
        <TextArea
          key={key}
          label={label}
          value={value[key]}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        />
      ))}
      <Attachments
        files={value.attachments}
        ownerId={value.id}
        onChange={(attachments) => onChange({ ...value, attachments })}
      />
    </div>
  )
}

function useExtract() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run(value: Minute): Promise<ExtractedFields | null> {
    if (!value.raw.trim()) {
      setMessage('原文を貼ってください。')
      return null
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
      return payload.fields
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '抽出に失敗しました。')
      return null
    } finally {
      setBusy(false)
    }
  }

  return { busy, message, setMessage, run }
}

function ExtractButton({
  value,
  onChange,
}: {
  value: Minute
  onChange: (next: Minute) => void
}) {
  const { busy, message, setMessage, run } = useExtract()

  async function extract() {
    if (
      extractedFieldsHaveContent(value) &&
      !window.confirm('5項目を原文からの抽出で置き換えます。よろしいですか？')
    ) {
      return
    }
    const fields = await run(value)
    if (fields) {
      onChange({ ...value, ...fields })
      setMessage('抽出しました。内容を確認して直してください。')
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
        {busy ? '抽出中…' : '原文から5項目を抽出'}
      </button>
      {message ? <p className="mt-2 text-[13px] text-muted">{message}</p> : null}
    </div>
  )
}

function AllocateBlock({ value }: { value: Minute }) {
  const { data, update } = useData()
  const categories = data.lists.categories
  const areas = data.lists.areas
  const assignees = data.lists.assignees
  const hints = data.decisions.map((item) => ({
    cat: item.cat,
    title: item.title,
  }))
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
  const catFor = (line: string) =>
    cats[line] ?? guessCategory(line, categories, hints)
  const toFor = (line: string) => tos[line] ?? guessAssignee(line, assignees)

  if (decided.length === 0 && questions.length === 0) return null

  function send() {
    const toSendD = pickedD.filter((line) => decided.includes(line) && !sentD.has(line))
    const toSendQ = pickedQ.filter((line) => questions.includes(line) && !sentQ.has(line))
    if (toSendD.length === 0 && toSendQ.length === 0) {
      setMessage('まだ送っていない行を選んでください。')
      return
    }
    const decidedRows: Decision[] = toSendD.map((line) => {
      const cat = catFor(line)
      const area = usesAreas(cat) ? guessArea(line, areas) : undefined
      return {
        id: newId(),
        cat,
        title: line.slice(0, 40),
        body: line,
        status: 1,
        drawn: false,
        ...(area ? { area } : {}),
        updatedAt: nowIso(),
        attachments: [],
        who: value.who,
      }
    })
    const questionRows: Question[] = toSendQ.map((line) => ({
      id: newId(),
      to: toFor(line),
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
            value={catFor(line)}
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
            value={toFor(line)}
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
