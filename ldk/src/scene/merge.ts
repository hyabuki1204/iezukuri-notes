import { type BufferGeometry, type Material, Matrix4, type Mesh, type Object3D } from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

/**
 * 同じマテリアルの動かない部材を 1 つのメッシュにまとめて、描画命令の数を減らす。
 * モデルは 700 近い部材に分かれていて、そのままだと 1 フレームで数千回の描画命令になり
 * スマホや内蔵 GPU の PC では歩くたびにカクつく。
 *
 * まとめないもの:
 * - 開閉・表示切替するもの (扉、カーテン) … keep(o) が true を返す祖先を持つ部材
 * - 透明なもの (ガラス・レース) … 奥行き順に並べ替えて描くため個別のまま
 */
export interface MergeSlot {
  mesh: Mesh
  base: Material
  /** 同じ base でも見た目の扱いが違うものは別のまとまりにする */
  key: string
}

export function mergeStatic<S extends MergeSlot>(
  root: Object3D,
  slots: S[],
  keep: (o: Object3D) => boolean,
  make: (slot: S, mesh: Mesh) => S,
): S[] {
  root.updateMatrixWorld(true)
  const rootInv = new Matrix4().copy(root.matrixWorld).invert()
  const groups = new Map<string, S[]>()
  const out: S[] = []

  for (const s of slots) {
    const m = s.mesh
    const mat = s.base as Material & { transmission?: number }
    if (
      chainMatches(m, root, keep) ||
      mat.transparent ||
      (mat.transmission ?? 0) > 0 ||
      m.renderOrder !== 0 ||
      (m as { isSkinnedMesh?: boolean }).isSkinnedMesh ||
      (m as { isInstancedMesh?: boolean }).isInstancedMesh ||
      Object.keys(m.geometry.morphAttributes).length > 0
    ) {
      out.push(s)
      continue
    }
    const g = m.geometry
    const attrs = Object.keys(g.attributes).sort().join(",")
    const k = [s.key, s.base.uuid, m.castShadow, m.receiveShadow, attrs, g.index ? "i" : "n"].join("|")
    const list = groups.get(k)
    if (list) list.push(s)
    else groups.set(k, [s])
  }

  const matrix = new Matrix4()
  for (const list of groups.values()) {
    if (list.length < 2) {
      out.push(...list)
      continue
    }
    const geos: BufferGeometry[] = []
    for (const s of list) {
      matrix.multiplyMatrices(rootInv, s.mesh.matrixWorld)
      const g = s.mesh.geometry.clone().applyMatrix4(matrix)
      // 鏡像の部材は面の向きが裏返るので、三角形の頂点順を戻す
      if (matrix.determinant() < 0) flipWinding(g)
      geos.push(g)
    }
    const merged = mergeGeometries(geos, false)
    for (const g of geos) g.dispose()
    if (!merged) {
      out.push(...list)
      continue
    }
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    const first = list[0]!
    const mesh = first.mesh.clone(false) as Mesh
    mesh.geometry = merged
    mesh.name = `merged:${first.base.name}`
    mesh.position.set(0, 0, 0)
    mesh.quaternion.identity()
    mesh.scale.set(1, 1, 1)
    mesh.updateMatrix()
    for (const s of list) s.mesh.removeFromParent()
    root.add(mesh)
    out.push(make(first, mesh))
  }
  root.updateMatrixWorld(true)
  return out
}

function chainMatches(o: Object3D, root: Object3D, keep: (o: Object3D) => boolean): boolean {
  for (let p: Object3D | null = o; p && p !== root; p = p.parent) {
    if (keep(p)) return true
  }
  return false
}

function flipWinding(g: BufferGeometry) {
  const index = g.index
  if (index) {
    const a = index.array
    for (let i = 0; i + 2 < a.length; i += 3) {
      const t = a[i + 1]!
      a[i + 1] = a[i + 2]!
      a[i + 2] = t
    }
    index.needsUpdate = true
    return
  }
  for (const attr of Object.values(g.attributes)) {
    const a = attr.array
    const n = attr.itemSize
    for (let v = 0; v + 2 < attr.count; v += 3) {
      for (let c = 0; c < n; c++) {
        const i1 = (v + 1) * n + c
        const i2 = (v + 2) * n + c
        const t = a[i1]!
        a[i1] = a[i2]!
        a[i2] = t
      }
    }
    attr.needsUpdate = true
  }
}
