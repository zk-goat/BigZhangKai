// 运行：npm test（Node 里没有 localStorage，成就只存在内存里，正好方便测试）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS, GROUPS, isUnlocked, onMerge, onShiny, onFuse, onBoard, onRoundEnd, onMute, onWeekRank,
  resetRoundStats, roundStats, takeRoundUnlocks, onUnlock
} from '../js/achievements.js';
import { LEVELS, MAX } from '../js/config.js';

const lv = name => LEVELS.findIndex(l => l.name === name);
const merge = (level, extra = {}) => onMerge({ lv: level, combo: 1, score: 0, shiny: false, playedMs: 999999, ...extra });

test('每个成就都有唯一 id、所属分组和说明', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  ACHIEVEMENTS.forEach(a => {
    assert.ok(GROUPS.includes(a.group), a.id);
    assert.ok(a.name && a.desc, a.id);
  });
});

test('合出大张楷：解锁楷旋而归；5 分钟内合出才算闪电楷', () => {
  resetRoundStats();
  merge(MAX, { playedMs: 6 * 60 * 1000 });
  assert.ok(isUnlocked('first-max'));
  assert.ok(!isUnlocked('flash'));
  merge(MAX, { playedMs: 4 * 60 * 1000 });
  assert.ok(isUnlocked('flash'));
});

test('十三幺：一局合出 13 个雀神楷，第 12 个时还没解锁', () => {
  resetRoundStats();
  for (let i = 0; i < 12; i++) merge(lv('雀神楷'));
  assert.ok(!isUnlocked('thirteen'));
  merge(lv('雀神楷'));
  assert.ok(isUnlocked('thirteen'));
});

test('新的一局计数清零；存档恢复时计数接着算', () => {
  resetRoundStats();
  merge(lv('挖掘机楷')); merge(lv('挖掘机楷'));
  const saved = roundStats();
  resetRoundStats();
  assert.equal(roundStats().made[lv('挖掘机楷')], 0);
  resetRoundStats(saved);
  assert.ok(!isUnlocked('digger'));
  merge(lv('挖掘机楷'));
  assert.ok(isUnlocked('digger'));
});

test('连击 ×5、分数三档', () => {
  resetRoundStats();
  merge(2, { combo: 4, score: 14999 });
  assert.ok(!isUnlocked('combo-5') && !isUnlocked('score-1'));
  merge(2, { combo: 5, score: 26000 });
  assert.ok(isUnlocked('combo-5') && isUnlocked('score-1') && isUnlocked('score-2') && !isUnlocked('score-3'));
});

test('黄金：遗传的不计入“遇到 5 个”；黄金大张楷解锁点石成金', () => {
  resetRoundStats();
  for (let i = 0; i < 6; i++) onShiny({ lv: 3, fresh: false });
  assert.ok(!isUnlocked('gold-5'));
  for (let i = 0; i < 5; i++) onShiny({ lv: 3, fresh: true });
  assert.ok(isUnlocked('gold-5'));
  onShiny({ lv: MAX, fresh: false });
  assert.ok(isUnlocked('gold-max'));
});

test('合体：一次解锁合体，同一局第 3 次解锁楷天辟地', () => {
  onFuse({ fusions: 1, score: 0 });
  assert.ok(isUnlocked('fuse') && !isUnlocked('fuse-3'));
  onFuse({ fusions: 3, score: 0 });
  assert.ok(isUnlocked('fuse-3'));
});

test('中指连发：场上同时 3 个中指楷', () => {
  const counts = new Array(MAX + 1).fill(0);
  counts[lv('中指楷')] = 2; onBoard(counts);
  assert.ok(!isUnlocked('finger-3'));
  counts[lv('中指楷')] = 3; onBoard(counts);
  assert.ok(isUnlocked('finger-3'));
});

test('一局结束：30 秒内输了是“秒了”；凌晨 3 点是“深夜楷”，晚上 10 点不是', () => {
  onRoundEnd({ score: 0, playedMs: 60000, now: new Date(2026, 9, 3, 22, 0) });
  assert.ok(!isUnlocked('instant') && !isUnlocked('night'));
  onRoundEnd({ score: 0, playedMs: 20000, now: new Date(2026, 9, 3, 3, 0) });
  assert.ok(isUnlocked('instant') && isUnlocked('night'));
});

test('本周榜前三才算本周之星；静音解锁张楷别吵', () => {
  onWeekRank(4); assert.ok(!isUnlocked('week-star'));
  onWeekRank(3); assert.ok(isUnlocked('week-star'));
  onMute(); assert.ok(isUnlocked('mute'));
});

test('解锁时通知一次，重复满足条件不再通知；本局解锁列表取走后清空', () => {
  const heard = [];
  onUnlock(def => heard.push(def.id));
  resetRoundStats();
  onFuse({ fusions: 1, score: 40000 });   // 合体已解锁过，只有分数第三档是新的
  assert.deepEqual(heard, ['score-3']);
  assert.deepEqual(takeRoundUnlocks().map(a => a.id), ['score-3']);
  assert.deepEqual(takeRoundUnlocks(), []);
});
