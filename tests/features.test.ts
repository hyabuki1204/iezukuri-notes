import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recordDecisionChange, SESSION_MS } from '../src/lib/history.ts'
import { daysLeft, expiredTrashIds, moveToTrash, purgeFromTrash, restoreFromTrash } from '../src/lib/trash.ts'
import { openTodoCount, setTodoDone, todosOf } from '../src/lib/todos.ts'
import { parseRaw } from '../src/lib/rawText.ts'
import { prepText } from '../src/lib/prep.ts'
import { appData, decision, file, minute, question } from './helpers.ts'

test('ゴミ箱：移す→戻すで元通り、完全削除で写真と履歴も消える', () => {
  const data = appData({
    decisions: [decision({ attachments: [file('f1')] })],
    history: { d1: [{ at: 'a', cat: 'c', title: 't', body: 'b', status: 0, drawn: false }] },
  })
  const trashed = moveToTrash(data, 'decisions', 'd1')
  assert.equal(trashed.decisions.length, 0)
  assert.equal(trashed.trash.length, 1)

  const restored = restoreFromTrash(trashed, trashed.trash[0]!.id)
  assert.deepEqual(restored.decisions.map((item) => item.id), ['d1'])
  assert.equal(restored.trash.length, 0)

  const { data: purged, files } = purgeFromTrash(trashed, [trashed.trash[0]!.id])
  assert.equal(purged.trash.length, 0)
  assert.equal(purged.history.d1, undefined)
  assert.deepEqual(files.map((item) => item.id), ['f1'])
})

test('ゴミ箱：30日で期限切れ', () => {
  const trashed = moveToTrash(appData({ ideas: [{ id: 'i', text: 'x', tag: '', url: '', createdAt: '', attachments: [], who: '自分' }] }), 'ideas', 'i', new Date('2026-10-01T00:00:00Z'))
  const entry = trashed.trash[0]!
  assert.equal(daysLeft(entry, new Date('2026-10-02T00:00:00Z')), 29)
  assert.deepEqual(expiredTrashIds(trashed, new Date('2026-10-30T00:00:00Z')), [])
  assert.deepEqual(expiredTrashIds(trashed, new Date('2026-10-31T00:00:01Z')), [entry.id])
})

test('変更履歴：続けて直している間は1回、時間をおいた変更は残る', () => {
  const before = decision({ body: '浅型', updatedAt: '2026-10-01T00:00:00.000Z' })
  const after = { ...before, body: '深型', updatedAt: '2026-10-05T00:00:00.000Z' }
  const data = appData({ decisions: [after] })

  const later = new Date(new Date(before.updatedAt).getTime() + SESSION_MS + 1)
  const recorded = recordDecisionChange(data, before, after, later)
  assert.equal(recorded.history.d1?.[0]?.body, '浅型')

  const soon = new Date(new Date(before.updatedAt).getTime() + 1000)
  assert.equal(recordDecisionChange(data, before, after, soon).history.d1, undefined)

  const sameContent = { ...before, attachments: [file('x')] }
  assert.equal(recordDecisionChange(data, before, sameContent, later).history.d1, undefined)
})

test('宿題：行ごとに拾い、済にすると未完了が減る', () => {
  const m = minute({ myTodo: '・食洗機を決める\n・照明を見る', theirTodo: '見積を出す' })
  const data = appData({ minutes: [m] })
  assert.equal(todosOf(m, 'my').length, 2)
  assert.equal(openTodoCount(data), 3)
  const next = setTodoDone(data, 'm1', 'my:食洗機を決める', true)
  assert.equal(openTodoCount(next), 2)
  assert.equal(openTodoCount(setTodoDone(next, 'm1', 'my:食洗機を決める', false)), 3)
})

test('次回準備：宛先の質問と宿題がまとめに入る', () => {
  const data = appData({
    questions: [question({ text: '締切はいつ？', to: '営業' }), question({ id: 'q2', text: '雨水の勾配', to: '設計' })],
    minutes: [minute({ theirTodo: '見積を出す', myTodo: '食洗機を決める', pending: '袖壁の高さ' })],
  })
  const text = prepText(data, '営業')
  assert.match(text, /締切はいつ？/)
  assert.doesNotMatch(text, /雨水の勾配/)
  assert.match(text, /見積を出す/)
  assert.match(text, /食洗機を決める/)
  assert.match(text, /袖壁の高さ/)
})

test('原文の整形：見出し・箇条書き・太字の行を取り違えない', () => {
  const blocks = parseRaw('## 次のステップ\n- 見積\n**駐車場は2台**で決定\n1. ペニンシュラ')
  assert.deepEqual(blocks.map((block) => block.kind), ['heading', 'bullet', 'para', 'number'])
})
