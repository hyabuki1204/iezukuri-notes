import { useCallback, useEffect, useMemo, useState } from 'react'
import { Attachments, AttachmentHint } from '../components/Attachments.tsx'
import { SelectField, TextArea, TextField } from '../components/Field.tsx'
import { WhoField, WhoStamp } from '../components/WhoField.tsx'
import {
  DangerZone,
  Disclosure,
  EditBar,
  ReadBlock,
  STATUS_BUTTON_ON,
  StatusBadge,
  Tag,
  useOpenFromJump,
  useOpenSet,
} from '../components/ui.tsx'
import { useData, type DecisionFilter } from '../app/DataProvider.tsx'
import { dueUrgency } from '../lib/due.ts'
import { keepPaths, removeAttachments } from '../lib/files.ts'
import { newId, nowIso } from '../lib/ids.ts'
import { firstLine } from '../lib/preview.ts'
import { firstOf, optionsFor, usesAreas } from '../lib/lists.ts'
import {
  STATUS_LABEL,
  type Decision,
  type Status,
} from '../storage/types.ts'

function emptyDraft(cat = 'キッチン'): Decision {
  return {
    id: newId(),
    cat,
    title: '',
    body: '',
    status: 0,
    drawn: false,
    updatedAt: nowIso(),
    attachments: [],
    who: '自分',
  }
}

