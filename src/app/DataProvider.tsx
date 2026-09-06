import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isEmptyData, seedData } from '../seed.ts'
import { LocalStore } from '../storage/local.ts'
import { emptyAppData, type AppData } from '../storage/types.ts'

export type Tab = 'decisions' | 'questions' | 'ideas' | 'minutes'

type DataContextValue = {
  data: AppData
  ready: boolean
  tab: Tab
  setTab: (tab: Tab) => void
  update: (fn: (data: AppData) => AppData) => void
  replace: (data: AppData) => void
}

const DataContext = createContext<DataContextValue | null>(null)
const store = new LocalStore()

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyAppData)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('decisions')

  useEffect(() => {
    void store.load().then((loaded) => {
      const next = isEmptyData(loaded) ? seedData() : loaded
      if (isEmptyData(loaded)) void store.save(next)
      setData(next)
      setReady(true)
    })
  }, [])

  const update = useCallback((fn: (current: AppData) => AppData) => {
    setData((current) => {
      const next = fn(current)
      void store.save(next)
      return next
    })
  }, [])

  const replace = useCallback((next: AppData) => {
    setData(next)
    void store.save(next)
  }, [])

  const value = useMemo(
    () => ({ data, ready, tab, setTab, update, replace }),
    [data, ready, tab, update, replace],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used within DataProvider')
  return value
}
