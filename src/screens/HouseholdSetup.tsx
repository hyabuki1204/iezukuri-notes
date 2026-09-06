import { useState } from 'react'
import { useData } from '../app/DataProvider.tsx'
import { TextField } from '../components/Field.tsx'

export function HouseholdSetup() {
  const { startHousehold, joinHousehold } = useData()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      await startHousehold()
    } catch (err) {
      setError(err instanceof Error ? err.message : '開始できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await joinHousehold(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : '入れませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="px-5 py-10">
      <h1 className="font-mincho text-2xl text-ink">家づくりメモ</h1>
      <p className="mt-3 text-sm text-muted">
        2台で同じメモを使います。ログインはありません。
      </p>
      <p className="mt-1 text-sm text-muted">
        最初の端末で家を始め、世帯コードをもう1台に渡してください。
      </p>

      <button
        type="button"
        disabled={busy}
        className="mt-8 w-full rounded-sm bg-green py-3 text-sm text-card disabled:opacity-60"
        onClick={() => void start()}
      >
        この端末で新しい家を始める
      </button>

      <div className="mt-8 space-y-3 rounded-sm border border-line bg-card p-4">
        <TextField
          label="世帯コードを持っている"
          value={code}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          onChange={(event) => setCode(event.target.value)}
        />
        <button
          type="button"
          disabled={busy || !code.trim()}
          className="w-full rounded-sm border border-green py-2 text-sm text-green disabled:opacity-60"
          onClick={() => void join()}
        >
          この家に入る
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-timber">{error}</p> : null}
    </main>
  )
}
