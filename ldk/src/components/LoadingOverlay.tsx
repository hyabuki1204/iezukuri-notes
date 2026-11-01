import { useProgress } from "@react-three/drei"

/**
 * 読み込み中と、読み込み後に最初の 1 枚が描けるまで (シェーダーの準備・テクスチャの転送) を覆う。
 * 後者の間は画面が固まって真っ黒に見えるので、何をしているかを出しておく
 */
export function LoadingOverlay({ drawn }: { drawn: boolean }) {
  const { active, progress, item } = useProgress()
  if (!active && drawn) return null
  const file = item?.split("/").pop() ?? ""
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-neutral-950/70 backdrop-blur-sm">
      <div className="w-72 space-y-3 text-center">
        <p className="text-sm tracking-wide text-white/90">
          {active ? "3Dモデルとテクスチャを読み込んでいます" : "表示の準備をしています…"}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-amber-200 transition-[width] duration-300"
            style={{ width: `${active ? progress * 0.9 : 95}%` }}
          />
        </div>
        <p className="truncate text-xs text-white/50 tabular-nums">
          {active ? `${Math.round(progress)}% ・ ${file}` : "もう少しで表示されます"}
        </p>
      </div>
    </div>
  )
}
