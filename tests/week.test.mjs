// 运行：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStart, weekKey, daysLeft } from '../js/week.js';

// 北京时间的某一刻 → 时间戳
const bj = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h - 8, min);

test('2026-10-03 是周六，本周从 9 月 28 日周一开始', () => {
  assert.equal(weekKey(bj(2026, 10, 3, 15)), '2026-09-28');
  assert.equal(weekStart(bj(2026, 10, 3, 15)), bj(2026, 9, 28));
});

test('周一 0 点整属于新的一周，前一分钟还是上周', () => {
  assert.equal(weekKey(bj(2026, 10, 5, 0, 0)), '2026-10-05');
  assert.equal(weekKey(bj(2026, 10, 4, 23, 59)), '2026-09-28');
});

test('北京时间周一早上 7 点（UTC 还是周日）也算周一', () => {
  assert.equal(weekKey(bj(2026, 10, 5, 7)), '2026-10-05');
});

test('跨月跨年', () => {
  assert.equal(weekKey(bj(2027, 1, 1, 12)), '2026-12-28');
});

test('剩余天数：周六下午还剩 2 天，周日晚上 11 点还剩 1 天，周一 0 点还剩 7 天', () => {
  assert.equal(daysLeft(bj(2026, 10, 3, 15)), 2);
  assert.equal(daysLeft(bj(2026, 10, 4, 23)), 1);
  assert.equal(daysLeft(bj(2026, 10, 5, 0)), 7);
});
