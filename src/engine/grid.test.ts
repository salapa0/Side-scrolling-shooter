import { beforeEach, expect, test } from 'vitest';
import { SpatialGrid } from './grid';

const item = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, stamp: 0 });
let grid: SpatialGrid<ReturnType<typeof item>>;
beforeEach(() => {
  grid = new SpatialGrid(480, 270, 32);
});

test('item spanning cells is returned once', () => {
  const a = item(32, 32, 10, 10);
  grid.insert(a);
  expect(grid.query(item(32, 32, 20, 20), [])).toEqual([a]);
});

test('far query finds nothing', () => {
  grid.insert(item(20, 20, 4, 4));
  expect(grid.query(item(400, 200, 4, 4), [])).toEqual([]);
});

test('items partly off-grid are still found', () => {
  const a = item(-3, 100, 10, 10);
  grid.insert(a);
  expect(grid.query(item(2, 100, 4, 4), [])).toContain(a);
});

test('clear empties every cell', () => {
  grid.insert(item(20, 20, 4, 4));
  grid.clear();
  expect(grid.query(item(20, 20, 4, 4), [])).toEqual([]);
});

test('query empties out before filling', () => {
  const a = item(20, 20, 4, 4);
  grid.insert(a);
  const out = [item(0, 0, 1, 1)];
  expect(grid.query(item(20, 20, 4, 4), out)).toEqual([a]);
});

test('repeated queries return the same item each time', () => {
  const a = item(20, 20, 4, 4);
  grid.insert(a);
  expect(grid.query(item(20, 20, 4, 4), [])).toEqual([a]);
  expect(grid.query(item(20, 20, 4, 4), [])).toEqual([a]);
});
