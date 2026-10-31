// Supabase 無料プランは一定期間アクセスがないと一時停止する。
// Vercel Cron から毎日呼び、データベースに軽い読み取りをして止まらないようにする。

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    res.status(503).json({ ok: false, error: 'Supabase の環境変数が未設定です。' })
    return
  }

  try {
    const response = await fetch(`${url}/rest/v1/iezukuri_households?select=id&limit=1`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    })
    const body = await response.text()
    if (!response.ok) {
      res.status(502).json({ ok: false, status: response.status, body: body.slice(0, 300) })
      return
    }
    res.status(200).json({ ok: true, at: new Date().toISOString() })
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
