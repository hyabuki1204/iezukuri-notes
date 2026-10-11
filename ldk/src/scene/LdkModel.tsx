import { useGLTF, useTexture } from "@react-three/drei"
import { useLoader, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  EquirectangularReflectionMapping,
  ImageLoader,
  type Material,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from "three"
import {
  asset,
  type BoardColor,
  type CeilingColor,
  type CounterTop,
  type CurtainState,
  DATA,
  type DoorState,
  hasLightmap,
  type KitchenColor,
  lightmapUrl,
  MOBILE,
  MODEL_URL,
  toThree,
  type TimeOfDay,
} from "./data"
import { SKY_ROTATION } from "./Lighting"
import { patchMaterial } from "./patch"
import { applyWorldUV, BOARD_PALETTE, COUNTER_PALETTE, createMaterials, KITCHEN_PALETTE, kitchenMaterialFor, type MaterialLib, setStone } from "./materials"
import { setCollision } from "./player"
import type { QualityProfile } from "./quality"

const SHRUBS = ["shrub_02", "shrub_03"]
const floorTextures = (hi: boolean) =>
  ["diff", "nor", "rough"].map((k) => `textures/laminate_floor_02_${k}${hi ? "_2k" : ""}.jpg`)
const SHRUB_TEXTURES = SHRUBS.flatMap((s) => [`textures/${s}_diff.webp`, `textures/${s}_nor.jpg`])
const BASE_COUNT = 3 + SHRUB_TEXTURES.length
const DETAIL_TEXTURES = ["textures/rough_linen_nor.jpg", "textures/leafy_grass_nor.jpg"]
/** Poly Haven のスキャン素材 (scripts/web_textures_scan.py)。MEDIUM 以上 */
const SCAN_TEXTURES = [
  "walnut_diff",
  "walnut_nor",
  "leather_diff",
  "leather_nor",
  "wool_herringbone_diff",
  "wool_herringbone_nor",
  "concrete_worn_diff",
  "concrete_worn_nor",
  "concrete_worn_rough",
].map((n) => `textures/${n}${MOBILE ? "_512" : ""}.jpg`)

/** 画質を切り替えると Canvas ごと作り直すため、読み込むテクスチャの組はマウント中は変わらない */
function useMaterialLib(q: QualityProfile): MaterialLib {
  const base = [...floorTextures(!MOBILE && q.hiResTextures), ...SHRUB_TEXTURES]
  const urls = (q.detailMaps ? [...base, ...DETAIL_TEXTURES, ...SCAN_TEXTURES] : base).map(asset)
  const textures = useTexture(urls)
  const [floorDiff, floorNor, floorRough] = textures
  const [linenNor, grassNor] = textures.slice(BASE_COUNT)
  const scan = q.detailMaps ? textures.slice(BASE_COUNT + DETAIL_TEXTURES.length) : undefined
  const images = useLoader(
    ImageLoader,
    (q.detailMaps ? ["textures/ash_veneer_diff.jpg", "textures/rough_linen_diff.jpg"] : ["textures/ash_veneer_diff.jpg"]).map(asset),
  )
  return useMemo(() => {
    const key = `${q.detailMaps}|${q.glass}|${q.reflector}`
    if (libCache?.ash !== images[0] || libCache.key !== key) {
      const lib = createMaterials(
        {
          floorDiff,
          floorNor,
          floorRough,
          ash: images[0],
          shrubs: Object.fromEntries(SHRUBS.map((s, i) => [s, [textures[3 + i * 2], textures[4 + i * 2]]])),
          linen: images[1],
          linenNor,
          grassNor,
          scan: scan && {
            walnut: [scan[0], scan[1]],
            leather: [scan[2], scan[3]],
            wool: [scan[4], scan[5]],
            concrete: [scan[6], scan[7], scan[8]],
          },
        },
        { detail: q.detailMaps, glass: q.glass, reflective: q.reflector },
      )
      libCache = { ash: images[0], key, lib }
    }
    return libCache.lib
  }, [textures, floorDiff, floorNor, floorRough, linenNor, grassNor, scan, images, q.detailMaps, q.glass, q.reflector])
}

/**
 * 2.5m / 2.7m の 2 モデルで同じマテリアルを使い回す。モデルごとに作ると 2048 角のキャンバスが倍になり、
 * iOS Safari のキャンバス総メモリ上限を超えて後から作った側のテクスチャが真っ黒になる。
 * 画質を変えたときは前の組を捨てる (保持し続けるとキャンバスが積み上がる)
 */
let libCache: { ash: HTMLImageElement; key: string; lib: MaterialLib } | undefined

/** 昼の壁: 拡散反射を抑えた分を一様な発光で補い、窓に向く壁と横向きの壁の明暗差を小さくする */
const WALL_DAY = { base: 0.5, fill: 0.74 }
/** 焼き込み時の壁: 白に近いクロスに見えるよう間接光を持ち上げ、薄い発光で窓から遠い壁のくすみを抑える */
const WALL_BAKED = { gain: 1.75, fill: 0.03 }

/** 石目柄の天板はテクスチャの色そのまま */
const STONE_TINT = new Color(1, 1, 1)

const CEILING_MESH = /^天井_仕上げ/
const LIGHTMAPPED = new Set(DATA.lightmap?.mats ?? [])
const FLOOR_MATS = new Set(["挽板フローリング_オーク", "キッチン床_モルタル調"])
/** 南面サッシより外 (Blender y < -0.3) と外装。焼き込み時は室内プローブではなく空を環境光にする */
const EXTERIOR_MESH = /^(外壁|鼻隠し|屋根)/

interface Slot {
  mesh: Mesh
  base: Material
  name: string
  ceiling: boolean
  lightmapped: boolean
  exterior: boolean
}

function prepare(root: Object3D, lib: MaterialLib): Slot[] {
  const slots: Slot[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const name = (mesh.material as { name?: string }).name ?? ""
    const mat = kitchenMaterialFor(name, lib) ?? lib.byName[name]
    if (mat) mesh.material = mat
    const g = mesh.geometry
    // 2.5m / 2.7m のクローンはジオメトリを共有するので、ライトマップ UV の退避は 1 回だけ
    const lightmapped = LIGHTMAPPED.has(name) && (!!g.getAttribute("uv1") || !!g.getAttribute("uv"))
    if (lightmapped && !g.getAttribute("uv1")) {
      const uv = g.getAttribute("uv") as BufferAttribute
      g.setAttribute("uv1", new BufferAttribute(uv.array.slice(), 2))
    }
    const uvMode = lib.uv[name] ?? (kitchenMaterialFor(name, lib) ? "plan" : undefined)
    if (uvMode) applyWorldUV(mesh, uvMode)
    const transparent = name === "Low-E複層ガラス" || name === "レースカーテン"
    mesh.castShadow = !transparent
    mesh.receiveShadow = !transparent
    if (name === "Low-E複層ガラス") mesh.renderOrder = 2
    if (!g.boundingBox) g.computeBoundingBox()
    const z = g.boundingBox!.getCenter(new Vector3()).applyMatrix4(mesh.matrixWorld).z
    slots.push({
      mesh,
      base: mesh.material as Material,
      name,
      ceiling: CEILING_MESH.test(mesh.name),
      lightmapped,
      exterior: !lightmapped && (z > 0.3 || EXTERIOR_MESH.test(mesh.name)),
    })
  })
  return slots
}

