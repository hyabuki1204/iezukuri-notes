export type ExtractedFields = {
  decided: string
  myTodo: string
  theirTodo: string
  pending: string
  newq: string
}

const KEYS = ['decided', 'myTodo', 'theirTodo', 'pending', 'newq'] as const

export function emptyExtractedFields(): ExtractedFields {
  return {
    decided: '',
    myTodo: '',
    theirTodo: '',
    pending: '',
    newq: '',
  }
}

export function extractedFieldsHaveContent(fields: {
  decided: string
  myTodo: string
  theirTodo: string
  pending: string
  newq: string
}): boolean {
  return KEYS.some((key) => fields[key].trim().length > 0)
}

export function parseExtractedJson(text: string): ExtractedFields | null {
  const source = unwrapJson(text)
  if (!source) return null
  try {
    const parsed: unknown = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    const fields = emptyExtractedFields()
    for (const key of KEYS) {
      const value = record[key]
      fields[key] = typeof value === 'string' ? normalizeLines(value) : ''
    }
    return fields
  } catch {
    return null
  }
}

function unwrapJson(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? trimmed).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return body.slice(start, end + 1)
}

function normalizeLines(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[・\-*\d.）)\s]+/, '').trim())
    .filter(Boolean)
    .join('\n')
}
