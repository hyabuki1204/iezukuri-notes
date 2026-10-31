// 繋がらない間に入力した分が、クラウドに繋がった時に消えないこと
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeLocalIntoRemote, resolveConnect } from '../src/storage/unsynced.ts'
import { moveToTrash } from '../src/lib/trash.ts'
import { appData, decision, minute, question } from './helpers.ts'

const seed = () => appData({ decisions: [decision({ id: 'seed' })] })

test('クラウドに未送信の変更が無ければ、クラウドの内容で始める', () => {
  const remote = appData({ decisions: [decision({ body: 'クラウド' })] })
  const local = appData({ decisions: [decision({ body: '端末（古い）' })] })
  assert.equal(resolveConnect(remote, local, false, seed), remote)
})

test('未送信の変更があれば、端末で足したものは残り、端末の変更が勝つ', () => {
  const remote = appData({
    decisions: [decision({ id: 'a', body: 'クラウド' }), decision({ id: 'b', body: '別端末で追加' })],
  })
  const local = appData({
    decisions: [decision({ id: 'a', body: '端末で直した' })],
    minutes: [minute({ id: 'offline', theme: '繋がらない間に入れた議事録' })],
  })
  const next = resolveConnect(remote, local, true, seed)
  assert.equal(next.minutes.length, 1)
  assert.equal(next.minutes[0]?.id, 'offline')
  assert.equal(next.decisions.find((item) => item.id === 'a')?.body, '端末で直した')
  assert.ok(next.decisions.some((item) => item.id === 'b'), 'クラウドにだけあるものも残る')
})

test('クラウドが空なら端末の内容を使い、どちらも空なら見本データ', () => {
  const local = appData({ questions: [question()] })
  assert.equal(resolveConnect(appData(), local, false, seed), local)
  assert.equal(resolveConnect(appData(), appData(), false, seed).decisions[0]?.id, 'seed')
})

test('端末でゴミ箱に移したものは、クラウドに残っていても一覧に戻らない', () => {
  const remote = appData({ decisions: [decision({ id: 'a' }), decision({ id: 'b' })] })
  const local = moveToTrash(remote, 'decisions', 'a')
  const next = mergeLocalIntoRemote(remote, local)
  assert.deepEqual(next.decisions.map((item) => item.id), ['b'])
  assert.equal(next.trash.length, 1)
})

test('端末でゴミ箱から戻したものは、クラウドのゴミ箱に残っていても戻した状態になる', () => {
  const base = appData({ decisions: [decision({ id: 'a' })] })
  const remote = moveToTrash(base, 'decisions', 'a')
  const local = { ...remote, decisions: [decision({ id: 'a' })], trash: [] }
  const next = mergeLocalIntoRemote(remote, local)
  assert.deepEqual(next.decisions.map((item) => item.id), ['a'])
  assert.equal(next.trash.length, 0)
})
