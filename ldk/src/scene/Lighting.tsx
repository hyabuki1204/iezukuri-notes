import { Environment, Lightformer } from "@react-three/drei"
import { type ReactNode, Suspense, useEffect, useMemo } from "react"
import { Object3D, SpotLight } from "three"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { asset, DATA, type TimeOfDay, toThree } from "./data"

/** 窓外の景色は見た目だけなので、読み込みに失敗しても室内の表示は続ける */
function Sky({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>{children}</Suspense>
    </ErrorBoundary>
  )
}

const WARM = "#ffc48a"
const NEUTRAL = "#ffd9b0"

function Spot({ x, y, z, intensity, angle, color, tx, ty, tz }: {
  x: number; y: number; z: number; intensity: number; angle: number; color: string
  tx?: number; ty?: number; tz?: number
}) {
  const light = useMemo(() => {
    const l = new SpotLight(color, intensity, 9, angle, 0.6, 2)
    l.position.copy(toThree(x, y, z))
    const t = new Object3D()
    t.position.copy(toThree(tx ?? x, ty ?? y, tz ?? 0))
    l.target = t
    return l
  }, [x, y, z, intensity, angle, color, tx, ty, tz])
  useEffect(() => () => light.dispose(), [light])
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  )
}

/** 夜景用: ダウンライトの発光面 (器具そのものが光って見えるように) */
function DownlightGlow({ ceiling }: { ceiling: number }) {
  return (
    <>
      {DATA.downlights.map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={toThree(x, y, ceiling - 0.006)} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.032, 24]} />
          <meshBasicMaterial color={[6, 5, 4]} toneMapped />
        </mesh>
      ))}
    </>
  )
}

export function Lighting({ time, ceiling, shadows }: { time: TimeOfDay; ceiling: number; shadows: boolean }) {
  const sunPos = useMemo(() => {
    const [dx, dy, dz] = DATA.sun.dir
    return toThree(3.5 + dx * 25, 3 + dy * 25, dz * 25)
  }, [])
  const sunTarget = useMemo(() => {
    const t = new Object3D()
    t.position.copy(toThree(3.5, 3, 0))
    return t
  }, [])

  if (time === "day") {
    return (
      <>
        <Sky>
          <Environment
            files={asset("textures/suburban_garden_sky.jpg")}
            background="only"
            backgroundIntensity={1.0}
            backgroundRotation={[0, Math.PI * 0.62, 0]}
          />
        </Sky>
        {/*
          室内の環境光: 屋外HDRIをそのまま当てると天井が芝生の緑を拾うため、
          南面の窓明かり + 床(挽板)の照り返し + 室内の拡散光 で室内用の環境マップを作る
        */}
        <Environment resolution={256} environmentIntensity={1}>
          <color attach="background" args={["#4a4540"]} />
          <Lightformer form="rect" intensity={2.6} color="#eef2f6" position={[0, 0.8, 10]} scale={[18, 5, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.1} color="#d9b48c" position={[0, -10, 0]} scale={[20, 20, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.35} color="#efe6da" position={[0, 10, 0]} scale={[20, 20, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.45} color="#e8ddd0" position={[-10, 0, 0]} scale={[14, 6, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.45} color="#e8ddd0" position={[10, 0, 0]} scale={[14, 6, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.3} color="#e8ddd0" position={[0, 0, -10]} scale={[18, 6, 1]} target={[0, 0, 0]} />
        </Environment>
        <primitive object={sunTarget} />
        <directionalLight
          position={sunPos}
          target={sunTarget}
          intensity={4.2}
          color="#fff3e2"
          castShadow={shadows}
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.025}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-camera-near={1}
          shadow-camera-far={60}
        />
      </>
    )
  }

  return (
    <>
      <Sky>
        <Environment
          files={asset("textures/moonlit_golf_sky.jpg")}
          background
          environmentIntensity={0.04}
          backgroundIntensity={0.06}
        />
      </Sky>
      <hemisphereLight args={["#c9b8a4", "#3a2c22", 0.12]} />
      {DATA.downlights.map(([x, y]) => (
        <Spot key={`${x}-${y}`} x={x} y={y} z={ceiling - 0.02} intensity={9} angle={Math.PI / 5.2} color={NEUTRAL} />
      ))}
      <Spot x={DATA.P.TABLE[0]} y={DATA.P.TABLE[1]} z={1.48} intensity={5} angle={Math.PI / 3} color={WARM} />
      <pointLight position={toThree(DATA.P.TABLE[0], DATA.P.TABLE[1], 1.45)} intensity={0.6} distance={4} color={WARM} />
      {[1, 3, 5, 7].map((x) => (
        <Spot key={x} x={x} y={-0.75} z={ceiling - 0.02} intensity={8} angle={Math.PI / 4} color={NEUTRAL} />
      ))}
      <Spot x={1} y={-5.4} z={0.05} tx={1} ty={-6} tz={3.5} intensity={60} angle={Math.PI / 9} color={NEUTRAL} />
      <Spot x={7.6} y={-6.2} z={0.05} tx={7.6} ty={-6.8} tz={3} intensity={45} angle={Math.PI / 9} color={NEUTRAL} />
      <DownlightGlow ceiling={ceiling} />
    </>
  )
}
