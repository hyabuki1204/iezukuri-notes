import { NavTabs } from './NavTabs.tsx'

export function TabBar() {
  return (
    <nav className="app-chrome fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] shadow-sm md:hidden">
      <NavTabs variant="bar" />
    </nav>
  )
}
