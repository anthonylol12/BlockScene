// @name Nitidez
// @description Realza los bordes de las texturas pixeladas.
// @stage ldr
// @param cantidad 0.5 0 2 Cantidad
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float cantidad;
varying vec2 vUv;

void main() {
  vec2 p = 1.0 / uResolution;
  vec4 c = texture2D(tDiffuse, vUv);
  vec3 blur = (texture2D(tDiffuse, vUv + vec2(p.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(p.x, 0.0)).rgb +
               texture2D(tDiffuse, vUv + vec2(0.0, p.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, p.y)).rgb) * 0.25;
  gl_FragColor = vec4(clamp(c.rgb + (c.rgb - blur) * cantidad, 0.0, 1.0), c.a);
}
