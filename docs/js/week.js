// 周榜的“这一周”：按北京时间，每周一 0 点开始。纯函数，可单独测试。
const BJ_OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

// 本周一 0 点（北京时间）对应的时间戳
export function weekStart(now = Date.now()) {
  const bj = new Date(now + BJ_OFFSET_MS);                    // 用 UTC 字段读出北京时间
  const daysSinceMonday = (bj.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  return midnight - daysSinceMonday * DAY_MS - BJ_OFFSET_MS;
}

// 这一周的标识，比如 '2026-09-28'（那周的周一）
export function weekKey(now = Date.now()) {
  return new Date(weekStart(now) + BJ_OFFSET_MS).toISOString().slice(0, 10);
}

// 距离下周一 0 点还剩几天（不足一天算 1 天）
export function daysLeft(now = Date.now()) {
  return Math.max(1, Math.ceil((weekStart(now) + 7 * DAY_MS - now) / DAY_MS));
}
