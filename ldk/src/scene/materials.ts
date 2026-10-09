import {
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  Matrix3,
  type Material,
  type Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Vector2,
  Vector3,
} from "three"
import { patchMaterial } from "./patch"

export interface TextureSet {
  floorDiff: Texture
  floorNor: Texture
  floorRough: Texture
  ash: HTMLImageElement
  /** 庭の低木 (Poly Haven)。色 + 切り抜きの WebP と法線 */
  shrubs: Record<string, [Texture, Texture]>
  /** 以下は MEDIUM / ULTRA のみ読み込む */
  linen?: HTMLImageElement
  linenNor?: Texture
  grassNor?: Texture
}

export interface MaterialOptions {
  /** 天井・壁の法線 / 粗さ / AO マップ、ファブリック、芝生のテクスチャ */
  detail: boolean
  /** 透過ガラス (屈折・微弱反射)。basic は半透明の板 */
  glass: "basic" | "transmit"
  /** 床に平面反射を映す (FloorReflector と組で使う) */
  reflective: boolean
}

const lin = (r: number, g: number, b: number) => new Color().setRGB(r, g, b)

function std(color: Color, roughness: number, extra: Partial<MeshStandardMaterial> = {}) {
  return new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra })
}

function wrap(t: Texture, size: number, srgb = false) {
  const c = t.clone()
  c.wrapS = c.wrapT = RepeatWrapping
  c.repeat.set(1 / size, 1 / size)
  if (srgb) c.colorSpace = SRGBColorSpace
  c.anisotropy = 8
  c.needsUpdate = true
  return c
}

function canvasTexture(cv: HTMLCanvasElement, size: number, srgb = true) {
  const t = new CanvasTexture(cv)
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 8
  t.repeat.set(1 / size, 1 / size)
  return t
}

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

type Mat3 = [number, number, number, number, number, number, number, number, number]

function filterMatrix(fn: string, v: number): { m: Mat3; k?: number } | { slope: number; intercept: number } {
  if (fn === "brightness") return { slope: v, intercept: 0 }
  if (fn === "contrast") return { slope: v, intercept: 0.5 - 0.5 * v }
  if (fn === "saturate") {
    return {
      m: [
        0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v,
      ],
    }
  }
  if (fn === "sepia") {
    const s = 1 - Math.min(1, v)
    return {
      m: [
        0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s,
        0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s,
        0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s,
      ],
    }
  }
  if (fn === "hue-rotate") {
    const r = (v * Math.PI) / 180
    const c = Math.cos(r)
    const s = Math.sin(r)
    return {
      m: [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ],
    }
  }
  throw new Error(`unsupported filter: ${fn}`)
}

/**
 * CSS filter 関数 (brightness / contrast / saturate / sepia / hue-rotate) を画素に直接かけた画像を描画に使う。
 * iOS Safari は CanvasRenderingContext2D.filter を無視するため、ctx.filter には頼らない。
 * iOS のキャンバス総メモリ上限に掛からないよう、使い終えた中間キャンバスはすぐ解放する
 */
function withFiltered<T>(img: HTMLImageElement, filter: string, draw: (src: HTMLCanvasElement) => T): T {
  const cv = filtered(img, filter)
  try {
    return draw(cv)
  } finally {
    cv.width = cv.height = 0
  }
}

function filtered(img: HTMLImageElement, filter: string): HTMLCanvasElement {
  const ops = [...filter.matchAll(/([a-z-]+)\(([-\d.]+)(deg)?\)/g)].map((m) => filterMatrix(m[1], Number(m[2])))
  const cv = document.createElement("canvas")
  cv.width = img.width
  cv.height = img.height
  const ctx = cv.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, cv.width, cv.height)
  const d = id.data
  const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255
    let g = d[i + 1] / 255
    let b = d[i + 2] / 255
    for (const op of ops) {
      if ("m" in op) {
        const m = op.m
        const nr = m[0] * r + m[1] * g + m[2] * b
        const ng = m[3] * r + m[4] * g + m[5] * b
        const nb = m[6] * r + m[7] * g + m[8] * b
        r = clamp(nr)
        g = clamp(ng)
        b = clamp(nb)
      } else {
        r = clamp(r * op.slope + op.intercept)
        g = clamp(g * op.slope + op.intercept)
        b = clamp(b * op.slope + op.intercept)
      }
    }
    d[i] = r * 255
    d[i + 1] = g * 255
    d[i + 2] = b * 255
  }
  ctx.putImageData(id, 0, 0)
  return cv
}

