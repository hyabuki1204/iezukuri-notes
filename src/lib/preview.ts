export function firstLine(text: string, max = 40): string {
  const line = text.trim().split(/\r?\n/, 1)[0] ?? ''
  if (!line) return ''
  return line.length > max ? `${line.slice(0, max)}…` : line
}
