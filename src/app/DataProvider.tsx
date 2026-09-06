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
import { isSupabaseConfigured } from '../storage/config.ts'
import {
  isHouseholdId,
  readHouseholdId,
  writeHouseholdId,
} from '../storage/household.ts'
import { LocalStore } from '../storage/local.ts'
import {
  SupabaseStore,
  ensureHousehold,
  householdExists,
} from '../storage/supabase.ts'
import { emptyAppData, type AppData } from '../storage/types.ts'

export type Tab = 'decisions' | 'questions' | 'ideas' | 'minutes'
export type CloudStatus = 'local' | 'setup' | 'connected' | 'error'

type DataContextValue = {
  data: AppData
  ready: boolean
  tab: Tab
  setTab: (tab: Tab) => void
  update: (fn: (data: AppData) => AppData) => void
  replace: (data: AppData) => void
  householdId: string | null
  cloud: CloudStatus
  cloudMessage: string | null
  startHousehold: () => Promise<void>
  joinHousehold: (id: string) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)
const local = new LocalStore()

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyAppData)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('decisions')
  const [householdId, setHouseholdId] = useState<string | null>(null)
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

  const attachRemote = useCallback(
    (id: string, store: SupabaseStore) => {
      remoteRef.current?.unsubscribe()
      remoteRef.current = store
      writeHouseholdId(id)
      setHouseholdId(id)
      setCloud('connected')
      setCloudMessage(null)
      return store.subscribe((incoming) => {
        setData(incoming)
        void local.save(incoming)
      })
    },
    [],
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

      const existing = readHouseholdId()
      if (!existing) {
        setData(cached)
        setCloud('setup')
        setReady(true)
        return
      }

      try {
        const remote = new SupabaseStore(existing)
        const loaded = await remote.load()
        const next = isEmptyData(loaded)
          ? isEmptyData(cached)
            ? seedData()
            : cached
          : loaded
        if (isEmptyData(loaded)) await remote.save(next)
        setData(next)
        await local.save(next)
        unsubscribe = attachRemote(existing, remote)
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
  }, [attachRemote])

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

  const startHousehold = useCallback(async () => {
    const id = crypto.randomUUID()
    await ensureHousehold(id)
    const cached = await local.load()
    const next = isEmptyData(cached) ? seedData() : cached
    const remote = new SupabaseStore(id)
    await remote.save(next)
    setData(next)
    await local.save(next)
    attachRemote(id, remote)
  }, [attachRemote])

  const joinHousehold = useCallback(
    async (raw: string) => {
      const id = raw.trim()
      if (!isHouseholdId(id)) {
        throw new Error('世帯コードの形が違います')
      }
      const exists = await householdExists(id)
      if (!exists) throw new Error('その世帯コードは見つかりません')
      const remote = new SupabaseStore(id)
      const loaded = await remote.load()
      setData(loaded)
      await local.save(loaded)
      attachRemote(id, remote)
    },
    [attachRemote],
  )

  const value = useMemo(
    () => ({
      data,
      ready,
      tab,
      setTab,
      update,
      replace,
      householdId,
      cloud,
      cloudMessage,
      startHousehold,
      joinHousehold,
    }),
    [
      data,
      ready,
      tab,
      update,
      replace,
      householdId,
      cloud,
      cloudMessage,
      startHousehold,
      joinHousehold,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used within DataProvider')
  return value
}
