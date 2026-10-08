import type { Object3D } from "three"
import { buildGrid, type Grid, gridBlocked } from "./collision"
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

/** 体の半径 [m]。家具の間の 30cm 強の隙間まで通れる */
export const RADIUS = 0.15

let grid: Grid | null = null

/** 表示中のモデル (扉の開閉を反映済み) から当たりを作り直す */
export function setCollision(root: Object3D) {
  grid = buildGrid(root, RADIUS)
}

export function blocked(x: number, y: number): boolean {
  if (y < RADIUS) return true
  if (!grid) return x < RADIUS || x > ROOM.W - RADIUS || y > ROOM.D - RADIUS
  return gridBlocked(grid, x, y)
}

export function moveBy(dx: number, dy: number) {
  // 当たりの中から始まった場合 (ソファに座った視点など) は抜け出せるように止めない
  const stuck = blocked(player.x, player.y)
  if (stuck || !blocked(player.x + dx, player.y)) player.x += dx
  if (stuck || !blocked(player.x, player.y + dy)) player.y += dy
}

function nearestFree(x: number, y: number): [number, number] | null {
  if (!blocked(x, y)) return [x, y]
  for (let r = 0.04; r <= 0.6; r += 0.04) {
    for (let k = 0; k < 16; k++) {
      const t = (k / 16) * Math.PI * 2
      const px = x + Math.cos(t) * r
      const py = y + Math.sin(t) * r
      if (!blocked(px, py)) return [px, py]
    }
  }
  return null
}

export function teleport(tx: number, ty: number, heading?: number) {
  const free = nearestFree(tx, ty)
  if (!free) return false
  const [x, y] = free
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
