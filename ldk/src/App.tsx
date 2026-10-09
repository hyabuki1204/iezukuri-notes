import { ChevronLeft, SlidersHorizontal, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ControlPanel } from "@/components/ControlPanel"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Joystick } from "@/components/Joystick"
import { LoadingOverlay } from "@/components/LoadingOverlay"
import { Minimap } from "@/components/Minimap"
import { Button } from "@/components/ui/button"
import { DATA, panoUrl, type Settings } from "@/scene/data"
import { input, jumpToPreset, player, tour } from "@/scene/player"
import { DEFAULT_QUALITY } from "@/scene/quality"
import { Viewer } from "@/scene/Viewer"

const DEFAULTS: Settings = {
  mode: "walk",
  ceiling: 2.5,
  ceilColor: "wood",
  kitchen: "black",
  curtain: "open",
  doors: "closed",
  time: "day",
  eye: "stand",
  fov: 68,
  pano: "p2",
  quality: DEFAULT_QUALITY,
  tone: "agx",
}

/** URL で条件を指定できる (例: ?ceiling=2.7&ceilColor=white&time=night&view=v3&panel=0&q=ultra&tone=aces) */
const QUERY = new URLSearchParams(location.search)

function initialSettings(): Settings {
  const s = { ...DEFAULTS }
  const pick = <K extends keyof Settings>(k: K, allowed: readonly Settings[K][]) => {
    const raw = QUERY.get(k)
    if (raw === null) return
    const v = (typeof DEFAULTS[k] === "number" ? Number(raw) : raw) as Settings[K]
    if (allowed.length === 0 || allowed.includes(v)) s[k] = v
  }
  pick("mode", ["walk", "pano"])
  pick("ceiling", [2.5, 2.7])
  pick("ceilColor", ["wood", "white"])
  pick("kitchen", ["black", "white"])
  pick("curtain", ["open", "closed"])
  pick("doors", ["open", "closed"])
  pick("time", ["day", "night"])
  pick("eye", ["stand", "sit"])
  pick("fov", [])
  pick("pano", Object.keys(DATA.panos))
  pick("quality", ["low", "medium", "ultra"])
  const q = QUERY.get("q")
  if (q === "low" || q === "medium" || q === "ultra") s.quality = q
  pick("tone", ["agx", "aces"])
  const view = QUERY.get("view")
  if (view && DATA.cameras[view]) {
    jumpToPreset(view)
    s.eye = DATA.cameras[view].loc[2] < 1.3 ? "sit" : "stand"
  }
  return s
}

const INITIAL = initialSettings()

/** iezukuri-notes に /ldk/ として組み込まれているときだけ、家づくりメモへ戻るリンクを出す */
const EMBEDDED = import.meta.env.BASE_URL === "/ldk/"

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => matchMedia("(pointer: coarse)").matches)
  useEffect(() => {
    const mq = matchMedia("(pointer: coarse)")
    const f = () => setCoarse(mq.matches)
    mq.addEventListener("change", f)
    return () => mq.removeEventListener("change", f)
  }, [])
  return coarse
}

