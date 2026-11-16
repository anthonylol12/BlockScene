// @name Profundidad de campo
// @description Desenfoca lo que está lejos o cerca del punto de enfoque, como una cámara real (efecto maqueta).
// @stage hdr
// @depth
// @param enfoque 60 1 400 Distancia de enfoque (bloques)
// @param rango 25 1 200 Zona nítida (bloques)
// @param desenfoque 6 0 16 Desenfoque máximo (px)
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float enfoque;
uniform float rango;
uniform float desenfoque;
varying vec2 vUv;

float lin(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  float d = lin(vUv);
  float coc = clamp((abs(d - enfoque) - rango * 0.5) / rango, 0.0, 1.0) * desenfoque;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 24; i++) {
    float a = float(i) * 2.39996;
    float r = sqrt(float(i) / 24.0) * coc;
    vec2 o = vec2(cos(a), sin(a)) * r / uResolution;
    acc += texture2D(tDiffuse, vUv + o);
    wsum += 1.0;
  }
  gl_FragColor = acc / wsum;
}
