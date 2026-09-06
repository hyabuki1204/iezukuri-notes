import { WHOS, type Who } from '../storage/types.ts'

export function WhoField({
  value,
  onChange,
}: {
  value: Who
  onChange: (next: Who) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">書いた人</p>
      <div className="grid grid-cols-2 gap-2">
        {WHOS.map((who) => (
          <button
            key={who}
            type="button"
            className={`rounded-sm border px-2 py-2 text-sm ${
              value === who
                ? 'border-blue bg-soft-blue font-medium text-blue'
                : 'border-line text-muted'
            }`}
            onClick={() => onChange(who)}
          >
            {who}
          </button>
        ))}
      </div>
    </div>
  )
}

export function WhoStamp({ who }: { who: Who }) {
  return <span className="text-[10px] text-muted">{who}</span>
}
