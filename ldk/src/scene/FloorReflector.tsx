import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import {
  HalfFloatType,
  LinearMipmapLinearFilter,
  Matrix4,
  type Mesh,
  type Object3D,
  PerspectiveCamera,
  Plane,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three"
import { reflection } from "./patch"

const NORMAL = new Vector3(0, 1, 0)
const BIAS = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)

/**
 * 床面 (y = 0) で鏡映したカメラから室内を描き、床マテリアルの鏡面反射に使う (three の Reflector と同じ斜め投影クリップ)。
 * ミップマップを粗さに応じて引くので、挽板の微光沢でぼやけた映り込みになる
 */
export function FloorReflector({ resolution = 0.5 }: { resolution?: number }) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const rt = useMemo(
    () =>
      new WebGLRenderTarget(1, 1, {
        type: HalfFloatType,
        generateMipmaps: true,
        minFilter: LinearMipmapLinearFilter,
      }),
    [],
  )
  const tmp = useMemo(
    () => ({
      cam: new PerspectiveCamera(),
      plane: new Plane(),
      clip: new Vector4(),
      q: new Vector4(),
      view: new Vector3(),
      target: new Vector3(),
      look: new Vector3(),
      camPos: new Vector3(),
      rot: new Matrix4(),
      origin: new Vector3(0, 0, 0),
    }),
    [],
  )

  useEffect(() => {
    rt.setSize(Math.round(size.width * dpr * resolution), Math.round(size.height * dpr * resolution))
    reflection.lodMax.value = Math.max(1, Math.floor(Math.log2(Math.max(rt.width, rt.height))) - 3)
  }, [rt, size, dpr, resolution])

  useEffect(() => {
    reflection.map.value = rt.texture
    reflection.mix.value = 1
    return () => {
      reflection.mix.value = 0
      reflection.map.value = null
      rt.dispose()
    }
  }, [rt])

  useFrame(({ scene, camera }) => {
    const { cam, plane, clip, q, view, target, look, camPos, rot, origin } = tmp
    camPos.setFromMatrixPosition(camera.matrixWorld)
    view.subVectors(origin, camPos)
    if (view.dot(NORMAL) > 0) return
    view.reflect(NORMAL).negate().add(origin)
    rot.extractRotation(camera.matrixWorld)
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos)
    target.subVectors(origin, look).reflect(NORMAL).negate().add(origin)
    cam.position.copy(view)
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(NORMAL)
    cam.lookAt(target)
    cam.far = camera.far
    cam.updateMatrixWorld()
    cam.projectionMatrix.copy(camera.projectionMatrix)
    reflection.matrix.value.copy(BIAS).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse)

    plane.setFromNormalAndCoplanarPoint(NORMAL, origin).applyMatrix4(cam.matrixWorldInverse)
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
    const p = cam.projectionMatrix.elements
    q.x = (Math.sign(clip.x) + p[8]) / p[0]
    q.y = (Math.sign(clip.y) + p[9]) / p[5]
    q.z = -1
    q.w = (1 + p[10]) / p[14]
    clip.multiplyScalar(2 / clip.dot(q))
    p[2] = clip.x
    p[6] = clip.y
    p[10] = clip.z + 1 - 0.003
    p[14] = clip.w

    const prev = gl.getRenderTarget()
    const autoShadow = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    const hidden: Object3D[] = []
    scene.traverseVisible((o) => {
      const m = (o as Mesh).material
      if (m && !Array.isArray(m) && m.userData.reflective) hidden.push(o)
    })
    for (const o of hidden) o.visible = false
    gl.setRenderTarget(rt)
    gl.clear()
    gl.render(scene, cam)
    gl.setRenderTarget(prev)
    for (const o of hidden) o.visible = true
    gl.shadowMap.autoUpdate = autoShadow
  })
  return null
}
