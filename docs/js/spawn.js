// 掉落：根据本局进度（合到的最高等级）决定下一个掉哪一级。纯函数，可单独测试。
import { SPAWN } from './config.js?v=21648a52';

// 场上某一级是单数（落单）时给它加的权重，帮它凑对；也让后期不再常规掉落的小张楷还能被清掉
export const ORPHAN_BOOST = 0.3;

// table: [{ minTop, weights: [第0级权重, 第1级权重, ...] }]，按 minTop 从小到大
export function spawnWeights(top, counts = [], table = SPAWN) {
  const row = table.filter(r => top >= r.minTop).pop() || table[0];
  return row.weights.map((w, lv) => w + ((counts[lv] || 0) % 2 === 1 ? ORPHAN_BOOST : 0));
}

export function pickLevel(weights, rand = Math.random) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let lv = 0; lv < weights.length; lv++) {
    r -= weights[lv];
    if (r < 0) return lv;
  }
  return weights.length - 1;
}
