// 运行：node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convexHull, simplify, polygonAreaCentroid, popScale } from '../js/geometry.js';

const sortPts = pts => [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

test('凸包去掉内部点，只留外圈', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const inner = [[5, 5], [2, 3], [7, 8]];
  assert.deepEqual(sortPts(convexHull([...square, ...inner])), sortPts(square));
});

test('凸包去掉共线点', () => {
  const pts = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(convexHull(pts).length, 4);
});

test('简化后顶点数不超过上限，且保留最重要的角', () => {
  const circle = Array.from({ length: 60 }, (_, i) => [Math.cos(i / 60 * 2 * Math.PI) * 100, Math.sin(i / 60 * 2 * Math.PI) * 100]);
  const s = simplify(circle, 18);
  assert.equal(s.length, 18);
  const { area } = polygonAreaCentroid(s);
  assert.ok(area > Math.PI * 100 * 100 * 0.95, `简化后面积损失太多：${area}`);
});

test('顶点本来就少时简化不改动', () => {
  const tri = [[0, 0], [4, 0], [0, 3]];
  assert.deepEqual(simplify(tri, 18), tri);
});

test('多边形面积与重心', () => {
  const rect = [[0, 0], [4, 0], [4, 2], [0, 2]];
  const { area, cx, cy } = polygonAreaCentroid(rect);
  assert.equal(area, 8);
  assert.ok(Math.abs(cx - 2) < 1e-9 && Math.abs(cy - 1) < 1e-9);
});

test('面积与顶点顺序无关（顺时针也为正）', () => {
  const cw = [[0, 0], [0, 2], [4, 2], [4, 0]];
  assert.equal(polygonAreaCentroid(cw).area, 8);
});

test('弹出动画从 0.55 起步、中途略超过 1、最后停在 1', () => {
  assert.ok(Math.abs(popScale(0) - 0.55) < 1e-9);
  const peak = Math.max(...Array.from({ length: 24 }, (_, i) => popScale(i * 10)));
  assert.ok(peak > 1, '应有回弹');
  assert.equal(popScale(240), 1);
  assert.equal(popScale(9999), 1);
});
