export type Quality = "low" | "medium" | "ultra"
export type ToneMap = "agx" | "aces"

export interface QualityProfile {
  /** 描画解像度の上限 (devicePixelRatio) */
  dpr: number
  shadow: "pcf" | "vsm" | "pcss"
  shadowSize: number
  ao: "off" | "half" | "full"
  /** Blender で焼いた間接光 (ライトマップ) と室内環境光・HDR の空を使う */
  baked: boolean
  /** 天井の法線・粗さ・AO マップ、ソファの布テクスチャ */
  detailMaps: boolean
  glass: "basic" | "transmit"
  /** 床の平面反射 */
  reflector: boolean
  bloom: boolean
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { dpr: 1, shadow: "pcf", shadowSize: 2048, ao: "off", baked: false, detailMaps: false, glass: "basic", reflector: false, bloom: false },
  medium: { dpr: 1.5, shadow: "vsm", shadowSize: 4096, ao: "half", baked: true, detailMaps: true, glass: "transmit", reflector: false, bloom: true },
  ultra: { dpr: 2, shadow: "pcss", shadowSize: 4096, ao: "full", baked: true, detailMaps: true, glass: "transmit", reflector: true, bloom: true },
}

export const QUALITY_LABEL: Record<Quality, string> = { low: "LOW", medium: "MEDIUM", ultra: "ULTRA" }

/** スマホは iOS Safari のメモリ上限に掛からないよう LOW から始める */
export function defaultQuality(): Quality {
  return matchMedia("(pointer: coarse)").matches ? "low" : "medium"
}
