export const MASK_VERT = `#version 300 es
layout(location = 0) in vec2 a_quad;
layout(location = 1) in vec3 a_inst;
uniform vec2 u_scale;
uniform vec2 u_offset;
out vec2 v_uv;
void main() {
  v_uv = a_quad;
  vec2 p = a_inst.xy + a_quad * a_inst.z;
  gl_Position = vec4(p * u_scale + u_offset, 0.0, 1.0);
}`;

export const MASK_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 o;
void main() {
  float d2 = dot(v_uv, v_uv);
  if (d2 >= 1.0) discard;
  float f = 1.0 - d2;
  o = vec4(f * f, 0.0, 0.0, 1.0);
}`;

export const COMPOSE_VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const COMPOSE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_mask;
uniform sampler2D u_noise;
uniform vec2 u_viewport;
uniform float u_dpr;
uniform vec2 u_noiseOffset;
uniform vec3 u_color;
uniform float u_opacity;
out vec4 o;
void main() {
  float m = texture(u_mask, gl_FragCoord.xy / u_viewport).r;
  float a = u_opacity * (1.0 - smoothstep(0.35, 0.65, m));
  vec2 uv = vec2(gl_FragCoord.x / u_dpr + u_noiseOffset.x, -gl_FragCoord.y / u_dpr + u_noiseOffset.y);
  float n = texture(u_noise, uv / 256.0).r;
  vec3 col = u_color * (0.92 + 0.16 * (n - 0.5));
  o = vec4(col * a, a);
}`;
