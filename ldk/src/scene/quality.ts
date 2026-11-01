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
  /** 床の 2K テクスチャ (PC のみ) */
  hiResTextures: boolean
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { dpr: 1, shadow: "pcf", shadowSize: 2048, ao: "off", baked: false, detailMaps: false, glass: "basic", reflector: false, bloom: false, hiResTextures: false },
  medium: { dpr: 1.5, shadow: "vsm", shadowSize: 4096, ao: "half", baked: true, detailMaps: true, glass: "transmit", reflector: false, bloom: true, hiResTextures: false },
  ultra: { dpr: 2, shadow: "pcss", shadowSize: 4096, ao: "full", baked: true, detailMaps: true, glass: "transmit", reflector: true, bloom: true, hiResTextures: true },
}

export const QUALITY_LABEL: Record<Quality, string> = { low: "LOW", medium: "MEDIUM", ultra: "ULTRA" }

/** ULTRA は高性能な GPU 向け。普段は MEDIUM で始める */
export const DEFAULT_QUALITY: Quality = "medium"

/**
 * スマホの MEDIUM: 焼き込み間接光 (描画の負担はほぼ無い) は残し、
 * 画面全体に重ねる効果 (AO・ブルーム) と、透過ガラスの追加描画、大きな影を外す
 */
const MOBILE_MEDIUM: QualityProfile = {
  ...QUALITY.medium,
  shadow: "pcf",
  shadowSize: 2048,
  ao: "off",
  glass: "basic",
  bloom: false,
}

export function qualityProfile(q: Quality, mobile: boolean): QualityProfile {
  return mobile && q === "medium" ? MOBILE_MEDIUM : QUALITY[q]
}
