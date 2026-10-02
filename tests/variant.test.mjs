// 运行：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollShiny, shinyMultiplier } from '../js/variant.js';
import { SHINY } from '../js/config.js';

const seq = values => { let i = 0; return () => values[i++ % values.length]; };

test('投放：低于概率出闪光，否则普通', () => {
  assert.equal(rollShiny(false, seq([SHINY.chance / 2])), true);
  assert.equal(rollShiny(false, seq([0.5])), false);
});

test('合成：有闪光参与时按遗传概率保留，没遗传到再按普通概率抽', () => {
  assert.equal(rollShiny(true, seq([SHINY.inherit / 2])), true);
  assert.equal(rollShiny(true, seq([0.99, 0.5])), false);
  assert.equal(rollShiny(true, seq([0.99, SHINY.chance / 2])), true);
});

test('大量抽取时比例接近配置', () => {
  const n = 200000;
  let hit = 0;
  for (let i = 0; i < n; i++) if (rollShiny()) hit++;
  assert.ok(Math.abs(hit / n - SHINY.chance) < 0.001, `比例 ${hit / n}`);
});

test('得分倍率：有闪光才加倍', () => {
  assert.equal(shinyMultiplier(false), 1);
  assert.equal(shinyMultiplier(true), SHINY.scoreMul);
});