/** 羽目板 (幅150・V溝) を ash veneer から合成。1.5m 角で 10 枚 */
function boards(src: HTMLImageElement, filter: string, size: number, groove = true) {
  const cv = boardsCanvas(src, filter, groove)
  return { map: canvasTexture(cv, size), canvas: cv }
}

const BOARD_ROWS = 10

function boardsCanvas(src: HTMLImageElement, filter: string, groove: boolean) {
  const S = 2048
  const cv = document.createElement("canvas")
  cv.width = cv.height = S
  const ctx = cv.getContext("2d")!
  const n = BOARD_ROWS
  const h = S / n
  const rnd = seeded(7)
  withFiltered(src, filter, (img) => {
    for (let i = 0; i < n; i++) {
      const off = rnd() * img.width
      const sy = rnd() * (img.height - img.height / n)
      for (const dx of [-off, img.width - off]) {
        ctx.drawImage(img, 0, sy, img.width, img.height / n, (dx / img.width) * S, i * h, S, h)
      }
    }
  })
  if (groove) {
    ctx.fillStyle = "rgba(40,28,18,0.85)"
    for (let i = 0; i < n; i++) ctx.fillRect(0, i * h, S, 3)
  }
  return cv
}

/**
 * 木目の濃淡を凹凸 (導管・春材) とみなし、V溝を深い溝として法線 / 粗さ / AO を作る。
 * 粗さは G、AO は R チャンネル (three の規約)
 */
function reliefMaps(src: HTMLCanvasElement, rows: number, size: number) {
  const R = 1024
  const cv = document.createElement("canvas")
  cv.width = cv.height = R
  const ctx = cv.getContext("2d")!
  ctx.drawImage(src, 0, 0, R, R)
  const d = ctx.getImageData(0, 0, R, R).data
  const h = new Float32Array(R * R)
  const ao = new Float32Array(R * R).fill(1)
  const rough = new Float32Array(R * R)
  let mean = 0
  for (let i = 0; i < R * R; i++) mean += (h[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255)
  mean /= R * R
  const pitch = R / rows
  const grooveHalf = Math.max(2, (0.004 / size) * R)
  for (let y = 0; y < R; y++) {
    const t = y % pitch
    const dist = Math.min(t, pitch - t)
    const g = dist < grooveHalf ? 1 - dist / grooveHalf : 0
    const occl = dist < grooveHalf * 4 ? 1 - 0.55 * (1 - dist / (grooveHalf * 4)) ** 2 : 1
    for (let x = 0; x < R; x++) {
      const i = y * R + x
      rough[i] = 0.62 + (mean - h[i]) * 0.5 + g * 0.3
      h[i] = h[i] * 0.6 - g * 4
      ao[i] = occl
    }
  }
  const make = (fill: (o: Uint8ClampedArray, i: number) => void) => {
    const c = document.createElement("canvas")
    c.width = c.height = R
    const cx = c.getContext("2d")!
    const id = cx.createImageData(R, R)
    for (let i = 0; i < R * R; i++) {
      fill(id.data, i)
      id.data[i * 4 + 3] = 255
    }
    cx.putImageData(id, 0, 0)
    return canvasTexture(c, size, false)
  }
  const k = 2.2
  const normalMap = make((o, i) => {
    const x = i % R
    const y = (i - x) / R
    const dx = h[y * R + ((x + 1) % R)] - h[y * R + ((x + R - 1) % R)]
    const dy = h[((y + 1) % R) * R + x] - h[((y + R - 1) % R) * R + x]
    let nx = -dx * k
    let ny = dy * k
    const l = Math.hypot(nx, ny, 1)
    nx /= l
    ny /= l
    o[i * 4] = (nx * 0.5 + 0.5) * 255
    o[i * 4 + 1] = (ny * 0.5 + 0.5) * 255
    o[i * 4 + 2] = (0.5 / l + 0.5) * 255
  })
  const roughnessMap = make((o, i) => {
    o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = Math.min(1, Math.max(0.2, rough[i])) * 255
  })
  const aoMap = make((o, i) => {
    o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = ao[i] * 255
  })
  cv.width = cv.height = 0
  return { normalMap, roughnessMap, aoMap }
}

/** 壁・天井クロスの織り目エンボス (細かなノイズの凹凸)。0.5m 角でタイル */
function clothNormal(seed: number) {
  const R = 512
  const rnd = seeded(seed)
  const h = new Float32Array(R * R)
  for (let i = 0; i < R * R; i++) h[i] = rnd()
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < R; y++) {
      for (let x = 0; x < R; x++) {
        const i = y * R + x
        h[i] = (h[i] * 2 + h[y * R + ((x + 1) % R)] + h[((y + 1) % R) * R + x]) / 4
      }
    }
  }
  const c = document.createElement("canvas")
  c.width = c.height = R
  const cx = c.getContext("2d")!
  const id = cx.createImageData(R, R)
  const k = 1.6
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const i = y * R + x
      const nx = -(h[y * R + ((x + 1) % R)] - h[y * R + ((x + R - 1) % R)]) * k
      const ny = (h[((y + 1) % R) * R + x] - h[((y + R - 1) % R) * R + x]) * k
      const l = Math.hypot(nx, ny, 1)
      id.data[i * 4] = (nx / l * 0.5 + 0.5) * 255
      id.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255
      id.data[i * 4 + 2] = (0.5 / l + 0.5) * 255
      id.data[i * 4 + 3] = 255
    }
  }
  cx.putImageData(id, 0, 0)
  return canvasTexture(c, 0.5, false)
}

