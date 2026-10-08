import { Canvas } from "@react-three/fiber"
import { EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing"
import { ToneMappingMode } from "postprocessing"
import { Suspense } from "react"
import { NoToneMapping, PCFSoftShadowMap } from "three"
import { DATA, EYE_HEIGHT, panoUrl, type Settings } from "./data"
import { LdkModel } from "./LdkModel"
import { Lighting } from "./Lighting"
import { PanoView } from "./PanoView"
import { Player } from "./Player"

export function Viewer({ s }: { s: Settings }) {
  const pano = s.mode === "pano" ? DATA.panos[s.pano] : undefined
  const eye = EYE_HEIGHT[s.eye]
  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }}
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: false, toneMapping: NoToneMapping, powerPreference: "high-performance" }}
      onCreated={({ gl }) => (gl.toneMappingExposure = 0.9)}
      camera={{ fov: s.fov, near: 0.03, far: 200 }}
      className="touch-none"
    >
      <Player eyeHeight={eye} fov={s.fov} anchor={pano?.loc} />
      {pano ? (
        <Suspense fallback={null}>
          <PanoView url={panoUrl(s.ceiling, s.ceilColor, s.pano)} loc={pano.loc} />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Lighting time={s.time} ceiling={s.ceiling} shadows />
          {([2.5, 2.7] as const).map((h) => (
            <LdkModel
              key={h}
              ceiling={h}
              visible={s.ceiling === h}
              ceilColor={s.ceilColor}
              kitchen={s.kitchen}
              curtain={s.curtain}
              doors={s.doors}
              time={s.time}
            />
          ))}
          <EffectComposer multisampling={0}>
            <N8AO aoRadius={0.55} distanceFalloff={0.35} intensity={s.time === "day" ? 2.4 : 1.6} quality="medium" halfRes />
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            <SMAA />
          </EffectComposer>
        </Suspense>
      )}
    </Canvas>
  )
}
