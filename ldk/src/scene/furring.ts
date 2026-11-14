import {
  BoxGeometry,
  BufferAttribute,
  Color,
  Group,
  Matrix3,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
} from "three"
import { NICHE, toThree } from "./data"
import { applyWorldUV, type MaterialLib } from "./materials"

/**
 * TV 裏のふかし壁とニッチ (表示切替用)。東壁 (Blender x=7.0) の前に厚み NICHE.furring の壁を足し、
 * 大判タイルをその前面へ移して、ニッチの開口を避けて貼り直す。
 *
 * 焼き込みライトマップは元のタイル面・東壁面のものを y・高さで写して使う (ふかした分の影のずれは許容)。
 * ニッチ内部とホール扉の枠の延長は焼き込みなし (環境光と直接光だけ)
 */
const X_WALL = 7.0
/** 元のタイルの厚み (x=6.98〜7.0) */
const TILE_T = 0.02
/** ニッチ内装の板厚 (開口の外側に置くので、内法は NICHE の寸法どおり) */
const LINER_T = 0.01
/** 下端の木の見切りの見付け */
const SILL_T = 0.02

const NICHE_GRAY = new Color().setRGB(0.32, 0.32, 0.31)

export interface FurringPart {
  mesh: Mesh
  base: Material
  name: string
  lightmapped: boolean
}

export interface Furring {
  group: Group
  /** 元の大判タイル。ふかし壁を出している間は隠す */
  tile: Mesh
  /** 焼き込みマテリアルへの切り替えが要る部材 */
  parts: FurringPart[]
  /** TV を支えるアーム金具 (TV の位置に合わせて動かす) */
  arm: Mesh
}

type Uv1Fit = (y: number, z: number) => [number, number]

/** x=planeX の -x 向きの面の頂点から、ライトマップ UV (uv1) を three の (y, z) の一次式で近似する */
function fitUv1(mesh: Mesh, planeX: number): Uv1Fit | undefined {
  const g = mesh.geometry
  const pos = g.getAttribute("position")
  const nor = g.getAttribute("normal")
  const uv1 = g.getAttribute("uv1")
  if (!pos || !nor || !uv1) return undefined
  mesh.updateWorldMatrix(true, false)
  const p = new Vector3()
  // 正規方程式 (A^T A) c = A^T b、A の行 = [y, z, 1]
  const ata = new Array(9).fill(0)
  const atu = [0, 0, 0]
  const atv = [0, 0, 0]
  let n = 0
  for (let i = 0; i < pos.count; i++) {
    if (nor.getX(i) > -0.9) continue
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    if (Math.abs(p.x - planeX) > 1e-3) continue
    const row = [p.y, p.z, 1]
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) ata[a * 3 + b] += row[a] * row[b]
      atu[a] += row[a] * uv1.getX(i)
      atv[a] += row[a] * uv1.getY(i)
    }
    n++
  }
  if (n < 3) return undefined
  const inv = new Matrix3().fromArray(ata).invert()
  const e = inv.elements
  const solve = (r: number[]) => [0, 1, 2].map((k) => e[k] * r[0] + e[k + 3] * r[1] + e[k + 6] * r[2])
  const cu = solve(atu)
  const cv = solve(atv)
  if (![...cu, ...cv].every(Number.isFinite)) return undefined
  return (y, z) => [cu[0] * y + cu[1] * z + cu[2], cv[0] * y + cv[1] * z + cv[2]]
}

