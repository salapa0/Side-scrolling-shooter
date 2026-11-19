import type { Config } from './config';

export interface StatInput { flatAttack: number; cdReduction: number; playTime: number }
export type StatField = keyof StatInput;
export type RawStatInput = Record<StatField, string>;
export type ParseResult =
  | { ok: true; value: StatInput }
  | { ok: false; errors: Partial<Record<StatField, string>> };

export interface DerivedStats {
  atk: number;
  shotDamage: number;
  amp: number;
  specialDamage: number;
  specialCooldown: number;
  playTime: number;
}

type Stats = Config['stats'];
type FieldRule = { min: number; max: number; default: number };

const WHOLE = /^\d+$/;
const DECIMAL = /^\d+(\.\d+)?$/;

/** Returns the parsed value or an error message. Blank takes the field default. */
function parseField(text: string, rule: FieldRule, whole: boolean): { value: number } | { error: string } {
  const t = text.trim();
  if (t === '') return { value: rule.default };
  if (!(whole ? WHOLE : DECIMAL).test(t)) return { error: whole ? 'Enter a whole number' : 'Enter a number' };
  const value = Number(t);
  if (value < rule.min || value > rule.max) return { error: `Must be ${rule.min}–${rule.max}` };
  return { value };
}

export function parseStatInput(raw: RawStatInput, cfg: Stats): ParseResult {
  const fields: [StatField, boolean][] = [['flatAttack', true], ['cdReduction', false], ['playTime', true]];
  const value = { ...defaultStatInput(cfg) };
  const errors: Partial<Record<StatField, string>> = {};
  for (const [field, whole] of fields) {
    const r = parseField(raw[field], cfg[field], whole);
    if ('error' in r) errors[field] = r.error;
    else value[field] = r.value;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function defaultStatInput(cfg: Stats): StatInput {
  return {
    flatAttack: cfg.flatAttack.default,
    cdReduction: cfg.cdReduction.default,
    playTime: cfg.playTime.default,
  };
}

/** Beam multiplier: rises steeply for small Flat Attack, then flattens and stops at the cap. */
export function ampFor(flatAttack: number, amp: Stats['amp']): number {
  return Math.min(amp.max, amp.min + amp.k * Math.log(1 + flatAttack / amp.scale));
}

export function deriveStats(input: StatInput, cfg: Stats): DerivedStats {
  const atk = cfg.baseAtk + input.flatAttack;
  const amp = ampFor(input.flatAttack, cfg.amp);
  return {
    atk,
    shotDamage: atk,
    amp,
    specialDamage: amp * atk,
    specialCooldown: cfg.baseCd * (1 - input.cdReduction / 100),
    playTime: input.playTime,
  };
}
