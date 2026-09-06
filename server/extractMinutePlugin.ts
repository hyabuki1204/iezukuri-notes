import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import {
  ExtractError,
  extractMinuteFromRaw,
  jsonFromRequest,
} from './anthropicExtract.ts'

export function extractMinuteApi(apiKey: string | undefined): Plugin {
  return {
    name: 'extract-minute-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/extract-minute') {
          next()
          return
        }
        void handle(req, res, apiKey)
      })
    },
  }
}

async function handle(
  req: IncomingMessage,
  res: import('node:http').ServerResponse,
  apiKey: string | undefined,
) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'POSTだけです。' }))
    return
  }
  if (!apiKey) {
    res.statusCode = 503
    res.end(
      JSON.stringify({
        error:
          'Anthropicのキーが未設定です。Vercelの Environment Variables に ANTHROPIC_API_KEY を入れてください。',
      }),
    )
    return
  }

  try {
    const rawBody = await readBody(req)
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {}
    const { raw } = jsonFromRequest(parsed)
    const fields = await extractMinuteFromRaw(raw, apiKey)
    res.statusCode = 200
    res.end(JSON.stringify({ fields }))
  } catch (error) {
    if (error instanceof ExtractError) {
      res.statusCode = error.status
      res.end(JSON.stringify({ error: error.message }))
      return
    }
    res.statusCode = 500
    res.end(JSON.stringify({ error: '抽出に失敗しました。' }))
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
