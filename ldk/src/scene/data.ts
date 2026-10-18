import { Vector3 } from "three"
import raw from "../sceneData.json"
import type { Quality, ToneMap } from "./quality"

/** public/ 配下のファイル URL (サブパスや file 共有先でも動くよう base 相対) */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export type CeilingHeight = 2.5 | 2.7
export type CeilingColor = "wood" | "white"
export type KitchenColor = "soil" | "black" | "gray" | "white"
/** ワークトップ。match = 本体と同じ仕上げ、genshou = グラリオ玄昌ブラック、mikage = グラリオ御影ブラック */
export type CounterTop = "match" | "genshou" | "mikage"
/** キッチンボード (ペニンシュラが接する北壁のキッチンパネル)。match = キッチン本体と同じ、none = 壁クロスのまま */
export type BoardColor = "stonegray" | "match" | "none"
export type CurtainState = "open" | "closed"
export type DoorState = "closed" | "open"
/** パネルの一括開閉に対する、建具ごとの上書き。キーはメッシュ名の「扉」まで */
export type DoorOverride = Partial<Record<string, DoorState>>

/** 開き戸・ハイドアのメッシュから建具 ID を取る。折れ戸は含まない。 */
export function doorLeaf(name: string): { id: string; open: boolean } | null {
  const m = /^(.*扉)_(閉|開)/.exec(name)
  if (!m || m[1] === undefined || m[2] === undefined) return null
  return { id: m[1], open: m[2] === "開" }
}
export type TimeOfDay = "day" | "night"
export type LightState = "on" | "off"
export type ViewMode = "walk" | "pano"

export interface Settings {
  mode: ViewMode
  ceiling: CeilingHeight
  ceilColor: CeilingColor
  kitchen: KitchenColor
  counter: CounterTop
  board: BoardColor
  curtain: CurtainState
  doors: DoorState
  time: TimeOfDay
  lights: LightState
  eye: "stand" | "sit"
  fov: number
  pano: string
  quality: Quality
  tone: ToneMap
  /** 静止時のパストレース */
  pt: "on" | "off"
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

export interface SwingDoor {
  name: string
  room: string
  x0: number
  x1: number
  wy0: number
  wy1: number
  hinge: number
  into: number
}

/** ホールと子ども部屋。LDK 側はハイドア、部屋への入口は通常高の開き戸 */
export interface KidsWing {
  x0: number
  x1: number
  y1: number
  /** 19 の南内壁。LDK 南面 (y=0) より南 */
  south?: number
  shell: number
  hall: [number, number, number, number]
  door_h: number
  win19: [number, number, number, number]
  win17: [number, number, number, number]
  swings: SwingDoor[]
  closets?: { name: string; x0: number; x1: number; y0: number; y1: number; face: number }[]
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
    EXT_WALL: number
    DECK: number
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
  kids?: KidsWing
  /** インターホン・スイッチ・給湯/床暖房リモコンをまとめた凹み壁 (a: 壁に沿う座標 / z: 床からの高さ) */
  remoteNiche?: { wall: "W" | "E" | "N"; a0: number; a1: number; z0: number; z1: number; depth: number }
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

/** スマホ・タブレット。iOS Safari は GPU メモリが上限を超えるとページごと落ちるので、テクスチャを軽くする */
export const MOBILE = matchMedia("(pointer: coarse)").matches

export function lightmapUrl(ceiling: CeilingHeight) {
  return asset(`lightmaps/ldk_${Math.round(ceiling * 1000)}${MOBILE ? "_1k" : ""}.png`)
}

export function probeUrl(ceiling: CeilingHeight) {
  return asset(`lightmaps/probe_${Math.round(ceiling * 1000)}.hdr`)
}

/** 焼き込みライトマップがこの天井高で使えるか */
export function hasLightmap(ceiling: CeilingHeight) {
  return DATA.lightmap?.scale[String(Math.round(ceiling * 1000))] !== undefined
}

export function panoUrl(ceiling: CeilingHeight, color: CeilingColor, point: string) {
  return asset(`panos/${Math.round(ceiling * 1000)}_${color}_${point}${MOBILE ? "_m" : ""}.jpg`)
}
