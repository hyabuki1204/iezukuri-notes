import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '../app/DataProvider.tsx'
import {
  addListItem,
  moveListItem,
  removeListItem,
  renameListItem,
  usedCounts,
  type ListKey,
} from '../lib/lists.ts'

const SECTIONS: { key: ListKey; title: string; hint: string }[] = [
  {
    key: 'categories',
    title: '大分類',
    hint: '名前に「外構」か「外観」が含まれる分類だけ、エリアが使えます。',
  },
  { key: 'areas', title: '外構エリア', hint: 'この家の場所。足したり、名前を直せます。' },
  { key: 'assignees', title: '質問の宛先', hint: '営業・設計など。人の名前も足せます。' },
]

export function ListsEditor({ onClose }: { onClose: () => void }) {
  const { data, update } = useData()
  const used = usedCounts(data)
  const [drafts, setDrafts] = useState<Record<ListKey, string>>({
    categories: '',
    areas: '',
    assignees: '',
  })
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function apply(next: ReturnType<typeof addListItem>, fail: string) {
    if (!next) {
      setMessage(fail)
      return false
    }
    update(() => next)
    setMessage(null)
    return true
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] overflow-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="分類を編集"
    >
      <div className="sticky top-0 z-10 border-b border-line bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-base font-bold text-ink">分類を編集</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-xl px-4 py-4 pb-16">
        <p className="mb-5 text-xs text-muted">
          確定度と「自分 / 妻」は、数字の意味が決まっているので変えられません。
        </p>
        {SECTIONS.map((section) => (
          <section key={section.key} className="mb-8">
            <h3 className="section-title">{section.title}</h3>
            <p className="mt-1 text-xs text-muted">{section.hint}</p>
            <ul className="mt-3 space-y-2">
              {data.lists[section.key].map((name, index) => {
                const count = used[section.key].get(name) ?? 0
                return (
                  <li
                    key={name}
                    className="rounded-sm border border-line bg-card px-2 py-2"
                  >
                    <input
                      className="w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm"
                      defaultValue={name}
                      onBlur={(event) => {
                        if (event.target.value.trim() === name) return
                        apply(
                          renameListItem(data, section.key, name, event.target.value),
                          '同じ名前があるか、空です。',
                        )
                      }}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted">
                        {count > 0 ? `${count}件で使用中` : '未使用'}
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-sm border border-line px-2 py-1 text-xs text-muted"
                          onClick={() =>
                            update((current) =>
                              moveListItem(current, section.key, index, -1),
                            )
                          }
                        >
                          上へ
                        </button>
                        <button
                          type="button"
                          className="rounded-sm border border-line px-2 py-1 text-xs text-muted"
                          onClick={() =>
                            update((current) =>
                              moveListItem(current, section.key, index, 1),
                            )
                          }
                        >
                          下へ
                        </button>
                        <button
                          type="button"
                          className="rounded-sm border border-line px-2 py-1 text-xs text-timber"
                          onClick={() => {
                            apply(
                              removeListItem(data, section.key, name),
                              count > 0
                                ? '使っているメモがあるので消せません。'
                                : '最後の1つは残せます。',
                            )
                          }}
                        >
                          削除
                        </button>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-sm border border-line bg-card px-3 py-2.5 text-sm"
                placeholder="名前を足す"
                value={drafts[section.key]}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [section.key]: event.target.value,
                  }))
                }
              />
              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => {
                  if (apply(addListItem(data, section.key, drafts[section.key]), '同じ名前があるか、空です。')) {
                    setDrafts((current) => ({ ...current, [section.key]: '' }))
                  }
                }}
              >
                追加
              </button>
            </div>
          </section>
        ))}
        {message ? <p className="text-sm text-timber">{message}</p> : null}
      </div>
    </div>,
    document.body,
  )
}
