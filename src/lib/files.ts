import { HOUSEHOLD_ID, isSupabaseConfigured } from '../storage/config.ts'
import { getSupabase } from '../storage/client.ts'
import type { Attachment } from '../storage/types.ts'
import { deleteLocalBlob, getLocalBlob, putLocalBlob } from './localFiles.ts'
import { newId, nowIso } from './ids.ts'

export const FILE_BUCKET = 'iezukuri'
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const FILE_ACCEPT = 'image/*,application/pdf,.pdf'

const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]

export function isImage(file: Attachment): boolean {
  return file.mime.startsWith('image/')
}

export function isPdf(file: Attachment): boolean {
  return file.mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function fileSummary(files: Attachment[]): string {
  const photos = files.filter(isImage).length
  const pdfs = files.filter(isPdf).length
  const parts = [
    photos > 0 ? `写真${photos}` : '',
    pdfs > 0 ? `PDF${pdfs}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-()\u3040-\u30ff\u4e00-\u9faf]+/g, '_').slice(0, 80)
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return '1ファイルは10MBまでです。'
  if (file.type && !ALLOWED.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
    return '写真かPDFだけです。'
  }
  return null
}

export async function uploadFiles(
  ownerId: string,
  files: FileList | File[],
): Promise<Attachment[]> {
  const added: Attachment[] = []
  for (const file of Array.from(files)) {
    const problem = validateFile(file)
    if (problem) throw new Error(problem)
    added.push(await uploadOne(ownerId, file))
  }
  return added
}

async function uploadOne(ownerId: string, file: File): Promise<Attachment> {
  const id = newId()
  const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
  const attachment: Attachment = {
    id,
    name: file.name || 'file',
    mime,
    size: file.size,
    path: `local:${id}`,
    createdAt: nowIso(),
  }

  if (isSupabaseConfigured()) {
    const path = `${HOUSEHOLD_ID}/${ownerId}/${id}/${safeName(attachment.name)}`
    const { error } = await getSupabase().storage.from(FILE_BUCKET).upload(path, file, {
      contentType: mime,
      upsert: false,
    })
    if (error) throw error
    attachment.path = path
  } else {
    await putLocalBlob(id, file)
  }
  return attachment
}

export async function removeAttachment(file: Attachment): Promise<void> {
  if (file.path.startsWith('local:')) {
    await deleteLocalBlob(file.id)
    return
  }
  if (isSupabaseConfigured() && file.path) {
    const { error } = await getSupabase().storage.from(FILE_BUCKET).remove([file.path])
    if (error) throw error
  }
}

export async function removeAttachments(files: Attachment[]): Promise<void> {
  await Promise.all(files.map((file) => removeAttachment(file)))
}

export async function attachmentUrl(file: Attachment): Promise<string> {
  if (file.path.startsWith('local:')) {
    const blob = await getLocalBlob(file.id)
    if (!blob) throw new Error('この端末にファイルがありません。')
    return URL.createObjectURL(blob)
  }
  if (!isSupabaseConfigured()) {
    throw new Error('クラウドに繋がっていないので開けません。')
  }
  const { data } = getSupabase().storage.from(FILE_BUCKET).getPublicUrl(file.path)
  return data.publicUrl
}
