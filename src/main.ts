import './style.css';
import { CONFIG } from './config';
import { Input } from './engine/input';
import { advance, startLoop } from './engine/loop';
import { Renderer, WebGL2UnavailableError } from './engine/renderer';
import { createRng } from './engine/rng';
import { drawWorld } from './game/draw';
import { stepWorld } from './game/step';
import { createWorld } from './game/world';
import { defaultStatInput, deriveStats } from './stats';

const WEBGL2_MESSAGE =
  'This game needs WebGL2. Open it in an up-to-date Chrome or Edge with hardware acceleration turned on.';
const CONTEXT_LOST_MESSAGE = 'The graphics driver reset. Press F5 to reload.';

function showFatal(message: string): void {
  const el = document.getElementById('fatal');
  if (el) {
    el.textContent = message;
    el.hidden = false;
  } else {
    document.body.textContent = message;
  }
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

  // Sandbox world until the round flow (Task 8) replaces it.
  const stats = deriveStats(defaultStatInput(CONFIG.stats), CONFIG.stats);
  const world = createWorld(CONFIG, stats, createRng(Date.now() >>> 0));
  const input = new Input(CONFIG.bindings);
  input.attach(window);
  let acc = 0;
  const stop = startLoop((frameDt) => {
    const a = advance(acc, frameDt, CONFIG.sim);
    acc = a.acc;
    for (let i = 0; i < a.steps; i++) stepWorld(world, input, CONFIG.sim.step);
    drawWorld(renderer, world);
  });
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
