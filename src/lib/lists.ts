import { nowIso } from './ids.ts'
import type { AppData, Lists } from '../storage/types.ts'

export type ListKey = keyof Lists

export function usesAreas(cat: string): boolean {
  return cat.includes('外構') || cat.includes('外観')
}

export function firstOf(list: string[], fallback: string): string {
  return list[0] || fallback
}

export function optionsFor(master: string[], current?: string): string[] {
  if (current && !master.includes(current)) return [...master, current]
  return master
}

export function usedCounts(data: AppData): Record<ListKey, Map<string, number>> {
  const categories = new Map<string, number>()
  const areas = new Map<string, number>()
  const assignees = new Map<string, number>()
  for (const item of data.decisions) {
    categories.set(item.cat, (categories.get(item.cat) ?? 0) + 1)
    if (item.area) areas.set(item.area, (areas.get(item.area) ?? 0) + 1)
  }
  for (const item of data.questions) {
    assignees.set(item.to, (assignees.get(item.to) ?? 0) + 1)
  }
  return { categories, areas, assignees }
}

export function addListItem(data: AppData, key: ListKey, name: string): AppData | null {
  const trimmed = name.trim()
  if (!trimmed || data.lists[key].includes(trimmed)) return null
  return {
    ...data,
    lists: { ...data.lists, [key]: [...data.lists[key], trimmed] },
  }
}

export function moveListItem(
  data: AppData,
  key: ListKey,
  index: number,
  dir: -1 | 1,
): AppData {
  const nextIndex = index + dir
  const items = data.lists[key]
  if (nextIndex < 0 || nextIndex >= items.length) return data
  const copy = [...items]
  const [row] = copy.splice(index, 1)
  copy.splice(nextIndex, 0, row)
  return { ...data, lists: { ...data.lists, [key]: copy } }
}

export function removeListItem(data: AppData, key: ListKey, name: string): AppData | null {
  if (data.lists[key].length <= 1) return null
  if ((usedCounts(data)[key].get(name) ?? 0) > 0) return null
  return {
    ...data,
    lists: { ...data.lists, [key]: data.lists[key].filter((item) => item !== name) },
  }
}

export function renameListItem(
  data: AppData,
  key: ListKey,
  from: string,
  to: string,
): AppData | null {
  const name = to.trim()
  if (!name || name === from) return null
  if (data.lists[key].includes(name)) return null
  const lists = {
    ...data.lists,
    [key]: data.lists[key].map((item) => (item === from ? name : item)),
  }
  if (key === 'categories') {
    return {
      ...data,
      lists,
      decisions: data.decisions.map((item) =>
        item.cat === from ? { ...item, cat: name, updatedAt: nowIso() } : item,
      ),
    }
  }
  if (key === 'areas') {
    return {
      ...data,
      lists,
      decisions: data.decisions.map((item) =>
        item.area === from ? { ...item, area: name, updatedAt: nowIso() } : item,
      ),
    }
  }
  return {
    ...data,
    lists,
    questions: data.questions.map((item) =>
      item.to === from ? { ...item, to: name } : item,
    ),
  }
}
