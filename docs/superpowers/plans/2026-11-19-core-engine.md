# Core Engine & Playable Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable round (start screen → boss fight → results) running on our own TypeScript + WebGL2 engine, built into one offline `.html` file.

**Architecture:** A fixed-timestep simulation (`src/game/`) runs on plain data in object pools and is fully unit-tested without a browser. A WebGL2 renderer (`src/engine/renderer.ts`) draws every rectangle in one instanced draw call into a 480×270 framebuffer, then scales that framebuffer up by whole numbers to the screen. Menus, HUD and the debug overlay are DOM elements laid over the canvas (`src/ui/`).

**Tech Stack:** TypeScript (strict), Vite, vite-plugin-singlefile, Vitest. Raw WebGL2. No runtime dependencies.

**Spec:** `docs/spec.md`

**Scope:** This is plan 1 of 2. Plan 2 covers spec §8.1 post-processing (glow, chromatic aberration, heat distortion, CRT), the §5.1 Effects-quality setting, and a sprite atlas. Plan 1 draws coloured rectangles only.

## Global Constraints

- Frontend only. No server, no network requests at runtime, no CDN or web fonts. Runtime dependencies: none (dev dependencies only).
- Must run from a double-clicked `dist/index.html` (`file://`), offline.
- Internal resolution 480×270, scaled up by a whole number with nearest-neighbour filtering, letterboxed (spec §8).
- Target a steady 60 fps on an integrated GPU. No allocation in per-step hot loops: entities come from pools.
- Every tuning value, key binding, cap and threshold lives in `src/config.ts` (spec §7).
- Stat inputs (spec §5.1): Flat Attack whole number 0–999, default 0; CD Reduction 0–80 %, default 0; Play Time 30–300 s, default 120.
- Formulas (spec §6.1): `ATK = BASE_ATK + FlatAttack`; auto-shot damage = ATK; special damage = `AMP × ATK`; special cooldown = `BASE_CD × (1 − CDReduction / 100)`.
- Controls (spec §6.4): W/↑ up, S/↓ down, A/← back, D/→ forward, E special, Esc pause. Firing is automatic.
- Coordinates: every `Box` uses `x, y` = **centre** and `w, h` = full size; y grows downward. `Renderer.rect` alone takes a top-left corner.
- TypeScript `strict: true`. Tests live next to their code as `*.test.ts`.
- Git: work on `feat/core-engine` (branched from `spec/initial-design`). Commit subjects are imperative and ≤72 characters. Each commit has a body explaining why and ends with the `Co-Authored-By` line from the session.

## Review Focus

1. **Stat-entry typos:** blank fields, spaces, negatives, decimals where a whole number is needed, `1e3`, leading zeros. Expected: blank → default, `007` → 7, everything else gets an inline message, and Start never begins a round with bad values. *(Task 1 tests.)*
2. **Focus loss at the booth:** alt-tab, a click outside the window, or a notification while a key is held. Expected: no stuck movement afterwards, and the round pauses. *(Task 2 `clear` test; Task 8 blur-pause check.)*
3. **Long frames:** tab hidden, window dragged, a GC hiccup. Expected: at most `maxStepsPerFrame` steps run, no spiral of death, and the timer loses at most ~83 ms. *(Task 2 `advance` test.)*
4. **Maximum chaos** (phase 3, pools at cap). Expected: spawns are skipped silently, nothing throws, and the frame rate holds. *(Task 6 and Task 9 pool-full tests; Task 10 stress check.)*
5. **Venue PC without WebGL2** (blocklisted iGPU driver, hardware acceleration off) or a driver reset mid-round. Expected: a readable message, never a blank black screen. *(Task 4 test.)*

---

### Task 1: Project scaffold, config, and stat rules

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html` (placeholder body for now)
- Create: `src/engine/color.ts`, `src/config.ts`, `src/stats.ts`
- Test: `src/stats.test.ts`, `src/engine/color.test.ts`

**Interfaces:**
- Produces:
  - `type Color = readonly [r: number, g: number, b: number, a: number]` (0–1 channels)
  - `rgb(hex: string, alpha = 1): Color`
  - `CONFIG`, `type Config = typeof CONFIG`
  - `interface StatInput { flatAttack: number; cdReduction: number; playTime: number }`
  - `type StatField = keyof StatInput`
  - `type RawStatInput = Record<StatField, string>`
  - `type ParseResult = { ok: true; value: StatInput } | { ok: false; errors: Partial<Record<StatField, string>> }`
  - `parseStatInput(raw: RawStatInput, cfg: Config['stats']): ParseResult`
  - `defaultStatInput(cfg: Config['stats']): StatInput`
  - `interface DerivedStats { atk: number; shotDamage: number; specialDamage: number; specialCooldown: number; playTime: number }`
  - `deriveStats(input: StatInput, cfg: Config['stats']): DerivedStats`

- [ ] **Step 1: Branch and scaffold**

```bash
git checkout spec/initial-design && git checkout -b feat/core-engine
npm init -y
npm install -D vite typescript vitest vite-plugin-singlefile
```

- `package.json` scripts: `dev: vite`, `build: tsc --noEmit && vite build`, `preview: vite preview`, `test: vitest run`, `typecheck: tsc --noEmit`. Set `"type": "module"` and `"private": true`.
- `tsconfig.json`: target/lib ES2022 + DOM, `module: ESNext`, `moduleResolution: bundler`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `types: ["vite/client"]`, include `src`.
- `vite.config.ts`: `plugins: [viteSingleFile()]`, `base: './'`, `build.target: 'es2022'`.
- `.gitignore`: `node_modules/`, `dist/`.

- [ ] **Step 2: Write `src/config.ts` with exactly these values**

The values below are the plan's decisions. Spec values are marked; the rest are placeholder tuning.

```ts
import { rgb } from './engine/color';

