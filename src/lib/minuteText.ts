import type { Minute } from '../storage/types.ts'

export function formatMinuteLetter(minute: Minute): string {
  const blocks = [
    `【${minute.date}】${minute.theme}`,
    '',
    '■ 決まったこと',
    minute.decided || '（なし）',
    '',
    '■ 自分の宿題',
    minute.myTodo || '（なし）',
    '',
    '■ 先方の宿題',
    minute.theirTodo || '（なし）',
    '',
    '■ 保留',
    minute.pending || '（なし）',
    '',
    '■ 新たな疑問',
    minute.newq || '（なし）',
    '',
    '認識違いがあればご指摘ください。',
  ]
  return blocks.join('\n')
}

export function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[・\-*\d.）)\s]+/, '').trim())
    .filter(Boolean)
}
