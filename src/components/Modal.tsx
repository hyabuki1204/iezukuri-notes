import type { ReactNode } from 'react'

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-sm border border-line bg-card p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-mincho text-base text-ink">{title}</h2>
          <button
            type="button"
            className="text-sm text-muted"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
