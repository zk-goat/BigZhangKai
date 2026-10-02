// 全班排行榜的数据接口（Supabase RPC，见 supabase/002_unique_names.sql）。只负责读写数据，不碰页面。
// 每台设备一个随机身份码：昵称第一次被谁占用就归谁，成绩也只能用自己的身份码提交。
import { LEADERBOARD, MAX, STORAGE_KEYS } from './config.js?v=10014806';
import { store } from './skin.js?v=78f85177';

const TIMEOUT_MS = 12000;
const NETWORK_RETRIES = 1;

export const leaderboardEnabled = () => Boolean(LEADERBOARD.url && LEADERBOARD.key);

// 本机身份码：32 字节随机数，第一次用时生成
// 存不进 localStorage 时（隐私模式、配额满）至少本次打开期间保持同一个身份
let sessionToken = '';
export const canPersist = () => store.set('dazhangkai-probe', '1');

function playerToken() {
  const saved = store.get(STORAGE_KEYS.playerToken);
  if (saved && saved.length >= 32) return saved;
  if (!sessionToken) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    sessionToken = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  store.set(STORAGE_KEYS.playerToken, sessionToken);
  return sessionToken;
}

function networkError(message) {
  const err = new Error(message);
  err.network = true;
  return err;
}

// 网络不通或超时自动重试；服务器明确拒绝（4xx/5xx）不重试
async function rpc(fn, args, retries = NETWORK_RETRIES) {
  try {
    return await rpcOnce(fn, args);
  } catch (err) {
    if (err.network && retries > 0) return rpc(fn, args, retries - 1);
    throw err;
  }
}

async function rpcOnce(fn, args) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${LEADERBOARD.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { apikey: LEADERBOARD.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!res.ok) throw new Error(`排行榜暂时出错了（${res.status}）`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;  // 函数返回 null 时响应体可能为空
  } catch (err) {
    if (err.name === 'AbortError') throw networkError('连接排行榜超时');
    if (err instanceof TypeError) throw networkError('网络连不上排行榜');  // fetch 断网时抛 TypeError
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// 去掉首尾空白、控制字符和零宽/方向控制等不可见字符，全角半角统一（与数据库端一致），截到允许长度
export function cleanName(raw) {
  const s = String(raw || '').normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return [...s].slice(0, LEADERBOARD.nameMaxLen).join('');
}

// 占用或修改昵称：成功返回 true，被别人占了返回 false
export async function claimName(name) {
  const clean = cleanName(name);
  if (!clean) throw new Error('先填一个昵称');
  return (await rpc('claim_name', { p_token: playerToken(), p_name: clean })) === 'ok';
}

// 提交一局成绩，返回自己最高分的名次；返回 null 表示本机还没占过昵称
export async function submitScore({ score, topLevel, merges, durationS }) {
  return rpc('submit_score', {
    p_token: playerToken(),
    p_score: Math.max(0, Math.round(score)),
    p_top_level: Math.min(MAX, Math.max(0, topLevel)),
    p_merges: Math.max(0, merges),
    p_duration: Math.min(86400, Math.max(0, Math.round(durationS)))
  });
}

// 前 N 名，每人只取最高分；is_me 标出自己
export async function fetchTop() {
  const rows = await rpc('top_scores', { p_token: playerToken(), p_limit: LEADERBOARD.size });
  return Array.isArray(rows) ? rows : [];
}
