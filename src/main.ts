import './style.css';
import { CONFIG } from './config';
import { rgb } from './engine/color';
import { startLoop } from './engine/loop';
import { Renderer, WebGL2UnavailableError } from './engine/renderer';
import { createRng, type Rng } from './engine/rng';

const WEBGL2_MESSAGE =
  'This game needs WebGL2. Open it in an up-to-date Chrome or Edge with hardware acceleration turned on.';
const CONTEXT_LOST_MESSAGE = 'The graphics driver reset. Press F5 to reload.';

// Temporary test pattern (Task 5 replaces it).
const SQUARE_COUNT = 3000;
const STAIR_STEPS = 200;
const WHITE = rgb('#ffffff');
const PALETTE = [
  CONFIG.colors.player, CONFIG.colors.drone, CONFIG.colors.enemyBullet,
  CONFIG.colors.playerBullet, CONFIG.colors.boss,
];

function showFatal(message: string): void {
  const el = document.getElementById('fatal');
  if (el) {
    el.textContent = message;
    el.hidden = false;
  } else {
    document.body.textContent = message;
  }
}

/** Border and staircase show whether scaling stays sharp; the squares exercise batching. */
function createTestPattern(rng: Rng): (r: Renderer, dt: number) => void {
  const { width, height } = CONFIG.view;
  const x = new Float32Array(SQUARE_COUNT);
  const y = new Float32Array(SQUARE_COUNT);
  const vx = new Float32Array(SQUARE_COUNT);
  const vy = new Float32Array(SQUARE_COUNT);
  const size = new Uint8Array(SQUARE_COUNT);
  for (let i = 0; i < SQUARE_COUNT; i++) {
    size[i] = 2 + Math.floor(rng() * 3);
    x[i] = 1 + rng() * (width - 2 - size[i]);
    y[i] = 1 + rng() * (height - 2 - size[i]);
    const angle = rng() * Math.PI * 2;
    const speed = 20 + rng() * 80;
    vx[i] = Math.cos(angle) * speed;
    vy[i] = Math.sin(angle) * speed;
  }

  return (r, dt) => {
    r.begin(CONFIG.colors.bg);
    for (let i = 0; i < SQUARE_COUNT; i++) {
      const s = size[i];
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      if (x[i] < 1) { x[i] = 1; vx[i] = Math.abs(vx[i]); }
      else if (x[i] > width - 1 - s) { x[i] = width - 1 - s; vx[i] = -Math.abs(vx[i]); }
      if (y[i] < 1) { y[i] = 1; vy[i] = Math.abs(vy[i]); }
      else if (y[i] > height - 1 - s) { y[i] = height - 1 - s; vy[i] = -Math.abs(vy[i]); }
      r.rect(x[i], y[i], s, s, PALETTE[i % PALETTE.length]);
    }
    r.rect(0, 0, width, 1, WHITE);
    r.rect(0, height - 1, width, 1, WHITE);
    r.rect(0, 0, 1, height, WHITE);
    r.rect(width - 1, 0, 1, height, WHITE);
    for (let i = 0; i < STAIR_STEPS; i++) r.rect(8 + i, 8 + i, 1, 1, WHITE);
    r.end();
  };
}

function start(): void {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('index.html has no <canvas id="game">.');
  const renderer = Renderer.create(canvas, CONFIG.view.width, CONFIG.view.height, CONFIG.caps.quads);

  const fitCanvas = (): void => {
    const dpr = window.devicePixelRatio || 1;
    renderer.resize(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr));
  };
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  const drawPattern = createTestPattern(createRng(1));
  const stop = startLoop((frameDt) => drawPattern(renderer, Math.min(frameDt, CONFIG.sim.maxFrameTime)));
  renderer.onContextLost(() => {
    stop();
    showFatal(CONTEXT_LOST_MESSAGE);
  });
}

try {
  start();
} catch (err) {
  if (err instanceof WebGL2UnavailableError) {
    showFatal(WEBGL2_MESSAGE);
  } else {
    console.error(err);
    showFatal(`The game could not start. ${err instanceof Error ? err.message : String(err)}`);
  }
}
