import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { DATA, ROOM, type ViewMode } from "@/scene/data"
import { player, teleport } from "@/scene/player"

const PAD = 0.45
const VB_W = ROOM.W + PAD * 2
const VB_H = ROOM.D + PAD * 2 + 0.4
/** Blender (x東, y北) -> SVG (北が上) */
const sx = (x: number) => x + PAD
const sy = (y: number) => ROOM.D + PAD - y

function Rect({ r, className }: { r: [number, number, number, number]; className?: string }) {
  const [x0, x1, y0, y1] = r
  return <rect x={sx(x0)} y={sy(y1)} width={x1 - x0} height={y1 - y0} className={className} />
}

function doorLine(d: (typeof DATA.doors)[number]) {
  const T = DATA.P.WALL
  if (d.wall === "W") return { x1: sx(-T / 2), y1: sy(d.a0), x2: sx(-T / 2), y2: sy(d.a1) }
  if (d.wall === "E") return { x1: sx(ROOM.W + T / 2), y1: sy(d.a0), x2: sx(ROOM.W + T / 2), y2: sy(d.a1) }
  return { x1: sx(d.a0), y1: sy(ROOM.D + T / 2), x2: sx(d.a1), y2: sy(ROOM.D + T / 2) }
}

interface Props {
  mode: ViewMode
  pano: string
  onPano: (key: string) => void
  className?: string
}

export function Minimap({ mode, pano, onPano, className }: Props) {
  const arrow = useRef<SVGGElement>(null)
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = mode === "pano" ? DATA.panos[pano]?.loc ?? [player.x, player.y] : [player.x, player.y]
      const deg = (-player.heading * 180) / Math.PI
      arrow.current?.setAttribute("transform", `translate(${sx(p[0])} ${sy(p[1])}) rotate(${deg})`)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [mode, pano])

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const el = svg.current
    if (!el) return
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = el.getScreenCTM()
    if (!m) return
    const q = pt.matrixTransform(m.inverse())
    const x = q.x - PAD
    const y = ROOM.D + PAD - q.y
    if (mode === "pano") {
      let best = ""
      let bd = Infinity
      for (const [k, v] of Object.entries(DATA.panos)) {
        const d = (v.loc[0] - x) ** 2 + (v.loc[1] - y) ** 2
        if (d < bd) {
          bd = d
          best = k
        }
      }
      if (best) onPano(best)
    } else {
      teleport(x, y)
    }
  }

  const [sa0, sa1] = DATA.P.SASH_A
  const [sb0, sb1] = DATA.P.SASH_B
  const [tx, ty, tr] = DATA.P.TABLE
  const [sf0, sf1, sfy0, sfy1] = DATA.P.SOFA
  const [ocx, ocy, orx, ory] = DATA.P.COFFEE
  const [c0, c1, cy0, cy1] = DATA.P.COUNTER
  const [tvy] = DATA.P.TV

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      onClick={onClick}
      className={cn("cursor-crosshair select-none", className)}
      role="img"
      aria-label="LDK 平面図（クリックで移動）"
    >
      <rect x={0} y={0} width={VB_W} height={VB_H} className="fill-transparent" />
      <rect x={sx(0)} y={sy(ROOM.D)} width={ROOM.W} height={ROOM.D} className="fill-white/[0.04] stroke-white/70" strokeWidth={0.12} />
      <Rect r={DATA.P.KITCHEN_FLOOR} className="fill-white/10" />
      <Rect r={DATA.P.PENINSULA} className="fill-white/35" />
      <Rect r={DATA.P.BACK} className="fill-white/35" />
      <Rect r={[c0, c1, cy0, cy1]} className="fill-white/25" />
      <Rect r={[DATA.P.PIANO[0], DATA.P.PIANO[1], DATA.P.D - 0.61, DATA.P.D]} className="fill-white/35" />
      <circle cx={sx(tx)} cy={sy(ty)} r={tr} className="fill-white/25" />
      <Rect r={[sf0, sf1, sfy0, sfy1]} className="fill-white/25" />
      <Rect r={[sf1, DATA.P.CHAISE_X, sfy1 - 0.95, sfy1]} className="fill-white/25" />
      <ellipse cx={sx(ocx)} cy={sy(ocy)} rx={orx} ry={ory} className="fill-white/20" />
      <line x1={sx(ROOM.W - 0.05)} x2={sx(ROOM.W - 0.05)} y1={sy(tvy - 0.72)} y2={sy(tvy + 0.72)} className="stroke-white" strokeWidth={0.07} />
      {[[sa0, sa1], [sb0, sb1]].map(([a, b]) => (
        <line key={a} x1={sx(a)} x2={sx(b)} y1={sy(-0.08)} y2={sy(-0.08)} className="stroke-sky-300" strokeWidth={0.1} />
      ))}
      {DATA.doors.map((d) => (
        <line key={d.name} {...doorLine(d)} className="stroke-amber-200" strokeWidth={0.16} />
      ))}
      <text x={sx(ROOM.W / 2)} y={sy(-0.55)} textAnchor="middle" className="fill-white/50 text-[0.28px]">
        南（庭）
      </text>
      {mode === "pano" &&
        Object.entries(DATA.panos).map(([k, v], i) => (
          <g key={k} transform={`translate(${sx(v.loc[0])} ${sy(v.loc[1])})`}>
            <circle r={0.26} className={k === pano ? "fill-amber-300" : "fill-white/80"} />
            <text y={0.1} textAnchor="middle" className="fill-black text-[0.3px] font-semibold">
              {i + 1}
            </text>
          </g>
        ))}
      <g ref={arrow}>
        <path d="M0 0 L1.3 -0.7 A1.5 1.5 0 0 1 1.3 0.7 Z" className="fill-amber-300/25" />
        <circle r={0.16} className="fill-amber-300 stroke-black/60" strokeWidth={0.04} />
      </g>
    </svg>
  )
}
