import {
  ExtractError,
  extractMinuteFromRaw,
  jsonFromRequest,
} from '../server/anthropicExtract.ts'

type ApiReq = { method?: string; body?: unknown }
type ApiRes = {
  status: (code: number) => { json: (body: unknown) => void }
}

export default async function handler(req: ApiReq, res: ApiRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTだけです。' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({
      error: 'Anthropicのキーが未設定です。Vercelの Environment Variables に ANTHROPIC_API_KEY を入れてください。',
    })
    return
  }

  try {
    const { raw } = jsonFromRequest(req.body)
    const fields = await extractMinuteFromRaw(raw, apiKey)
    res.status(200).json({ fields })
  } catch (error) {
    if (error instanceof ExtractError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    res.status(500).json({ error: '抽出に失敗しました。' })
  }
}
