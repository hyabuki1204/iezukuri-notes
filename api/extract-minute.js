const MODEL = 'claude-sonnet-5'
const MAX_RAW = 80_000
const KEYS = ['decided', 'myTodo', 'theirTodo', 'pending', 'newq']

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTだけです。' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({
      error:
        'Anthropicのキーが未設定です。Vercelの Environment Variables に ANTHROPIC_API_KEY を入れてください。',
    })
    return
  }

  try {
    const raw = typeof req.body?.raw === 'string' ? req.body.raw : ''
    const fields = await extractMinuteFromRaw(raw, apiKey)
    res.status(200).json({ fields })
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500
    res.status(status).json({
      error: error instanceof Error ? error.message : '抽出に失敗しました。',
    })
  }
}

async function extractMinuteFromRaw(raw, apiKey) {
  const text = String(raw ?? '').trim()
  if (!text) {
    const error = new Error('原文を貼ってください。')
    error.status = 400
    throw error
  }
  if (text.length > MAX_RAW) {
    const error = new Error('原文が長すぎます。短くしてからもう一度。')
    error.status = 400
    throw error
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

  const payload = await response.json()
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ?? 'Anthropicの応答に失敗しました。',
    )
    error.status =
      response.status >= 400 && response.status < 600 ? response.status : 502
    throw error
  }

  const textOut = (payload.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
  const fields = parseExtractedJson(textOut)
  if (!fields) {
    const error = new Error(
      '抽出結果の形が読めませんでした。もう一度試してください。',
    )
    error.status = 502
    throw error
  }
  return fields
}

function parseExtractedJson(text) {
  const source = unwrapJson(text)
  if (!source) return null
  try {
    const parsed = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object') return null
    const fields = {
      decided: '',
      myTodo: '',
      theirTodo: '',
      pending: '',
      newq: '',
    }
    for (const key of KEYS) {
      const value = parsed[key]
      fields[key] = typeof value === 'string' ? normalizeLines(value) : ''
    }
    return fields
  } catch {
    return null
  }
}

function unwrapJson(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return null
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? trimmed).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return body.slice(start, end + 1)
}

function normalizeLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[・\-*\d.）)\s]+/, '').trim())
    .filter(Boolean)
    .join('\n')
}
