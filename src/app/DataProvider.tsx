import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { isEmptyData, seedData } from '../seed.ts'
import { HOUSEHOLD_ID, isSupabaseConfigured } from '../storage/config.ts'
import { LocalStore } from '../storage/local.ts'
import { SupabaseStore, ensureHousehold } from '../storage/supabase.ts'
import { emptyAppData, type AppData } from '../storage/types.ts'

export type Tab = 'decisions' | 'questions' | 'ideas' | 'minutes' | 'docs'
export type CloudStatus = 'local' | 'connected' | 'error'

type DataContextValue = {
  data: AppData
  ready: boolean
  tab: Tab
  setTab: (tab: Tab) => void
  update: (fn: (data: AppData) => AppData) => void
  replace: (data: AppData) => void
  cloud: CloudStatus
  cloudMessage: string | null
}

const DataContext = createContext<DataContextValue | null>(null)
const local = new LocalStore()

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyAppData)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('decisions')
  const [cloud, setCloud] = useState<CloudStatus>('local')
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const remoteRef = useRef<SupabaseStore | null>(null)
  const remoteTimer = useRef<number>(0)

  const persistRemote = useCallback((next: AppData) => {
    const remote = remoteRef.current
    if (!remote) return
    window.clearTimeout(remoteTimer.current)
    remoteTimer.current = window.setTimeout(() => {
      void remote.save(next).catch((error: unknown) => {
        setCloud('error')
        setCloudMessage(error instanceof Error ? error.message : '同期に失敗')
      })
    }, 400)
  }, [])

  const persist = useCallback(
    (next: AppData, immediate = false) => {
      void local.save(next)
      if (immediate) {
        window.clearTimeout(remoteTimer.current)
        const remote = remoteRef.current
        if (remote) {
          void remote.save(next).catch((error: unknown) => {
            setCloud('error')
            setCloudMessage(
              error instanceof Error ? error.message : '同期に失敗',
            )
          })
        }
        return
      }
      persistRemote(next)
    },
    [persistRemote],
  )

  useEffect(() => {
    let unsubscribe = () => {}

    async function boot() {
      const cached = await local.load()
      if (!isSupabaseConfigured()) {
        const next = isEmptyData(cached) ? seedData() : cached
        if (isEmptyData(cached)) await local.save(next)
        setData(next)
        setCloud('local')
        setReady(true)
        return
      }

      try {
        await ensureHousehold(HOUSEHOLD_ID)
        const remote = new SupabaseStore(HOUSEHOLD_ID)
        const loaded = await remote.load()
        const next = isEmptyData(loaded)
          ? isEmptyData(cached)
            ? seedData()
            : cached
          : loaded
        if (isEmptyData(loaded)) await remote.save(next)
        setData(next)
        await local.save(next)
        remoteRef.current = remote
        try {
          unsubscribe = remote.subscribe((incoming) => {
            setData(incoming)
            void local.save(incoming)
          })
        } catch {
          unsubscribe = () => {}
        }
        setCloud('connected')
        setCloudMessage(null)
      } catch (error: unknown) {
        setData(isEmptyData(cached) ? seedData() : cached)
        setCloud('error')
        setCloudMessage(
          error instanceof Error ? error.message : 'クラウドに繋がらない',
        )
      }
      setReady(true)
    }

    void boot()
    return () => {
      unsubscribe()
      remoteRef.current?.unsubscribe()
      window.clearTimeout(remoteTimer.current)
    }
  }, [])

  const update = useCallback(
    (fn: (current: AppData) => AppData) => {
      setData((current) => {
        const next = fn(current)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const replace = useCallback(
    (next: AppData) => {
      setData(next)
      persist(next, true)
    },
    [persist],
  )

  const value = useMemo(
    () => ({
      data,
      ready,
      tab,
      setTab,
      update,
      replace,
      cloud,
      cloudMessage,
    }),
    [data, ready, tab, update, replace, cloud, cloudMessage],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used within DataProvider')
  return value
}
