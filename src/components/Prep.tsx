import { useMemo, useState, type ReactNode } from 'react'
import { useData } from '../app/DataProvider.tsx'
import { dueUrgency } from '../lib/due.ts'
import { setTodoDone, type Todo } from '../lib/todos.ts'
import { prepData, prepText } from '../lib/prep.ts'
import { StatusBadge, Tag } from './ui.tsx'

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="section-title">
        {title} <span className="font-normal">{count}件</span>
      </h2>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      {count > 0 ? (
        <ul className="mt-2 space-y-2">{children}</ul>
      ) : (
        <p className="mt-2 rounded-sm border border-dashed border-line px-3 py-2.5 text-center text-[13px] text-muted">
          なし
        </p>
      )}
    </section>
  )
}

function CheckRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <li className="flex items-start gap-3 rounded-sm border border-line bg-card px-3 py-2.5">
      <input
        type="checkbox"
        aria-label={`${label} を済にする`}
        className="mt-0.5 h-6 w-6 shrink-0 accent-green"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] leading-snug ${checked ? 'text-muted line-through' : 'text-ink'}`}>{label}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
      </div>
    </li>
  )
}

export function PrepView() {
  const { data, update } = useData()
  const assignees = data.lists.assignees
  const [to, setTo] = useState(
    () => assignees.find((name) => data.questions.some((item) => !item.done && item.to === name)) ?? assignees[0] ?? '営業',
  )
  const [copied, setCopied] = useState(false)
  const prep = useMemo(() => prepData(data, to), [data, to])
  const todoSub = (todo: Todo) => `${todo.minute.date} ${todo.minute.theme || '（テーマなし）'}`
  const toggleTodo = (todo: Todo, done: boolean) =>
    update((current) => setTodoDone(current, todo.minute.id, todo.key, done))

  async function copy() {
    await navigator.clipboard.writeText(prepText(data, to))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <p className="text-[13px] text-muted">次に打ち合わせる相手を選ぶと、持っていくものをまとめます。</p>
      <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {assignees.map((name) => {
          const count = data.questions.filter((item) => !item.done && item.to === name).length
          return (
            <button
              key={name}
              type="button"
              className={`chip ${to === name ? 'chip-on font-bold' : ''}`}
              onClick={() => setTo(name)}
            >
              {name}
              {count > 0 ? <span className="ml-1 text-xs">{count}</span> : null}
            </button>
          )
        })}
      </div>

      <button type="button" className="btn-ghost btn-wide mt-3 py-2.5" onClick={() => void copy()}>
        {copied ? 'コピーした' : 'まとめをコピー（LINE・メモ用）'}
      </button>

      <Section title={`${to}に聞くこと`} count={prep.questions.length}>
        {prep.questions.map((item) => (
          <CheckRow
            key={item.id}
            label={item.text}
            checked={false}
            onChange={(done) =>
              update((current) => ({
                ...current,
                questions: current.questions.map((row) => (row.id === item.id ? { ...row, done } : row)),
              }))
            }
          />
        ))}
      </Section>

      <Section title="先方の宿題（もらえたか確認）" count={prep.theirTodos.length} hint="担当者では絞れないので、先方の宿題をすべて出しています。">
        {prep.theirTodos.map((todo) => (
          <CheckRow
            key={`${todo.minute.id}-${todo.key}`}
            label={todo.line}
            sub={todoSub(todo)}
            checked={false}
            onChange={(done) => toggleTodo(todo, done)}
          />
        ))}
      </Section>

      <Section title="こちらの宿題（報告すること）" count={prep.myTodos.length}>
        {prep.myTodos.map((todo) => (
          <CheckRow
            key={`${todo.minute.id}-${todo.key}`}
            label={todo.line}
            sub={todoSub(todo)}
            checked={false}
            onChange={(done) => toggleTodo(todo, done)}
          />
        ))}
      </Section>

      {prep.latest ? (
        <Section title={`前回（${prep.latest.date}）の保留`} count={prep.pending.length}>
          {prep.pending.map((line) => (
            <li key={line} className="rounded-sm border border-line bg-card px-3 py-2.5 text-[15px] text-ink">
              {line}
            </li>
          ))}
        </Section>
      ) : null}

      <Section title="期限が近い・過ぎた決定" count={prep.urgent.length}>
        {prep.urgent.map((item) => (
          <li key={item.id} className="rounded-sm border border-line bg-card px-3 py-2.5">
            <p className="text-[15px] text-ink">{item.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={item.status} />
              <Tag tone={dueUrgency(item.due) === 'overdue' ? 'red' : 'orange'}>締切 {item.due}</Tag>
            </div>
          </li>
        ))}
      </Section>
    </div>
  )
}
