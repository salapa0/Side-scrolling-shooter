import { expect, test } from 'vitest';
import { CONFIG } from './config';
import { ampFor, defaultStatInput, deriveStats, parseStatInput } from './stats';
import type { RawStatInput } from './stats';

const S = CONFIG.stats;
const raw = (f: string, c: string, p: string): RawStatInput => ({ flatAttack: f, cdReduction: c, playTime: p });

test('derives stats from formulas', () => {
  const d = deriveStats({ flatAttack: 5, cdReduction: 25, playTime: 90 }, S);
  expect(d).toMatchObject({ atk: 15, shotDamage: 15, specialCooldown: 6, playTime: 90 });
  expect(d.amp).toBeCloseTo(23.47, 2); expect(d.specialDamage).toBeCloseTo(15 * d.amp);
});
test('defaults give base stats', () => {
  expect(deriveStats(defaultStatInput(S), S)).toMatchObject({ atk: 10, amp: 20, specialDamage: 200, specialCooldown: 8, playTime: 120 });
});
test.each([[0, 20], [5, 23.47], [10, 25.49], [50, 31.99], [100, 35.22], [268, 40], [999, 40]])('ampFor(%i) ≈ %f', (flat, out) => {
  expect(ampFor(flat, S.amp)).toBeCloseTo(out, 2);
});
test('AMP never drops as Flat Attack rises and never passes the cap', () => {
  let prev = 0;
  for (let f = 0; f <= 999; f++) { const a = ampFor(f, S.amp); expect(a).toBeGreaterThanOrEqual(prev); expect(a).toBeLessThanOrEqual(40); prev = a; }
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
