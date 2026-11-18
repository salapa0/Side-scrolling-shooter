import { expect, test } from 'vitest';
import { rgb } from './color';
import { Renderer, WebGL2UnavailableError } from './renderer';

const BLACK = rgb('#000000');
const WHITE = rgb('#ffffff');

interface GlCall {
  name: string;
  args: unknown[];
}

type Listener = (e: { preventDefault(): void }) => void;

/**
 * Records every GL call made through a stand-in context. Constants resolve to their own names,
 * and uploaded Float32Arrays are copied so each call keeps what was sent at that moment.
 */
function fakeGl(overrides: Record<string, (...args: unknown[]) => unknown> = {}) {
  const calls: GlCall[] = [];
  const listeners = new Map<string, Listener>();
  const defaults: Record<string, (...args: unknown[]) => unknown> = {
    checkFramebufferStatus: () => 'FRAMEBUFFER_COMPLETE',
  };
  const gl = new Proxy({}, {
    get: (_target, prop) => {
      if (typeof prop !== 'string') return undefined;
      if (/^[A-Z0-9_]+$/.test(prop)) return prop;
      return (...args: unknown[]) => {
        calls.push({ name: prop, args: args.map((a) => (a instanceof Float32Array ? a.slice() : a)) });
        const impl = overrides[prop] ?? defaults[prop];
        return impl ? impl(...args) : {};
      };
    },
  });
  const canvas = {
    width: 300,
    height: 150,
    getContext: () => gl,
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  } as unknown as HTMLCanvasElement;
  return { canvas, calls, listeners };
}

const named = (calls: GlCall[], name: string): GlCall[] => calls.filter((c) => c.name === name);

test('throws a readable error when WebGL2 is missing', () => {
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
  expect(() => Renderer.create(canvas, 480, 270, 16)).toThrow(WebGL2UnavailableError);
});

test('a shader compile failure throws with the GL info log', () => {
  const { canvas } = fakeGl({
    getShaderParameter: () => false,
    getShaderInfoLog: () => "ERROR: 0:3: 'v_colour' : undeclared identifier",
  });
  expect(() => Renderer.create(canvas, 480, 270, 16)).toThrow("ERROR: 0:3: 'v_colour' : undeclared identifier");
});

test('a program link failure throws with the GL info log', () => {
  const { canvas } = fakeGl({
    getProgramParameter: () => false,
    getProgramInfoLog: () => 'varying v_uv not written by vertex shader',
  });
  expect(() => Renderer.create(canvas, 480, 270, 16)).toThrow('varying v_uv not written by vertex shader');
});

test('rect rounds to whole pixels and uploads only the used range', () => {
  const { canvas, calls } = fakeGl();
  const r = Renderer.create(canvas, 480, 270, 16);
  r.begin(BLACK);
  r.rect(1.4, 2.6, 3.5, 2.4, rgb('#ff0000', 0.5));
  r.end();

  const [upload] = named(calls, 'bufferSubData');
  expect(upload.args[4]).toBe(8);
  expect(Array.from((upload.args[2] as Float32Array).subarray(0, 8))).toEqual([1, 3, 4, 2, 1, 0, 0, 0.5]);
});

test('a full buffer flushes mid-frame and quadCount sums every flush', () => {
  const { canvas, calls } = fakeGl();
  const r = Renderer.create(canvas, 480, 270, 2);
  r.begin(BLACK);
  for (let i = 0; i < 5; i++) r.rect(i, 0, 1, 1, WHITE);
  r.end();

  expect(named(calls, 'drawArraysInstanced').map((c) => c.args[3])).toEqual([2, 2, 1]);
  expect(r.quadCount).toBe(5);

  r.begin(BLACK);
  r.rect(0, 0, 1, 1, WHITE);
  r.end();
  expect(r.quadCount).toBe(1);
});

test('the present pass converts the top-left viewport to GL bottom-left coordinates', () => {
  const { canvas, calls } = fakeGl();
  const r = Renderer.create(canvas, 480, 270, 16);
  // 61 spare rows: 30 above the frame, 31 below it.
  expect(r.resize(1000, 601)).toEqual({ x: 20, y: 30, width: 960, height: 540, scale: 2 });
  r.begin(BLACK);
  r.end();

  expect(named(calls, 'viewport').at(-1)?.args).toEqual([20, 31, 960, 540]);
});

test('a lost context is reported and the default handling prevented', () => {
  const { canvas, listeners } = fakeGl();
  const r = Renderer.create(canvas, 480, 270, 16);
  let lost = 0;
  let prevented = 0;
  r.onContextLost(() => lost++);
  listeners.get('webglcontextlost')?.({ preventDefault: () => prevented++ });

  expect(lost).toBe(1);
  expect(prevented).toBe(1);
});
