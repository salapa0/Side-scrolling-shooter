import type { FrameStats } from '../engine/frameStats';
import type { Pool } from '../engine/pool';
import type { World } from '../game/world';
import type { StatInput } from '../stats';
import type { TallySummary } from '../tally';

/** Everything the console shows; built by main.ts only when a refresh is due. */
export interface DevSnapshot {
  appState: string;
  world: World;
  input: StatInput;
  frame: FrameStats;
  steps: number;
  quads: number;
  tally: TallySummary;
  clearArmed: boolean;                                                // one F4 seen; a second clears
}

export interface DevConsole {
  readonly visible: boolean;
  toggle(): void;
  setVisible(v: boolean): void;
  update(snapshot: () => DevSnapshot): void;
}

const REFRESH_MS = 250;

const used = <T>(name: string, pool: Pool<T>): string => `${name} ${pool.count}/${pool.capacity}`;

/** Read-only dump of the live game: one line per section, fields joined with " · ". */
export function devConsoleText(s: DevSnapshot): string {
  const { world: w, frame: f, tally: t } = s;
  const { player: p, boss: b, stats: st, cfg } = w;
  const fireRate = cfg.player.fireRate * (p.rapid > 0 ? cfg.player.rapidMultiplier : 1);
  const winRate = t.winRate === null ? '—' : `${Math.round(t.winRate * 100)}%`;
  const bands = t.bands.map((band) => `${band.label}: ${band.wins}/${band.rounds}`).join(' · ');
  const armed = s.clearArmed ? ` · F4 again to clear ${t.rounds} rounds` : '';
  return [
    `PERFORMANCE FPS ${Math.round(f.fps)} · frame ${f.avgMs.toFixed(1)} ms avg / ${f.maxMs.toFixed(1)} max · steps ${s.steps} · quads ${s.quads}`,
    `ROUND ${s.appState} · status ${w.status} · time ${w.timeLeft.toFixed(1)} / ${st.playTime} s · scale ${w.fx.timeScale.toFixed(2)} · kills ${w.kills}`,
    `PLAYER HP ${p.hp}/${cfg.player.hp} · pos ${Math.round(p.x)},${Math.round(p.y)} · invuln ${p.invuln.toFixed(2)}`
      + ` · special ${p.specialCd.toFixed(1)}/${st.specialCooldown.toFixed(1)} s · fire ${fireRate}/s · rapid ${p.rapid.toFixed(1)} s`
      + ` · hitbox ${cfg.player.hitW}×${cfg.player.hitH}`,
    `STATS flat ${s.input.flatAttack} · CDR ${s.input.cdReduction}% · play ${s.input.playTime} s`
      + ` · ATK ${st.atk} · shot ${st.shotDamage} · AMP ${st.amp.toFixed(2)} · beam ${Math.round(st.specialDamage)}`,
    `BOSS HP ${Math.round(b.hp)}/${b.maxHp} (${((b.hp / b.maxHp) * 100).toFixed(1)}%) · phase ${b.phase} · pos ${Math.round(b.x)},${Math.round(b.y)}`,
    `POOLS ${used('drones', w.drones)} · ${used('bullets', w.playerBullets)} · ${used('enemy', w.enemyBullets)}`
      + ` · ${used('particles', w.particles)} · ${used('power-ups', w.powerUps)}`,
    `TALLY @${t.bossMaxHp} rounds ${t.rounds} · wins ${t.wins} · lost time ${t.lostTime} · lost HP ${t.lostHp} · win rate ${winRate} · ${bands}${armed}`,
  ].join('\n');
}

export function createDevConsole(doc: Document): DevConsole {
  const el = doc.getElementById('dev-console');
  if (!el) throw new Error('index.html has no #dev-console.');
  let visible = !el.hidden;
  let lastWrite = -Infinity;

  const setVisible = (v: boolean): void => {
    visible = v;
    el.hidden = !v;
    lastWrite = -Infinity; // refresh on the next frame instead of showing stale text
  };
  return {
    get visible() { return visible; },
    toggle: () => setVisible(!visible),
    setVisible,
    update(snapshot) {
      // Hidden or not yet due: no snapshot and no string building.
      if (!visible) return;
      const now = performance.now();
      if (now - lastWrite < REFRESH_MS) return;
      lastWrite = now;
      el.textContent = devConsoleText(snapshot());
    },
  };
}
