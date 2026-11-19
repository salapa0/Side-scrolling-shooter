import './style.css';
import { CONFIG } from './config';
import { FrameStats } from './engine/frameStats';
import { Input } from './engine/input';
import { advance, startLoop } from './engine/loop';
import { Renderer, WebGL2UnavailableError } from './engine/renderer';
import { createRng } from './engine/rng';
import { drawWorld } from './game/draw';
import { toResult } from './game/round';
import { stepWorld } from './game/step';
import { createWorld, type World } from './game/world';
import { defaultStatInput, deriveStats, type StatInput } from './stats';
import { createTally, type TallyKey, type TallyStorage } from './tally';
import { createConfirm } from './ui/confirm';
import { createDevConsole } from './ui/devConsole';
import { createHud } from './ui/hud';
import { createScreens } from './ui/screens';

const WEBGL2_MESSAGE =
  'This game needs WebGL2. Open it in an up-to-date Chrome or Edge with hardware acceleration turned on.';
const CONTEXT_LOST_MESSAGE = 'The graphics driver reset. Press F5 to reload.';

type AppState = 'start' | 'playing' | 'paused' | 'results';

const newWorld = (input: StatInput): World =>
  createWorld(CONFIG, deriveStats(input, CONFIG.stats), createRng(Date.now() >>> 0));

/** localStorage, or null where the browser blocks it (the round log then lives in memory). */
function openStorage(): TallyStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// ?stress: sustained phase 3 for frame-rate checks. Zero damage keeps the boss there; drones leave
// the screen, so it settles near 25-35 drones and ~240 quads, not the pool caps.
const STRESS = new URLSearchParams(window.location.search).has('stress');
// Rounds count together only under the same total boss HP and balance rules.
const TALLY_KEY: TallyKey = { bossMaxHp: CONFIG.boss.stageHp * CONFIG.boss.phases.length, balanceVersion: CONFIG.balanceVersion };

function applyStress(w: World): void {
  w.boss.phase = 3;
  w.boss.hp = w.boss.maxHp;
  w.player.invuln = Infinity;
  w.stats.shotDamage = 0;
  w.stats.specialDamage = 0;
}

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

  const hud = createHud(document);
  const devConsole = createDevConsole(document);
  const tally = createTally(openStorage(), CONFIG.tally.key, CONFIG.tally.cap, CONFIG.tally.bands);
  const confirmClear = createConfirm(CONFIG.tally.confirmWindow * 1000);
  const frameStats = new FrameStats();

  const fitCanvas = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const viewport = renderer.resize(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr));
    hud.layout(viewport, dpr);
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
  let steps = 0;

  const pause = (): void => {
    if (state !== 'playing') return;
    state = 'paused';
    screens.showPause(true);
    input.clear();
  };
  const resume = (): void => {
    state = 'playing';
    screens.showPause(false);
    input.clear(); // A key pressed while paused (E) must not act on resume.
    acc = 0;
  };
  const play = (frameDt: number): void => {
    const a = advance(acc, frameDt, CONFIG.sim);
    acc = a.acc;
    steps = a.steps;
    for (let i = 0; i < a.steps && !world.finished; i++) stepWorld(world, input, CONFIG.sim.step);
    if (world.finished) {
      state = 'results';
      hud.setVisible(false);
      const result = toResult(world, lastInput);
      // Stress rounds can't be won, so they'd only skew the win rate.
      if (!STRESS) tally.record({ ...result, ...TALLY_KEY });
      screens.showResults(result);
    }
  };

  screens.onStart((stats) => {
    if (state !== 'start') return;
    lastInput = stats;
    input.clear();
    world = newWorld(stats);
    if (STRESS) {
      applyStress(world);
      devConsole.setVisible(true);
    }
    acc = 0;
    screens.hideAll();
    state = 'playing';
    hud.setVisible(true);
  });
  screens.onPlayAgain(() => {
    if (state !== 'results') return;
    state = 'start';
    hud.setVisible(false);
    screens.showStart(lastInput);
  });
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pause();
  });
  screens.showStart(lastInput);

  const frame = (frameDt: number): void => {
    steps = 0;
    if (input.consume('debug')) devConsole.toggle();
    // Consumed every frame so a press made while the console is hidden can't clear the log later.
    if (input.consume('resetTally') && devConsole.visible && confirmClear.press(performance.now())) tally.clear(TALLY_KEY);
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
    if (state === 'playing' || state === 'paused') hud.update(world);
    frameStats.record(frameDt * 1000);
    devConsole.update(() => ({
      appState: state, world, input: lastInput, frame: frameStats, steps, quads: renderer.quadCount,
      tally: tally.summary(TALLY_KEY), clearArmed: confirmClear.armed(performance.now()),
    }));
  };
  // An exception would silently end the rAF chain and freeze the screen, so surface it.
  const stop = startLoop((frameDt) => {
    try {
      frame(frameDt);
    } catch (err) {
      stop();
      console.error(err);
      showFatal(`The game stopped unexpectedly. ${err instanceof Error ? err.message : String(err)}`);
    }
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
