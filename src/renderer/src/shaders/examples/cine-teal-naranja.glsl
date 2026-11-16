// @name Cine teal y naranja
// @description Gradación de color cinematográfica: sombras verdeazuladas y luces cálidas.
// @stage ldr
// @param cantidad 0.6 0 1 Cantidad
uniform sampler2D tDiffuse;
uniform float cantidad;
varying vec2 vUv;

void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 shadows = vec3(0.0, 0.32, 0.38);
  vec3 lights = vec3(1.0, 0.62, 0.32);
  vec3 tone = mix(shadows, lights, smoothstep(0.1, 0.9, l));
  vec3 graded = mix(c.rgb, c.rgb * (0.65 + tone * 0.7), cantidad);
  gl_FragColor = vec4(clamp(graded, 0.0, 1.0), c.a);
}
