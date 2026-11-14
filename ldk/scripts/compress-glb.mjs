// glb の頂点・インデックスを EXT_meshopt_compression で圧縮する (可逆。量子化はしない)。
// Vercel は glb (model/gltf-binary) を gzip/brotli で配らないので、ファイル自体を小さくしておく。
// 読み込みは drei の useGLTF が MeshoptDecoder を既定で使う。
//
// Blender から書き出し直したら実行する (依存はリポジトリに入れていないので一時的に入れる):
//   npm i --no-save --prefix /tmp/gltf @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer@0.22
//   NODE_PATH=/tmp/gltf/node_modules node ldk/scripts/compress-glb.mjs ldk/public/models/*.glb
//
// 量子化 (KHR_mesh_quantization) はしない: 頂点がワールド座標のまま入っていて、merge.ts で applyMatrix4 したり
// ライトマップ UV を複製したりするため、整数化すると座標がずれる。
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(path.join(process.env.NODE_PATH ?? process.cwd(), "x.js"))
const { NodeIO } = require("@gltf-transform/core")
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require("@gltf-transform/extensions")
const { reorder } = require("@gltf-transform/functions")
const { MeshoptDecoder, MeshoptEncoder } = require("meshoptimizer")

await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder })

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file)
  const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)
  if (used.includes(EXTMeshoptCompression.EXTENSION_NAME)) {
    console.log(`${file}: 圧縮済み`)
    continue
  }
  // 頂点の並びを圧縮しやすい順に (形は変わらない)
  await doc.transform(reorder({ encoder: MeshoptEncoder, target: "size" }))
  // QUANTIZE = フィルタなし。法線などを 8bit に丸める FILTER は使わない
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  const before = (await import("node:fs")).statSync(file).size
  await io.write(file, doc)
  const after = (await import("node:fs")).statSync(file).size
  console.log(`${file}: ${(before / 1e6).toFixed(2)}MB -> ${(after / 1e6).toFixed(2)}MB`)
}
