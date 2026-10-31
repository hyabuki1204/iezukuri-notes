// 保存の形（端末・Supabase）で中身が欠けないこと
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { householdExtras, minuteToRow, rowToMinute } from '../src/storage/supabase.ts'
import { parseAppData, parseImportedJson } from '../src/storage/local.ts'
import { appData, decision, minute } from './helpers.ts'
import { moveToTrash } from '../src/lib/trash.ts'

test('議事録の「済」の宿題は、台帳の送り済みと混ざらずに往復する', () => {
  const item = minute({
    myTodo: '食洗機を決める',
    sentDecided: ['駐車場は2台'],
    doneTodos: ['my:食洗機を決める'],
  })
  const row = minuteToRow('h', item)
  const back = rowToMinute(row)
  assert.deepEqual(back.sentDecided, ['駐車場は2台'])
  assert.deepEqual(back.doneTodos, ['my:食洗機を決める'])
})

test('ゴミ箱と変更履歴は households.lists から読める。分類リストも壊れない', () => {
  const raw = {
    categories: ['外構', 'キッチン'],
    areas: ['駐車場'],
    assignees: ['営業'],
    _trash: moveToTrash(appData({ decisions: [decision()] }), 'decisions', 'd1').trash,
    _history: { d1: [{ at: '2026-10-01T00:00:00.000Z', cat: 'キッチン', title: '食洗機', body: '浅型', status: 0, drawn: false }] },
  }
  const extras = householdExtras(raw)
  assert.deepEqual(extras.lists.categories, ['外構', 'キッチン'])
  assert.equal(extras.trash.length, 1)
  assert.equal(extras.history.d1?.[0]?.body, '浅型')
})

test('古い households.lists（ゴミ箱なし）でも読める', () => {
  const extras = householdExtras({ categories: ['外構'], areas: [], assignees: [] })
  assert.deepEqual(extras.trash, [])
  assert.deepEqual(extras.history, {})
})

test('端末の保存とバックアップの読み込みで、ゴミ箱・履歴・済の宿題が残る', () => {
  const data = moveToTrash(
    appData({
      decisions: [decision()],
      minutes: [minute({ doneTodos: ['their:見積'] })],
      history: { x: [{ at: 'a', cat: 'c', title: 't', body: 'b', status: 1, drawn: false }] },
    }),
    'decisions',
    'd1',
  )
  for (const back of [parseAppData(JSON.stringify(data)), parseImportedJson(JSON.stringify(data))]) {
    assert.ok(back)
    assert.equal(back.trash.length, 1)
    assert.equal(back.history.x?.length, 1)
    assert.deepEqual(back.minutes[0]?.doneTodos, ['their:見積'])
  }
})

test('古い端末データ（新しい項目なし）でも読める', () => {
  const old = { decisions: [], questions: [], ideas: [], minutes: [{ id: 'm', date: '2026-01-01', theme: '', decided: '', myTodo: 'a', theirTodo: '', pending: '', newq: '' }] }
  const back = parseAppData(JSON.stringify(old))
  assert.deepEqual(back.trash, [])
  assert.deepEqual(back.history, {})
  assert.deepEqual(back.minutes[0]?.doneTodos, [])
})
