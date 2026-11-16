import * as THREE from 'three'

// ---------------------------------------------------------------------------------------------
// Niebla con altura: se reemplazan los fragmentos de shader de niebla de three.js.
// Se reutilizan los uniforms de THREE.Fog: fogNear = densidad, fogFar = altura de caída.
// ---------------------------------------------------------------------------------------------
let fogPatched = false
export function patchHeightFog(): void {
  if (fogPatched) return
  fogPatched = true
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif`
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vec4 fogWp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    fogWp = instanceMatrix * fogWp;
  #endif
  vFogWorldPos = ( modelMatrix * fogWp ).xyz;
#endif`
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogWorldPos;
  uniform float fogNear;
  uniform float fogFar;
#endif`
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  float fogDist = length( vFogWorldPos - cameraPosition );
  float fogH = exp( - max( vFogWorldPos.y, 0.0 ) / max( fogFar, 0.5 ) );
  float fogFactor = 1.0 - exp( - fogNear * fogDist * ( 0.25 + 0.75 * fogH ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );
#endif`
}

// ---------------------------------------------------------------------------------------------
// Cielo procedural + nubes volumétricas por raymarching (capa entre altura H y H + grosor)
// ---------------------------------------------------------------------------------------------
const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // siempre en el plano lejano
}`

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uDay;      // 0 noche … 1 día
uniform float uSunset;   // 0..1 tono de atardecer
uniform float uTime;
uniform vec3 uCamPos;
uniform float uClouds;   // 0/1
uniform float uCloudStyle; // 1 = bloques (Minecraft), 0 = volumétricas
uniform float uDensity;
uniform float uScale;
uniform float uDetail;
uniform float uCloudH;
uniform float uSteps;
uniform float uWeatherDark;
uniform vec3 uFogColor;
uniform float uFogAmt;
uniform float uStudio;
uniform vec3 uBg1;
uniform vec3 uBg2;
uniform float uSpecks;
uniform vec2 uRes;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uDetail) break;
    s += a * noise(p);
    n += a;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s / max(n, 0.001);
}
float cloudDensity(vec3 p, float thick) {
  float hfrac = clamp((p.y - uCloudH) / thick, 0.0, 1.0);
  float profile = smoothstep(0.0, 0.25, hfrac) * smoothstep(1.0, 0.55, hfrac);
  vec3 q = p * (0.012 / uScale) + vec3(uTime * 0.02, 0.0, uTime * 0.008);
  float n = fbm(q);
  float cov = 1.0 - uDensity;
  return clamp((n - cov * 0.85) * 3.0, 0.0, 1.0) * profile;
}

vec3 skyColor(vec3 d) {
  float h = d.y;
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
  // halo cálido del atardecer en el lado del sol
  col += uSunColor * uSunset * pow(sd, 6.0) * 0.6 * (1.0 - clamp(h * 2.0, 0.0, 1.0));
  if (h < 0.0) col = mix(uHorizon, uGround, clamp(-h * 4.0, 0.0, 1.0));
  // estrellas de noche
  if (uDay < 0.5 && h > 0.0) {
    vec3 sp = floor(d * 420.0);
    float st = step(0.9985, hash(sp));
    col += vec3(st) * (1.0 - uDay * 2.0) * h;
  }
  // sol cuadrado (como en Minecraft)
  vec3 sT = normalize(cross(uSunDir, abs(uSunDir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 sB = cross(sT, uSunDir);
  float sq = max(abs(dot(d, sT)), abs(dot(d, sB)));
  float inSun = step(0.0, dot(d, uSunDir)) * (1.0 - smoothstep(0.034, 0.037, sq));
  col += uSunColor * (inSun * 14.0 + pow(sd, 300.0) * 0.8) * step(0.0, h + 0.02);
  return col;
}

void main() {
  vec3 d = normalize(vDir);
  if (uStudio > 0.5) {
    // fondo de exhibición: degradado radial en pantalla + motas de polvo (independiente de la resolución)
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 q = uv - vec2(0.5, 0.55);
    q.x *= uRes.x / uRes.y;
    vec3 bg = mix(uBg1, uBg2, smoothstep(0.0, 0.95, length(q)));
    vec2 g = uv * vec2(uRes.x / uRes.y, 1.0) * 140.0;
    vec2 cell = floor(g);
    float h = hash(vec3(cell, 3.0));
    if (h > 0.985) {
      vec2 c = vec2(hash(vec3(cell, 5.0)), hash(vec3(cell, 9.0)));
      float r = length(fract(g) - c);
      bg += vec3(1.0, 0.95, 0.85) * uSpecks * 0.5 * smoothstep(0.09, 0.0, r) * (h - 0.985) * 66.0;
    }
    gl_FragColor = vec4(bg, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }
  vec3 col = skyColor(d);
  if (uClouds > 0.5 && uCloudStyle > 0.5 && d.y > 0.01) {
    // nubes de bloques: capa plana de 4 bloques de grosor dividida en celdas de 12×12
    float H0 = uCloudH, T = 4.0, cell = 12.0 * uScale;
    float t0 = (H0 - uCamPos.y) / d.y;
    float t1 = (H0 + T - uCamPos.y) / d.y;
    if (t0 > 0.0) {
      float dt = (t1 - t0) / 16.0;
      for (int i = 0; i < 16; i++) {
        vec3 p = uCamPos + d * (t0 + (float(i) + 0.5) * dt);
        vec2 c = floor((p.xz + vec2(uTime * 0.8, 0.0)) / cell);
        float nn = noise(vec3(c * 0.21, 0.5)) * 0.7 + noise(vec3(c * 0.63, 7.5)) * 0.3;
        if (nn > 1.0 - uDensity * 0.85) {
          float shade = i == 0 ? 0.74 : 0.9;
          vec3 cc = mix(vec3(1.0), uHorizon, 0.15) * shade * (0.25 + 0.75 * uDay) * (1.0 - uWeatherDark * 0.5);
          float fade = exp(-t0 * 0.0006);
          col = mix(col, cc, 0.9 * fade);
          break;
        }
      }
    }
  }
  if (uClouds > 0.5 && uCloudStyle < 0.5 && d.y > 0.015) {
    float thick = 70.0;
    float camY = uCamPos.y;
    float t0 = max((uCloudH - camY) / d.y, 0.0);
    float t1 = max((uCloudH + thick - camY) / d.y, 0.0);
    if (t1 > t0) {
      float steps = uSteps;
      float dt = (t1 - t0) / steps;
      float T = 1.0;
      vec3 acc = vec3(0.0);
      vec3 amb = mix(uHorizon, uZenith, 0.5) * 0.9;
      float jitter = hash(vec3(gl_FragCoord.xy, uTime));
      for (int i = 0; i < 48; i++) {
        if (float(i) >= steps) break;
        float t = t0 + (float(i) + jitter) * dt;
        vec3 p = uCamPos + d * t;
        float den = cloudDensity(p, thick);
        if (den > 0.01) {
          float ld = cloudDensity(p + uSunDir * 12.0, thick) + cloudDensity(p + uSunDir * 30.0, thick);
          float light = exp(-ld * 1.4);
          float powder = 1.0 - exp(-den * 2.0);
          vec3 c = uSunColor * light * powder * 1.6 * uDay + amb * (0.55 + 0.45 * (1.0 - den));
          c *= (1.0 - uWeatherDark * 0.55);
          float a = 1.0 - exp(-den * dt * 0.06);
          acc += T * a * c;
          T *= 1.0 - a;
          if (T < 0.02) break;
        }
      }
      float fade = exp(-t0 * 0.00035);
      col = mix(col, acc + col * T, fade);
    }
  }
  // neblina cerca del horizonte
  col = mix(col, uFogColor, uFogAmt * (1.0 - smoothstep(0.0, 0.25, abs(d.y))));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uDay: { value: 1 },
      uSunset: { value: 0 },
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uClouds: { value: 1 },
      uCloudStyle: { value: 1 },
      uDensity: { value: 0.45 },
      uScale: { value: 1 },
      uDetail: { value: 4 },
      uCloudH: { value: 140 },
      uSteps: { value: 24 },
      uWeatherDark: { value: 0 },
      uFogColor: { value: new THREE.Color() },
      uFogAmt: { value: 0 },
      uStudio: { value: 0 },
      uBg1: { value: new THREE.Color() },
      uBg2: { value: new THREE.Color() },
      uSpecks: { value: 0.4 },
      uRes: { value: new THREE.Vector2(1, 1) }
    }
  })
}

export function createSkyMesh(mat: THREE.ShaderMaterial): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat)
  m.frustumCulled = false
  m.renderOrder = 1000 // después de lo opaco: el test de profundidad evita sombrear píxeles ocultos
  m.name = '__sky'
  m.onBeforeRender = (r, _s, cam) => {
    const t = r.getRenderTarget()
    if (t) mat.uniforms.uRes.value.set(t.width, t.height)
    else r.getDrawingBufferSize(mat.uniforms.uRes.value)
    m.position.copy(cam.position)
    m.updateMatrixWorld()
    mat.uniforms.uCamPos.value.copy(cam.position)
  }
  return m
}
