import { useEffect, useRef, useState } from 'react'
import { DataProvider, useData } from './app/DataProvider.tsx'
import { Header } from './components/Header.tsx'
import { ListsEditor } from './components/ListsEditor.tsx'
import { TabBar } from './components/TabBar.tsx'
import { TrashScreen } from './components/TrashScreen.tsx'
import { keepPaths, removeAttachments } from './lib/files.ts'
import { expiredTrashIds, purgeFromTrash } from './lib/trash.ts'
import { DecisionsScreen } from './screens/DecisionsScreen.tsx'
import { IdeasScreen } from './screens/IdeasScreen.tsx'
import { DocsScreen } from './screens/DocsScreen.tsx'
import { MinutesScreen } from './screens/MinutesScreen.tsx'
import { QuestionsScreen } from './screens/QuestionsScreen.tsx'

function Shell() {
  const { ready, tab, data, update } = useData()
  const [editingLists, setEditingLists] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)

  // 30日を過ぎたゴミ箱の中身を完全に削除する（起動時に1回）
  const purgedRef = useRef(false)
  useEffect(() => {
    if (!ready || purgedRef.current) return
    purgedRef.current = true
    const expired = expiredTrashIds(data)
    if (expired.length === 0) return
    const { data: next, files } = purgeFromTrash(data, expired)
    update(() => next)
    void removeAttachments(files, keepPaths(next))
  }, [ready, data, update])

  if (!ready) {
    return (
      <div className="px-5 py-16 text-center text-sm text-muted">読み込み中</div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper pb-24 md:pb-0">
      <Header onEditLists={() => setEditingLists(true)} onOpenTrash={() => setTrashOpen(true)} />
      {trashOpen ? <TrashScreen onClose={() => setTrashOpen(false)} /> : null}
      {editingLists ? (
        <ListsEditor onClose={() => setEditingLists(false)} />
      ) : null}
      <main className="mx-auto w-full max-w-6xl">
        {tab === 'decisions' ? <DecisionsScreen /> : null}
        {tab === 'questions' ? <QuestionsScreen /> : null}
        {tab === 'ideas' ? <IdeasScreen /> : null}
        {tab === 'minutes' ? <MinutesScreen /> : null}
        {tab === 'docs' ? <DocsScreen /> : null}
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
