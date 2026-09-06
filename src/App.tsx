const tokens = [
  { name: 'paper', swatch: 'bg-paper', hex: '#F2F1ED' },
  { name: 'card', swatch: 'bg-card', hex: '#FFFFFF' },
  { name: 'ink', swatch: 'bg-ink', hex: '#23262B' },
  { name: 'muted', swatch: 'bg-muted', hex: '#7B7A71' },
  { name: 'line', swatch: 'bg-line', hex: '#DEDCD3' },
  { name: 'green', swatch: 'bg-green', hex: '#3F6B4A' },
  { name: 'amber', swatch: 'bg-amber', hex: '#B8842B' },
  { name: 'timber', swatch: 'bg-timber', hex: '#8A6A4F' },
] as const

function App() {
  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <h1 className="font-mincho text-2xl text-ink">家づくりメモ</h1>
      <p className="mt-2 text-sm text-muted">ステップ1 — トークン確認</p>

      <section className="mt-6 rounded-sm border border-line bg-card p-4">
        <h2 className="font-mincho text-base text-ink">色</h2>
        <ul className="mt-3 grid grid-cols-4 gap-3">
          {tokens.map((token) => (
            <li key={token.name} className="flex flex-col gap-1">
              <div
                className={`${token.swatch} h-10 rounded-sm border border-line`}
              />
              <span className="text-xs text-ink">{token.name}</span>
              <span className="text-[10px] text-muted">{token.hex}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-sm border border-line bg-card p-4">
        <h2 className="font-mincho text-base text-ink">見出しは明朝</h2>
        <p className="mt-2 text-sm text-ink">本文はサンセリフ。影は使わない。</p>
        <p className="mt-1 text-sm text-muted">補助文字 muted</p>
        <div className="mt-3 border-l-4 border-amber pl-3 text-sm text-ink">
          左ボーダーで確定度（仮 = amber）
        </div>
      </section>
    </main>
  )
}

export default App
