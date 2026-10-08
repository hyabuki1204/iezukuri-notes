import { useGLTF, useTexture } from "@react-three/drei"
import { useLoader, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { ImageLoader, type Mesh, type Object3D } from "three"
import {
  asset,
  type CeilingColor,
  type CurtainState,
  type DoorState,
  type KitchenColor,
  MODEL_URL,
  type TimeOfDay,
} from "./data"
import { applyWorldUV, createMaterials, KITCHEN_PALETTE, kitchenMaterialFor, type MaterialLib } from "./materials"

function useMaterialLib(): MaterialLib {
  const [floorDiff, floorNor, floorRough] = useTexture([
    asset("textures/laminate_floor_02_diff.jpg"),
    asset("textures/laminate_floor_02_nor.jpg"),
    asset("textures/laminate_floor_02_rough.jpg"),
  ])
  const ash = useLoader(ImageLoader, asset("textures/ash_veneer_diff.jpg"))
  return useMemo(() => createMaterials({ floorDiff, floorNor, floorRough, ash }), [floorDiff, floorNor, floorRough, ash])
}

const CEILING_MESH = /^天井_仕上げ/

function prepare(root: Object3D, lib: MaterialLib) {
  const ceilings: Mesh[] = []
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const name = (mesh.material as { name?: string }).name ?? ""
    const mat = kitchenMaterialFor(name, lib) ?? lib.byName[name]
    if (mat) mesh.material = mat
    const uvMode = lib.uv[name]
    if (uvMode) applyWorldUV(mesh, uvMode)
    const transparent = name === "Low-E複層ガラス" || name === "レースカーテン"
    mesh.castShadow = !transparent
    mesh.receiveShadow = !transparent
    if (name === "Low-E複層ガラス") mesh.renderOrder = 2
    if (CEILING_MESH.test(mesh.name)) ceilings.push(mesh)
  })
  return ceilings
}

const CURTAIN_GROUPS = {
  laceOpen: /^レース\d/,
  laceClosed: /^レース閉/,
  drapeOpen: /^ドレープ\d/,
  drapeClosed: /^ドレープ閉/,
}

function applyVisibility(root: Object3D, curtain: CurtainState, time: TimeOfDay, doors: DoorState) {
  const closed = curtain === "closed"
  const vis = {
    laceOpen: !closed,
    laceClosed: closed,
    drapeOpen: !(closed && time === "night"),
    drapeClosed: closed && time === "night",
  }
  root.traverse((o) => {
    for (const [k, re] of Object.entries(CURTAIN_GROUPS)) {
      if (re.test(o.name)) o.visible = vis[k as keyof typeof vis]
    }
    if (/扉_閉/.test(o.name)) o.visible = doors === "closed"
    if (/扉_開/.test(o.name)) o.visible = doors === "open"
  })
}

interface Props {
  ceiling: 2.5 | 2.7
  ceilColor: CeilingColor
  visible: boolean
  kitchen: KitchenColor
  curtain: CurtainState
  doors: DoorState
  time: TimeOfDay
}

export function LdkModel({ ceiling, ceilColor, visible, kitchen, curtain, doors, time }: Props) {
  const { scene } = useGLTF(MODEL_URL[ceiling])
  const lib = useMaterialLib()
  const invalidate = useThree((s) => s.invalidate)
  const { root, ceilings } = useMemo(() => {
    const r = scene.clone(true)
    return { root: r, ceilings: prepare(r, lib) }
  }, [scene, lib])

  useEffect(() => {
    applyVisibility(root, curtain, time, doors)
    invalidate()
  }, [root, curtain, time, doors, invalidate])

  useEffect(() => {
    for (const m of ceilings) m.material = ceilColor === "white" ? lib.ceilWhite : lib.ceilWood
    invalidate()
  }, [ceilings, ceilColor, lib, invalidate])

  useEffect(() => {
    const p = KITCHEN_PALETTE[kitchen]
    lib.kitchenBody.color.copy(p.body)
    lib.kitchenBody.roughness = p.bodyRough
    lib.kitchenTop.color.copy(p.top)
    lib.led.emissiveIntensity = time === "night" ? 6 : 0
    invalidate()
  }, [lib, kitchen, time, invalidate])

  return <primitive object={root} visible={visible} />
}

useGLTF.preload(MODEL_URL[2.5])
useGLTF.preload(MODEL_URL[2.7])
