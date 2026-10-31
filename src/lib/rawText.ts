// AI 要約（Zoom / 積水の AI 議事録など）を読みやすく表示するための軽い構造化。
// Markdown 風の見出し・箇条書き・番号・太字と、全角記号の箇条書きを拾う。

export type Inline = { text: string; bold: boolean }

export type RawBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'bullet'; depth: number; inline: Inline[] }
  | { kind: 'number'; depth: number; marker: string; inline: Inline[] }
  | { kind: 'para'; inline: Inline[] }
  | { kind: 'rule' }

// "-" "*" "+" は後ろに空白が必要（"**太字**" を箇条書きと誤認しない）
const BULLET = /^(\s*)(?:[-*+](?=\s)|[•・●○◦▪□◇※])\s*(.+)$/
const NUMBER = /^(\s*)((?:\d{1,2}[.)．）])|(?:[（(]\d{1,2}[)）])|[①-⑳])\s*(.+)$/
const HEADING_MD = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/
const BOLD_LINE = /^\s*\*\*(.+?)\*\*\s*[:：]?\s*$/
const BRACKET_HEADING = /^\s*[【■◆]\s*(.+?)\s*】?\s*$/
const RULE = /^\s*(?:[-*_=─━]\s*){3,}$/

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*|__(.+?)__/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false })
    out.push({ text: m[1] ?? m[2] ?? '', bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false })
  return out.length > 0 ? out : [{ text, bold: false }]
}

function depthOf(indent: string): number {
  const width = indent.replace(/\t/g, '    ').replace(/　/g, '  ').length
  return Math.min(3, Math.floor(width / 2))
}

// 短く、句点で終わらず、「：」で終わる行は見出しとみなす（例: 「次のステップ：」）
function looksLikeLabel(line: string): boolean {
  const t = line.trim()
  return t.length <= 30 && /[:：]$/.test(t) && !/[。.]/.test(t.slice(0, -1))
}

export function parseRaw(raw: string): RawBlock[] {
  const blocks: RawBlock[] = []
  let para: string[] = []

  const flush = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'para', inline: parseInline(para.join('\n')) })
      para = []
    }
  }

  for (const rawLine of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim()) {
      flush()
      continue
    }
    let m: RegExpMatchArray | null
    if (RULE.test(line)) {
      flush()
      blocks.push({ kind: 'rule' })
    } else if ((m = line.match(HEADING_MD))) {
      flush()
      const hashes = m[1]!.length
      const level = hashes <= 1 ? 1 : hashes === 2 ? 2 : 3
      blocks.push({ kind: 'heading', level, text: stripBold(m[2]!) })
    } else if ((m = line.match(BOLD_LINE))) {
      flush()
      blocks.push({ kind: 'heading', level: 3, text: m[1]! })
    } else if ((m = line.match(BRACKET_HEADING)) && line.trim().length <= 40) {
      flush()
      blocks.push({ kind: 'heading', level: 2, text: m[1]! })
    } else if ((m = line.match(NUMBER))) {
      flush()
      blocks.push({
        kind: 'number',
        depth: depthOf(m[1]!),
        marker: m[2]!,
        inline: parseInline(m[3]!),
      })
    } else if ((m = line.match(BULLET))) {
      flush()
      blocks.push({ kind: 'bullet', depth: depthOf(m[1]!), inline: parseInline(m[2]!) })
    } else if (looksLikeLabel(line) && para.length === 0) {
      blocks.push({ kind: 'heading', level: 3, text: line.trim().replace(/[:：]$/, '') })
    } else {
      para.push(line.trim())
    }
  }
  flush()
  return blocks
}

function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1')
}

// 一覧のプレビュー用：見出し記号や箇条書き記号を外した最初の行
export function plainFirstLine(raw: string, max = 40): string {
  for (const block of parseRaw(raw)) {
    const text =
      block.kind === 'heading'
        ? block.text
        : block.kind === 'rule'
          ? ''
          : block.inline.map((part) => part.text).join('')
    const line = text.trim().split('\n', 1)[0] ?? ''
    if (line) return line.length > max ? `${line.slice(0, max)}…` : line
  }
  return ''
}
