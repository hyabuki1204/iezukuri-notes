// 生成テクスチャ (木目の色調整・石目・クロスの凹凸など) を WebP に焼いて public/baked/ に置く。
// materials.ts の生成処理を変えたら実行し直す:  node ldk/scripts/bake-textures.cjs
// (Playwright の Chromium を使う。ldk/ で vite を一時的に起動する)
const { spawn } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const { chromium } = require("playwright")

const LDK = path.resolve(__dirname, "..")
const OUT = path.join(LDK, "public/baked")
const MANIFEST = path.join(LDK, "src/scene/bakedTextures.json")
const PORT = 5399

function fnv(s) {
  let h = 0x811c9dc5
  for (const ch of Buffer.from(s, "utf8")) {
    h ^= ch
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

;(async () => {
  const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: LDK, stdio: "ignore" })
  try {
    await new Promise((r) => setTimeout(r, 4000))
    const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
    page.on("pageerror", (e) => console.error("pageerror", e.message))
    // ULTRA で開くと凹凸マップなど全種類が生成される
    await page.goto(`http://localhost:${PORT}/?bake=1&q=ultra&panel=0`)
    await page.waitForFunction(() => typeof window.__ldkBake === "function", null, { timeout: 120000 })
    await page.waitForTimeout(20000)
    const items = await page.evaluate(() => window.__ldkBake())
    await browser.close()
    if (items.length === 0) throw new Error("生成されたテクスチャがありません")
    fs.rmSync(OUT, { recursive: true, force: true })
    fs.mkdirSync(OUT, { recursive: true })
    const manifest = {}
    let bytes = 0
    for (const { key, full, half } of items.sort((a, b) => a.key.localeCompare(b.key))) {
      const h = fnv(key)
      manifest[key] = h
      for (const [suffix, url] of [["", full], ["_m", half]]) {
        const buf = Buffer.from(url.split(",")[1], "base64")
        fs.writeFileSync(path.join(OUT, `${h}${suffix}.webp`), buf)
        if (suffix === "_m") bytes += buf.length
      }
      console.log(h, key)
    }
    fs.writeFileSync(MANIFEST, JSON.stringify({ items: manifest }, null, 2) + "\n")
    console.log(`${items.length} 枚。スマホ用の合計 ${(bytes / 1e6).toFixed(2)}MB`)
  } finally {
    vite.kill()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