/** ファブリックの柄を無彩色にして平均 0.5 (リニア ≒ 0.21) に揃える。色はマテリアルの color で付ける */
function grayFabric(img: HTMLImageElement, size: number) {
  const cv = document.createElement("canvas")
  cv.width = img.width
  cv.height = img.height
  const ctx = cv.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, cv.width, cv.height)
  const d = id.data
  let mean = 0
  for (let i = 0; i < d.length; i += 4) mean += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11
  mean /= d.length / 4
  const k = 128 / mean
  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * k
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(id, 0, 0)
  return canvasTexture(cv, size)
}

/** 突板1枚貼り (建具の白杢)。木目方向 = テクスチャの U。元画像の解像度のまま使う */
function veneer(src: HTMLImageElement, filter: string, size: number) {
  const cv = document.createElement("canvas")
  cv.width = src.width
  cv.height = src.height
  const ctx = cv.getContext("2d")!
  withFiltered(src, filter, (img) => ctx.drawImage(img, 0, 0))
  return canvasTexture(cv, size)
}

/** 木調タイルデッキ: 600 角を 4×4 枚 (2.4m 角)。タイルごとに木目を切り出し、正方形の目地を引く */
function deckTiles(src: HTMLImageElement, filter: string, size: number) {
  const S = 1024
  const n = 4
  const t = S / n
  const cv = document.createElement("canvas")
  cv.width = cv.height = S
  const ctx = cv.getContext("2d")!
  const rnd = seeded(31)
  withFiltered(src, filter, (img) => {
    const cw = img.width / 2
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.drawImage(img, rnd() * (img.width - cw), rnd() * (img.height - cw), cw, cw, i * t, j * t, t, t)
      }
    }
  })
  ctx.fillStyle = "rgba(70,70,66,0.95)"
  const g = Math.max(2, Math.round((0.006 / 0.6) * t))
  for (let i = 0; i < n; i++) {
    ctx.fillRect(i * t, 0, g, S)
    ctx.fillRect(0, i * t, S, g)
  }
  return canvasTexture(cv, size)
}

/**
 * 横長の大判タイル (芋目地)。テクスチャ 1 枚 = size m 角に cols × rows 枚。
 * 平面投影 UV で壁の端・床から目地が始まる
 */
