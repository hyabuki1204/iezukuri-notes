import { DataProvider, useData } from './app/DataProvider.tsx'
import { Header } from './components/Header.tsx'
import { TabBar } from './components/TabBar.tsx'
import { DecisionsScreen } from './screens/DecisionsScreen.tsx'
import { HouseholdSetup } from './screens/HouseholdSetup.tsx'
import { IdeasScreen } from './screens/IdeasScreen.tsx'
import { MinutesScreen } from './screens/MinutesScreen.tsx'
import { QuestionsScreen } from './screens/QuestionsScreen.tsx'

function Shell() {
  const { ready, tab, cloud } = useData()

  if (!ready) {
    return (
      <div className="px-5 py-16 text-center text-sm text-muted">読み込み中</div>
    )
  }

  if (cloud === 'setup') {
    return <HouseholdSetup />
  }

  return (
    <div className="min-h-dvh pb-20">
      <Header />
      {tab === 'decisions' ? <DecisionsScreen /> : null}
      {tab === 'questions' ? <QuestionsScreen /> : null}
      {tab === 'ideas' ? <IdeasScreen /> : null}
      {tab === 'minutes' ? <MinutesScreen /> : null}
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
