import { dueUrgency } from './due.ts'
import { linesOf } from './minuteText.ts'
import { allTodos } from './todos.ts'
import type { AppData } from '../storage/types.ts'

export function prepData(data: AppData, to: string) {
  const questions = data.questions.filter((item) => !item.done && item.to === to)
  const theirTodos = allTodos(data, 'their').filter((todo) => !todo.done)
  const myTodos = allTodos(data, 'my').filter((todo) => !todo.done)
  const latest = data.minutes
    .filter((minute) => minute.pending.trim())
    .toSorted((a, b) => b.date.localeCompare(a.date))[0]
  const pending = latest ? linesOf(latest.pending) : []
  const urgent = data.decisions
    .filter((item) => dueUrgency(item.due))
    .toSorted((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
  return { questions, theirTodos, myTodos, latest, pending, urgent }
}

export function prepText(data: AppData, to: string): string {
  const prep = prepData(data, to)
  const list = (lines: string[]) => (lines.length > 0 ? lines.map((line) => `・${line}`) : ['（なし）'])
  return [
    `【次回の打ち合わせ（${to}）】`,
    '',
    '■ 聞くこと',
    ...list(prep.questions.map((item) => item.text)),
    '',
    '■ 先方の宿題（もらえたか確認）',
    ...list(prep.theirTodos.map((todo) => todo.line)),
    '',
    '■ こちらの宿題（報告すること）',
    ...list(prep.myTodos.map((todo) => todo.line)),
    ...(prep.pending.length > 0 ? ['', `■ 前回（${prep.latest?.date}）の保留`, ...list(prep.pending)] : []),
    ...(prep.urgent.length > 0
      ? ['', '■ 期限が近い決定', ...list(prep.urgent.map((item) => `${item.title}（締切 ${item.due}）`))]
      : []),
  ].join('\n')
}
