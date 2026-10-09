import { Vector3 } from "three"
import raw from "../sceneData.json"
import type { Quality, ToneMap } from "./quality"

/** public/ 配下のファイル URL (サブパスや file 共有先でも動くよう base 相対) */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export type CeilingHeight = 2.5 | 2.7
export type CeilingColor = "wood" | "white"
export type KitchenColor = "black" | "white"
export type CurtainState = "open" | "closed"
export type DoorState = "closed" | "open"
export type TimeOfDay = "day" | "night"
export type ViewMode = "walk" | "pano"

export interface Settings {
  mode: ViewMode
  ceiling: CeilingHeight
  ceilColor: CeilingColor
  kitchen: KitchenColor
  curtain: CurtainState
  doors: DoorState
  time: TimeOfDay
  eye: "stand" | "sit"
  fov: number
  pano: string
  quality: Quality
  tone: ToneMap
}

export const EYE_HEIGHT = { stand: 1.5, sit: 1.15 } as const

type Rect4 = [number, number, number, number]

export interface DoorDef {
  name: string
  wall: "W" | "E" | "N"
  a0: number
  a1: number
  pocket: number[]
  room: string
}

interface Raw {
  P: {
    W: number
    D: number
    WALL: number
    SASH_A: [number, number]
    SASH_B: [number, number]
    PENINSULA: Rect4
    BACK: Rect4
    TABLE: [number, number, number]
    EAVE: number
    KITCHEN_FLOOR: Rect4
    COUNTER: [number, number, number, number, number]
    TV: [number, number]
    TILE: [number, number]
    SOFA: Rect4
    CHAISE_X: number
    COFFEE: Rect4
    /** ピアノ + ベンチの占有範囲 x0,x1,y0,y1 */
    PIANO: Rect4
  }
  cameras: Record<string, { loc: [number, number, number]; target: [number, number, number]; label: string }>
  panos: Record<string, { loc: [number, number, number]; label: string }>
  doors: DoorDef[]
  downlights: [number, number][]
  sun: { dir: [number, number, number] }
  /** Cycles で焼いた昼のライトマップ (scripts/export_gltf.py)。scale = PNG の 1.0 が表す放射輝度 */
  lightmap?: { scale: Record<string, number>; mats: string[]; probe: [number, number, number] }
}

export const DATA = raw as unknown as Raw
export const ROOM = { W: DATA.P.W, D: DATA.P.D }

/** Blender 座標 (x東 / y北 / z上) -> three.js (Y上) */
export function toThree(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, z, -y)
}

export const MODEL_URL: Record<CeilingHeight, string> = {
  2.5: asset("models/ldk_2500.glb"),
  2.7: asset("models/ldk_2700.glb"),
}

export function lightmapUrl(ceiling: CeilingHeight) {
  return asset(`lightmaps/ldk_${Math.round(ceiling * 1000)}.png`)
}

export function probeUrl(ceiling: CeilingHeight) {
  return asset(`lightmaps/probe_${Math.round(ceiling * 1000)}.hdr`)
}

/** 焼き込みライトマップがこの天井高で使えるか */
export function hasLightmap(ceiling: CeilingHeight) {
  return DATA.lightmap?.scale[String(Math.round(ceiling * 1000))] !== undefined
}

export function panoUrl(ceiling: CeilingHeight, color: CeilingColor, point: string) {
  return asset(`panos/${Math.round(ceiling * 1000)}_${color}_${point}.jpg`)
}