export const CONFIG = {
  view: { width: 480, height: 270 },                                  // spec §8
  sim: { step: 1 / 60, maxStepsPerFrame: 5, maxFrameTime: 0.25 },
  stats: {
    baseAtk: 10, amp: 5, baseCd: 8,                                   // spec §6.5
    flatAttack: { min: 0, max: 999, default: 0 },                     // spec §5.1
    cdReduction: { min: 0, max: 80, default: 0 },
    playTime: { min: 30, max: 300, default: 120 },
  },
  player: {
    hp: 3, invulnTime: 1, speed: 140, w: 16, h: 10,                   // hp, invuln: spec §6.2
    // Range the player's centre may occupy (left third). w: 0 = up/down only (spec §7).
    area: { x: 12, y: 24, w: 148, h: 236 },
    spawn: { x: 40, y: 142 },
    fireRate: 8, bulletSpeed: 360, bulletW: 6, bulletH: 2,           // fireRate: spec §6.5
    beam: { duration: 0.35, height: 12 },
  },
  boss: {
    // No-bonus player ≈ 58 effective DPS (~65% of 80 auto-fire DPS, plus the beam) × 90 s (75% of 120 s).
    maxHp: 5200,
    w: 64, h: 96, centerY: 142, moveSpeed: 60, bulletSpeed: 100,
    phaseThresholds: [0.6, 0.25],                                     // spec §5.2
    phases: [
      { x: 420, bobAmp: 40, bobSpeed: 0.15, droneInterval: 2.2, droneWave: 4, spreadInterval: 0, spreadCount: 0, spreadArc: 0, spiralInterval: 0 },
      { x: 370, bobAmp: 60, bobSpeed: 0.25, droneInterval: 2.0, droneWave: 5, spreadInterval: 1.2, spreadCount: 5, spreadArc: 0.6, spiralInterval: 0 },
      { x: 350, bobAmp: 70, bobSpeed: 0.4, droneInterval: 1.2, droneWave: 6, spreadInterval: 0.8, spreadCount: 7, spreadArc: 0.9, spiralInterval: 0.1 },
    ],
    spiralTurn: 0.35,
  },
  drone: { hp: 20, w: 12, h: 10, speed: 70, wobbleAmp: 18, wobbleFreq: 0.6, fireInterval: 2, bulletSpeed: 110, waveSpacing: 22 },
  enemyBullet: { w: 4, h: 4 },
  caps: { drones: 64, playerBullets: 128, enemyBullets: 768, particles: 2048, quads: 8192 },
  fx: {
    droneBurst: 12, phaseBurst: 40, bossBurst: 120, playerBurst: 60, hitSparks: 2,
    shakeDrone: 2, shakeBeam: 4, shakePlayerHit: 6, shakePhase: 10, shakeBossKilled: 14, shakeDecay: 8,
    hitStopPlayerHit: 0.06, hitStopPhase: 0.12,
    flashPlayerHit: 0.1, flashPhase: 0.2, flashBossKilled: 0.3,
    particleLife: [0.25, 0.6], particleSpeed: [40, 160], particleDrag: 3,
  },
  round: { endDelay: 1.5 },
  bindings: {                                                          // spec §6.4; codes are KeyboardEvent.code
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    special: ['KeyE'], pause: ['Escape'], debug: ['F3', 'Backquote'],
  },
  stars: [
    { count: 60, speed: 12, size: 1, color: rgb('#3a3f6b') },
    { count: 35, speed: 30, size: 1, color: rgb('#6c74b8') },
    { count: 15, speed: 70, size: 2, color: rgb('#c8ceff') },
  ],
  colors: {
    bg: rgb('#0b0d1a'), player: rgb('#5ef2ff'), playerBullet: rgb('#fff36b'),
    boss: rgb('#ff4d6d'), drone: rgb('#ff9f43'), enemyBullet: rgb('#ff5ef0'),
    beam: rgb('#bdfcff'), hitFlash: rgb('#ffffff'),
    droneBurst: rgb('#ffb86b'), bossBurst: rgb('#ff4d6d'), playerBurst: rgb('#5ef2ff'),
  },
};
export type Config = typeof CONFIG;
```

- [ ] **Step 3: Write the failing tests**

```ts
// src/engine/color.test.ts
expect(rgb('#ff0000')).toEqual([1, 0, 0, 1]);
expect(rgb('#000000', 0.5)).toEqual([0, 0, 0, 0.5]);

// src/stats.test.ts — S = CONFIG.stats; raw(f, c, p) builds a RawStatInput
test('derives stats from formulas', () => {
  expect(deriveStats({ flatAttack: 5, cdReduction: 25, playTime: 90 }, S))
    .toEqual({ atk: 15, shotDamage: 15, specialDamage: 75, specialCooldown: 6, playTime: 90 });
});
test('defaults give base stats', () => {
  expect(deriveStats(defaultStatInput(S), S)).toMatchObject({ atk: 10, specialDamage: 50, specialCooldown: 8, playTime: 120 });
});
test('max CD reduction', () => {
  expect(deriveStats({ flatAttack: 0, cdReduction: 80, playTime: 120 }, S).specialCooldown).toBeCloseTo(1.6);
});
test('blank fields use defaults', () => {
  expect(parseStatInput(raw('', '', ''), S)).toEqual({ ok: true, value: { flatAttack: 0, cdReduction: 0, playTime: 120 } });
});
test('trims spaces and accepts leading zeros', () => {
  expect(parseStatInput(raw(' 42 ', '007', '060'), S)).toEqual({ ok: true, value: { flatAttack: 42, cdReduction: 7, playTime: 60 } });
});
test.each([['-5'], ['12.5'], ['1e3'], ['abc']])('flat attack %s is not a whole number', (v) => {
  expect(parseStatInput(raw(v, '', ''), S)).toEqual({ ok: false, errors: { flatAttack: 'Enter a whole number' } });
});
test('flat attack over range', () => {
  expect(parseStatInput(raw('1000', '', ''), S)).toEqual({ ok: false, errors: { flatAttack: 'Must be 0–999' } });
});
test('cd reduction accepts decimals, rejects over range and text', () => {
  expect(parseStatInput(raw('', '12.5', ''), S)).toMatchObject({ ok: true, value: { cdReduction: 12.5 } });
  expect(parseStatInput(raw('', '81', ''), S)).toEqual({ ok: false, errors: { cdReduction: 'Must be 0–80' } });
  expect(parseStatInput(raw('', 'abc', ''), S)).toEqual({ ok: false, errors: { cdReduction: 'Enter a number' } });
});
test('play time bounds', () => {
  expect(parseStatInput(raw('', '', '29'), S)).toEqual({ ok: false, errors: { playTime: 'Must be 30–300' } });
  expect(parseStatInput(raw('', '', '300'), S)).toMatchObject({ ok: true });
  expect(parseStatInput(raw('', '', '60.5'), S)).toEqual({ ok: false, errors: { playTime: 'Enter a whole number' } });
});
test('reports every bad field at once', () => {
  const r = parseStatInput(raw('x', '99', '5'), S);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['cdReduction', 'flatAttack', 'playTime']);
});
```

- [ ] **Step 4: Run the tests and see them fail**

Run: `npx vitest run src/stats.test.ts src/engine/color.test.ts`
Expected: FAIL. The imports can't be resolved.

- [ ] **Step 5: Implement `rgb`, `parseStatInput`, `defaultStatInput`, `deriveStats`**

- Whole-number fields (Flat Attack, Play Time) are validated with `/^\d+$/`; CD Reduction with `/^\d+(\.\d+)?$/`.
- Values are trimmed first. A blank value takes the field's default.
- The range message is `Must be ${min}–${max}`, using an en dash.

- [ ] **Step 6: Run the tests and see them pass**

Run: `npx vitest run` and then `npm run typecheck`
Expected: all tests pass, and typecheck shows 0 errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Scaffold Vite + TypeScript project with config and stat rules"
```

---

### Task 2: Frame timing and keyboard input

**Files:**
- Create: `src/engine/loop.ts`, `src/engine/input.ts`, `src/engine/frameStats.ts`
- Test: `src/engine/loop.test.ts`, `src/engine/input.test.ts`, `src/engine/frameStats.test.ts`

**Interfaces:**
- Consumes: `Config['sim']`, `Config['bindings']`
- Produces:
  - `advance(acc: number, frameDt: number, sim: Config['sim']): { steps: number; acc: number }`
  - `startLoop(onFrame: (frameDt: number) => void): () => void`. Uses requestAnimationFrame, passes elapsed seconds (0 on the first frame), and returns a stop function.
  - `type Action = 'up' | 'down' | 'left' | 'right' | 'special' | 'pause' | 'debug'`
  - `interface InputState { isDown(a: Action): boolean; consume(a: Action): boolean }`
  - `class Input implements InputState`:
    - `constructor(bindings: Record<Action, readonly string[]>)`
    - `keyDown(code: string, repeat?: boolean): boolean`. Returns true when the code is bound.
    - `keyUp(code: string): boolean`
    - `clear(): void`
    - `attach(target: Window): () => void`
  - `class FrameStats`: `record(frameMs: number): void`, plus getters `fps`, `avgMs`, `maxMs` over the last 60 frames.

- [ ] **Step 1: Write the failing tests**

