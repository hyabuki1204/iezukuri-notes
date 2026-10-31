import { useState } from 'react'
import { useData } from '../app/DataProvider.tsx'
import { allTodos, setTodoDone, todosOf, type Todo, type TodoKind } from '../lib/todos.ts'
import type { Minute } from '../storage/types.ts'

function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return m && d ? `${Number(m)}/${Number(d)}` : date
}

function TodoRow({
  todo,
  showSource,
  onToggle,
}: {
  todo: Todo
  showSource: boolean
  onToggle: (done: boolean) => void
}) {
  const { go } = useData()
  return (
    <li className="flex items-start gap-3 rounded-sm border border-line bg-card px-3 py-2.5">
      <input
        type="checkbox"
        aria-label={`${todo.line} を済にする`}
        className="mt-0.5 h-6 w-6 shrink-0 accent-green"
        checked={todo.done}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] leading-snug ${todo.done ? 'text-muted line-through decoration-1' : 'text-ink'}`}
        >
          {todo.line}
        </p>
        {showSource ? (
          <button
            type="button"
            className="mt-0.5 text-left text-xs text-blue"
            onClick={() => go({ tab: 'minutes', openId: todo.minute.id })}
          >
            {shortDate(todo.minute.date)} {todo.minute.theme || '（テーマなし）'} の議事録
          </button>
        ) : null}
      </div>
    </li>
  )
}

function TodoSection({ kind, title, hint }: { kind: TodoKind; title: string; hint: string }) {
  const { data, update } = useData()
  const [showDone, setShowDone] = useState(false)
  const todos = allTodos(data, kind)
  const open = todos.filter((todo) => !todo.done)
  const done = todos.filter((todo) => todo.done)
  const toggle = (todo: Todo, next: boolean) =>
    update((current) => setTodoDone(current, todo.minute.id, todo.key, next))

  return (
    <section className="mt-5">
      <h2 className="section-title">
        {title} <span className="font-normal">未完了 {open.length}件</span>
      </h2>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      {open.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {open.map((todo) => (
            <TodoRow key={`${todo.minute.id}-${todo.key}`} todo={todo} showSource onToggle={(next) => toggle(todo, next)} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-sm border border-dashed border-line px-3 py-3 text-center text-[13px] text-muted">
          {todos.length > 0 ? 'ぜんぶ済んでいます' : '議事録に宿題がまだありません'}
        </p>
      )}
      {done.length > 0 ? (
        <>
          <button
            type="button"
            className="mt-2 w-full py-2 text-left text-[13px] text-muted"
            onClick={() => setShowDone((value) => !value)}
          >
            済 {done.length}件{showDone ? 'を閉じる' : 'を見る'}
          </button>
          {showDone ? (
            <ul className="space-y-2">
              {done.map((todo) => (
                <TodoRow key={`${todo.minute.id}-${todo.key}`} todo={todo} showSource onToggle={(next) => toggle(todo, next)} />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export function TodosView() {
  return (
    <div>
      <TodoSection
        kind="my"
        title="自分の宿題"
        hint="議事録の「自分の宿題」から集めています。"
      />
      <TodoSection
        kind="their"
        title="先方の宿題"
        hint="次の打ち合わせで、もらえたか確認するもの。"
      />
    </div>
  )
}

// 議事録を開いた時の宿題チェック欄
export function MinuteTodoList({ minute, kind, label }: { minute: Minute; kind: TodoKind; label: string }) {
  const { update } = useData()
  const todos = todosOf(minute, kind)
  if (todos.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[13px] font-bold text-muted">
        {label} <span className="font-normal">{todos.filter((todo) => todo.done).length}/{todos.length} 済</span>
      </p>
      <ul className="space-y-1.5">
        {todos.map((todo) => (
          <TodoRow
            key={todo.key}
            todo={todo}
            showSource={false}
            onToggle={(next) => update((current) => setTodoDone(current, minute.id, todo.key, next))}
          />
        ))}
      </ul>
    </div>
  )
}
