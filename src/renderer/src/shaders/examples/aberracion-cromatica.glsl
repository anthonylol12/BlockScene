// @name Aberración cromática
// @description Separa ligeramente los canales de color hacia los bordes, como una lente.
// @stage ldr
// @param cantidad 0.004 0 0.02 Cantidad
uniform sampler2D tDiffuse;
uniform float cantidad;
varying vec2 vUv;

void main() {
  vec2 d = (vUv - 0.5) * cantidad * length(vUv - 0.5) * 4.0;
  vec4 c = texture2D(tDiffuse, vUv);
  float r = texture2D(tDiffuse, vUv + d).r;
  float b = texture2D(tDiffuse, vUv - d).b;
  gl_FragColor = vec4(r, c.g, b, c.a);
}
