import { Sparkles } from "lucide-react"
import { usePtStatus } from "@/scene/ptStatus"

/** 静止時パストレースの進み具合 */
export function PtBadge() {
  const st = usePtStatus()
  if (st.phase !== "tracing" && st.phase !== "done") return null
  const pct = Math.round((st.samples / st.max) * 100)
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 md:bottom-5">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur-md">
        <Sparkles className="size-3.5 text-amber-200" />
        {st.phase === "done" ? "フォトリアル表示" : `フォトリアル描画中 ${pct}%`}
        {st.phase === "tracing" && (
          <span className="h-1 w-16 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full bg-amber-200/90" style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>
    </div>
  )
}
