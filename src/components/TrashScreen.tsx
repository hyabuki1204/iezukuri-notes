import { createPortal } from 'react-dom'
import { useData } from '../app/DataProvider.tsx'
import { keepPaths, removeAttachments } from '../lib/files.ts'
import {
  daysLeft,
  purgeFromTrash,
  restoreFromTrash,
  TRASH_DAYS,
  TRASH_KIND_LABEL,
  trashTitle,
} from '../lib/trash.ts'
import { Tag } from './ui.tsx'

export function TrashScreen({ onClose }: { onClose: () => void }) {
  const { data, update } = useData()
  const entries = data.trash.toSorted((a, b) => b.deletedAt.localeCompare(a.deletedAt))

  function purge(ids: string[], message: string) {
    if (!window.confirm(message)) return
    const { data: next, files } = purgeFromTrash(data, ids)
    update(() => next)
    void removeAttachments(files, keepPaths(next))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] overflow-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="ゴミ箱"
    >
      <div className="sticky top-0 z-10 border-b border-line bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-base font-bold text-ink">ゴミ箱</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-xl px-4 py-4 pb-16">
        <p className="text-[13px] text-muted">
          削除したものは{TRASH_DAYS}日間ここに残り、そのあと自動で完全に削除されます。
        </p>
        {entries.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">ゴミ箱は空です。</p>
        ) : (
          <>
            <ul className="mt-4 space-y-2">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-sm border border-line bg-card px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tag tone="blue">{TRASH_KIND_LABEL[entry.kind]}</Tag>
                    <span className="text-xs text-muted">
                      {entry.deletedAt.slice(0, 10)} に削除・あと{daysLeft(entry)}日
                    </span>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-snug break-words text-ink">{trashTitle(entry)}</p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="btn-primary py-2.5"
                      onClick={() => update((current) => restoreFromTrash(current, entry.id))}
                    >
                      元に戻す
                    </button>
                    <button
                      type="button"
                      className="btn-ghost py-2.5 text-timber"
                      onClick={() =>
                        purge([entry.id], '完全に削除します。写真・PDFも消え、元に戻せません。よろしいですか？')
                      }
                    >
                      完全に削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-6 w-full py-2 text-sm text-timber"
              onClick={() =>
                purge(
                  entries.map((entry) => entry.id),
                  `ゴミ箱の${entries.length}件をすべて完全に削除します。元に戻せません。よろしいですか？`,
                )
              }
            >
              ゴミ箱を空にする
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