function wallTiles(base: [number, number, number], cols: number, rows: number, size: number, seed: number) {
  const S = 1024
  const cv = document.createElement("canvas")
  cv.width = cv.height = S
  const ctx = cv.getContext("2d")!
  const rnd = seeded(seed)
  const tw = S / cols
  const th = S / rows
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const k = 1 + (rnd() - 0.5) * 0.06
      ctx.fillStyle = `rgb(${base.map((c) => Math.round(c * k)).join(",")})`
      ctx.fillRect(i * tw, j * th, tw, th)
      for (let n = 0; n < 40; n++) {
        const x = i * tw + rnd() * tw
        const y = j * th + rnd() * th
        const r = 20 + rnd() * 90
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        const c = rnd() > 0.5 ? "255,255,255" : "0,0,0"
        g.addColorStop(0, `rgba(${c},${rnd() * 0.035})`)
        g.addColorStop(1, `rgba(${c},0)`)
        ctx.save()
        ctx.beginPath()
        ctx.rect(i * tw, j * th, tw, th)
        ctx.clip()
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
        ctx.restore()
      }
    }
  }
  const id = ctx.getImageData(0, 0, S, S)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 8
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(id, 0, 0)
  const joint = Math.max(2, Math.round((0.004 / size) * S))
  ctx.fillStyle = "rgb(92,92,90)"
  for (let i = 0; i < cols; i++) ctx.fillRect(i * tw - joint / 2, 0, joint, S)
  for (let j = 0; j < rows; j++) ctx.fillRect(0, j * th - joint / 2, S, joint)
  ctx.fillRect(S - joint / 2, 0, joint, S)
  ctx.fillRect(0, S - joint / 2, S, joint)
  return canvasTexture(cv, size)
}

/** モルタル / 石目: コテムラ (大きなぼかし斑) + 細かな骨材ノイズ */
function mottled(base: [number, number, number], blob: number, grain: number, size: number, seed: number) {
  const S = 1024
  const cv = document.createElement("canvas")
  cv.width = cv.height = S
  const ctx = cv.getContext("2d")!
  const rnd = seeded(seed)
  ctx.fillStyle = `rgb(${base.join(",")})`
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const r = 40 + rnd() * 220
    const light = rnd() > 0.5
    const a = rnd() * blob
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r)
        const c = light ? "255,255,255" : "0,0,0"
        g.addColorStop(0, `rgba(${c},${a})`)
        g.addColorStop(1, `rgba(${c},0)`)
        ctx.fillStyle = g
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2)
      }
    }
  }
  const id = ctx.getImageData(0, 0, S, S)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * grain
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(id, 0, 0)
  return canvasTexture(cv, size)
}

export type UVMode = "plan" | "vertical"

export interface MaterialLib {
  byName: Record<string, Material>
  /** ワールド座標から平面投影 UV を生成するマテリアル */
  uv: Record<string, UVMode>
  kitchenBody: MeshPhysicalMaterial
  kitchenTop: MeshPhysicalMaterial
  led: MeshStandardMaterial
  /** 壁クロス。昼は emissive で面の向きによる明暗差を薄め、どの壁も白に近いライトグレーに揃える */
  wall: MeshStandardMaterial
  ceilWood: MeshStandardMaterial
  ceilWhite: MeshStandardMaterial
}

