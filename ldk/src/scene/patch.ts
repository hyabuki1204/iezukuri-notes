import { Matrix4, type MeshStandardMaterial, ShaderChunk, type Texture, Uniform } from "three"

/** 床の鏡面反射 (ULTRA)。全ての床マテリアルが同じ uniform を参照し、FloorReflector が毎フレーム更新する */
export const reflection = {
  map: new Uniform<Texture | null>(null),
  matrix: new Uniform(new Matrix4()),
  /** 0 = 環境マップのみ, 1 = 平面反射のみ */
  mix: new Uniform(0),
  lodMax: new Uniform(6),
}

interface PatchOptions {
  /** 焼き込みライトマップの面: 環境マップからの拡散光を切る (ライトマップに空・照り返しが入っている) */
  lightmapped?: boolean
  /** 床: 環境マップの鏡面反射を平面反射で置き換える */
  reflective?: boolean
}

/**
 * MeshStandardMaterial のシェーダーを差し替える。
 * 鏡面反射は RE_IndirectSpecular に渡す radiance を置き換えるため、フレネル・粗さによる減衰は three の物理モデルのまま
 */
export function patchMaterial(mat: MeshStandardMaterial, opt: PatchOptions) {
  const key = `${opt.lightmapped ? "L" : ""}${opt.reflective ? "R" : ""}`
  if (!key) return mat
  mat.customProgramCacheKey = () => key
  mat.userData.reflective = !!opt.reflective
  mat.onBeforeCompile = (shader) => {
    if (opt.lightmapped) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_maps>",
        ShaderChunk.lights_fragment_maps.replace("iblIrradiance += getIBLIrradiance( geometryNormal );", ""),
      )
    }
    if (opt.reflective) {
      shader.uniforms.reflMap = reflection.map
      shader.uniforms.reflMatrix = reflection.matrix
      shader.uniforms.reflMix = reflection.mix
      shader.uniforms.reflLodMax = reflection.lodMax
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 reflMatrix;\nvarying vec4 vReflCoord;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvReflCoord = reflMatrix * modelMatrix * vec4( transformed, 1.0 );",
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform sampler2D reflMap;\nuniform float reflMix;\nuniform float reflLodMax;\nvarying vec4 vReflCoord;\n#define REFL_CLAMP 0.15\n#define REFL_MIX 0.7",
        )
        .replace(
          "#include <lights_fragment_end>",
          `{
            vec2 ruv = vReflCoord.xy / vReflCoord.w + normal.xz * 0.012;
            float lod = clamp( material.roughness * reflLodMax * 1.6 + 1.5, 0.0, reflLodMax );
            vec3 refl = textureLod( reflMap, ruv, lod ).rgb;
            refl *= REFL_CLAMP / max( REFL_CLAMP, max( refl.r, max( refl.g, refl.b ) ) );
            radiance = mix( radiance, refl, reflMix * REFL_MIX );
          }
          #include <lights_fragment_end>`,
        )
    }
  }
  mat.needsUpdate = true
  return mat
}