```ts
// loop.test.ts — SIM = CONFIG.sim
test('one frame at 60 Hz runs one step', () => {
  const r = advance(0, 1 / 60, SIM); expect(r.steps).toBe(1); expect(r.acc).toBeCloseTo(0);
});
test('remainder carries over', () => {
  const r = advance(0.01, 0.01, SIM); expect(r.steps).toBe(1); expect(r.acc).toBeCloseTo(0.02 - 1 / 60);
});
test('a 10 s stall runs at most maxStepsPerFrame and drops the backlog', () => {
  expect(advance(0, 10, SIM)).toEqual({ steps: 5, acc: 0 });
});

// input.test.ts — input = new Input(CONFIG.bindings)
test('either bound key holds the action', () => {
  input.keyDown('KeyW'); input.keyDown('ArrowUp'); input.keyUp('KeyW');
  expect(input.isDown('up')).toBe(true);
});
test('consume returns true once per press', () => {
  input.keyDown('KeyE'); expect(input.consume('special')).toBe(true); expect(input.consume('special')).toBe(false);
});
test('press and release before the step still counts', () => {
  input.keyDown('KeyE'); input.keyUp('KeyE'); expect(input.consume('special')).toBe(true);
});
test('auto-repeat does not latch a press', () => {
  input.keyDown('KeyE', true); expect(input.consume('special')).toBe(false);
});
test('clear releases held keys and pending presses', () => {   // Review Focus 2
  input.keyDown('KeyD'); input.keyDown('KeyE'); input.clear();
  expect(input.isDown('right')).toBe(false); expect(input.consume('special')).toBe(false);
});
test('unbound keys are ignored', () => { expect(input.keyDown('KeyQ')).toBe(false); });

// frameStats.test.ts
test('steady 60 fps', () => {
  const s = new FrameStats(); for (let i = 0; i < 60; i++) s.record(1000 / 60);
  expect(s.fps).toBeCloseTo(60, 0);
});
test('tracks the worst frame', () => {
  const s = new FrameStats(); s.record(16); s.record(50); s.record(16); expect(s.maxMs).toBe(50);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/engine`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Implement**

- `advance`:
  1. Clamp `frameDt` to `sim.maxFrameTime`, then `acc += frameDt`.
  2. Set `steps = floor(acc / step)`.
  3. If `steps > maxStepsPerFrame`, return `{ steps: maxStepsPerFrame, acc: 0 }`. Otherwise subtract `steps × step` from `acc`.
- `Input`:
  - Keep a `Set` of held codes and a `Set` of pressed actions.
  - `attach` listens for `keydown`, `keyup` and `blur` on the window.
  - Skip any event whose `target` is an `HTMLInputElement`, so typing in the start form never reaches the game.
  - Call `preventDefault()` on bound keys only, so arrows don't scroll and F3 doesn't open Find.
  - `blur` calls `clear()`.
- `FrameStats`: a fixed `Float64Array(60)` ring buffer.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run src/engine`
Expected: PASS.

- [ ] **Step 5: Commit**: `Add fixed-step frame timing, keyboard input, and frame stats`

---

### Task 3: Pools, geometry, spatial grid, seeded RNG

**Files:**
- Create: `src/engine/pool.ts`, `src/engine/geom.ts`, `src/engine/grid.ts`, `src/engine/rng.ts`
- Test: `src/engine/pool.test.ts`, `src/engine/geom.test.ts`, `src/engine/grid.test.ts`, `src/engine/rng.test.ts`

**Interfaces:**
- Produces:
  - `class Pool<T>`:
    - `constructor(capacity: number, create: () => T)`. Calls `create` exactly `capacity` times, all up front.
    - `acquire(): T | null`
    - `releaseAt(i: number): void`. Swap-removes: the last active item moves into slot `i`.
    - `get(i: number): T`, `count: number`, `capacity: number`, `clear(): void`
    - Callers iterate backwards when releasing during iteration.
  - `interface Box { x: number; y: number; w: number; h: number }` (centre-based)
  - `overlaps(a: Box, b: Box): boolean`. Boxes that only touch do not overlap.
  - `clamp(v: number, lo: number, hi: number): number`
  - `interface Stamped { stamp: number }`
  - `class SpatialGrid<T extends Box & Stamped>`:
    - `constructor(width: number, height: number, cellSize: number)`
    - `clear(): void`, `insert(item: T): void`
    - `query(box: Box, out: T[]): T[]`. Empties `out`, then fills it with unique broad-phase candidates.
  - `type Rng = () => number` (values in [0, 1)), `createRng(seed: number): Rng` (mulberry32)

- [ ] **Step 1: Write the failing tests**

```ts
// pool.test.ts
test('acquires up to capacity, then null', () => {
  const p = new Pool(2, () => ({ v: 0 })); p.acquire(); p.acquire(); expect(p.acquire()).toBeNull();
});
test('creates every object up front and reuses them', () => {
  let made = 0; const p = new Pool(3, () => ({ id: made++ }));
  const a = p.acquire()!; p.releaseAt(0); expect(p.acquire()).toBe(a); expect(made).toBe(3);
});
test('releaseAt swaps the last active item into the hole', () => {
  const p = new Pool(3, () => ({ n: 0 })); const [a, b, c] = [p.acquire()!, p.acquire()!, p.acquire()!];
  a.n = 1; b.n = 2; c.n = 3; p.releaseAt(0);
  expect(p.count).toBe(2); expect(p.get(0)).toBe(c); expect(p.get(1)).toBe(b);
});

// geom.test.ts
expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 0, w: 10, h: 10 })).toBe(true);
expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false); // touching

// grid.test.ts — grid = new SpatialGrid(480, 270, 32); item(x, y, w, h) adds stamp: 0
test('item spanning cells is returned once', () => {
  const a = item(32, 32, 10, 10); grid.insert(a); expect(grid.query(item(32, 32, 20, 20), [])).toEqual([a]);
});
test('far query finds nothing', () => {
  grid.insert(item(20, 20, 4, 4)); expect(grid.query(item(400, 200, 4, 4), [])).toEqual([]);
});
test('items partly off-grid are still found', () => {
  const a = item(-3, 100, 10, 10); grid.insert(a); expect(grid.query(item(2, 100, 4, 4), [])).toContain(a);
});
test('clear empties every cell', () => {
  grid.insert(item(20, 20, 4, 4)); grid.clear(); expect(grid.query(item(20, 20, 4, 4), [])).toEqual([]);
});

// rng.test.ts
expect([createRng(7)(), createRng(7)()]).toEqual([createRng(7)(), createRng(7)()]);
// 1000 draws from createRng(1) are all >= 0 and < 1
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/engine`. Expected: FAIL on the missing modules.

- [ ] **Step 3: Implement**

`SpatialGrid`:
- Cells are pre-allocated arrays. Item coordinates are clamped to the grid's edge cells.
- Duplicates are removed with a query counter. Each query increments it; an item whose `stamp` equals the current counter is skipped, and otherwise its `stamp` is set to the counter.

- [ ] **Step 4: Run the tests and see them pass.** Run `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit**: `Add object pool, spatial grid, geometry helpers, and seeded RNG`

---

### Task 4: WebGL2 renderer and pixel-perfect scaling

**Files:**
- Create: `src/engine/viewport.ts`, `src/engine/shaders.ts`, `src/engine/renderer.ts`, `src/style.css`, `src/main.ts`
- Modify: `index.html`. Add `<canvas id="game">`, `<div id="fatal" hidden>`, and the module script `src/main.ts`.
- Test: `src/engine/viewport.test.ts`, `src/engine/renderer.test.ts`

