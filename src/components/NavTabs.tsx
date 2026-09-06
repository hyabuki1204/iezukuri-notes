import { TABS } from '../app/tabs.ts'
import { useData, type Tab } from '../app/DataProvider.tsx'
import { headerStats } from '../lib/stats.ts'
import { NavIcon } from './NavIcon.tsx'

export function NavTabs({
  variant,
}: {
  variant: 'header' | 'bar'
}) {
  const { tab, setTab, data } = useData()
  const stats = headerStats(data)

  return (
    <ul
      className={
        variant === 'header'
          ? 'flex items-center gap-2'
          : 'grid grid-cols-5'
      }
    >
      {TABS.map((item) => (
        <NavTab
          key={item.id}
          id={item.id}
          label={item.label}
          badge={
            item.id === 'decisions'
              ? stats.undecided
              : item.id === 'questions'
                ? stats.openQuestions
                : 0
          }
          active={tab === item.id}
          variant={variant}
          onClick={() => setTab(item.id)}
        />
      ))}
    </ul>
  )
}

function NavTab({
  id,
  label,
  badge,
  active,
  variant,
  onClick,
}: {
  id: Tab
  label: string
  badge: number
  active: boolean
  variant: 'header' | 'bar'
  onClick: () => void
}) {
  const iconBox = active ? 'bg-blue text-card' : 'bg-paper text-muted'

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={
          variant === 'header'
            ? 'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm'
            : 'flex h-16 w-full flex-col items-center justify-center gap-1'
        }
      >
        <span className="relative">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBox}`}
          >
            <NavIcon id={id} className="h-4 w-4" />
          </span>
          {badge > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-orange px-1 text-center text-[10px] leading-4 text-card">
              {badge}
            </span>
          ) : null}
        </span>
        <span className={`text-xs ${active ? 'font-medium text-blue' : 'text-muted'}`}>
          {label}
        </span>
      </button>
    </li>
  )
}
