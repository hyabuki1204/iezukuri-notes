import { SoftShadows } from "@react-three/drei"
import { Canvas, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing"
import { ToneMappingMode } from "postprocessing"
import { lazy, Suspense, useEffect } from "react"
import { NoToneMapping, PCFShadowMap, VSMShadowMap } from "three"
import { DATA, EYE_HEIGHT, hasLightmap, MOBILE, panoUrl, type Settings } from "./data"
import { FloorReflector } from "./FloorReflector"
import { LdkModel } from "./LdkModel"
import { Lighting } from "./Lighting"
import { usePtStatus } from "./ptStatus"
import { PanoView } from "./PanoView"
import { Player } from "./Player"
import { QUALITY, type QualityProfile, type ToneMap } from "./quality"

/** スマホの描画解像度の上限。横向きにすると描画バッファを作り直すので、iOS の GPU メモリ上限に余裕を残す */
const MOBILE_DPR = 1.5

/** パストレーサーは PC で使うときだけ読み込む */
const PathTracer = lazy(() => import("./PathTracer"))

/** 静止時パストレースの最大サンプル数 (これに達したら計算を止める) */
const PT_SAMPLES = 1000

/** トーンマッピング別の露出。AgX は中間調が沈むぶん持ち上げ、ACES は肩が早いので抑える */
const EXPOSURE: Record<ToneMap, { day: number; night: number; baked: number }> = {
  agx: { day: 1.35, night: 1.3, baked: 2 ** 3.3 },
  aces: { day: 0.62, night: 0.62, baked: 2 ** 2.2 },
}

function Effects({ q, day, tone }: { q: QualityProfile; day: boolean; tone: ToneMap }) {
  const mode = tone === "aces" ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.AGX
  // パストレースの結果が画面を覆っている間は、下に隠れるラスタライズ表示を描かない
  const { covering } = usePtStatus()
  return (
    <EffectComposer multisampling={0} enabled={!covering}>
      {q.ao !== "off" && (
        <N8AO
          aoRadius={0.55}
          distanceFalloff={0.35}
          intensity={day ? 2.4 : 1.6}
          quality={q.ao === "full" ? "high" : "medium"}
          halfRes={q.ao === "half"}
        />
      )}
      {q.bloom && <Bloom mipmapBlur luminanceThreshold={day ? 1.6 : 0.9} luminanceSmoothing={0.3} intensity={day ? 0.18 : 0.5} radius={0.75} />}
      <ToneMapping mode={mode} />
      <SMAA />
    </EffectComposer>
  )
}

function Exposure({ value }: { value: number }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    gl.toneMappingExposure = value
    invalidate()
  }, [gl, value, invalidate])
  return null
}

export function Viewer({ s }: { s: Settings }) {
  const pano = s.mode === "pano" ? DATA.panos[s.pano] : undefined
  const eye = EYE_HEIGHT[s.eye]
  const q = QUALITY[s.quality]
  const day = s.time === "day"
  const baked = q.baked && day && hasLightmap(s.ceiling)
  const exposure = EXPOSURE[s.tone][baked ? "baked" : s.time]
  const ptOn = s.pt === "on" && s.quality !== "low" && !pano
  const sceneKey = [s.ceiling, s.ceilColor, s.kitchen, s.counter, s.board, s.curtain, s.doors, s.time, s.lights, s.quality].join("|")
  return (
    <Canvas
      key={s.quality}
      shadows={{ type: q.shadow === "vsm" ? VSMShadowMap : PCFShadowMap }}
      frameloop="demand"
      dpr={[1, MOBILE ? Math.min(q.dpr, MOBILE_DPR) : q.dpr]}
      gl={{ antialias: false, toneMapping: NoToneMapping, powerPreference: "high-performance" }}
      camera={{ fov: s.fov, near: 0.03, far: 200 }}
      className="touch-none"
    >
      {q.shadow === "pcss" && <SoftShadows size={18} samples={12} focus={0.6} />}
      <Exposure value={pano ? 0.9 : exposure} />
      <Player eyeHeight={eye} fov={s.fov} anchor={pano?.loc} />
      {pano ? (
        <Suspense fallback={null}>
          <PanoView url={panoUrl(s.ceiling, s.ceilColor, s.pano)} loc={pano.loc} />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Lighting
            time={s.time}
            lights={s.lights === "on"}
            ceiling={s.ceiling}
            q={q}
            baked={baked}
            lightScale={EXPOSURE[s.tone].night / exposure}
          />
          {([2.5, 2.7] as const).map((h) => (
            <LdkModel
              key={h}
              ceiling={h}
              visible={s.ceiling === h}
              ceilColor={s.ceilColor}
              kitchen={s.kitchen}
              counter={s.counter}
              board={s.board}
              curtain={s.curtain}
              doors={s.doors}
              time={s.time}
              q={q}
            />
          ))}
          {q.reflector && <FloorReflector />}
          <Effects q={q} day={day} tone={s.tone} />
          {ptOn && (
            <Suspense fallback={null}>
              <PathTracer sceneKey={sceneKey} tone={s.tone} day={day} maxSamples={PT_SAMPLES} />
            </Suspense>
          )}
        </Suspense>
      )}
    </Canvas>
  )
}
