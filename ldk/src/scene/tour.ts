import { CatmullRomCurve3, Vector3 } from "three"

/** ウォークスルー経路 (Blender 座標 x, y) と注視点 (x, y, z) */
const KEYS: { p: [number, number]; look: [number, number, number] }[] = [
  { p: [6.45, 5.1], look: [2.5, 0.0, 1.3] },     // 玄関ホール扉から入って南面大開口
  { p: [5.1, 4.45], look: [5.1, 6.0, 0.95] },    // ピアノと北壁の 2 枚のハイドア
  { p: [3.7, 4.4], look: [3.0, 0.0, 1.2] },
  { p: [3.3, 3.9], look: [1.0, 1.0, 1.2] },      // ペニンシュラ横 → ダイニング
  { p: [3.25, 2.3], look: [2.1, 0.0, 1.5] },     // 窓へ近づく
  { p: [3.3, 0.55], look: [0.0, 0.4, 1.6] },     // 窓際を西へ (軒天の連続 / 主寝室扉)
  { p: [1.05, 0.6], look: [0.0, 2.2, 1.0] },     // デスクカウンター
  { p: [1.12, 3.1], look: [1.1, 6.0, 1.0] },     // キッチン (モルタル床)
  { p: [1.12, 4.6], look: [1.2, 6.0, 1.3] },
  { p: [1.12, 3.4], look: [6.5, 1.5, 1.4] },     // キッチンから LDK 全体
  { p: [2.1, 2.95], look: [7.0, 2.4, 1.3] },
  { p: [3.3, 4.1], look: [7.0, 2.8, 1.4] },      // TV 壁・ホール扉
  { p: [5.0, 4.3], look: [7.0, 1.3, 1.1] },
  { p: [5.9, 4.45], look: [3.0, -1.0, 1.4] },    // 最後に南の庭を見渡す
]

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
export const POS_CURVE = new CatmullRomCurve3(KEYS.map((k) => v(k.p[0], k.p[1], 0)), false, "centripetal")
export const LOOK_CURVE = new CatmullRomCurve3(KEYS.map((k) => v(...k.look)), false, "centripetal")
export const TOUR_LENGTH = POS_CURVE.getLength()
export const TOUR_SPEED = 0.55 // m/s (ゆっくり歩く速さ)
