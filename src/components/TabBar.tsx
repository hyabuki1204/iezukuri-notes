import { TABS } from '../app/tabs.ts'
import { useData } from '../app/DataProvider.tsx'

export function TabBar() {
  const { tab, setTab } = useData()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-4">
        {TABS.map((item) => {
          const active = tab === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`flex h-14 w-full items-center justify-center text-xs tracking-[0.16em] ${
                  active ? 'text-ink' : 'text-muted'
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
