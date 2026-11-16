// @name Contorno cel
// @description Líneas oscuras en los bordes de las construcciones (estilo cómic), detectadas con la profundidad.
// @stage ldr
// @depth
// @param grosor 1.5 0.5 4 Grosor (px)
// @param fuerza 0.7 0 1 Intensidad
// @param umbral 0.6 0.05 3 Sensibilidad (bloques)
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float grosor;
uniform float fuerza;
uniform float umbral;
varying vec2 vUv;

float lin(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 px = grosor / uResolution;
  float d = lin(vUv);
  float e = 0.0;
  e += abs(lin(vUv + vec2(px.x, 0.0)) - d);
  e += abs(lin(vUv - vec2(px.x, 0.0)) - d);
  e += abs(lin(vUv + vec2(0.0, px.y)) - d);
  e += abs(lin(vUv - vec2(0.0, px.y)) - d);
  float edge = smoothstep(umbral, umbral * 2.0, e) * step(d, uFar * 0.9);
  gl_FragColor = vec4(mix(c.rgb, c.rgb * 0.15, edge * fuerza), c.a);
}