**Interfaces:**
- Consumes: `Color`
- Produces:
  - `interface Viewport { x: number; y: number; width: number; height: number; scale: number }` (device pixels)
  - `computeViewport(canvasW: number, canvasH: number, baseW: number, baseH: number): Viewport`
  - `class WebGL2UnavailableError extends Error`
  - `class Renderer`:
    - `static create(canvas: HTMLCanvasElement, width: number, height: number, maxQuads: number): Renderer`. Throws `WebGL2UnavailableError`.
    - `resize(pixelW: number, pixelH: number): Viewport`
    - `begin(clear: Color, offsetX = 0, offsetY = 0): void`
    - `rect(x: number, y: number, w: number, h: number, c: Color): void`. Takes the **top-left** corner in internal pixels.
    - `end(): void`
    - `readonly quadCount: number`. The number of quads drawn last frame.
    - `onContextLost(cb: () => void): void`

- [ ] **Step 1: Write the failing tests**

```ts
// viewport.test.ts
expect(computeViewport(1920, 1080, 480, 270)).toEqual({ x: 0, y: 0, width: 1920, height: 1080, scale: 4 });
expect(computeViewport(1366, 768, 480, 270)).toEqual({ x: 203, y: 114, width: 960, height: 540, scale: 2 });
expect(computeViewport(1280, 1024, 480, 270)).toEqual({ x: 160, y: 242, width: 960, height: 540, scale: 2 });
const tiny = computeViewport(320, 180, 480, 270);   // smaller than 1×: fit without cropping
expect(tiny).toMatchObject({ x: 0, y: 0, width: 320, height: 180 }); expect(tiny.scale).toBeCloseTo(2 / 3);

// renderer.test.ts — Review Focus 5
test('throws a readable error when WebGL2 is missing', () => {
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
  expect(() => Renderer.create(canvas, 480, 270, 16)).toThrow(WebGL2UnavailableError);
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/engine/viewport.test.ts src/engine/renderer.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the viewport and renderer**

- `computeViewport`:
  - `scale = floor(min(canvasW / baseW, canvasH / baseH))`. If that comes out below 1, use the fractional fit instead.
  - Centre the result with `Math.floor` offsets.
- Context: `getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false })`.
- Quad pass:
  - One instanced draw call per flush, using `TRIANGLE_STRIP` with 4 corners.
  - Instance data is a `Float32Array(maxQuads × 8)` holding x, y, w, h, r, g, b, a. Upload only the used range with `bufferSubData`.
  - If `rect()` is called when the buffer is full, flush first, then continue.
  - `rect()` rounds x, y, w and h to whole pixels so the pixel art stays crisp.
  - The vertex shader maps pixels to clip space with y flipped and adds the `u_offset` uniform for screen shake.
  - Alpha blending: `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`.
- Render target: a 480×270 RGBA8 texture on a framebuffer, with `NEAREST` filtering and `CLAMP_TO_EDGE`.
- Present pass:
  - Bind the default framebuffer, clear it to black (the letterbox bars), set `gl.viewport` from the last `resize`, and draw one fullscreen triangle that samples the texture.
  - The quad pass already flipped y, so the present pass does not flip again.
- `onContextLost`: listen for `webglcontextlost`, call `preventDefault()`, then invoke the callback.
- `main.ts` (a temporary test pattern; Task 5 replaces it):
  - Size the canvas to `clientWidth/Height × devicePixelRatio` on load and on every resize.
  - Each frame, draw a 1-px border around the 480×270 frame, a 1-px diagonal staircase (to check sharp scaling), and 3,000 small bouncing squares (to check batching).
  - On `WebGL2UnavailableError`, show `#fatal`: "This game needs WebGL2. Open it in an up-to-date Chrome or Edge with hardware acceleration turned on."
  - On context loss, show: "The graphics driver reset. Press F5 to reload."
- `style.css`:
  - `html, body` margin 0, black background, `overflow: hidden`.
  - The canvas fills the window (`100vw × 100vh`).
  - `#fatal` is centred white text.

- [ ] **Step 4: Run the tests and see them pass.** Run `npx vitest run` and `npm run typecheck`. Expected: PASS with 0 type errors.

- [ ] **Step 5: Check it in the browser**

Start `npm run dev` in the background, open `http://localhost:5173` with Playwright, and take a screenshot.

Expected:
- The border and staircase have hard pixel edges (no blur).
- The frame is letterboxed in black at a whole-number scale.
- The squares are moving.
- The console shows no WebGL errors.

- [ ] **Step 6: Commit**: `Add batched WebGL2 renderer with integer-scaled low-res framebuffer`

---

### Task 5: World, player movement, auto-fire

**Files:**
- Create: `src/game/world.ts`, `src/game/player.ts`, `src/game/projectiles.ts`, `src/game/step.ts`, `src/game/draw.ts`, `src/game/testUtils.ts`
- Modify: `src/main.ts`. Replace the test pattern with a sandbox: one world built from default stats, stepped and drawn every frame.
- Test: `src/game/player.test.ts`, `src/game/projectiles.test.ts`

**Interfaces:**
- Consumes: `Config`, `DerivedStats`, `Pool`, `SpatialGrid`, `Box`, `Stamped`, `Rng`, `InputState`, `Renderer`, `Color`
- Produces (in `world.ts`):

```ts
export interface Body extends Box, Stamped { vx: number; vy: number }
export interface Bullet extends Body { damage: number }
export interface Drone extends Body { hp: number; age: number; baseY: number; fireTimer: number; flash: number }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: Color }
export interface Player extends Box { hp: number; invuln: number; fireTimer: number; specialCd: number }
export interface Boss extends Box { hp: number; maxHp: number; phase: 1 | 2 | 3; age: number; droneTimer: number; spreadTimer: number; spiralTimer: number; spiralAngle: number; flash: number }
export interface Beam { x: number; y: number; time: number }               // time > 0 while visible
export type GameEvent =
  | { type: 'droneKilled' | 'bossHit' | 'playerHit' | 'bossKilled' | 'playerKilled'; x: number; y: number }
  | { type: 'phaseChanged'; phase: 2 | 3; x: number; y: number }
  | { type: 'beamFired'; x: number; y: number };
export interface World {
  cfg: Config; stats: DerivedStats; rng: Rng;
  time: number; timeLeft: number; kills: number;
  status: 'playing' | 'won' | 'lost'; reason: 'boss' | 'time' | 'hp' | null; endTimer: number; finished: boolean;
  player: Player; boss: Boss; beam: Beam;
  drones: Pool<Drone>; playerBullets: Pool<Bullet>; enemyBullets: Pool<Bullet>; particles: Pool<Particle>;
  grid: SpatialGrid<Drone>; events: GameEvent[];
  fx: { shake: number; hitStop: number; flash: number };
}
export function createWorld(cfg: Config, stats: DerivedStats, rng: Rng): World
```

- Also produces:
  - `updatePlayer(w: World, input: InputState, dt: number): void`
  - `updateBullets(pool: Pool<Bullet>, dt: number, view: Config['view'], margin = 16): void`
  - `stepWorld(w: World, input: InputState, dt: number): void`
  - `drawWorld(r: Renderer, w: World): void`
  - In `testUtils.ts`:
    - `makeWorld(mutate?: (cfg: Config) => void): World`. Clones `CONFIG` with `structuredClone`, uses default stats and `createRng(1)`.
    - `fakeInput(held?: Action[], pressed?: Action[]): InputState`
    - `run(w: World, input: InputState, seconds: number, fn = stepWorld): void`. Runs `Math.round(seconds × 60)` steps of `1/60`.

