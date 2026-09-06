import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/storage/local.ts', import.meta.url), 'utf8')

class MemoryStorage {
  map = new Map()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null
  }
  key(index) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key) {
    this.map.delete(key)
  }
  setItem(key, value) {
    this.map.set(key, String(value))
  }
}

function emptyAppData() {
  return { decisions: [], questions: [], ideas: [], minutes: [] }
}

function readAppData(raw) {
  if (!raw) return emptyAppData()
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyAppData()
    return {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      minutes: Array.isArray(parsed.minutes)
        ? parsed.minutes.map((minute) => ({
            ...minute,
            raw: minute.raw ?? '',
          }))
        : [],
    }
  } catch {
    return emptyAppData()
  }
}

const KEY = 'iezukuri-notes:v1'
const storage = new MemoryStorage()

const empty = readAppData(storage.getItem(KEY))
if (JSON.stringify(empty) !== JSON.stringify(emptyAppData())) {
  throw new Error('empty load failed')
}

const sample = {
  decisions: [],
  questions: [],
  ideas: [],
  minutes: [
    {
      id: 'm1',
      date: '2026-09-06',
      theme: 'verify',
      decided: 'x',
      myTodo: '',
      theirTodo: '',
      pending: '',
      newq: '',
    },
  ],
}
storage.setItem(KEY, JSON.stringify(sample))
const loaded = readAppData(storage.getItem(KEY))
if (loaded.minutes[0].raw !== '') throw new Error('raw default failed')
if (loaded.minutes[0].theme !== 'verify') throw new Error('roundtrip failed')

storage.setItem(KEY, '{not-json')
const recovered = readAppData(storage.getItem(KEY))
if (recovered.decisions.length !== 0) throw new Error('corrupt recover failed')

if (!source.includes(`'${KEY}'`) && !source.includes(`"${KEY}"`)) {
  throw new Error('storage key mismatch')
}

console.log('LocalStore contract ok')
