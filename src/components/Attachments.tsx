import { useEffect, useRef, useState } from 'react'
import {
  attachmentUrl,
  FILE_ACCEPT,
  fileSummary,
  isImage,
  isPdf,
  removeAttachment,
  uploadFiles,
} from '../lib/files.ts'
import type { Attachment } from '../storage/types.ts'

export function Attachments({
  files,
  ownerId,
  onChange,
}: {
  files: Attachment[]
  ownerId: string
  onChange: (next: Attachment[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Attachment | null>(null)

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const added = await uploadFiles(ownerId, list)
      onChange([...files, ...added])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存に失敗しました。')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onRemove(file: Attachment) {
    if (!window.confirm(`${file.name} を削除しますか？`)) return
    setBusy(true)
    try {
      await removeAttachment(file)
      onChange(files.filter((item) => item.id !== file.id))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '削除に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs text-muted">写真・PDF</p>
      {files.length > 0 ? (
        <ul className="mb-2 grid grid-cols-2 gap-2">
          {files.map((file) => (
            <li key={file.id} className="overflow-hidden rounded-sm border border-line bg-paper">
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setPreview(file)}
              >
                <Thumb file={file} />
                <span className="block truncate px-2 py-1 text-xs text-ink">{file.name}</span>
              </button>
              <button
                type="button"
                className="px-2 pb-2 text-xs text-timber"
                onClick={() => void onRemove(file)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-muted">まだありません</p>
      )}
      <button
        type="button"
        className="btn-ghost btn-wide"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? '保存中…' : '写真・PDFを追加'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void onPick(event.target.files)}
      />
      {message ? <p className="mt-2 text-xs text-timber">{message}</p> : null}
      {preview ? (
        <Preview file={preview} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  )
}

export function AttachmentHint({ files }: { files: Attachment[] }) {
  const text = fileSummary(files)
  if (!text) return null
  return <span className="mt-0.5 block text-xs text-blue">{text}</span>
}

function Thumb({ file }: { file: Attachment }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!isImage(file)) return
    let url = ''
    let alive = true
    void attachmentUrl(file).then((next) => {
      if (!alive) return
      url = next
      setSrc(next)
    })
    return () => {
      alive = false
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [file])

  if (isPdf(file)) {
    return (
      <div className="flex h-24 items-center justify-center bg-soft-blue text-sm text-blue">
        PDF
      </div>
    )
  }
  if (src) {
    return <img src={src} alt="" className="h-24 w-full object-cover" />
  }
  return <div className="h-24 bg-paper" />
}

function Preview({ file, onClose }: { file: Attachment; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let url = ''
    let alive = true
    void attachmentUrl(file)
      .then((next) => {
        if (!alive) return
        url = next
        setSrc(next)
      })
      .catch((caught: unknown) => {
        if (!alive) return
        setError(caught instanceof Error ? caught.message : '開けません')
      })
    return () => {
      alive = false
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [file])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 md:items-center">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-sm bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            閉じる
          </button>
        </div>
        {error ? <p className="text-sm text-timber">{error}</p> : null}
        {src && isImage(file) ? (
          <img src={src} alt={file.name} className="max-h-[70dvh] w-full object-contain" />
        ) : null}
        {src && isPdf(file) ? (
          <iframe title={file.name} src={src} className="h-[70dvh] w-full border-0" />
        ) : null}
        {src ? (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-blue"
          >
            別のタブで開く
          </a>
        ) : null}
      </div>
    </div>
  )
}
