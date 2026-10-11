import { NoBlending, ShaderMaterial, type Texture } from "three"

/**
 * パストレース結果を画面に出すシェーダー。
 * 周囲 8 画素より飛び抜けて明るい 1 画素 (軒や庭の照り返しをまれに拾う経路で出る白い粒) を周囲の明るさまで抑え、
 * サンプルが少ないうちは明るさの相対差で輪郭を判定するぼかしで粒状ノイズを均す。最後にトーンマップする
 */
export class PtOutputMaterial extends ShaderMaterial {
  constructor() {
    super({
      blending: NoBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        map: { value: null as Texture | null },
        opacity: { value: 1 },
        /** 0 で生の結果、1 で最大のぼかし */
        strength: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float opacity;
        uniform float strength;
        varying vec2 vUv;

        float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

        vec3 fetch(ivec2 p, ivec2 size) {
          return texelFetch(map, clamp(p, ivec2(0), size - 1), 0).rgb;
        }

        void main() {
          ivec2 size = textureSize(map, 0);
          ivec2 p = ivec2(vUv * vec2(size));
          vec3 c = fetch(p, size);

          float nMax = 0.0;
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              if (x == 0 && y == 0) continue;
              nMax = max(nMax, lum(fetch(p + ivec2(x, y), size)));
            }
          }
          float lc = lum(c);
          float cap = nMax * 1.6 + 1e-4;
          if (lc > cap) c *= cap / lc;
          lc = lum(c);

          if (strength > 0.01) {
            float sr = 0.12 + 0.5 * strength;
            vec3 acc = c;
            float wsum = 1.0;
            for (int y = -3; y <= 3; y++) {
              for (int x = -3; x <= 3; x++) {
                if (x == 0 && y == 0) continue;
                vec3 s = fetch(p + ivec2(x, y), size);
                float ls = min(lum(s), cap);
                float d = (ls - lc) / (max(ls, lc) + 1e-3);
                float w = exp(-float(x * x + y * y) / (2.0 * 4.0 * strength * strength + 1e-3)) * exp(-d * d / (2.0 * sr * sr));
                acc += s * (ls / max(lum(s), 1e-5)) * w;
                wsum += w;
              }
            }
            c = acc / wsum;
          }

          gl_FragColor = vec4(c, opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })
  }
}