`createWorld` sets up a fresh round:
- Grid: `new SpatialGrid(view.width, view.height, 32)`.
- Player: at the spawn point (clamped to the area), `hp = cfg.player.hp`, all timers 0, so the special is ready.
- Boss: `x = phases[0].x`, `y = centerY`, full HP, phase 1. `droneTimer` starts at 1 so the first wave arrives quickly.
- `timeLeft = stats.playTime`, `status = 'playing'`.

`stepWorld` order. Later tasks insert their calls in this order:
1. Empty `events`.
2. If `fx.hitStop > 0`, subtract `dt` and return.
3. `time += dt`.
4. `updatePlayer`
5. `updateBoss` and `updateDrones` (Task 6)
6. `updateBullets` for both pools
7. `resolveCombat` (Task 7)
8. `updateRound` (Task 8)
9. `updateEffects` (Task 9)

- [ ] **Step 1: Write the failing tests**

```ts
// player.test.ts — area {x:12,y:24,w:148,h:236}, speed 140, spawn (40,142)
test('moves right at configured speed', () => {
  const w = makeWorld(); run(w, fakeInput(['right']), 0.5, updatePlayerOnly); expect(w.player.x).toBeCloseTo(110, 0);
});
test('diagonal movement is normalised', () => {
  const w = makeWorld(); run(w, fakeInput(['right', 'down']), 0.5, updatePlayerOnly);
  expect(w.player.x - 40).toBeCloseTo(70 / Math.SQRT2, 0); expect(w.player.y - 142).toBeCloseTo(70 / Math.SQRT2, 0);
});
test('stays inside the movement area', () => {
  const w = makeWorld(); run(w, fakeInput(['left', 'up']), 5, updatePlayerOnly); expect([w.player.x, w.player.y]).toEqual([12, 24]);
});
test('area width 0 gives up/down-only movement (spec §7)', () => {
  const w = makeWorld((c) => { c.player.area.w = 0; }); run(w, fakeInput(['right', 'down']), 0.5, updatePlayerOnly);
  expect(w.player.x).toBe(12); expect(w.player.y).toBeGreaterThan(142);
});
test('auto-fires 8 shots per second with shot damage', () => {
  const w = makeWorld(); run(w, fakeInput(), 59 / 60, updatePlayerOnly);   // 59 steps: stays clear of the 9th shot at exactly 1.0 s
  expect(w.playerBullets.count).toBe(8); expect(w.playerBullets.get(0).damage).toBe(w.stats.shotDamage);
});
test('timers count down and stop at 0', () => {
  const w = makeWorld(); w.player.invuln = 0.5; w.player.specialCd = 0.5;
  run(w, fakeInput(), 1, updatePlayerOnly); expect([w.player.invuln, w.player.specialCd]).toEqual([0, 0]);
});
test('does nothing once the round is over', () => {
  const w = makeWorld(); w.status = 'lost'; run(w, fakeInput(['right']), 0.5, updatePlayerOnly);
  expect(w.player.x).toBe(40); expect(w.playerBullets.count).toBe(0);
});
// updatePlayerOnly = (w, i, dt) => updatePlayer(w, i, dt)

// projectiles.test.ts
test('moves bullets and releases those past the margin', () => {
  const pool = new Pool<Bullet>(4, blankBullet);
  Object.assign(pool.acquire()!, { x: 100, vx: 360 }); Object.assign(pool.acquire()!, { x: 490, vx: 360 });
  updateBullets(pool, 1 / 60, CONFIG.view);
  expect(pool.count).toBe(1); expect(pool.get(0).x).toBeCloseTo(106);
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/game`. Expected: FAIL.

- [ ] **Step 3: Implement**

- Movement:
  - Normalise diagonal input.
  - Clamp the centre to `[area.x, area.x + area.w] × [area.y, area.y + area.h]`.
- Order inside `updatePlayer`: decay the timers, then move, then auto-fire. Task 7 adds the special after these.
- Auto-fire:
  - Each step, `fireTimer -= dt`. While `fireTimer <= 0`, spawn a bullet at the player's nose and add `1 / fireRate` to the timer.
  - If the pool is full, skip the shot.
- `drawWorld` (this task):
  - Starts with `r.begin(colors.bg)`, and every later task draws inside that same `begin`/`end`.
  - Draws the player and the player bullets.
  - While invulnerable, the player is hidden on alternate 0.08 s intervals.
- `main.ts` sandbox: create the `Input` and `attach` it, call `startLoop`, then `advance` → `stepWorld × steps` → `drawWorld` each frame.

