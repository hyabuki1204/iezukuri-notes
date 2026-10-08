import { type BufferGeometry, type Mesh, type Object3D, Vector3 } from "three"

/**
 * 歩行用の占有グリッド (Blender 座標 x東 / y北)。
 * 表示中のモデルのうち、床上 BAND の高さにかかる三角形を平面に投影して塗り、
 * 人の半径ぶん太らせる。家具・壁・閉じた扉が実際の形どおりに当たりになる。
 */
const CELL = 0.04
const BAND: [number, number] = [0.1, 1.3]
const X0 = -2.6
const Y0 = -0.5
const NX = Math.ceil(12.2 / CELL)
const NY = Math.ceil(9.2 / CELL)

export interface Grid {
  cells: Uint8Array
}

const a = new Vector3()
const b = new Vector3()
const c = new Vector3()

function mark(raw: Uint8Array, x: number, y: number) {
  const i = Math.floor((x - X0) / CELL)
  const j = Math.floor((y - Y0) / CELL)
  if (i >= 0 && j >= 0 && i < NX && j < NY) raw[j * NX + i] = 1
}

function markEdge(raw: Uint8Array, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (CELL * 0.5)))
  for (let k = 0; k <= n; k++) mark(raw, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n)
}

/** three 座標の 3 頂点を平面 (x, y=-z) に投影して塗る。立ち上がった面は辺で塗られる */
function markTriangle(raw: Uint8Array) {
  const ax = a.x, ay = -a.z, bx = b.x, by = -b.z, cx = c.x, cy = -c.z
  markEdge(raw, ax, ay, bx, by)
  markEdge(raw, bx, by, cx, cy)
  markEdge(raw, cx, cy, ax, ay)
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  if (Math.abs(area) < CELL * CELL) return
  const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - X0) / CELL))
  const i1 = Math.min(NX - 1, Math.floor((Math.max(ax, bx, cx) - X0) / CELL))
  const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - Y0) / CELL))
  const j1 = Math.min(NY - 1, Math.floor((Math.max(ay, by, cy) - Y0) / CELL))
  for (let j = j0; j <= j1; j++) {
    const py = Y0 + (j + 0.5) * CELL
    for (let i = i0; i <= i1; i++) {
      const px = X0 + (i + 0.5) * CELL
      const w0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
      const w1 = (cx - bx) * (py - by) - (cy - by) * (px - bx)
      const w2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx)
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) raw[j * NX + i] = 1
    }
  }
}

function rasterize(raw: Uint8Array, mesh: Mesh) {
  const g = mesh.geometry as BufferGeometry
  const pos = g.getAttribute("position")
  if (!pos) return
  const idx = g.getIndex()
  const count = idx ? idx.count : pos.count
  const m = mesh.matrixWorld
  for (let t = 0; t + 2 < count; t += 3) {
    const i0 = idx ? idx.getX(t) : t
    const i1 = idx ? idx.getX(t + 1) : t + 1
    const i2 = idx ? idx.getX(t + 2) : t + 2
    a.fromBufferAttribute(pos, i0).applyMatrix4(m)
    b.fromBufferAttribute(pos, i1).applyMatrix4(m)
    c.fromBufferAttribute(pos, i2).applyMatrix4(m)
    if (Math.max(a.y, b.y, c.y) < BAND[0] || Math.min(a.y, b.y, c.y) > BAND[1]) continue
    markTriangle(raw)
  }
}

export function buildGrid(root: Object3D, radius: number): Grid {
  const raw = new Uint8Array(NX * NY)
  root.updateWorldMatrix(true, true)
  root.traverseVisible((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh) rasterize(raw, mesh)
  })
  const r = Math.ceil(radius / CELL)
  const offsets: number[] = []
  for (let dj = -r; dj <= r; dj++) {
    for (let di = -r; di <= r; di++) {
      if ((di * di + dj * dj) * CELL * CELL <= radius * radius) offsets.push(di, dj)
    }
  }
  const cells = new Uint8Array(NX * NY)
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      if (!raw[j * NX + i]) continue
      for (let k = 0; k < offsets.length; k += 2) {
        const ii = i + offsets[k]
        const jj = j + offsets[k + 1]
        if (ii >= 0 && jj >= 0 && ii < NX && jj < NY) cells[jj * NX + ii] = 1
      }
    }
  }
  return { cells }
}

export function gridBlocked(g: Grid, x: number, y: number): boolean {
  const i = Math.floor((x - X0) / CELL)
  const j = Math.floor((y - Y0) / CELL)
  if (i < 0 || j < 0 || i >= NX || j >= NY) return true
  return g.cells[j * NX + i] === 1
}