/** Blender 座標の範囲 (x0..x1, y0..y1, 高さ z0..z1) の箱 */
function box(name: string, mat: Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const mesh = new Mesh(new BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat)
  mesh.name = name
  mesh.position.copy(toThree((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

function setUv1(mesh: Mesh, fit: Uv1Fit) {
  mesh.updateWorldMatrix(true, false)
  const pos = mesh.geometry.getAttribute("position")
  const uv1 = new Float32Array(pos.count * 2)
  const p = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    const [u, v] = fit(p.y, p.z)
    uv1[i * 2] = u
    uv1[i * 2 + 1] = v
  }
  mesh.geometry.setAttribute("uv1", new BufferAttribute(uv1, 2))
}

/** prepare() の後 (uv1 が揃った状態)、部材をまとめる前に呼ぶ */
export function buildFurring(root: Object3D, lib: MaterialLib): Furring | undefined {
  let tile: Mesh | undefined
  let wall: Mesh | undefined
  let frame: Mesh | undefined
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    if (m.name === "TV壁_大判タイル") tile = m
    else if (m.name === "東壁0") wall = m
    else if (m.name === "子ども部屋ホール扉_枠_戸当り") frame = m
  })
  if (!tile || !wall) return undefined
  const tileFit = fitUv1(tile, X_WALL - TILE_T)
  const wallFit = fitUv1(wall, X_WALL)
  if (!tile.geometry.boundingBox) tile.geometry.computeBoundingBox()
  const tb = tile.geometry.boundingBox!
  // タイルの範囲 (Blender y = -three z)。高さは天井まで
  const ty0 = -tb.max.z
  const ty1 = -tb.min.z
  const top = tb.max.y

  const group = new Group()
  group.name = "ふかし壁"
  const parts: FurringPart[] = []
  const add = (mesh: Mesh, lightmapped: boolean, uv?: "plan" | "vertical", fit?: Uv1Fit) => {
    group.add(mesh)
    if (uv) applyWorldUV(mesh, uv)
    if (lightmapped && fit) setUv1(mesh, fit)
    parts.push({ mesh, base: mesh.material as Material, name: (mesh.material as Material).name, lightmapped: lightmapped && !!fit })
  }

  const face = X_WALL - NICHE.furring
  const tx0 = face - TILE_T
  const ny0 = NICHE.y - NICHE.w / 2
  const ny1 = NICHE.y + NICHE.w / 2
  const nz0 = NICHE.z - NICHE.h / 2
  const nz1 = NICHE.z + NICHE.h / 2
  const back = face + NICHE.depth

  // 大判タイル: ニッチの開口を避けて 4 枚。下端は木の見切りのぶん下げる
  const tileMat = tile.material as Material
  const tiles: [number, number, number, number][] = [
    [ty0, ny0, 0, top],
    [ny1, ty1, 0, top],
    [ny0, ny1, 0, nz0 - SILL_T],
    [ny0, ny1, nz1, top],
  ]
  for (const [y0, y1, z0, z1] of tiles) add(box("ふかし壁_タイル", tileMat, tx0, face, y0, y1, z0, z1), true, "plan", tileFit)

  // タイルの北端からホール扉の枠までのふかし壁 (クロス)
  if (NICHE.y1 > ty1) add(box("ふかし壁_クロス", wall.material as Material, tx0, X_WALL, ty1, NICHE.y1, 0, top), true, "plan", wallFit)
  // ニッチ内装 (グレー)。開口の外側に貼るので内法は NICHE の寸法どおり
  const gray = new MeshStandardMaterial({ name: "ニッチ_グレー", color: NICHE_GRAY, roughness: 0.85 })
  add(box("ニッチ_奥", gray, back - LINER_T, back, ny0, ny1, nz0, nz1), false)
  add(box("ニッチ_南", gray, tx0, back, ny0 - LINER_T, ny0, nz0, nz1), false)
  add(box("ニッチ_北", gray, tx0, back, ny1, ny1 + LINER_T, nz0, nz1), false)
  add(box("ニッチ_天", gray, tx0, back, ny0 - LINER_T, ny1 + LINER_T, nz1, nz1 + LINER_T), false)
  // 下端は木の見切り (前面に見付け SILL_T が出る)
  const oak = lib.byName["開き戸_オーク"] ?? gray
  add(box("ニッチ_見切り", oak, tx0, back, ny0 - LINER_T, ny1 + LINER_T, nz0 - SILL_T, nz0), false, "vertical")

  // ホール扉の枠: ふかしたぶん見込みを深く見せる
  if (frame) {
    if (!frame.geometry.boundingBox) frame.geometry.computeBoundingBox()
    const fb = frame.geometry.boundingBox!
    add(box("ふかし壁_扉枠", frame.material as Material, face - TILE_T, X_WALL, -fb.max.z, -fb.min.z, fb.min.y, fb.max.y), false, "vertical")
  }

  // アーム金具 (TV 背面とニッチの奥をつなぐ)。位置は TV に合わせて placeArm で動かす
  const steel = lib.byName["黒スチール"] ?? gray
  const armLen = back - (tx0 - NICHE.standoff)
  const arm = new Mesh(new BoxGeometry(armLen, 0.2, 0.24), steel)
  arm.name = "TV_アーム"
  arm.castShadow = arm.receiveShadow = true
  group.add(arm)

  group.visible = false
  return { group, tile, parts, arm }
}

/** TV の背面をふかし壁の前面 (タイル面) から standoff 浮かせるための x 方向の移動量 */
export const TV_SHIFT = -(NICHE.furring + NICHE.standoff)

/** アーム金具を TV の中心 (Blender y, 高さ z) の後ろへ */
export function placeArm(arm: Mesh, y: number, z: number) {
  const face = X_WALL - NICHE.furring - TILE_T
  const back = X_WALL - NICHE.furring + NICHE.depth
  arm.position.copy(toThree((face - NICHE.standoff + back) / 2, y, z))
}
