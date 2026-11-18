import { expect, test } from 'vitest';
import { CONFIG } from './config';
import { defaultStatInput, deriveStats, parseStatInput } from './stats';
import type { RawStatInput } from './stats';

const S = CONFIG.stats;
const raw = (f: string, c: string, p: string): RawStatInput => ({ flatAttack: f, cdReduction: c, playTime: p });

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