export function createMaterials(tex: TextureSet, opt: MaterialOptions): MaterialLib {
  const wood = boards(tex.ash, "brightness(1.36) sepia(0.12) saturate(0.8)", 1.5)
  const woodTex = wood.map
  const woodRelief = opt.detail ? reliefMaps(wood.canvas, BOARD_ROWS, 1.5) : undefined
  const walnutTex = boards(tex.ash, "brightness(0.55) sepia(0.9) saturate(1.6) hue-rotate(-12deg)", 0.8, false).map
  const doorTex = veneer(tex.ash, "brightness(1.62) saturate(0.2) contrast(0.82)", 1.2)
  const mortarTex = mottled([128, 128, 125], 0.09, 26, 2.0, 11)
  const tileTex = mottled([200, 191, 174], 0.022, 10, 2.4, 23)
  const deckTex = deckTiles(tex.ash, "brightness(0.62) sepia(0.7) saturate(1.1)", 2.4)
  const tvWallTex = wallTiles([168, 168, 165], 2, 4, 2.36, 41)
  const pianoTex = veneer(tex.ash, "brightness(0.7) sepia(0.75) saturate(1.35) hue-rotate(-18deg)", 1.0)

  const floor = new MeshStandardMaterial({
    map: wrap(tex.floorDiff, 1.7, true),
    normalMap: wrap(tex.floorNor, 1.7),
    roughnessMap: wrap(tex.floorRough, 1.7),
    roughness: opt.detail ? 0.58 : 0.75,
    color: lin(1.0, 0.97, 0.94),
  })
  floor.normalScale.set(0.6, 0.6)

  const mortar = std(lin(1.15, 1.15, 1.13), 0.6, { map: mortarTex })
  if (opt.reflective) {
    patchMaterial(floor, { reflective: true })
    patchMaterial(mortar, { reflective: true })
  }

  const kitchenBody = new MeshPhysicalMaterial({ color: lin(0.007, 0.007, 0.007), roughness: 0.6, specularIntensity: 0.3 })
  const kitchenTop = new MeshPhysicalMaterial({ color: lin(0.011, 0.011, 0.0105), roughness: 0.35, specularIntensity: 0.3 })
  const cloth = opt.detail ? clothNormal(5) : undefined
  const clothExtra = cloth ? { normalMap: cloth, normalScale: new Vector2(0.35, 0.35) } : {}
  const wall = std(lin(0.8, 0.8, 0.797), 0.92, {
    emissive: lin(0.8, 0.8, 0.797),
    emissiveIntensity: 0,
    ...clothExtra,
  })
  const led = std(lin(0.9, 0.9, 0.9), 0.5, { emissive: lin(1, 0.76, 0.52), emissiveIntensity: 0 })
  const ceilWood = std(lin(1, 1, 1), 0.7, { map: woodTex, ...(woodRelief ?? {}) })
  if (woodRelief) {
    ceilWood.roughness = 1
    ceilWood.normalScale.set(0.8, 0.8)
    ceilWood.aoMapIntensity = 1
  }
  const ceilWhite = std(lin(0.8, 0.8, 0.785), 0.93, clothExtra)
  const door = std(lin(1, 1, 1), 0.62, { map: doorTex })

  const glass =
    opt.glass === "transmit"
      ? new MeshPhysicalMaterial({
          color: lin(0.9, 0.95, 0.93),
          roughness: 0,
          metalness: 0,
          transmission: 1,
          ior: 1.52,
          thickness: 0.012,
          attenuationColor: lin(0.86, 0.94, 0.9),
          attenuationDistance: 0.4,
          specularIntensity: 1,
          envMapIntensity: 1,
        })
      : new MeshPhysicalMaterial({
          color: lin(0.96, 0.98, 0.97),
          roughness: 0.02,
          metalness: 0,
          transparent: true,
          opacity: 0.12,
          envMapIntensity: 1.2,
          depthWrite: false,
        })

  const linen = opt.detail && tex.linen ? grayFabric(tex.linen, 0.32) : undefined
  const linenNor = tex.linenNor && opt.detail ? wrap(tex.linenNor, 0.32) : undefined
  const fabric = (c: Color, sheen: Color, extra: Partial<MeshPhysicalMaterial> = {}) =>
    linen
      ? new MeshPhysicalMaterial({
          color: c.clone().multiplyScalar(1 / 0.216),
          map: linen,
          normalMap: linenNor,
          normalScale: new Vector2(0.9, 0.9),
          roughness: 0.92,
          sheen: 0.8,
          sheenRoughness: 0.7,
          sheenColor: sheen,
          ...extra,
        })
      : std(c, 0.95, extra as Partial<MeshStandardMaterial>)
  const lawn =
    opt.detail && tex.grassNor
      ? std(lin(1, 1, 1), 0.95, { map: mottled([84, 115, 56], 0.16, 18, 4.0, 51), normalMap: wrap(tex.grassNor, 1.2) })
      : std(lin(0.09, 0.17, 0.04), 0.9)

  const shrubs = Object.fromEntries(
    Object.entries(tex.shrubs).map(([name, [diff, nor]]) => {
      for (const t of [diff, nor]) {
        t.flipY = false
        t.needsUpdate = true
      }
      diff.colorSpace = SRGBColorSpace
      return [
        name,
        new MeshStandardMaterial({
          map: diff,
          normalMap: nor,
          alphaTest: 0.5,
          side: DoubleSide,
          roughness: 0.65,
          color: lin(0.85, 0.85, 0.85),
        }),
      ]
    }),
  )

  const byName: Record<string, Material> = {
    ...shrubs,
    "植栽帯_バークチップ": std(lin(0.07, 0.05, 0.035), 0.95),
    "挽板フローリング_オーク": floor,
    "天井_明るい木目シート": ceilWood,
    "ウォールナット": std(lin(1, 1, 1), 0.5, { map: walnutTex }),
    "壁_クロス_ペールグレーN9.3": wall,
    "TV壁_トラバーチン調大判": std(lin(1, 1, 1), 0.55, { map: tvWallTex }),
    "キッチン床_モルタル調": mortar,
    "見切り_ステンレスHL": new MeshStandardMaterial({ color: lin(0.55, 0.55, 0.54), roughness: 0.35, metalness: 1 }),
    "建具_白杢": door,
    "建具_白杢_Y": door,
    "隣室_壁": std(lin(0.6, 0.6, 0.59), 0.9),
    "目地": std(lin(0.004, 0.004, 0.004), 0.9),
    "IH_ブラックガラス": std(lin(0.005, 0.005, 0.005), 0.08),
    "ステンレス": new MeshStandardMaterial({ color: lin(0.62, 0.62, 0.6), roughness: 0.3, metalness: 1 }),
    "黒スチール": new MeshStandardMaterial({ color: lin(0.02, 0.02, 0.02), roughness: 0.4, metalness: 0.6 }),
    "サッシ枠_ブラック": new MeshStandardMaterial({ color: lin(0.03, 0.03, 0.03), roughness: 0.42, metalness: 0.4 }),
    "Low-E複層ガラス": glass,
    "ソファ_グレージュファブリック": fabric(lin(0.47, 0.44, 0.4), lin(0.62, 0.6, 0.56)),
    "クッション": fabric(lin(0.3, 0.27, 0.24), lin(0.45, 0.42, 0.38)),
    "ラグ_ウール": fabric(lin(0.6, 0.57, 0.52), lin(0.7, 0.68, 0.64)),
    "トラバーチン": std(lin(1.2, 1.15, 1.08), 0.45, { map: tileTex }),
    "チェア_レザー": std(lin(0.16, 0.1, 0.07), 0.55),
    "TV_画面": std(lin(0.004, 0.004, 0.004), 0.05),
    "レースカーテン": std(lin(0.92, 0.91, 0.88), 0.9, {
      transparent: true,
      opacity: 0.62,
      side: DoubleSide,
      depthWrite: false,
    }),
    "ドレープカーテン_リネン": fabric(lin(0.52, 0.48, 0.43), lin(0.6, 0.57, 0.52), { side: DoubleSide }),
    "外壁_ダインコンクリート調": std(lin(0.52, 0.51, 0.48), 0.85),
    "テラス_木調タイルデッキ": std(lin(1, 1, 1), 0.7, { map: deckTex }),
    "ピアノ_木目": std(lin(1, 1, 1), 0.3, { map: pianoTex }),
    "鍵盤_白": std(lin(0.82, 0.8, 0.75), 0.2),
    "鍵盤_黒": std(lin(0.01, 0.01, 0.01), 0.25),
    "真鍮": new MeshStandardMaterial({ color: lin(0.8, 0.62, 0.32), roughness: 0.3, metalness: 1 }),
    "芝生": lawn,
    "生垣":
      opt.detail && tex.grassNor
        ? std(lin(1, 1, 1), 0.85, {
            map: mottled([48, 72, 30], 0.22, 30, 1.6, 61),
            normalMap: wrap(tex.grassNor, 0.7),
            normalScale: new Vector2(1.6, 1.6),
          })
        : std(lin(0.03, 0.08, 0.02), 0.85),
    "葉": std(lin(0.07, 0.13, 0.04), 0.5, { side: DoubleSide }),
    "葉_オリーブ": std(lin(0.13, 0.15, 0.08), 0.5, { side: DoubleSide }),
    "幹": std(lin(0.12, 0.09, 0.07), 0.9),
    "鉢_モルタル": std(lin(0.34, 0.33, 0.31), 0.85),
    "鼻隠し": std(lin(0.1, 0.1, 0.1), 0.6),
    "ダウンライト枠": std(lin(0.85, 0.85, 0.83), 0.5),
    "フロアランプ_シェード": std(lin(0.85, 0.8, 0.72), 0.85),
    "LED": led,
    "本1": std(lin(0.55, 0.5, 0.44), 0.8),
    "本2": std(lin(0.12, 0.12, 0.12), 0.8),
    "花器": std(lin(0.7, 0.67, 0.62), 0.6),
  }
  return {
    byName,
    uv: {
      "挽板フローリング_オーク": "plan",
      "天井_明るい木目シート": "plan",
      "ウォールナット": "plan",
      "キッチン床_モルタル調": "plan",
      "TV壁_トラバーチン調大判": "plan",
      "トラバーチン": "plan",
      "テラス_木調タイルデッキ": "plan",
      "ピアノ_木目": "vertical",
      "建具_白杢": "vertical",
      "建具_白杢_Y": "vertical",
      ...(opt.detail
        ? {
            "壁_クロス_ペールグレーN9.3": "plan",
            "ソファ_グレージュファブリック": "plan",
            "クッション": "plan",
            "ラグ_ウール": "plan",
            "ドレープカーテン_リネン": "plan",
            "芝生": "plan",
            "生垣": "plan",
          }
        : {}),
    },
    kitchenBody,
    kitchenTop,
    led,
    wall,
    ceilWood,
    ceilWhite,
  }
}

