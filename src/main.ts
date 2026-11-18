import './style.css';
import { CONFIG } from './config';
import { Input } from './engine/input';
import { advance, startLoop } from './engine/loop';
import { Renderer, WebGL2UnavailableError } from './engine/renderer';
import { createRng } from './engine/rng';
import { drawWorld } from './game/draw';
import { toResult } from './game/round';
import { stepWorld } from './game/step';
import { createWorld, type World } from './game/world';
import { defaultStatInput, deriveStats, type StatInput } from './stats';
import { createScreens } from './ui/screens';

const WEBGL2_MESSAGE =
  'This game needs WebGL2. Open it in an up-to-date Chrome or Edge with hardware acceleration turned on.';
const CONTEXT_LOST_MESSAGE = 'The graphics driver reset. Press F5 to reload.';

type AppState = 'start' | 'playing' | 'paused' | 'results';

const newWorld = (input: StatInput): World =>
  createWorld(CONFIG, deriveStats(input, CONFIG.stats), createRng(Date.now() >>> 0));

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

  const input = new Input(CONFIG.bindings);
  input.attach(window);
  const screens = createScreens(document, CONFIG);

  let lastInput = defaultStatInput(CONFIG.stats);
  // Start-screen backdrop: drawn but never stepped. Starting a round replaces it.
  let world = newWorld(lastInput);
  let state: AppState = 'start';
  let acc = 0;

  const pause = (): void => {
    if (state !== 'playing') return;
    state = 'paused';
    screens.showPause(true);
    input.clear();
  };
  const resume = (): void => {
    state = 'playing';
    screens.showPause(false);
    acc = 0;
  };
  const play = (frameDt: number): void => {
    const a = advance(acc, frameDt, CONFIG.sim);
    acc = a.acc;
    for (let i = 0; i < a.steps && !world.finished; i++) stepWorld(world, input, CONFIG.sim.step);
    if (world.finished) {
      state = 'results';
      screens.showResults(toResult(world, lastInput));
    }
  };

  screens.onStart((stats) => {
    if (state !== 'start') return;
    lastInput = stats;
    input.clear();
    world = newWorld(stats);
    acc = 0;
    screens.hideAll();
    state = 'playing';
  });
  screens.onPlayAgain(() => {
    if (state !== 'results') return;
    state = 'start';
    screens.showStart(lastInput);
  });
  window.addEventListener('blur', pause);
  screens.showStart(lastInput);

  const stop = startLoop((frameDt) => {
    if (state === 'playing') {
      if (input.consume('pause')) pause();
      else play(frameDt);
    } else if (state === 'paused') {
      if (input.consume('pause')) resume();
    } else {
      // Discard Esc pressed on the start or results screen so it can't pause the next round.
      input.consume('pause');
    }
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
