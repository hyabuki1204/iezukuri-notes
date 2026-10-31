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
import {
  clearUnsynced,
  hasUnsynced,
  markUnsynced,
  resolveConnect,
} from '../storage/unsynced.ts'

export type Tab = 'decisions' | 'questions' | 'ideas' | 'minutes' | 'docs'
export type CloudStatus = 'local' | 'connected' | 'error'
export type DecisionFilter = 'all' | 'undecided' | 'undrawn'

export type Jump = {
  tab: Tab
  filter?: DecisionFilter
  urgent?: boolean
  openId?: string
  view?: 'questions' | 'todos' | 'prep'
}

type DataContextValue = {
  data: AppData
  ready: boolean
  tab: Tab
  setTab: (tab: Tab) => void
  go: (intent: Jump) => void
  jump: Jump | null
  consumeJump: () => void
  update: (fn: (data: AppData) => AppData) => void
  replace: (data: AppData) => void
  cloud: CloudStatus
  cloudMessage: string | null
  unsynced: boolean
  retry: () => void
}

const DataContext = createContext<DataContextValue | null>(null)
const local = new LocalStore()

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyAppData)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('decisions')
  const [jump, setJump] = useState<Jump | null>(null)
  const [cloud, setCloud] = useState<CloudStatus>('local')
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const [unsynced, setUnsynced] = useState(hasUnsynced)
  const remoteRef = useRef<SupabaseStore | null>(null)
  const remoteTimer = useRef<number>(0)
  const latestRef = useRef<AppData>(data)
  const unsubscribeRef = useRef<() => void>(() => {})
  const connectingRef = useRef(false)

  const failRemote = useCallback((error: unknown, fallback: string) => {
    markUnsynced()
    setUnsynced(true)
    setCloud('error')
    setCloudMessage(error instanceof Error ? error.message : fallback)
  }, [])

  const saveRemote = useCallback(
    (remote: SupabaseStore, next: AppData) => {
      void remote
        .save(next)
        .then(() => {
          if (latestRef.current === next) {
            clearUnsynced()
            setUnsynced(false)
          }
          setCloud('connected')
          setCloudMessage(null)
        })
        .catch((error: unknown) => failRemote(error, '同期に失敗'))
    },
    [failRemote],
  )

  const persist = useCallback(
    (next: AppData, immediate = false) => {
      latestRef.current = next
      void local.save(next)
      if (!isSupabaseConfigured()) return
      markUnsynced()
      setUnsynced(true)
      const remote = remoteRef.current
      if (!remote) return
      window.clearTimeout(remoteTimer.current)
      if (immediate) {
        saveRemote(remote, next)
        return
      }
      remoteTimer.current = window.setTimeout(() => saveRemote(remote, next), 400)
    },
    [saveRemote],
  )

  // クラウドに繋ぐ。繋がらない間に端末で入力した分は、クラウドに重ねてから送る。
  const connect = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured() || connectingRef.current) return
    connectingRef.current = true
    try {
      await ensureHousehold(HOUSEHOLD_ID)
      const remote = new SupabaseStore(HOUSEHOLD_ID)
      const loaded = await remote.load()
      const cached = latestRef.current
      const next = resolveConnect(loaded, cached, hasUnsynced(), seedData)
      if (next !== loaded) await remote.save(next)
      clearUnsynced()
      setUnsynced(false)
      latestRef.current = next
      setData(next)
      await local.save(next)
      unsubscribeRef.current()
      remoteRef.current?.unsubscribe()
      remoteRef.current = remote
      try {
        unsubscribeRef.current = remote.subscribe((incoming) => {
          if (hasUnsynced()) return
          latestRef.current = incoming
          setData(incoming)
          void local.save(incoming)
        })
      } catch {
        unsubscribeRef.current = () => {}
      }
      setCloud('connected')
      setCloudMessage(null)
    } catch (error: unknown) {
      setCloud('error')
      setCloudMessage(
        error instanceof Error ? error.message : 'クラウドに繋がらない',
      )
    } finally {
      connectingRef.current = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    async function boot() {
      const cached = await local.load()
      const start = isEmptyData(cached)
        ? { ...seedData(), lists: cached.lists }
        : cached
      if (isEmptyData(cached) && !isSupabaseConfigured()) await local.save(start)
      if (!alive) return
      latestRef.current = isSupabaseConfigured() ? cached : start
      if (!isSupabaseConfigured()) {
        setData(start)
        setCloud('local')
        setReady(true)
        return
      }
      await connect()
      if (!alive) return
      // 繋がらなかった時は端末の内容で開く
      if (!remoteRef.current) {
        latestRef.current = start
        setData(start)
      }
      setReady(true)
    }
    void boot()
    return () => {
      alive = false
      unsubscribeRef.current()
      remoteRef.current?.unsubscribe()
      window.clearTimeout(remoteTimer.current)
    }
  }, [connect])

  // 繋がらない間は自動で繋ぎ直す（30秒ごと・画面に戻った時・電波が戻った時）
  useEffect(() => {
    if (cloud !== 'error') return
    const retry = () => {
      if (document.visibilityState === 'visible') void connect()
    }
    const timer = window.setInterval(retry, 30000)
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [cloud, connect])

  const retry = useCallback(() => {
    void connect()
  }, [connect])

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

  const go = useCallback((intent: Jump) => {
    setTab(intent.tab)
    if (intent.filter || intent.urgent || intent.openId || intent.view) {
      setJump(intent)
    } else {
      setJump(null)
    }
  }, [])

  const consumeJump = useCallback(() => {
    setJump(null)
  }, [])

  const value = useMemo(
    () => ({
      data,
      ready,
      tab,
      setTab,
      go,
      jump,
      consumeJump,
      update,
      replace,
      cloud,
      cloudMessage,
      unsynced,
      retry,
    }),
    [
      data,
      ready,
      tab,
      go,
      jump,
      consumeJump,
      update,
      replace,
      cloud,
      cloudMessage,
      unsynced,
      retry,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used within DataProvider')
  return value
}
