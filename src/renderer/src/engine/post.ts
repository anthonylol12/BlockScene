// Cadena de postproceso compartida por el visor y el render final:
// escena → (profundidad) → (GTAO) → (shaders externos HDR) → (bloom) → tono/sRGB → gradación → (shaders externos LDR)
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import type { EnvironmentSettings } from '@shared/types'
import { DepthPrePass, makeShared, userPass, type ActiveShader } from './userShaders'

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVig: { value: 0.2 },
    uSat: { value: 1 },
    uCon: { value: 1 },
    uWarm: { value: 0 },
    uGrain: { value: 0 },
    uSeed: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVig, uSat, uCon, uWarm, uGrain, uSeed;
    uniform vec2 uRes;
    varying vec2 vUv;
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = t.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uCon + 0.5;
      c += vec3(uWarm * 0.06, uWarm * 0.015, -uWarm * 0.06);
      vec2 d = vUv - 0.5;
      d.x *= uRes.x / uRes.y;
      c *= 1.0 - uVig * smoothstep(0.25, 1.05, length(d) * 1.25);
      float n = fract(sin(dot(floor(vUv * uRes) + uSeed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      c += n * uGrain * 0.09;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
    }`
}

export interface PostChain {
  composer: EffectComposer
  /** clave de estructura: si cambia hay que reconstruir la cadena */
  key: string
  update(env: EnvironmentSettings, seed?: number, shaders?: ActiveShader[]): void
  setSize(w: number, h: number): void
  setTime(t: number): void
  dispose(): void
}

/** hash del código del shader: si cambia el contenido (aunque mida lo mismo) se reconstruye la cadena */
function hash(t: string): string {
  let h = 5381
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
const shaderKey = (s: ActiveShader[]): string => s.map((x) => `${x.file}:${x.meta.stage}:${x.meta.depth}:${hash(x.source)}`).join(',')
export const postKey = (env: EnvironmentSettings, shaders: ActiveShader[] = []): string => `${env.quality.ao}|${env.post.bloom > 0}|${shaderKey(shaders)}`

export function createPost(
  renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number,
  env: EnvironmentSettings, pixelRatio?: number, shaders: ActiveShader[] = [], depthMap?: () => THREE.Texture | null
): PostChain {
  const composer = new EffectComposer(renderer)
  if (pixelRatio != null) composer.setPixelRatio(pixelRatio)
  composer.setSize(w, h)
  const shared = makeShared()
  let depth: DepthPrePass | null = null
  if (shaders.some((s) => s.meta.depth)) {
    depth = new DepthPrePass(scene, camera, shared, depthMap)
    composer.addPass(depth)
  }
  composer.addPass(new RenderPass(scene, camera))
  if (env.quality.ao) {
    const gtao = new GTAOPass(scene, camera, w, h)
    gtao.updateGtaoMaterial({ radius: 1.2, distanceFallOff: 1, thickness: 1.5, scale: 1 })
    composer.addPass(gtao)
  }
  const userPasses: { file: string; pass: ShaderPass }[] = []
  for (const s of shaders.filter((x) => x.meta.stage === 'hdr')) {
    const p = userPass(s, shared)
    userPasses.push({ file: s.file, pass: p })
    composer.addPass(p)
  }
  let bloom: UnrealBloomPass | null = null
  if (env.post.bloom > 0) {
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), env.post.bloom, 0.6, env.post.bloomThreshold)
    composer.addPass(bloom)
  }
  composer.addPass(new OutputPass())
  const grade = new ShaderPass(GradeShader)
  composer.addPass(grade)
  for (const s of shaders.filter((x) => x.meta.stage === 'ldr')) {
    const p = userPass(s, shared)
    userPasses.push({ file: s.file, pass: p })
    composer.addPass(p)
  }
  const chain: PostChain = {
    composer,
    key: postKey(env, shaders),
    update(e, seed = 0, sh) {
      if (bloom) {
        bloom.strength = e.post.bloom
        bloom.threshold = e.post.bloomThreshold
      }
      const u = grade.uniforms
      u.uVig.value = e.post.vignette
      u.uSat.value = e.post.saturation
      u.uCon.value = e.post.contrast
      u.uWarm.value = e.post.warmth
      u.uGrain.value = e.post.grain
      u.uSeed.value = seed
      for (const s of sh ?? []) {
        const up = userPasses.find((x) => x.file === s.file)
        if (!up) continue
        for (const p of s.meta.params) if (up.pass.uniforms[p.name]) up.pass.uniforms[p.name].value = s.values[p.name] ?? p.def
      }
    },
    setSize(nw, nh) {
      composer.setSize(nw, nh)
      const pr = pixelRatio ?? renderer.getPixelRatio()
      grade.uniforms.uRes.value.set(nw * pr, nh * pr)
      shared.uResolution.value.set(nw * pr, nh * pr)
      depth?.setSize(nw * pr, nh * pr)
    },
    setTime(t) {
      shared.uTime.value = t
    },
    dispose() {
      depth?.dispose()
      composer.dispose()
    }
  }
  chain.setSize(w, h)
  chain.update(env, 0, shaders)
  return chain
}
