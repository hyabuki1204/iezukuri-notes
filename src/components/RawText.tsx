import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseRaw, type Inline, type RawBlock } from '../lib/rawText.ts'

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.bold ? (
          <strong key={index} className="font-bold text-ink">
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

function Block({ block }: { block: RawBlock }) {
  switch (block.kind) {
    case 'heading':
      return block.level === 1 ? (
        <h3 className="mt-5 mb-2 border-b border-line pb-1 text-[1.05em] font-bold text-ink first:mt-0">
          {block.text}
        </h3>
      ) : block.level === 2 ? (
        <h4 className="mt-5 mb-1.5 flex items-center gap-2 text-[1em] font-bold text-ink first:mt-0">
          <span aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-blue" />
          {block.text}
        </h4>
      ) : (
        <h5 className="mt-4 mb-1 text-[0.95em] font-bold text-blue first:mt-0">
          {block.text}
        </h5>
      )
    case 'bullet':
      return (
        <div
          className="my-1 flex gap-2"
          style={{ paddingLeft: `${block.depth * 1.1}em` }}
        >
          <span
            aria-hidden
            className={`mt-[0.62em] h-1.5 w-1.5 shrink-0 rounded-full ${
              block.depth === 0 ? 'bg-ink/60' : 'border border-ink/50'
            }`}
          />
          <p className="flex-1">
            <InlineText parts={block.inline} />
          </p>
        </div>
      )
    case 'number':
      return (
        <div
          className="my-1 flex gap-1.5"
          style={{ paddingLeft: `${block.depth * 1.1}em` }}
        >
          <span className="shrink-0 font-bold text-blue tabular-nums">
            {block.marker}
          </span>
          <p className="flex-1">
            <InlineText parts={block.inline} />
          </p>
        </div>
      )
    case 'rule':
      return <hr className="my-4 border-line" />
    case 'para':
      return (
        <p className="my-2 whitespace-pre-wrap">
          <InlineText parts={block.inline} />
        </p>
      )
  }
}

export function RawDocument({ text, large = false }: { text: string; large?: boolean }) {
  const blocks = useMemo(() => parseRaw(text), [text])
  return (
    <div
      className={`break-words text-ink/90 ${
        large ? 'text-[17px] leading-[1.9]' : 'text-[15px] leading-[1.8]'
      }`}
    >
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  )
}

function RawReader({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <h2 className="min-w-0 truncate text-sm font-bold text-ink">{title}</h2>
        <button type="button" className="btn-ghost shrink-0 px-4" onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-5 pt-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
          <RawDocument text={text} large />
        </div>
      </div>
    </div>,
    document.body,
  )
}

function AutoTextArea({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (next: string) => void
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 160), window.innerHeight * 0.7)}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      autoFocus={autoFocus}
      className="w-full rounded-sm border border-line bg-paper px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none focus:border-blue"
      placeholder="Zoom の AI 要約などをそのまま貼り付け"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

const COLLAPSED_PX = 320

// 議事録の原文：保存済みは読みやすい表示、編集ボタンで貼り付け欄に切り替える
export function RawSection({
  label,
  title,
  value,
  onChange,
  startEditing = false,
}: {
  label: string
  title: string
  value: string
  onChange: (next: string) => void
  startEditing?: boolean
}) {
  const [editing, setEditing] = useState(startEditing || !value.trim())
  const [expanded, setExpanded] = useState(false)
  const [reading, setReading] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const [copied, setCopied] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    setOverflows(el.scrollHeight > COLLAPSED_PX + 40)
  }, [value, editing])

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const showEditor = editing || !value.trim()

  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="min-w-0 text-xs text-muted">{label}</span>
        {value.trim() ? (
          <div className="flex shrink-0 gap-0.5 whitespace-nowrap">
            {!showEditor ? (
              <>
                <button
                  type="button"
                  className="rounded-sm px-2 py-1 text-xs text-blue"
                  onClick={() => setReading(true)}
                >
                  全画面で読む
                </button>
                <button
                  type="button"
                  className="rounded-sm px-2 py-1 text-xs text-muted"
                  onClick={() => void copy()}
                >
                  {copied ? 'コピーした' : 'コピー'}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="rounded-sm px-2 py-1 text-xs text-muted"
              onClick={() => setEditing((current) => !current)}
            >
              {showEditor ? '表示に戻す' : '編集'}
            </button>
          </div>
        ) : null}
      </div>

      {showEditor ? (
        <AutoTextArea value={value} onChange={onChange} autoFocus={editing && !startEditing} />
      ) : (
        <div className="rounded-sm border border-line bg-paper">
          <div
            ref={bodyRef}
            className="relative overflow-hidden px-4 py-3"
            style={!expanded && overflows ? { maxHeight: COLLAPSED_PX } : undefined}
          >
            <RawDocument text={value} />
            {!expanded && overflows ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-paper to-transparent" />
            ) : null}
          </div>
          {overflows ? (
            <button
              type="button"
              className="w-full border-t border-line py-2.5 text-sm text-blue"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? '折りたたむ' : '続きを読む'}
            </button>
          ) : null}
        </div>
      )}

      {reading ? (
        <RawReader title={title} text={value} onClose={() => setReading(false)} />
      ) : null}
    </section>
  )
}
