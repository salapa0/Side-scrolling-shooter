/** Instanced quads: one unit-square corner per vertex, one rect + colour per instance, in internal pixels. */
export const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_rect;
layout(location = 2) in vec4 a_color;
uniform vec2 u_view;
uniform vec2 u_offset;
out vec4 v_color;
void main() {
  vec2 px = a_rect.xy + u_offset + a_corner * a_rect.zw;
  vec2 clip = px / u_view * 2.0 - 1.0;
  // Pixel y grows downward; clip y grows upward.
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_color = a_color;
}`;

export const QUAD_FS = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 o_color;
void main() {
  o_color = v_color;
}`;

/** One triangle that covers the viewport, built from gl_VertexID so it needs no vertex buffer. */
export const PRESENT_VS = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// highp so texel lookups stay exact across the full 480-texel width.
export const PRESENT_FS = `#version 300 es
precision highp float;
uniform sampler2D u_frame;
in vec2 v_uv;
out vec4 o_color;
void main() {
  o_color = vec4(texture(u_frame, v_uv).rgb, 1.0);
}`;

/** Compiles and links a program; any failure throws with the driver's info log. */
export function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource, 'Vertex');
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource, 'Fragment');
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  // A linked program keeps its own copy of the compiled code.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader program failed to link: ${log}`);
  }
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string, kind: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`${kind} shader could not be created (the WebGL context may be lost)`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`${kind} shader failed to compile: ${log}`);
  }
  return shader;
}
