import { useTexture } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  EquirectangularReflectionMapping,
  Euler,
  Matrix4,
  DataTexture,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  NoToneMapping,
  RGBAFormat,
  type ShaderMaterial,
  type Texture,
  Vector2,
} from "three"
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js"
import { WebGLPathTracer } from "three-gpu-pathtracer"
import { asset } from "./data"
import { SKY_ROTATION } from "./Lighting"
import { PtOutputMaterial } from "./ptOutput"
import { ptStatus } from "./ptStatus"
import type { ToneMap } from "./quality"

/** 止まってから描き始めるまで (ms)。歩行中の小休止では始めない */
const IDLE_MS = 600
/**
 * 窓の外の空 (LDR の JPEG) を室内に差し込む光として使う。焼き込み表示の窓外の空 (BAKED_SKY) と同じ露出基準で、
 * JPEG で飽和した空の明るさを補う分だけ持ち上げる
 */
const SKY_LIGHT = { day: 0.3 * 2.2, night: 0.04 }

/** パストレーサーの環境光は画素データを持つテクスチャが必要なので、空の JPEG をリニアの浮動小数点に展開する */
function skyDataTexture(src: Texture) {
  const img = src.image as HTMLImageElement
  const w = Math.min(1024, img.width)
  const h = Math.round((w * img.height) / img.width)
  const cv = document.createElement("canvas")
  cv.width = w
  cv.height = h
  const ctx = cv.getContext("2d")!
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  cv.width = cv.height = 0
  const data = new Float32Array(w * h * 4)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  // 画像は上が天頂。DataTexture は下の行から並ぶので上下を入れ替える
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const o = ((h - 1 - y) * w + x) * 4
      data[o] = lin(px[i])
      data[o + 1] = lin(px[i + 1])
      data[o + 2] = lin(px[i + 2])
      data[o + 3] = 1
    }
  }
  const t = new DataTexture(data, w, h, RGBAFormat, FloatType)
  t.mapping = EquirectangularReflectionMapping
  t.colorSpace = LinearSRGBColorSpace
  t.magFilter = t.minFilter = LinearFilter
  t.needsUpdate = true
  return t
}

/** ぼかしはこのサンプル数まで徐々に弱め、溜まり切った後も残る細かな粒のために少しだけ残す */
const SMOOTH = { until: 256, min: 0.15 }
/** 計算する画素数の上限。高 DPI の画面ではサンプル数を稼ぐ方を優先する */
const PIXEL_BUDGET = 1.3e6

const TONE = { agx: AgXToneMapping, aces: ACESFilmicToneMapping } as const

/**
 * カメラが止まると、ラスタライズ表示の上にパストレース (three-gpu-pathtracer) の結果を重ねていく。
 * ライトマップや環境光プローブは使わず、窓から入る空の光・日差し・照明の相互反射をその場で計算する
 */
export default function PathTracer({ sceneKey, tone, day, maxSamples }: { sceneKey: string; tone: ToneMap; day: boolean; maxSamples: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const sky = useTexture(asset(day ? "textures/suburban_garden_sky.jpg" : "textures/moonlit_golf_sky.jpg")) as Texture

  const skyEnv = useMemo(() => skyDataTexture(sky), [sky])
  useEffect(() => () => skyEnv.dispose(), [skyEnv])

  const pt = useMemo(() => {
    const p = new WebGLPathTracer(gl)
    p.rasterizeScene = false
    p.renderDelay = 0
    p.minSamples = 2
    p.fadeDuration = 500
    p.bounces = 6
    p.transmissiveBounces = 6
    p.filterGlossyFactor = 0.5
    p.tiles.set(2, 2)
    return p
  }, [gl])
  const denoise = useMemo(() => new FullScreenQuad(new PtOutputMaterial()), [])
  useEffect(
    () => () => {
      pt.dispose()
      denoise.material.dispose()
      denoise.dispose()
    },
    [pt, denoise],
  )
  useEffect(() => {
    // サンプルが少ないうちは輪郭を保つぼかしで粒状ノイズを抑え、溜まるにつれて外していく
    pt.renderToCanvasCallback = (target, renderer, quad) => {
      const m = denoise.material as PtOutputMaterial
      const qm = quad.material as ShaderMaterial & { opacity: number }
      m.uniforms.map.value = target.texture
      m.uniforms.strength.value = Math.max(SMOOTH.min, 1 - pt.samples / SMOOTH.until)
      m.uniforms.opacity.value = qm.opacity
      m.blending = qm.blending
      const autoClear = renderer.autoClear
      renderer.autoClear = false
      denoise.render(renderer)
      renderer.autoClear = autoClear
    }
  }, [pt, denoise])

  const st = useRef({ dirty: true, idleSince: 0, timer: 0, view: new Matrix4(), proj: new Matrix4(), size: new Vector2() })

  useEffect(() => {
    st.current.dirty = true
    pt.reset()
    invalidate()
  }, [sceneKey, day, pt, invalidate])

  useEffect(() => {
    ptStatus.set({ max: maxSamples })
    invalidate()
  }, [maxSamples, invalidate])

  useEffect(
    () => () => {
      clearTimeout(st.current.timer)
      ptStatus.set({ phase: "off", samples: 0, covering: false })
    },
    [],
  )

  useFrame(() => {
    const s = st.current
    const now = performance.now()
    if (!s.view.equals(camera.matrixWorld) || !s.proj.equals(camera.projectionMatrix)) {
      s.view.copy(camera.matrixWorld)
      s.proj.copy(camera.projectionMatrix)
      s.idleSince = now
      pt.reset()
      ptStatus.set({ phase: "waiting", samples: 0, covering: false })
    }
    const wait = IDLE_MS - (now - s.idleSince)
    if (wait > 0) {
      clearTimeout(s.timer)
      s.timer = window.setTimeout(invalidate, wait + 16)
      return
    }

    if (s.dirty) {
      // 室内の環境光プローブではなく、窓の外の空そのものを光源にする
      const env = { map: scene.environment, intensity: scene.environmentIntensity, rot: scene.environmentRotation.clone() }
      scene.environment = skyEnv
      scene.environmentIntensity = day ? SKY_LIGHT.day : SKY_LIGHT.night
      scene.environmentRotation = new Euler(0, day ? SKY_ROTATION : 0, 0)
      pt.setScene(scene, camera)
      scene.environment = env.map
      scene.environmentIntensity = env.intensity
      scene.environmentRotation = env.rot
      s.dirty = false
    }

    gl.getDrawingBufferSize(s.size)
    pt.renderScale = Math.min(1, Math.sqrt(PIXEL_BUDGET / (s.size.x * s.size.y)))
    const done = pt.samples >= maxSamples
    pt.pausePathTracing = done
    gl.toneMapping = TONE[tone]
    pt.renderSample()
    gl.toneMapping = NoToneMapping
    ptStatus.set({
      phase: done ? "done" : "tracing",
      samples: Math.min(Math.floor(pt.samples), maxSamples),
      covering: (pt as unknown as { _quad: { material: { opacity: number } } })._quad.material.opacity >= 1,
    })
    if (!done) invalidate()
  }, 2)

  return null
}
