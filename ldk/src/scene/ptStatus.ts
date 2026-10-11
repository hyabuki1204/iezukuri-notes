import { useSyncExternalStore } from "react"

export type PtPhase = "off" | "waiting" | "tracing" | "done"

type Listener = () => void

interface PtState {
  phase: PtPhase
  samples: number
  max: number
  /** 描画結果が画面を完全に覆っている (このあいだ通常のポストエフェクト描画を止める) */
  covering: boolean
}

const listeners = new Set<Listener>()

/** パストレースの進み具合 (React の外から更新し、UI は購読して表示する) */
export const ptStatus: PtState & { set(patch: Partial<PtState>): void; subscribe(f: Listener): () => void } = {
  phase: "off",
  samples: 0,
  max: 1,
  covering: false,
  set(patch) {
    let changed = false
    for (const k of Object.keys(patch) as (keyof PtState)[]) {
      if (ptStatus[k] !== patch[k]) {
        Object.assign(ptStatus, { [k]: patch[k] })
        changed = true
      }
    }
    if (changed) for (const f of listeners) f()
  },
  subscribe(f) {
    listeners.add(f)
    return () => listeners.delete(f)
  },
}

export function usePtStatus() {
  useSyncExternalStore(ptStatus.subscribe, () => `${ptStatus.phase}|${ptStatus.samples}|${ptStatus.covering}`)
  return ptStatus
}
