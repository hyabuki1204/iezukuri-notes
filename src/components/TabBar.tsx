import { useData, type Tab } from '../app/DataProvider.tsx'

const TABS: { id: Tab; label: string }[] = [
  { id: 'decisions', label: '決定' },
  { id: 'questions', label: '質問' },
  { id: 'ideas', label: 'アイデア' },
  { id: 'minutes', label: '議事録' },
]

export function TabBar() {
  const { tab, setTab } = useData()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto max-w-md border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map((item) => {
          const active = tab === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`flex h-14 w-full items-center justify-center text-sm ${
                  active ? 'text-green' : 'text-muted'
                }`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