/** ペニンシュラが接する北壁のキッチンパネル (天板上端〜天井、ペニンシュラ幅)。壁面と重ならないよう 4mm 手前に貼る */
function kitchenBoard(lib: MaterialLib, ceiling: number) {
  const [x0, x1, , y1] = DATA.P.PENINSULA
  const z0 = 0.87
  const t = 0.004
  const mesh = new Mesh(new BoxGeometry(x1 - x0, ceiling - z0, t), lib.boardBody)
  mesh.name = "キッチンボード"
  mesh.position.copy(toThree((x0 + x1) / 2, y1 - t / 2, (z0 + ceiling) / 2))
  mesh.castShadow = mesh.receiveShadow = true
  applyWorldUV(mesh, "plan")
  return mesh
}

/** 焼き込み (昼・MEDIUM 以上) 用のマテリアル。モデルごとにライトマップが違うので複製する */
function bakedVariant(base: Material, lm: Texture, scale: number, reflective: boolean) {
  const m = base.clone() as MeshStandardMaterial
  m.lightMap = lm
  m.lightMapIntensity = Math.PI * scale * (base.userData.lightMapGain ?? 1)
  // 壁クロスは昼の見た目合わせで拡散色を下げ発光で補っている (WALL_DAY)。焼き込み時は本来の色に戻す
  if (m.emissive && m.emissive.getHex() !== 0) {
    m.color.copy(m.emissive)
    m.lightMapIntensity *= WALL_BAKED.gain
    m.emissiveIntensity = WALL_BAKED.fill
  }
  patchMaterial(m, { lightmapped: true, reflective })
  return m
}

