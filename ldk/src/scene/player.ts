import { DATA, ROOM } from "./data"

const START = DATA.cameras.v2

/** プレイヤー状態 (Blender 座標系)。heading は +x から反時計回り [rad] */
export const player = {
  x: START.loc[0],
  y: START.loc[1],
  heading: Math.atan2(START.target[1] - START.loc[1], START.target[0] - START.loc[0]),
  pitch: -0.04,
}

export const input = {
  keys: new Set<string>(),
  /** 次のフレームまでに押された（離されたかもしれない）キー。短いタップでも 1 歩進めるため */
  taps: new Set<string>(),
  joy: { x: 0, y: 0 },
  look: { dx: 0, dy: 0 },
  /** オンデマンド描画の再開 (Canvas 内の invalidate を Player が登録する) */
  wake: () => {},
}

export const tour = { playing: false, t: 0, onStop: [] as (() => void)[] }

const RADIUS = 0.22

type Rect = [number, number, number, number]
type Circle = [number, number, number]

const [sx0, sx1, sy0, sy1] = DATA.P.SOFA
const [c0, c1, cy0, cy1] = DATA.P.COUNTER
const [ocx, ocy, , ory] = DATA.P.COFFEE

const RECTS: Rect[] = [
  DATA.P.BACK,
  DATA.P.PENINSULA,
  [sx0, sx1, sy0, sy1],
  [sx1, DATA.P.CHAISE_X, sy1 - 0.95, sy1],
  [c0, c1, cy0, cy1],
  DATA.P.PIANO,
]
const CIRCLES: Circle[] = [
  [DATA.P.TABLE[0], DATA.P.TABLE[1], DATA.P.TABLE[2] + 0.38],
  [ocx, ocy - ory * 0.45, 0.4],
  [ocx, ocy + ory * 0.45, 0.4],
  [6.62, 3.95, 0.3],
  [4.0, 0.4, 0.3],
  [6.68, 0.34, 0.18],
  [0.62, (cy0 + cy1) / 2, 0.28],
]

export const OBSTACLES = { rects: RECTS, circles: CIRCLES }

export function blocked(x: number, y: number): boolean {
  const m = 0.18
  if (x < m || x > ROOM.W - m || y < m || y > ROOM.D - m) return true
  for (const [x0, x1, y0, y1] of RECTS) {
    if (x > x0 - RADIUS && x < x1 + RADIUS && y > y0 - RADIUS && y < y1 + RADIUS) return true
  }
  for (const [cx, cy, r] of CIRCLES) {
    if ((x - cx) ** 2 + (y - cy) ** 2 < (r + RADIUS) ** 2) return true
  }
  return false
}

export function moveBy(dx: number, dy: number) {
  if (!blocked(player.x + dx, player.y)) player.x += dx
  if (!blocked(player.x, player.y + dy)) player.y += dy
}

export function teleport(x: number, y: number, heading?: number) {
  if (blocked(x, y)) return false
  player.x = x
  player.y = y
  if (heading !== undefined) player.heading = heading
  input.wake()
  return true
}

export function jumpToPreset(key: string) {
  const c = DATA.cameras[key]
  player.x = c.loc[0]
  player.y = c.loc[1]
  player.heading = Math.atan2(c.target[1] - c.loc[1], c.target[0] - c.loc[0])
  player.pitch = -0.04
  input.wake()
}
