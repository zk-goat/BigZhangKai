// 全班排行榜的数据接口（Supabase REST）。只负责读写数据，不碰页面。
import { LEADERBOARD, MAX } from './config.js';

const TIMEOUT_MS = 8000;

export const leaderboardEnabled = () => Boolean(LEADERBOARD.url && LEADERBOARD.key);

async function request(path, { method = 'GET', body, prefer } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${LEADERBOARD.url}/rest/v1/${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        apikey: LEADERBOARD.key,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`排行榜暂时出错了（${res.status}）`);
    return res;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('连接排行榜超时');
    if (err instanceof TypeError) throw new Error('网络连不上排行榜');  // fetch 断网时抛 TypeError
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// 去掉首尾空白和控制字符，截到允许的长度
export function cleanName(raw) {
  return [...String(raw || '').replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, LEADERBOARD.nameMaxLen).join('');
}

export async function fetchTop() {
  const q = `${LEADERBOARD.table}?select=id,name,score,top_level,created_at&order=score.desc,created_at.asc&limit=${LEADERBOARD.size}`;
  const rows = await (await request(q)).json();
  return Array.isArray(rows) ? rows : [];
}

// 提交一局成绩，返回新纪录的 id
export async function submitScore({ name, score, topLevel, merges, durationS }) {
  const clean = cleanName(name);
  if (!clean) throw new Error('先填一个昵称');
  const row = {
    name: clean,
    score: Math.max(0, Math.round(score)),
    top_level: Math.min(MAX, Math.max(0, topLevel)),
    merges: Math.max(0, merges),
    duration_s: Math.max(0, Math.round(durationS))
  };
  const [saved] = await (await request(LEADERBOARD.table, { method: 'POST', body: row, prefer: 'return=representation' })).json();
  return saved && saved.id;
}

// 分数比 score 高的有几条 → 名次 = 条数 + 1
export async function rankOf(score) {
  const res = await request(`${LEADERBOARD.table}?select=id&score=gt.${Math.round(score)}&limit=1`, { prefer: 'count=exact' });
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total + 1 : null;
}