function exteriorVariant(base: Material, sky: Texture) {
  const m = base.clone() as MeshStandardMaterial
  m.envMap = sky
  m.envMapIntensity = SKY_ENV
  m.envMapRotation.set(0, SKY_ROTATION, 0)
  return m
}

/** 焼き込み時の屋外の環境光 (空の JPEG は LDR なので、Cycles の HDRI の明るさに合わせて下げる) */
const SKY_ENV = 0.3

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
  counter: CounterTop
  board: BoardColor
  curtain: CurtainState
  doors: DoorState
  time: TimeOfDay
  q: QualityProfile
}

export function LdkModel({ ceiling, ceilColor, visible, kitchen, counter, board, curtain, doors, time, q }: Props) {
  const { scene } = useGLTF(MODEL_URL[ceiling])
  const lib = useMaterialLib(q)
  const invalidate = useThree((s) => s.invalidate)
  // スマホは表示中の天井高のライトマップだけ持つ
  const canBake = q.baked && hasLightmap(ceiling) && (visible || !MOBILE)
  const [lm, sky] = useTexture(canBake ? [lightmapUrl(ceiling), asset("textures/suburban_garden_sky.jpg")] : []) as Texture[]
  const { root, slots, board: boardMesh } = useMemo(() => {
    const r = scene.clone(true)
    const slots = prepare(r, lib)
    const b = kitchenBoard(lib, ceiling)
    r.add(b)
    return { root: r, slots, board: b }
  }, [scene, lib, ceiling])

  useEffect(() => {
    boardMesh.visible = board !== "none"
    invalidate()
  }, [boardMesh, board, invalidate])
  const variants = useMemo(() => {
    if (!canBake || !lm || !sky) return undefined
    lm.flipY = false
    lm.channel = 1
    lm.colorSpace = SRGBColorSpace
    lm.needsUpdate = true
    sky.mapping = EquirectangularReflectionMapping
    sky.colorSpace = SRGBColorSpace
    const scale = DATA.lightmap!.scale[String(Math.round(ceiling * 1000))]
    const cache = new Map<Material, Material>()
    return (base: Material, s: Slot) => {
      let v = cache.get(base)
      if (!v) {
        v = s.lightmapped ? bakedVariant(base, lm, scale, q.reflector && FLOOR_MATS.has(s.name)) : exteriorVariant(base, sky)
        cache.set(base, v)
      }
      return v
    }
  }, [canBake, lm, sky, ceiling, q.reflector])
  const baked = !!variants && time === "day"

  useEffect(() => {
    applyVisibility(root, curtain, time, doors)
    invalidate()
  }, [root, curtain, time, doors, invalidate])

  useEffect(() => {
    if (visible) setCollision(root)
  }, [root, visible, doors])

  useEffect(() => {
    for (const s of slots) {
      const base = s.ceiling ? (ceilColor === "white" ? lib.ceilWhite : lib.ceilWood) : s.base
      s.mesh.material = baked && (s.lightmapped || s.exterior) ? variants(base, s) : base
    }
    invalidate()
  }, [slots, ceilColor, lib, baked, variants, invalidate])

  useEffect(() => {
    const p = KITCHEN_PALETTE[kitchen]
    setStone(lib.kitchenBody, p.stone)
    lib.kitchenBody.color.copy(p.body)
    lib.kitchenBody.roughness = p.bodyRough
    lib.kitchenBody.specularIntensity = p.spec
    const b = board === "match" || board === "none" ? undefined : BOARD_PALETTE[board]
    setStone(lib.boardBody, b ? b.stone : p.stone)
    lib.boardBody.color.copy(b ? STONE_TINT : p.body)
    lib.boardBody.roughness = b ? b.rough : p.bodyRough
    lib.boardBody.specularIntensity = b ? b.spec : p.spec
    const top = counter === "match" ? undefined : COUNTER_PALETTE[counter]
    setStone(lib.kitchenTop, top ? top.stone : p.stone)
    lib.kitchenTop.color.copy(top ? STONE_TINT : p.top)
    lib.kitchenTop.roughness = top ? top.rough : 0.35
    lib.kitchenTop.specularIntensity = top ? top.spec : p.spec
    lib.led.emissiveIntensity = time === "night" ? 6 : 0
    const day = time === "day"
    lib.wall.color.copy(lib.wall.emissive).multiplyScalar(day ? WALL_DAY.base : 1)
    lib.wall.emissiveIntensity = day ? WALL_DAY.fill : 0
    invalidate()
  }, [lib, kitchen, counter, board, time, invalidate])

  return <primitive object={root} visible={visible} />
}

useGLTF.preload(MODEL_URL[2.5])
useGLTF.preload(MODEL_URL[2.7])