/** 360°パノラマのレンダリング済み判定 (Vite は未存在パスに index.html を返すため Content-Type で判定) */
function usePanoAvailability(s: Settings) {
  const [avail, setAvail] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (s.mode !== "pano") return
    let alive = true
    const check = async () => {
      const entries = await Promise.all(
        Object.keys(DATA.panos).map(async (k) => {
          try {
            const r = await fetch(panoUrl(s.ceiling, s.ceilColor, k), { method: "HEAD", cache: "no-store" })
            return [k, r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")] as const
          } catch {
            return [k, false] as const
          }
        }),
      )
      if (alive) setAvail(Object.fromEntries(entries))
    }
    check()
    const id = setInterval(check, 20000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [s.mode, s.ceiling, s.ceilColor])
  return avail
}

export default function App() {
  const [s, setS] = useState<Settings>(INITIAL)
  const [touring, setTouring] = useState(false)
  const [panelOpen, setPanelOpen] = useState(
    () => QUERY.get("panel") !== "0" && matchMedia("(min-width: 768px)").matches,
  )
  const coarse = useCoarsePointer()
  const avail = usePanoAvailability(s)

  const set = useCallback((patch: Partial<Settings>) => setS((p) => ({ ...p, ...patch })), [])

  useEffect(() => {
    const f = () => setTouring(false)
    tour.onStop.push(f)
    return () => {
      tour.onStop = tour.onStop.filter((g) => g !== f)
    }
  }, [])

  const panoReady = s.mode !== "pano" || avail[s.pano] !== false
  useEffect(() => {
    if (s.mode !== "pano" || avail[s.pano] !== false) return
    const first = Object.keys(DATA.panos).find((k) => avail[k])
    if (first) set({ pano: first })
  }, [s.mode, s.pano, avail, set])

  const onTour = () => {
    if (tour.playing) {
      tour.playing = false
      setTouring(false)
      return
    }
    set({ mode: "walk", eye: "stand" })
    tour.t = 0
    tour.playing = true
    setTouring(true)
    input.wake()
  }

  const onPreset = (k: string) => {
    tour.playing = false
    setTouring(false)
    jumpToPreset(k)
    set({ eye: DATA.cameras[k].loc[2] < 1.3 ? "sit" : "stand" })
  }

  const onReset = () => onPreset("v2")

  const onPano = (k: string) => {
    if (avail[k] === false) return
    const p = DATA.panos[k].loc
    player.x = p[0]
    player.y = p[1]
    set({ pano: k })
  }

  const ceilingLabel = `天井高 ${s.ceiling === 2.5 ? "2,500" : "2,700"}mm ・ ${s.ceilColor === "wood" ? "木目" : "白"}天井`

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-950 text-white">
      <ErrorBoundary
        fallback={(e, reset) => (
          <div className="grid h-full place-items-center p-6">
            <div className="max-w-md space-y-3 text-center">
              <p className="text-base font-medium">3D 表示を開始できませんでした</p>
              <p className="text-sm text-white/60">
                WebGL2 に対応したブラウザ（Chrome / Edge / Safari 最新版）でお試しください。ハードウェアアクセラレーションが無効の場合も表示できません。
              </p>
              <p className="font-mono text-xs break-all text-white/40">{e.message}</p>
              <Button variant="outline" onClick={reset}>
                再読み込み
              </Button>
            </div>
          </div>
        )}
      >
        {panoReady ? (
          <Viewer s={s} />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-white/60">
            この条件の 360° パノラマはまだレンダリング中です。しばらくすると自動で表示されます。
          </div>
        )}
      </ErrorBoundary>
      <LoadingOverlay />

      <header className="pointer-events-none absolute top-0 left-0 max-w-[calc(100%-8.5rem)] p-3 md:max-w-none md:p-5">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md">
          {EMBEDDED && (
            <a href="/" className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white md:text-xs">
              <ChevronLeft className="size-3.5" /> 家づくりメモ
            </a>
          )}
          <h1 className="text-sm font-semibold tracking-wide md:text-base">LDK ウォークスルー</h1>
          <p className="mt-0.5 hidden text-[11px] text-white/55 sm:block md:text-xs">平屋 LDK 約25畳 ・ 南面ハイサッシ ・ 挽板フローリング</p>
          <p className="mt-2 inline-flex rounded-md bg-amber-200/90 px-2 py-0.5 text-[11px] font-medium text-neutral-950">{ceilingLabel}</p>
        </div>
      </header>

      <div className="absolute bottom-3 left-3 flex flex-col items-start gap-3 md:bottom-5 md:left-5">
        {coarse && s.mode === "walk" && <Joystick />}
        <div className="rounded-xl border border-white/10 bg-black/45 p-2 backdrop-blur-md">
          <Minimap mode={s.mode} pano={s.pano} onPano={onPano} className="block w-40 md:w-56" />
          <p className="px-1 pt-1 text-[10px] text-white/45">{s.mode === "pano" ? `番号を${coarse ? "タップ" : "クリック"}で地点移動` : `${coarse ? "タップ" : "クリック"}でその位置へ移動`}</p>
        </div>
      </div>

      <aside
        className={
          "absolute top-0 right-0 bottom-0 flex w-full max-w-[22rem] flex-col p-3 transition-transform duration-300 md:p-5 " +
          (panelOpen ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="relative flex max-h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/80 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-medium">表示条件</span>
            <Button size="icon-sm" variant="ghost" onClick={() => setPanelOpen(false)} aria-label="パネルを閉じる">
              <X />
            </Button>
          </div>
          <ControlPanel
            s={s}
            set={set}
            touring={touring}
            onTour={onTour}
            onPreset={onPreset}
            onReset={onReset}
            panoAvailable={avail}
            className="overflow-y-auto px-4 py-4"
          />
        </div>
      </aside>
      {!panelOpen && (
        <Button
          onClick={() => setPanelOpen(true)}
          className="absolute top-3 right-3 md:top-5 md:right-5"
          variant="secondary"
        >
          <SlidersHorizontal /> 表示条件
        </Button>
      )}
    </div>
  )
}
