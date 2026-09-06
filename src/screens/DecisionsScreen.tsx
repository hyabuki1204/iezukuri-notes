import { useMemo, useState } from 'react'
import { SelectField, TextArea, TextField } from '../components/Field.tsx'
import { useData } from '../app/DataProvider.tsx'
import { dueUrgency } from '../lib/due.ts'
import { newId, nowIso } from '../lib/ids.ts'
import {
  AREAS,
  CATEGORIES,
  STATUS_BORDER,
  STATUS_LABEL,
  type Decision,
  type Status,
} from '../storage/types.ts'

type StatusFilter = 'all' | 'undecided' | 'undrawn'

function emptyDraft(): Decision {
  return {
    id: newId(),
    cat: 'キッチン',
    title: '',
    body: '',
    status: 0,
    drawn: false,
    updatedAt: nowIso(),
  }
}

export function DecisionsScreen() {
  const { data, update } = useData()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [groupByArea, setGroupByArea] = useState(false)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Decision>(emptyDraft)

  const filtered = useMemo(() => {
    return data.decisions.filter((item) => {
      if (statusFilter === 'undecided' && item.status > 1) return false
      if (statusFilter === 'undrawn' && !(item.status >= 2 && !item.drawn)) {
        return false
      }
      if (catFilter !== 'all' && item.cat !== catFilter) return false
      return true
    })
  }, [data.decisions, statusFilter, catFilter])

  const { urgent, groups } = useMemo(() => {
    const urgentItems = filtered
      .filter((item) => dueUrgency(item.due))
      .toSorted((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
    const urgentIdSet = new Set(urgentItems.map((item) => item.id))
    const byArea = groupByArea && catFilter === '外構'
    const keys = byArea ? [...AREAS, 'エリア未設定'] : [...CATEGORIES]
    const map = new Map<string, Decision[]>()
    for (const key of keys) map.set(key, [])
    for (const item of filtered) {
      if (urgentIdSet.has(item.id)) continue
      const key = byArea ? (item.area ?? 'エリア未設定') : item.cat
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return {
      urgent: urgentItems,
      groups: [...map.entries()].filter(([, items]) => items.length > 0),
    }
  }, [filtered, groupByArea, catFilter])

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function patch(id: string, partial: Partial<Decision>) {
    update((current) => ({
      ...current,
      decisions: current.decisions.map((item) =>
        item.id === id
          ? { ...item, ...partial, updatedAt: nowIso() }
          : item,
      ),
    }))
  }

  function remove(id: string) {
    if (!window.confirm('この決定を削除しますか？')) return
    update((current) => ({
      ...current,
      decisions: current.decisions.filter((item) => item.id !== id),
    }))
  }

  function addDraft() {
    if (!draft.title.trim()) return
    update((current) => ({
      ...current,
      decisions: [{ ...draft, title: draft.title.trim(), updatedAt: nowIso() }, ...current.decisions],
    }))
    setDraft(emptyDraft())
    setAdding(false)
  }

  return (
    <div className="page">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'すべて'],
            ['undecided', '未確定'],
            ['undrawn', '図面未反映'],
          ] as const
        ).map(([id, label]) => (
          <Chip
            key={id}
            active={statusFilter === id}
            onClick={() => setStatusFilter(id)}
          >
            {label}
          </Chip>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip active={catFilter === 'all'} onClick={() => setCatFilter('all')}>
          大分類
        </Chip>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            active={catFilter === cat}
            onClick={() => setCatFilter(cat)}
          >
            {cat}
          </Chip>
        ))}
      </div>
      {catFilter === '外構' ? (
        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={groupByArea}
            onChange={(event) => setGroupByArea(event.target.checked)}
          />
          エリア別に見る
        </label>
      ) : null}

      <button
        type="button"
        className="btn-ghost btn-wide mt-5"
        onClick={() => {
          setDraft(emptyDraft())
          setAdding((value) => !value)
        }}
      >
        {adding ? '追加を閉じる' : '＋ 決定を追加'}
      </button>
      {adding ? (
        <article className="panel mt-3 md:max-w-xl">
          <DecisionFields value={draft} onChange={setDraft} />
          <button
            type="button"
            className="btn-primary btn-wide mt-3"
            onClick={addDraft}
          >
            追加する
          </button>
        </article>
      ) : null}

      {urgent.length > 0 ? (
        <section className="mt-5">
          <h2 className="section-title text-orange">期限が近い・過ぎた</h2>
          <ul className="card-list mt-2">
            {urgent.map((item) => (
              <DecisionCard
                key={`due-${item.id}`}
                item={item}
                open={openIds.has(item.id)}
                onToggle={() => toggle(item.id)}
                onPatch={(partial) => patch(item.id, partial)}
                onRemove={() => remove(item.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.map(([name, items]) => (
        <section key={name} className="mt-5">
          <h2 className="section-title">{name}</h2>
          <ul className="card-list mt-2">
            {items.map((item) => (
              <DecisionCard
                key={item.id}
                item={item}
                open={openIds.has(item.id)}
                onToggle={() => toggle(item.id)}
                onPatch={(partial) => patch(item.id, partial)}
                onRemove={() => remove(item.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip ${active ? 'chip-on' : ''}`}
    >
      {children}
    </button>
  )
}

function DecisionCard({
  item,
  open,
  onToggle,
  onPatch,
  onRemove,
}: {
  item: Decision
  open: boolean
  onToggle: () => void
  onPatch: (partial: Partial<Decision>) => void
  onRemove: () => void
}) {
  const urgency = dueUrgency(item.due)
  return (
    <li
      className={`note-card border-l-4 ${STATUS_BORDER[item.status]} ${
        open ? 'md:col-span-2' : ''
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
        onClick={onToggle}
      >
        <span>
          <span className="block text-sm text-ink">{item.title}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {STATUS_LABEL[item.status]}
            {item.drawn ? ' · 図面済' : ''}
            {item.due ? ` · ${item.due}` : ''}
          </span>
        </span>
        {urgency ? (
          <span
            className={`text-[10px] ${urgency === 'overdue' ? 'text-timber' : 'text-amber'}`}
          >
            {urgency === 'overdue' ? '期限超過' : '期限近し'}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="border-t border-line px-3 py-3">
          <DecisionFields value={item} onChange={(next) => onPatch(next)} />
          <button
            type="button"
            className="mt-3 text-sm text-timber"
            onClick={onRemove}
          >
            削除
          </button>
        </div>
      ) : null}
    </li>
  )
}

function DecisionFields({
  value,
  onChange,
}: {
  value: Decision
  onChange: (next: Decision) => void
}) {
  const showArea = value.cat === '外構' || value.cat === '外観'
  return (
    <div className="space-y-3">
      <SelectField
        label="大分類"
        value={value.cat}
        onChange={(event) => onChange({ ...value, cat: event.target.value })}
      >
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </SelectField>
      <TextField
        label="項目名"
        value={value.title}
        onChange={(event) => onChange({ ...value, title: event.target.value })}
      />
      <TextArea
        label="決定内容"
        value={value.body}
        onChange={(event) => onChange({ ...value, body: event.target.value })}
      />
      <div>
        <p className="mb-1 text-xs text-muted">確定度</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_LABEL.map((label, status) => (
            <button
              key={label}
              type="button"
              className={`rounded-sm border px-2 py-2 text-sm ${
                value.status === status
                  ? `${STATUS_BORDER[status as Status]} bg-paper font-medium text-ink`
                  : 'border-line text-muted'
              }`}
              onClick={() => onChange({ ...value, status: status as Status })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={value.drawn}
          onChange={(event) =>
            onChange({ ...value, drawn: event.target.checked })
          }
        />
        図面に反映した
      </label>
      {showArea ? (
        <SelectField
          label="外構エリア"
          value={value.area ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              area: event.target.value || undefined,
            })
          }
        >
          <option value="">未設定</option>
          {AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </SelectField>
      ) : null}
      <TextField
        label="概算（万円）"
        type="number"
        inputMode="decimal"
        value={value.cost ?? ''}
        onChange={(event) =>
          onChange({
            ...value,
            cost: event.target.value === '' ? undefined : Number(event.target.value),
          })
        }
      />
      <TextField
        label="変更締切"
        type="date"
        value={value.due ?? ''}
        onChange={(event) =>
          onChange({
            ...value,
            due: event.target.value || undefined,
          })
        }
      />
    </div>
  )
}
