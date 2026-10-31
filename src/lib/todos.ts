import type { AppData, Minute } from '../storage/types.ts'
import { linesOf } from './minuteText.ts'

export type TodoKind = 'my' | 'their'

export type Todo = {
  key: string
  kind: TodoKind
  line: string
  done: boolean
  minute: Minute
}

export function todoKey(kind: TodoKind, line: string): string {
  return `${kind}:${line}`
}

export function todosOf(minute: Minute, kind: TodoKind): Todo[] {
  const text = kind === 'my' ? minute.myTodo : minute.theirTodo
  const done = new Set(minute.doneTodos)
  return [...new Set(linesOf(text))].map((line) => {
    const key = todoKey(kind, line)
    return { key, kind, line, done: done.has(key), minute }
  })
}

// 全議事録の宿題（新しい打ち合わせ順）
export function allTodos(data: AppData, kind: TodoKind): Todo[] {
  return data.minutes
    .toSorted((a, b) => b.date.localeCompare(a.date))
    .flatMap((minute) => todosOf(minute, kind))
}

export function openTodoCount(data: AppData): number {
  return data.minutes.reduce(
    (sum, minute) =>
      sum +
      todosOf(minute, 'my').filter((todo) => !todo.done).length +
      todosOf(minute, 'their').filter((todo) => !todo.done).length,
    0,
  )
}

export function setTodoDone(data: AppData, minuteId: string, key: string, done: boolean): AppData {
  return {
    ...data,
    minutes: data.minutes.map((minute) => {
      if (minute.id !== minuteId) return minute
      const rest = minute.doneTodos.filter((item) => item !== key)
      return { ...minute, doneTodos: done ? [...rest, key] : rest }
    }),
  }
}
