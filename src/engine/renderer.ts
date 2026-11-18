import type { Color } from './color';
import { createProgram, PRESENT_FS, PRESENT_VS, QUAD_FS, QUAD_VS } from './shaders';
import { computeViewport, type Viewport } from './viewport';

const FLOATS_PER_QUAD = 8; // x, y, w, h, r, g, b, a
const BYTES_PER_QUAD = FLOATS_PER_QUAD * Float32Array.BYTES_PER_ELEMENT;

export class WebGL2UnavailableError extends Error {
  constructor() {
    super('WebGL2 is not available (hardware acceleration may be off, or the GPU driver is blocklisted).');
    this.name = 'WebGL2UnavailableError';
  }
}

/** Batches every rect into one low-res framebuffer, then scales that frame up to the canvas. */
export class Renderer {
  private readonly instances: Float32Array;
  private queued = 0;
  private drawnThisFrame = 0;
  private drawnLastFrame = 0;
  private viewport: Viewport;
  private canvasHeight: number;
  private readonly quadProgram: WebGLProgram;
  private readonly uOffset: WebGLUniformLocation | null;
  private readonly quadVao: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly presentProgram: WebGLProgram;
  private readonly presentVao: WebGLVertexArrayObject;
  private readonly target: WebGLTexture;
  private readonly framebuffer: WebGLFramebuffer;

  /** Throws WebGL2UnavailableError when the browser can't give us a WebGL2 context. */
  static create(canvas: HTMLCanvasElement, width: number, height: number, maxQuads: number): Renderer {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
    if (!gl) throw new WebGL2UnavailableError();
    return new Renderer(canvas, gl, width, height, maxQuads);
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly width: number,
    private readonly height: number,
    private readonly maxQuads: number,
  ) {
    this.instances = new Float32Array(maxQuads * FLOATS_PER_QUAD);
    this.viewport = computeViewport(canvas.width, canvas.height, width, height);
    this.canvasHeight = canvas.height;

    this.quadProgram = createProgram(gl, QUAD_VS, QUAD_FS);
    gl.useProgram(this.quadProgram);
    gl.uniform2f(gl.getUniformLocation(this.quadProgram, 'u_view'), width, height);
    this.uOffset = gl.getUniformLocation(this.quadProgram, 'u_offset');

    this.presentProgram = createProgram(gl, PRESENT_VS, PRESENT_FS);
    gl.useProgram(this.presentProgram);
    gl.uniform1i(gl.getUniformLocation(this.presentProgram, 'u_frame'), 0);

    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, BYTES_PER_QUAD, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, BYTES_PER_QUAD, 4 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    this.presentVao = gl.createVertexArray();

    this.target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.target);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.target, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`The ${width}x${height} render target is incomplete (status 0x${status.toString(16)}).`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Quads drawn in the last finished frame, summed across mid-frame flushes. */
  get quadCount(): number {
    return this.drawnLastFrame;
  }

  /** Sets the canvas's drawing buffer to this many device pixels; returns where the frame lands. */
  resize(pixelW: number, pixelH: number): Viewport {
    this.canvas.width = pixelW;
    this.canvas.height = pixelH;
    this.canvasHeight = pixelH;
    this.viewport = computeViewport(pixelW, pixelH, this.width, this.height);
    return this.viewport;
  }

  begin(clear: Color, offsetX = 0, offsetY = 0): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.useProgram(this.quadProgram);
    // Whole-pixel shake keeps every edge on the low-res pixel grid.
    gl.uniform2f(this.uOffset, Math.round(offsetX), Math.round(offsetY));
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    this.queued = 0;
    this.drawnThisFrame = 0;
  }

  /** x, y is the top-left corner in internal pixels. */
  rect(x: number, y: number, w: number, h: number, c: Color): void {
    if (this.queued === this.maxQuads) this.flush();
    const d = this.instances;
    const i = this.queued++ * FLOATS_PER_QUAD;
    d[i] = Math.round(x);
    d[i + 1] = Math.round(y);
    d[i + 2] = Math.round(w);
    d[i + 3] = Math.round(h);
    d[i + 4] = c[0];
    d[i + 5] = c[1];
    d[i + 6] = c[2];
    d[i + 7] = c[3];
  }

  end(): void {
    const gl = this.gl;
    this.flush();
    this.drawnLastFrame = this.drawnThisFrame;

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT); // letterbox bars
    const v = this.viewport;
    // Viewport y is top-down; gl.viewport counts from the bottom edge.
    gl.viewport(v.x, this.canvasHeight - v.y - v.height, v.width, v.height);
    gl.useProgram(this.presentProgram);
    gl.bindVertexArray(this.presentVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.target);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  onContextLost(cb: () => void): void {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      // Per the WebGL spec, only a prevented loss can later be restored.
      e.preventDefault();
      cb();
    });
  }

  private flush(): void {
    if (this.queued === 0) return;
    const gl = this.gl;
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instances, 0, this.queued * FLOATS_PER_QUAD);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.queued);
    this.drawnThisFrame += this.queued;
    this.queued = 0;
  }
}