- [ ] **Step 4: Run the tests and see them pass.** Run `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Check it in the browser.** Expected: WASD and the arrow keys move the ship only inside the left third, and a stream of bullets flies right.

- [ ] **Step 6: Commit**: `Add world state, player movement, and auto-fire`

---

### Task 6: Boss phases and drones

**Files:**
- Create: `src/game/enemies.ts`
- Modify: `src/game/step.ts` (step 5 of the order), `src/game/draw.ts` (boss, drones, enemy bullets; a white `colors.hitFlash` while `flash > 0`)
- Test: `src/game/enemies.test.ts`

**Interfaces:**
- Consumes: `World`, `Drone`, `Bullet`, `GameEvent`
- Produces:
  - `phaseFor(hpFrac: number, thresholds: readonly number[]): 1 | 2 | 3`
  - `updateBoss(w: World, dt: number): void`
  - `updateDrones(w: World, dt: number): void`
  - `fireBullet(w: World, x: number, y: number, angle: number, speed: number): void`. Silently skips when the pool is full.

- [ ] **Step 1: Write the failing tests**

```ts
test.each([[1, 1], [0.61, 1], [0.6, 2], [0.25, 2], [0.249, 3], [0, 3]])('phaseFor(%f) = %i', (f, p) => {
  expect(phaseFor(f, [0.6, 0.25])).toBe(p);
});
test('emits phaseChanged once when crossing 60%', () => {
  const w = makeWorld(); w.boss.hp = w.boss.maxHp * 0.59;
  updateBoss(w, 1 / 60); expect(w.boss.phase).toBe(2);
  expect(w.events.filter((e) => e.type === 'phaseChanged')).toHaveLength(1);
  w.events.length = 0; updateBoss(w, 1 / 60); expect(w.events).toHaveLength(0);
});
test('jumping from phase 1 to 3 emits one event for phase 3', () => {
  const w = makeWorld(); w.boss.hp = 1; updateBoss(w, 1 / 60);
  expect(w.events).toEqual([expect.objectContaining({ type: 'phaseChanged', phase: 3 })]);
});
test('phase 1 launches drones but no boss bullets', () => {
  const w = makeWorld(); run(w, fakeInput(), 3, (w, _i, dt) => updateBoss(w, dt));
  expect(w.drones.count).toBeGreaterThanOrEqual(4); expect(w.enemyBullets.count).toBe(0);
});
test('phase 2 fires an aimed spread', () => {
  const w = makeWorld(); w.boss.hp = w.boss.maxHp * 0.5;
  run(w, fakeInput(), 1.3, (w, _i, dt) => updateBoss(w, dt)); expect(w.enemyBullets.count).toBeGreaterThanOrEqual(5);
});
test('full pools are skipped without throwing', () => {     // Review Focus 4
  const w = makeWorld(); w.boss.hp = 1;
  while (w.drones.acquire()); while (w.enemyBullets.acquire());
  expect(() => run(w, fakeInput(), 3, (w, _i, dt) => updateBoss(w, dt))).not.toThrow();
  expect(w.drones.count).toBe(w.drones.capacity);
  expect(() => run(w, fakeInput(), 1, (w, _i, dt) => updateDrones(w, dt))).not.toThrow(); // blank drones fire into the full bullet pool
});
test('drone flies left and is released off-screen', () => {
  const w = makeWorld(); const d = w.drones.acquire()!; Object.assign(d, { x: 10, y: 100, baseY: 100, hp: 20, age: 0, fireTimer: 99 });
  run(w, fakeInput(), 1, (w, _i, dt) => updateDrones(w, dt)); expect(w.drones.count).toBe(0);
});
test('drone shots are aimed at the player at bullet speed', () => {
  const w = makeWorld(); const d = w.drones.acquire()!; Object.assign(d, { x: 300, y: 142, baseY: 142, hp: 20, age: 0, fireTimer: 0 });
  updateDrones(w, 1 / 60); const b = w.enemyBullets.get(0);
  expect(b.vx).toBeLessThan(0); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(110);
});
test('nothing spawns once the round is over', () => {
  const w = makeWorld(); w.status = 'won'; run(w, fakeInput(), 3, (w, _i, dt) => updateBoss(w, dt)); expect(w.drones.count).toBe(0);
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/game/enemies.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

Boss (does nothing unless `status === 'playing'`):
- **Phase:** `phase = max(current, phaseFor(hp/maxHp))`. Phases never go backwards, and each change emits `phaseChanged`.
- **Movement:** move `x` toward `phases[phase-1].x` at `moveSpeed`. `y = centerY + sin(age · bobSpeed · 2π) · bobAmp`.
- **Drone waves:** when `droneTimer ≤ 0`, spawn `droneWave` drones at the boss's left edge, spaced `waveSpacing` apart vertically and centred on the boss.
- **Aimed spread:** every `spreadInterval` (when it's above 0), fire `spreadCount` bullets evenly across `spreadArc` radians, centred on the angle to the player.
- **Spiral:** every `spiralInterval` (when it's above 0), fire two opposite bullets at `spiralAngle`, then add `spiralTurn`.

Drones:
- `x -= speed·dt`, and `y = baseY + sin(age · wobbleFreq · 2π) · wobbleAmp`.
- Fire one aimed shot every `fireInterval` (the first shot after a random 0–1 × interval), but only while `status === 'playing'`.
- Release a drone once `x < -16`. The `flash` timer decays.

- [ ] **Step 4: Run the tests and see them pass.** Run `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Check it in the browser.** Expected: the boss bobs at the right edge and launches waves of drones, and the drones weave left while firing.

- [ ] **Step 6: Commit**: `Add three-phase boss with drone waves and bullet patterns`

---

### Task 7: Combat and the special beam

**Files:**
- Create: `src/game/combat.ts`
- Modify:
  - `src/game/player.ts`: if `input.consume('special') && specialCd <= 0`, call `fireBeam(w)` and set `specialCd = stats.specialCooldown`. Also decay `beam.time`.
  - `src/game/step.ts`: step 7 of the order.
  - `src/game/draw.ts`: draw the beam rectangle from `beam.x` to the right edge while `beam.time > 0`, with alpha `beam.time / duration`.
- Test: `src/game/combat.test.ts`

**Interfaces:**
- Consumes: `World`, `SpatialGrid`, `overlaps`
- Produces: `resolveCombat(w: World): void`, `fireBeam(w: World): void`

Rules (builder's calls):
- The kill count only counts drones the player destroys, with bullets or the beam. Drones that crash into the player don't count.
- Each player bullet hits at most one target. Drones are checked first, then the boss.
- While the player is invulnerable, enemy bullets and drones pass through without being used up.
- The beam deals its damage once, at the moment it fires.

- [ ] **Step 1: Write the failing tests**

```ts
// Add to testUtils.ts (Task 9 reuses them):
//   shoot(w, x, y): Bullet — player bullet at (x,y), vx 0, damage = shotDamage
//   enemyShot(w, x, y): Bullet — enemy bullet at (x,y), vx 0
//   drone(w, x, y, hp = 20): Drone — baseY = y, age 0, fireTimer 99
test('bullet damages a drone, flashes it, and is used up', () => {
  const w = makeWorld(); const d = drone(w, 200, 100); shoot(w, 200, 100); resolveCombat(w);
  expect(d.hp).toBe(10); expect(d.flash).toBeGreaterThan(0); expect(w.playerBullets.count).toBe(0);
});
test('killing a drone counts and emits droneKilled', () => {
  const w = makeWorld(); drone(w, 200, 100, 5); shoot(w, 200, 100); resolveCombat(w);
  expect(w.drones.count).toBe(0); expect(w.kills).toBe(1); expect(w.events[0]).toMatchObject({ type: 'droneKilled' });
});
test('bullet hits the boss and HP never goes below 0', () => {
  const w = makeWorld(); w.boss.hp = 5; shoot(w, w.boss.x, w.boss.y); resolveCombat(w);
  expect(w.boss.hp).toBe(0); expect(w.events[0]).toMatchObject({ type: 'bossHit' });
});
test('a bullet over both a drone and the boss hits only the drone', () => {
  const w = makeWorld(); drone(w, w.boss.x, w.boss.y); shoot(w, w.boss.x, w.boss.y); resolveCombat(w);
  expect(w.boss.hp).toBe(w.boss.maxHp);
});
test('enemy bullet hit costs 1 HP and grants invulnerability', () => {
  const w = makeWorld(); enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(2); expect(w.player.invuln).toBe(1); expect(w.enemyBullets.count).toBe(0);
  expect(w.events[0]).toMatchObject({ type: 'playerHit' });
});
test('invulnerable player is not hit and the bullet survives', () => {
  const w = makeWorld(); w.player.invuln = 0.5; enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(3); expect(w.enemyBullets.count).toBe(1);
});
test('drone collision hurts the player but does not count as a kill', () => {
  const w = makeWorld(); drone(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(2); expect(w.drones.count).toBe(0); expect(w.kills).toBe(0);
});
test('last hit emits playerKilled', () => {
  const w = makeWorld(); w.player.hp = 1; enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.events.map((e) => e.type)).toContain('playerKilled');
});
test('beam hits the boss for AMP × ATK and clears drones in its row', () => {
  const w = makeWorld(); w.player.y = w.boss.y; drone(w, 250, w.boss.y, 999); const outRow = drone(w, 250, w.boss.y - 60);
  fireBeam(w);
  expect(w.boss.hp).toBe(w.boss.maxHp - 50); expect(w.kills).toBe(1);
  expect(w.drones.count).toBe(1); expect(w.drones.get(0)).toBe(outRow);
  expect(w.beam.time).toBe(0.35);
});
test('beam that misses the boss row leaves its HP alone', () => {
  const w = makeWorld(); w.player.y = 24; w.boss.y = 230; fireBeam(w); expect(w.boss.hp).toBe(w.boss.maxHp);
});
test('E fires the beam once, then waits for the cooldown', () => {
  const w = makeWorld(); updatePlayer(w, fakeInput([], ['special']), 1 / 60); expect(w.player.specialCd).toBe(8);
  const hp = w.boss.hp; updatePlayer(w, fakeInput([], ['special']), 1 / 60); expect(w.boss.hp).toBe(hp);
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/game/combat.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

`resolveCombat`:
1. Rebuild the grid: `clear` it, then insert every drone.
2. Player bullets: iterate backwards. Query the grid, take the first overlapping drone, and fall back to the boss. A killed drone is released (backwards iteration again) and emits `droneKilled`.
3. Check enemy bullets and drones against the player.

`fireBeam`:
- The beam box spans from `player.x` to `view.width + 16`, centred on `player.y`, with height `beam.height`.
- Emit `beamFired`.

- [ ] **Step 4: Run the tests and see them pass.** Run `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Check it in the browser.** Expected: drones pop when shot, the boss takes damage, E fires a beam along your row, and getting hit makes the ship flash.

- [ ] **Step 6: Commit**: `Add collision resolution, damage, kill count, and special beam`

---

### Task 8: Round rules, screens, and the app flow

**Files:**
- Create: `src/game/round.ts`, `src/ui/screens.ts`
- Modify:
  - `src/game/step.ts`: step 8 of the order.
  - `index.html`: screen markup with the ids below.
  - `src/style.css`
  - `src/main.ts`: replace the sandbox with the app flow.
- Test: `src/game/round.test.ts`

**Interfaces:**
- Consumes: `World`, `StatInput`, `parseStatInput`, `deriveStats`, `createWorld`, `Input`
- Produces:
  - `updateRound(w: World, dt: number): void`
  - `interface RoundResult { outcome: 'win' | 'fail'; reason: 'boss' | 'time' | 'hp'; kills: number; timeLeft: number | null; stats: StatInput }`
  - `toResult(w: World, input: StatInput): RoundResult`
  - `interface Screens { showStart(prefill: StatInput): void; onStart(cb: (input: StatInput) => void): void; showPause(visible: boolean): void; showResults(r: RoundResult): void; onPlayAgain(cb: () => void): void; hideAll(): void }`
  - `createScreens(doc: Document, cfg: Config): Screens`
- DOM ids:
  - `#start`, `#start-form`
  - Inputs `#flat-attack`, `#cd-reduction`, `#play-time`, each with an error span `#<id>-error`
  - `#pause`
  - `#results`, `#results-title`, `#results-reason`, `#results-kills`, `#results-stats`, `#play-again`

- [ ] **Step 1: Write the failing tests**

```ts
test('boss at 0 HP wins', () => {
  const w = makeWorld(); w.boss.hp = 0; updateRound(w, 1 / 60);
  expect([w.status, w.reason]).toEqual(['won', 'boss']); expect(w.events[0]).toMatchObject({ type: 'bossKilled' });
});
test('boss dying on the last tick still wins', () => {
  const w = makeWorld(); w.boss.hp = 0; w.timeLeft = 0.001; updateRound(w, 1 / 60); expect(w.status).toBe('won');
});
test('player at 0 HP loses', () => {
  const w = makeWorld(); w.player.hp = 0; updateRound(w, 1 / 60); expect([w.status, w.reason]).toEqual(['lost', 'hp']);
});
test('timer running out loses and stops at 0', () => {
  const w = makeWorld(); w.timeLeft = 0.01; updateRound(w, 1 / 60);
  expect([w.status, w.reason, w.timeLeft]).toEqual(['lost', 'time', 0]);
});
test('round finishes after the end delay', () => {
  const w = makeWorld(); w.boss.hp = 0; updateRound(w, 1 / 60);
  run(w, fakeInput(), 1.4, (w, _i, dt) => updateRound(w, dt)); expect(w.finished).toBe(false);
  run(w, fakeInput(), 0.2, (w, _i, dt) => updateRound(w, dt)); expect(w.finished).toBe(true);
});
test('results: win keeps time left, fail does not, and both are plain JSON', () => {
  const input = { flatAttack: 5, cdReduction: 10, playTime: 120 };
  const w = makeWorld(); w.boss.hp = 0; w.kills = 7; updateRound(w, 1 / 60);
  const r = toResult(w, input);
  expect(r).toMatchObject({ outcome: 'win', reason: 'boss', kills: 7, stats: input }); expect(r.timeLeft).toBeGreaterThan(0);
  expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  const l = makeWorld(); l.player.hp = 0; updateRound(l, 1 / 60); expect(toResult(l, input).timeLeft).toBeNull();
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/game/round.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `updateRound`, `toResult`, the screens, and the flow**

`updateRound`:
- While playing, run these in order and stop at the first that applies:
  1. `timeLeft = max(0, timeLeft − dt)`
  2. If `boss.hp ≤ 0`: won, reason `boss`.
  3. Else if `player.hp ≤ 0`: lost, reason `hp`.
  4. Else if `timeLeft == 0`: lost, reason `time`.
- On the transition, set `endTimer = round.endDelay` and emit `bossKilled` on a win. The `playerKilled` event comes from combat.
- After the round ends, `endTimer` counts down, and `finished = endTimer ≤ 0`.

Screens:
- Inputs are `type="text" inputmode="decimal"` so the raw text reaches `parseStatInput`.
- Submitting the form (Enter or the Start button) runs `parseStatInput`.
  - Errors go into the `#<id>-error` spans.
  - `onStart` is called only when the input is valid.
- Showing the start screen focuses `#flat-attack`.
- Start screen copy:
  - Title: "SIDE-SCROLLING SHOOTER" (working title).
  - Controls hint (spec §5.1): "WASD / Arrows: move · E: special beam · Firing is automatic · Esc: pause".
- Pause screen copy: "PAUSED". Hint: "Press Esc to resume".
- Results screen:
  - Title: "VICTORY" or "FAILED".
  - Reason: `boss` → "Boss destroyed with M:SS left"; `time` → "Time ran out"; `hp` → "Your ship was destroyed".
  - Kills: "Drones destroyed: N".
  - Stats: "Flat Attack N · CD Reduction N% · Play Time N s".
  - `#play-again` gets focus, so Enter works.

`main.ts` flow:

| From | Trigger | Action |
|---|---|---|
| boot | — | `showStart(defaultStatInput)` |
| start | `onStart(input)` | Save `input`, then `input.clear()`. Create the world with `createRng(Date.now() >>> 0)`, reset `acc = 0`, call `hideAll()`. → playing |
| playing | `consume('pause')`, or window `blur` | `showPause(true)`, `input.clear()`. → paused |
| paused | `consume('pause')` | `showPause(false)`, reset `acc = 0`. → playing |
| playing | `world.finished` | `showResults(toResult(world, input))`. → results |
| results | `onPlayAgain` | `showStart(last input)`, prefilled (spec §5.4). → start |

Behaviour by state:
- The world is drawn in every state, so it stays visible behind the overlays.
- It is only stepped while playing.

- [ ] **Step 4: Run the tests and see them pass.** Run `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Check it in the browser**

- Typing `abc` in Flat Attack and pressing Start shows "Enter a whole number" and doesn't start a round.
- With Play Time `30`:
  1. Start a round, and confirm Esc pauses and resumes it.
  2. Click outside the page and confirm the game pauses (Review Focus 2).
  3. Wait 30 s and confirm the results say "FAILED / Time ran out".
  4. Click Play Again and confirm the start screen is prefilled with 30.

- [ ] **Step 6: Commit**: `Add round rules, start/pause/results screens, and app flow`

---

### Task 9: Game feel and background

**Files:**
- Create: `src/game/effects.ts`, `src/game/background.ts`
- Modify:
  - `src/game/step.ts`: step 9 of the order.
  - `src/game/draw.ts`: draw the starfield first, then particles, then a full-screen white overlay with alpha `min(1, fx.flash / flashPhase) × 0.6`. Pass a shake offset to `r.begin`: `round((Math.random()·2−1)·shake)` per axis.
- Test: `src/game/effects.test.ts`, `src/game/step.test.ts`

**Interfaces:**
- Consumes: `World`, `GameEvent`, `Config['fx']`, `Config['stars']`
- Produces:
  - `updateEffects(w: World, dt: number): void`
  - `interface Starfield { x: Float32Array; y: Float32Array; layer: Uint8Array }`
  - `createStarfield(rng: Rng, cfg: Config): Starfield`
  - `drawStarfield(r: Renderer, s: Starfield, cfg: Config, time: number): void`. Each star's x is `(x₀ − time·speed) mod width`, which needs no per-frame state.

What each event does (`shake = max(shake, value)`; bursts use `particleLife`, `particleSpeed` and random angles):

| Event | Effect |
|---|---|
| droneKilled | `droneBurst` particles in `droneBurst` colour, `shakeDrone` |
| bossHit | `hitSparks` white particles, `boss.flash = 0.06` |
| playerHit | `hitStop = hitStopPlayerHit`, `shakePlayerHit`, `flash = flashPlayerHit` |
| phaseChanged | `hitStop = hitStopPhase`, `shakePhase`, `flash = flashPhase`, `phaseBurst` particles at the boss |
| beamFired | `shakeBeam` |
| bossKilled | `bossBurst` particles, `shakeBossKilled`, `flash = flashBossKilled` |
| playerKilled | `playerBurst` particles, `shakePlayerHit` |

Particles:
- They move by velocity, which decays as `v *= exp(−particleDrag·dt)`.
- `life` decreases with `dt`, and a particle is released at `life ≤ 0`.
- `shake *= exp(−shakeDecay·dt)`, and `flash` drops linearly to 0.

- [ ] **Step 1: Write the failing tests**

```ts
// effects.test.ts
test('drone death bursts particles', () => {
  const w = makeWorld(); w.events.push({ type: 'droneKilled', x: 100, y: 100 }); updateEffects(w, 1 / 60);
  expect(w.particles.count).toBe(12);
});
test('particles expire', () => {
  const w = makeWorld(); w.events.push({ type: 'droneKilled', x: 100, y: 100 }); updateEffects(w, 1 / 60);
  w.events.length = 0; run(w, fakeInput(), 1, (w, _i, dt) => updateEffects(w, dt)); expect(w.particles.count).toBe(0);
});
test('player hit triggers hit-stop, shake, and flash', () => {
  const w = makeWorld(); w.events.push({ type: 'playerHit', x: 0, y: 0 }); updateEffects(w, 0);
  expect(w.fx).toEqual({ hitStop: 0.06, shake: 6, flash: 0.1 });
});
test('shake settles', () => {
  const w = makeWorld(); w.fx.shake = 14; run(w, fakeInput(), 2, (w, _i, dt) => updateEffects(w, dt));
  expect(w.fx.shake).toBeLessThan(0.01);
});
test('full particle pool is skipped without throwing', () => {     // Review Focus 4
  const w = makeWorld(); while (w.particles.acquire());
  w.events.push({ type: 'bossKilled', x: 0, y: 0 }); expect(() => updateEffects(w, 1 / 60)).not.toThrow();
});

// step.test.ts
test('hit-stop freezes the whole simulation, timer included', () => {
  const w = makeWorld(); w.fx.hitStop = 0.1; const t = w.timeLeft; const x = w.boss.x;
  stepWorld(w, fakeInput(['right']), 1 / 60);
  expect([w.timeLeft, w.boss.x, w.player.x]).toEqual([t, x, 40]); expect(w.fx.hitStop).toBeCloseTo(0.1 - 1 / 60);
});
test('events are handled once', () => {
  const w = makeWorld(); w.player.invuln = 99; drone(w, 200, 100, 1); shoot(w, 200, 100);
  stepWorld(w, fakeInput(), 1 / 60); const n = w.particles.count; stepWorld(w, fakeInput(), 1 / 60);
  expect(w.particles.count).toBeLessThanOrEqual(n);
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/game/effects.test.ts src/game/step.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `updateEffects`, the starfield, and the draw changes.**

- [ ] **Step 4: Run the tests and see them pass.** Run `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Check it in the browser.** Expected: three parallax star layers scroll, drones burst into particles, the screen shakes on hits and phase changes, and each phase change has a visible freeze-and-flash moment.

- [ ] **Step 6: Commit**: `Add particles, screen shake, hit-stop, flashes, and parallax stars`

---

### Task 10: HUD, debug overlay, stress mode, single-file build

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/debug.ts`
- Modify:
  - `index.html`: add `#hud` and `#debug`.
  - `src/style.css`
  - `src/main.ts`: wire the HUD and the debug overlay, add `?stress`, and lay out the HUD on every resize.
  - `README.md`
- Test: `src/ui/hud.test.ts`

**Interfaces:**
- Consumes: `World`, `Viewport`, `FrameStats`, `Renderer.quadCount`
- Produces:
  - `formatTime(seconds: number): string`. Format `m:ss`, rounding seconds up.
  - `createHud(doc: Document): { layout(v: Viewport, dpr: number): void; update(w: World): void; setVisible(v: boolean): void }`
  - `createDebugOverlay(doc: Document): { toggle(): void; setVisible(v: boolean): void; update(s: FrameStats, steps: number, quads: number): void }`

- [ ] **Step 1: Write the failing test**

```ts
test.each([[120, '2:00'], [59.2, '1:00'], [9.01, '0:10'], [0, '0:00']])('formatTime(%f) = %s', (s, out) => {
  expect(formatTime(s)).toBe(out);
});
```

- [ ] **Step 2: Run the test and see it fail.** Run `npx vitest run src/ui`. Expected: FAIL.

- [ ] **Step 3: Implement**

HUD (spec §8: timer, player HP, boss HP bar, kill count, special cooldown):
- `#hud` is absolutely positioned over the game viewport: `left/top/width/height = viewport / dpr`. Its font size scales with `viewport.scale`.
- It is a top bar:
  - Timer `m:ss`.
  - Hearts: `♥` for each HP left and `♡` for each HP lost.
  - A boss HP bar whose width is `hp / maxHp`.
  - "KILLS N".
  - A special bar filling as the cooldown runs. It reads "E READY" when ready and stays visible at all times (spec §6.3).
- `update` writes to the DOM only when a displayed value changes.
- Font: `ui-monospace, Consolas, monospace` (no web fonts).

Debug overlay:
- **F3** or **`** toggles it. The main loop handles the key with `consume('debug')`.
- Text: `FPS 60 · frame 16.7 ms avg / 18.2 max · steps 1 · quads 1234`, refreshed 4 times a second.

Stress mode (`?stress` in the URL):
- On every round start, set `boss.hp = maxHp × 0.24` (straight to phase 3) and `player.invuln = Infinity`, and turn the debug overlay on.
- This is for checking frame rate on the festival workstation (spec §9).

`README.md` covers:
- `npm install`, `npm run dev`, `npm test`.
- `npm run build` produces `dist/index.html`. Copy that one file, double-click it, then press F11.
- F3 shows the FPS overlay, and `?stress` tests performance.
- The GitHub Pages backup.

- [ ] **Step 4: Run every check**

Run: `npx vitest run && npm run typecheck && npm run build && ls dist`
Expected: all tests pass, 0 type errors, and `dist` contains **only** `index.html`.

- [ ] **Step 5: Check the built file offline**

1. Open `dist/index.html` straight from disk (`file:///…/dist/index.html`) in Playwright, play one round end to end, and confirm the network log shows no requests besides the file itself.
2. Open `http://localhost:5173/?stress` in the dev server, toggle F3, let phase 3 run for 30 s, and record the FPS and the worst frame time.

Expected: the game is fully playable from `file://`, and the stress numbers are recorded for the user to compare on the workstation.

- [ ] **Step 6: Commit**: `Add HUD, debug overlay, stress mode, and single-file build docs`
