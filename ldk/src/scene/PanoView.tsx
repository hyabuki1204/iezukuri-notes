import { useTexture } from "@react-three/drei"
import { useMemo } from "react"
import { SphereGeometry, SRGBColorSpace } from "three"
import { toThree } from "./data"

/**
 * Cycles 正距円筒パノラマを内側から見る球。
 * Blender 側は 画像中心 = 北(+y)・左 = 西 で書き出しているので、
 * 反転した球を -90° 回して three 座標 (北 = -z) に合わせる。
 */
export function PanoView({ url, loc }: { url: string; loc: [number, number, number] }) {
  const tex = useTexture(url)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const geo = useMemo(() => {
    const g = new SphereGeometry(40, 128, 64)
    g.scale(-1, 1, 1)
    return g
  }, [])
  return (
    <mesh geometry={geo} position={toThree(...loc)} rotation={[0, -Math.PI / 2, 0]} renderOrder={-1}>
      <meshBasicMaterial map={tex} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}
