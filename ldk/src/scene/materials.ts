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
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from "three"

export interface TextureSet {
  floorDiff: Texture
  floorNor: Texture
  floorRough: Texture
  ash: HTMLImageElement
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

function canvasTexture(cv: HTMLCanvasElement, size: number) {
  const t = new CanvasTexture(cv)
  t.colorSpace = SRGBColorSpace
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
  const S = 2048
  const cv = document.createElement("canvas")
  cv.width = cv.height = S
  const ctx = cv.getContext("2d")!
  const n = 10
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
  kitchenBody: MeshStandardMaterial
  kitchenTop: MeshStandardMaterial
  led: MeshStandardMaterial
  /** 壁クロス。昼は emissive で面の向きによる明暗差を薄め、どの壁も白に近いライトグレーに揃える */
  wall: MeshStandardMaterial
  ceilWood: MeshStandardMaterial
  ceilWhite: MeshStandardMaterial
}

export function createMaterials(tex: TextureSet): MaterialLib {
  const woodTex = boards(tex.ash, "brightness(1.36) sepia(0.12) saturate(0.8)", 1.5)
  const walnutTex = boards(tex.ash, "brightness(0.55) sepia(0.9) saturate(1.6) hue-rotate(-12deg)", 0.8, false)
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
    roughness: 0.75,
    color: lin(1.0, 0.97, 0.94),
  })
  floor.normalScale.set(0.6, 0.6)

  const kitchenBody = std(lin(0.018, 0.018, 0.018), 0.6)
  const kitchenTop = std(lin(0.03, 0.03, 0.029), 0.35)
  const wall = std(lin(0.8, 0.8, 0.797), 0.92, { emissive: lin(0.8, 0.8, 0.797), emissiveIntensity: 0 })
  const led = std(lin(0.9, 0.9, 0.9), 0.5, { emissive: lin(1, 0.76, 0.52), emissiveIntensity: 0 })
  const ceilWood = std(lin(1, 1, 1), 0.7, { map: woodTex })
  const ceilWhite = std(lin(0.8, 0.8, 0.785), 0.93)
  const door = std(lin(1, 1, 1), 0.62, { map: doorTex })

  const glass = new MeshPhysicalMaterial({
    color: lin(0.96, 0.98, 0.97),
    roughness: 0.02,
    metalness: 0,
    transparent: true,
    opacity: 0.12,
    envMapIntensity: 1.2,
    depthWrite: false,
  })

  const byName: Record<string, Material> = {
    "挽板フローリング_オーク": floor,
    "天井_明るい木目シート": ceilWood,
    "ウォールナット": std(lin(1, 1, 1), 0.5, { map: walnutTex }),
    "壁_クロス_ペールグレーN9.3": wall,
    "TV壁_トラバーチン調大判": std(lin(1, 1, 1), 0.55, { map: tvWallTex }),
    "キッチン床_モルタル調": std(lin(1.15, 1.15, 1.13), 0.6, { map: mortarTex }),
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
    "ソファ_グレージュファブリック": std(lin(0.47, 0.44, 0.4), 0.95),
    "クッション": std(lin(0.3, 0.27, 0.24), 0.95),
    "ラグ_ウール": std(lin(0.6, 0.57, 0.52), 1),
    "トラバーチン": std(lin(1.2, 1.15, 1.08), 0.45, { map: tileTex }),
    "チェア_レザー": std(lin(0.16, 0.1, 0.07), 0.55),
    "TV_画面": std(lin(0.004, 0.004, 0.004), 0.05),
    "レースカーテン": std(lin(0.92, 0.91, 0.88), 0.9, {
      transparent: true,
      opacity: 0.62,
      side: DoubleSide,
      depthWrite: false,
    }),
    "ドレープカーテン_リネン": std(lin(0.52, 0.48, 0.43), 0.95, { side: DoubleSide }),
    "外壁_ダインコンクリート調": std(lin(0.52, 0.51, 0.48), 0.85),
    "テラス_木調タイルデッキ": std(lin(1, 1, 1), 0.7, { map: deckTex }),
    "ピアノ_木目": std(lin(1, 1, 1), 0.3, { map: pianoTex }),
    "鍵盤_白": std(lin(0.82, 0.8, 0.75), 0.2),
    "鍵盤_黒": std(lin(0.01, 0.01, 0.01), 0.25),
    "真鍮": new MeshStandardMaterial({ color: lin(0.8, 0.62, 0.32), roughness: 0.3, metalness: 1 }),
    "芝生": std(lin(0.09, 0.17, 0.04), 0.9),
    "生垣": std(lin(0.03, 0.08, 0.02), 0.85),
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
  black: { body: lin(0.018, 0.018, 0.018), bodyRough: 0.6, top: lin(0.03, 0.03, 0.029) },
  white: { body: lin(0.8, 0.8, 0.78), bodyRough: 0.55, top: lin(0.8, 0.8, 0.78) },
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
