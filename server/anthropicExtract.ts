import { parseExtractedJson, type ExtractedFields } from '../src/lib/extractMinute.ts'

const MODEL = 'claude-sonnet-5'
const MAX_RAW = 80_000

const SYSTEM = `あなたは積水ハウスの打ち合わせ議事録を、家づくりメモの5欄に仕分ける係です。

ルール:
- 原文に書いてあることだけを使う。推測で埋めない。
- 各欄は改行区切り。1行=1件。短い名詞句で書く。
- 該当がなければ空文字。
- JSONだけ返す。前後の説明やコードフェンスは不要。

キー:
- decided: 決まったこと
- myTodo: 施主（自分・妻）がやること
- theirTodo: 営業・設計・インテリア・外構など先方がやること
- pending: 保留・未決
- newq: 新たに出た疑問・確認事項`

export async function extractMinuteFromRaw(
  raw: string,
  apiKey: string,
): Promise<ExtractedFields> {
  const text = raw.trim()
  if (!text) throw new ExtractError(400, '原文を貼ってください。')
  if (text.length > MAX_RAW) {
    throw new ExtractError(400, '原文が長すぎます。短くしてからもう一度。')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `次の原文を5欄に分けてください。\n\n${text}`,
        },
      ],
    }),
  })

  const payload = (await response.json()) as {
    error?: { message?: string }
    content?: { type: string; text?: string }[]
  }

  if (!response.ok) {
    throw new ExtractError(
      response.status >= 400 && response.status < 600 ? response.status : 502,
      payload.error?.message ?? 'Anthropicの応答に失敗しました。',
    )
  }

  const textOut = payload.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')

  const fields = parseExtractedJson(textOut ?? '')
  if (!fields) {
    throw new ExtractError(502, '抽出結果の形が読めませんでした。もう一度試してください。')
  }
  return fields
}

export class ExtractError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function jsonFromRequest(body: unknown): { raw: string } {
  if (!body || typeof body !== 'object') {
    throw new ExtractError(400, '原文を貼ってください。')
  }
  const raw = (body as { raw?: unknown }).raw
  if (typeof raw !== 'string') {
    throw new ExtractError(400, '原文を貼ってください。')
  }
  return { raw }
}
