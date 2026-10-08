import { useProgress } from "@react-three/drei"

export function LoadingOverlay() {
  const { active, progress, item } = useProgress()
  if (!active) return null
  const file = item?.split("/").pop() ?? ""
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-neutral-950/70 backdrop-blur-sm">
      <div className="w-72 space-y-3 text-center">
        <p className="text-sm tracking-wide text-white/90">3Dモデルとテクスチャを読み込んでいます</p>
        <div className="h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-amber-200 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="truncate text-xs text-white/50 tabular-nums">
          {Math.round(progress)}% ・ {file}
        </p>
      </div>
    </div>
  )
}