export function DecisionsScreen() {
  const { data, update, jump, consumeJump } = useData()
  const [statusFilter, setStatusFilter] = useState<DecisionFilter>('all')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [groupByArea, setGroupByArea] = useState(false)
  const { openIds, setOpenIds, editingIds, toggle, toggleEdit } = useOpenSet()
  const openOne = useCallback(
    (id: string) => {
      setStatusFilter('all')
      setCatFilter('all')
      setOpenIds((current) => new Set(current).add(id))
    },
    [setOpenIds],
  )
  useOpenFromJump('decisions', openOne)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Decision>(emptyDraft)

  useEffect(() => {
    if (!jump || jump.tab !== 'decisions' || jump.openId) return
    if (jump.urgent) {
      setStatusFilter('all')
      setCatFilter('all')
    } else if (jump.filter && jump.filter !== 'all') {
      setStatusFilter(jump.filter)
    }
    const scrollUrgent = Boolean(jump.urgent)
    consumeJump()
    if (scrollUrgent) {
      window.setTimeout(() => {
        document.getElementById('urgent-decisions')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 80)
    }
  }, [jump, consumeJump])

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
    const byArea = groupByArea && usesAreas(catFilter)
    const master = byArea ? data.lists.areas : data.lists.categories
    const used = byArea
      ? filtered.map((item) => item.area ?? 'エリア未設定')
      : filtered.map((item) => item.cat)
    const keys = [
      ...master,
      ...(byArea ? ['エリア未設定'] : []),
      ...used.filter((name) => name && !master.includes(name) && name !== 'エリア未設定'),
    ]
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
  }, [filtered, groupByArea, catFilter, data.lists.areas, data.lists.categories])

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
    const target = data.decisions.find((item) => item.id === id)
    if (target) {
      const remaining = {
        ...data,
        decisions: data.decisions.filter((item) => item.id !== id),
      }
      void removeAttachments(target.attachments, keepPaths(remaining))
    }
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
    setDraft(emptyDraft(firstOf(data.lists.categories, 'キッチン')))
    setAdding(false)
  }

  return (
    <div className="page">
      <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
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
        <select
          aria-label="大分類"
          className={`shrink-0 rounded-full border py-1.5 pr-6 pl-3 text-sm ${
            catFilter === 'all' ? 'border-line bg-card text-muted' : 'border-blue bg-soft-blue text-blue'
          }`}
          value={catFilter}
          onChange={(event) => setCatFilter(event.target.value)}
        >
          <option value="all">大分類</option>
          {optionsFor(
            data.lists.categories,
            catFilter === 'all' ? undefined : catFilter,
          ).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      {usesAreas(catFilter) ? (
        <label className="mt-2 flex items-center gap-2 text-sm text-ink">
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
        className="btn-ghost btn-wide mt-3 py-2.5"
        onClick={() => {
          setDraft(emptyDraft(firstOf(data.lists.categories, 'キッチン')))
          setAdding((value) => !value)
        }}
      >
        {adding ? '追加を閉じる' : '＋ 決定を追加'}
      </button>
      {adding ? (
        <article className="panel mt-3 md:max-w-xl">
          <DecisionFields value={draft} onChange={setDraft} isNew />
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
        <section id="urgent-decisions" className="mt-5 scroll-mt-24">
          <h2 className="section-title text-orange">期限が近い・過ぎた</h2>
          <ul className="card-list mt-2">
            {urgent.map((item) => (
              <DecisionCard
                key={`due-${item.id}`}
                item={item}
                open={openIds.has(item.id)}
                editing={editingIds.has(item.id)}
                onToggle={() => toggle(item.id)}
                onToggleEdit={() => toggleEdit(item.id)}
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
                editing={editingIds.has(item.id)}
                onToggle={() => toggle(item.id)}
                onToggleEdit={() => toggleEdit(item.id)}
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
  editing,
  onToggle,
  onToggleEdit,
  onPatch,
  onRemove,
}: {
  item: Decision
  open: boolean
  editing: boolean
  onToggle: () => void
  onToggleEdit: () => void
  onPatch: (partial: Partial<Decision>) => void
  onRemove: () => void
}) {
  const urgency = dueUrgency(item.due)
  const preview = firstLine(item.body, 60)
  return (
    <li
      id={`item-${item.id}`}
      className={`note-card scroll-mt-24 ${open ? 'md:col-span-2' : ''}`}
    >
      <button
        type="button"
        className="block w-full px-4 py-3 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-ink">
            {item.title}
          </span>
          <WhoStamp who={item.who} />
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={item.status} />
          {item.status >= 2 ? (
            item.drawn ? <Tag tone="green">図面済</Tag> : <Tag tone="orange">図面未反映</Tag>
          ) : null}
          {urgency ? (
            <Tag tone={urgency === 'overdue' ? 'red' : 'orange'}>
              {urgency === 'overdue' ? '期限超過' : '期限近し'} {item.due}
            </Tag>
          ) : item.due ? (
            <Tag>締切 {item.due}</Tag>
          ) : null}
          {item.cost !== undefined ? <Tag>{item.cost}万円</Tag> : null}
        </span>
        {!open && preview ? (
          <span className="mt-1.5 block text-[13px] leading-snug text-ink/70">{preview}</span>
        ) : null}
        {!open ? <AttachmentHint files={item.attachments} /> : null}
      </button>
      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-3">
          {editing ? (
            <>
              <EditBar editing onToggle={onToggleEdit}>
                <span className="text-[13px] text-muted">変更はその場で保存されます</span>
              </EditBar>
              <DecisionFields value={item} onChange={(next) => onPatch(next)} />
              <DangerZone onRemove={onRemove} label="この決定を削除" />
            </>
          ) : (
            <>
              <EditBar editing={false} onToggle={onToggleEdit}>
                <Tag>{item.cat}</Tag>
                {item.area ? <Tag>{item.area}</Tag> : null}
              </EditBar>
              <ReadBlock label="決定内容" text={item.body} empty="（まだ書いていません）" />
              <QuickStatus value={item} onPatch={onPatch} />
              <Attachments
                files={item.attachments}
                ownerId={item.id}
                readOnly
                onChange={(attachments) => onPatch({ attachments })}
              />
              <p className="text-xs text-muted">最終更新 {item.updatedAt.slice(0, 10)}</p>
            </>
          )}
        </div>
      ) : null}
    </li>
  )
}

// 読む表示のまま、確定度と図面反映だけはワンタップで変えられる
function QuickStatus({
  value,
  onPatch,
}: {
  value: Decision
  onPatch: (partial: Partial<Decision>) => void
}) {
  return (
    <div className="space-y-2">
      <StatusPicker value={value.status} onChange={(status) => onPatch({ status })} />
      <DrawnToggle value={value.drawn} onChange={(drawn) => onPatch({ drawn })} />
    </div>
  )
}

function StatusPicker({
  value,
  onChange,
}: {
  value: Status
  onChange: (status: Status) => void
}) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-muted">確定度</p>
      <div className="grid grid-cols-4 gap-1.5">
        {STATUS_LABEL.map((label, status) => (
          <button
            key={label}
            type="button"
            className={`rounded-sm border px-1 py-2 text-sm ${
              value === status
                ? `${STATUS_BUTTON_ON[status as Status]} font-bold`
                : 'border-line bg-card text-muted'
            }`}
            onClick={() => onChange(status as Status)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DrawnToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (drawn: boolean) => void
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-sm border px-3 py-2.5 text-[15px] ${
        value ? 'border-green bg-soft-green text-green' : 'border-line bg-card text-ink'
      }`}
    >
      <input
        type="checkbox"
        className="h-5 w-5 accent-green"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      図面に反映した
    </label>
  )
}

function DecisionFields({
  value,
  onChange,
  isNew = false,
}: {
  value: Decision
  onChange: (next: Decision) => void
  isNew?: boolean
}) {
  const { data } = useData()
  const showArea = usesAreas(value.cat)
  const hasDetail =
    value.cost !== undefined || Boolean(value.due) || value.attachments.length > 0
  return (
    <div className="space-y-3">
      <TextField
        label="項目名"
        value={value.title}
        placeholder="例：食洗機"
        onChange={(event) => onChange({ ...value, title: event.target.value })}
      />
      <TextArea
        label="決定内容"
        value={value.body}
        onChange={(event) => onChange({ ...value, body: event.target.value })}
      />
      <StatusPicker
        value={value.status}
        onChange={(status) => onChange({ ...value, status })}
      />
      <DrawnToggle
        value={value.drawn}
        onChange={(drawn) => onChange({ ...value, drawn })}
      />
      <div className={`grid gap-2 ${showArea ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <SelectField
          label="大分類"
          value={value.cat}
          onChange={(event) => onChange({ ...value, cat: event.target.value })}
        >
          {optionsFor(data.lists.categories, value.cat).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </SelectField>
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
            {optionsFor(data.lists.areas, value.area).map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </SelectField>
        ) : null}
      </div>
      <WhoField
        value={value.who}
        onChange={(who) => onChange({ ...value, who })}
      />
      <Disclosure label="概算・変更締切・写真" defaultOpen={hasDetail && !isNew}>
        <div className="grid grid-cols-2 gap-2">
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
        <Attachments
          files={value.attachments}
          ownerId={value.id}
          onChange={(attachments) => onChange({ ...value, attachments })}
        />
      </Disclosure>
    </div>
  )
}