export function kitchenMaterialFor(name: string, lib: MaterialLib): Material | undefined {
  if (name.startsWith("キッチン_")) return lib.kitchenBody
  if (name.startsWith("天板_セラミック")) return lib.kitchenTop
  return undefined
}

export const KITCHEN_PALETTE = {
  // 黒は窓の映り込みで灰色に浮きやすいので、鏡面反射 (F0) も弱めて艶消しの黒に見せる
  black: { body: lin(0.007, 0.007, 0.007), bodyRough: 0.6, top: lin(0.011, 0.011, 0.0105), spec: 0.3 },
  white: { body: lin(0.8, 0.8, 0.78), bodyRough: 0.55, top: lin(0.8, 0.8, 0.78), spec: 1 },
} as const

/**
 * Blender から UV なしで出力されたメッシュに、ワールド座標の平面投影 UV を付与する。
 * plan    : 床・天井は U = 南北 (Blender y = -three z)、V = 東西 (x)
 * vertical: 建具の縦木目。U = 高さ、V = 壁に沿う水平方向
 */
export function applyWorldUV(mesh: Mesh, mode: UVMode = "plan") {
  const g = mesh.geometry
  const pos = g.getAttribute("position")
  const nor = g.getAttribute("normal")
  if (!pos || !nor) return
  mesh.updateWorldMatrix(true, false)
  const nm = new Matrix3().getNormalMatrix(mesh.matrixWorld)
  const p = new Vector3()
  const n = new Vector3()
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize()
    const ax = Math.abs(n.x)
    const ay = Math.abs(n.y)
    const az = Math.abs(n.z)
    let u: number
    let v: number
    if (mode === "vertical") {
      if (ay >= ax && ay >= az) {
        u = p.x
        v = -p.z
      } else if (ax >= az) {
        u = p.y
        v = -p.z
      } else {
        u = p.y
        v = p.x
      }
    } else if (ay >= ax && ay >= az) {
      u = -p.z
      v = p.x
    } else if (ax >= az) {
      u = -p.z
      v = p.y
    } else {
      u = p.x
      v = p.y
    }
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  g.setAttribute("uv", new BufferAttribute(uv, 2))
}
