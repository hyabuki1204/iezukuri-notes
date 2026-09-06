import { DataProvider, useData } from './app/DataProvider.tsx'
import { Header } from './components/Header.tsx'
import { TabBar } from './components/TabBar.tsx'
import { DecisionsScreen } from './screens/DecisionsScreen.tsx'
import { IdeasScreen } from './screens/IdeasScreen.tsx'
import { MinutesScreen } from './screens/MinutesScreen.tsx'
import { QuestionsScreen } from './screens/QuestionsScreen.tsx'

function Shell() {
  const { ready, tab } = useData()

  if (!ready) {
    return (
      <div className="px-5 py-16 text-center text-sm text-muted">読み込み中</div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper pb-20 md:pb-0">
      <Header />
      <main className="mx-auto w-full max-w-6xl">
        {tab === 'decisions' ? <DecisionsScreen /> : null}
        {tab === 'questions' ? <QuestionsScreen /> : null}
        {tab === 'ideas' ? <IdeasScreen /> : null}
        {tab === 'minutes' ? <MinutesScreen /> : null}
      </main>
      <TabBar />
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}
