// 运行：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnWeights, pickLevel, ORPHAN_BOOST } from '../js/spawn.js';

const TABLE = [
  { minTop: 0, weights: [1, 1, 1] },
  { minTop: 5, weights: [1, 1, 1, 1, 1] },
  { minTop: 9, weights: [0, 0.5, 1, 1, 1, 1] }
];

test('按最高等级选对应的那一行', () => {
  assert.equal(spawnWeights(0, [], TABLE).length, 3);
  assert.equal(spawnWeights(4, [], TABLE).length, 3);
  assert.equal(spawnWeights(5, [], TABLE).length, 5);
  assert.equal(spawnWeights(13, [], TABLE).length, 6);
});

test('场上落单的等级会加权，成对的不加', () => {
  const w = spawnWeights(9, [1, 2, 0, 3], TABLE);
  assert.equal(w[0], ORPHAN_BOOST);       // 本来不掉，落单后能掉
  assert.equal(w[1], 0.5);                // 成对不加
  assert.equal(w[3], 1 + ORPHAN_BOOST);   // 落单加权
});

test('超出这一行范围的落单等级不会被加进来', () => {
  assert.equal(spawnWeights(0, [0, 0, 0, 0, 0, 0, 0, 1], TABLE).length, 3);
});

test('按权重抽取：权重为 0 的等级抽不到，抽到的都在范围内', () => {
  const w = [0, 1, 3];
  const seen = new Set(Array.from({ length: 2000 }, (_, i) => pickLevel(w, () => (i + 0.5) / 2000)));
  assert.deepEqual([...seen].sort(), [1, 2]);
});

test('抽取比例接近权重比例', () => {
  const w = [1, 3];
  const n = 4000;
  const ones = Array.from({ length: n }, (_, i) => pickLevel(w, () => (i + 0.5) / n)).filter(x => x === 1).length;
  assert.ok(Math.abs(ones / n - 0.75) < 0.01, `比例 ${ones / n}`);
});
