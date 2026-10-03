// 成就：定义、触发判断、本机存储。界面在 achieve-ui.js。
// 游戏各处在发生事件时调用下面的 onXxx，满足条件就解锁；解锁结果存在本机。
import { MAX, LEVELS, STORAGE_KEYS } from './config.js';
import { store } from './skin.js';
import { loadDex } from './dex.js';

const lvOf = name => LEVELS.findIndex(l => l.name === name);
const QUESHEN = lvOf('雀神楷'), ZHONGZHI = lvOf('中指楷'), WAJUEJI = lvOf('挖掘机楷');

export const SCORE_TIERS = { 'score-1': 15000, 'score-2': 25000, 'score-3': 40000 };
export const GAME_TIERS = { 'games-1': 4, 'games-2': 16, 'games-3': 64 };

// hidden：解锁前只显示 ？？？；goal + progress：成就页显示进度条
export const ACHIEVEMENTS = [
  { id: 'first-max', group: '主线', name: '楷旋而归', desc: '合出第一个大张楷' },
  { id: 'fuse', group: '主线', name: '张楷，合体！', desc: '两个大张楷合体一次' },
  { id: 'fuse-3', group: '主线', name: '楷天辟地', desc: '一局里合体 3 次' },
  { id: 'score-1', group: '分数', name: '楷始发力', desc: '单局 1.5 万分' },
  { id: 'score-2', group: '分数', name: '势不可楷', desc: '单局 2.5 万分' },
  { id: 'score-3', group: '分数', name: '楷神降临', desc: '单局 4 万分' },
  { id: 'combo-5', group: '技巧', name: '连环楷', desc: '一局打出连击 ×5' },
  { id: 'flash', group: '技巧', name: '闪电楷', desc: '5 分钟内合出大张楷' },
  { id: 'gold-5', group: '黄金', name: '金光闪闪', desc: '一局遇到 5 个黄金张楷' },
  { id: 'gold-max', group: '黄金', name: '点石成金', desc: '合出黄金大张楷' },
  { id: 'gold-dex', group: '黄金', name: '张楷金库', desc: '黄金图鉴集齐 14 级', goal: LEVELS.length, progress: () => loadDex().length },
  { id: 'thirteen', group: '玩梗', name: '十三幺', desc: '一局里合出 13 个雀神楷' },
  { id: 'finger-3', group: '玩梗', name: '中指连发', desc: '场上同时有 3 个中指楷' },
  { id: 'digger', group: '玩梗', name: '挖掘机哪家强', desc: '一局里合出 3 个挖掘机楷' },
  { id: 'instant', group: '惊喜', name: '秒了', desc: '开局 30 秒内就输了', hidden: true },
  { id: 'mute', group: '惊喜', name: '张楷别吵', desc: '把游戏静音', hidden: true },
  { id: 'night', group: '惊喜', name: '深夜楷', desc: '凌晨 0～5 点打完一局', hidden: true },
  { id: 'games-1', group: '坚持', name: '初识张楷', desc: '累计玩 4 局', goal: 4, progress: () => gamesPlayed() },
  { id: 'games-2', group: '坚持', name: '张楷常客', desc: '累计玩 16 局', goal: 16, progress: () => gamesPlayed() },
  { id: 'games-3', group: '坚持', name: '张楷铁粉', desc: '累计玩 64 局', goal: 64, progress: () => gamesPlayed() },
  { id: 'message', group: '社交', name: '有话对楷说', desc: '第一次给张楷留言' },
  { id: 'week-star', group: '社交', name: '本周之星', desc: '进本周榜前三' }
];
export const GROUPS = ['主线', '分数', '技巧', '黄金', '玩梗', '惊喜', '坚持', '社交'];

// ---------- 本机存储 ----------
function loadUnlocked() {
  try {
    const u = JSON.parse(store.get(STORAGE_KEYS.achievements) || '{}');
    return u && typeof u === 'object' ? u : {};
  } catch { return {}; }
}
let unlocked = loadUnlocked();
export const isUnlocked = id => Boolean(unlocked[id]);
export const unlockedCount = () => ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
export function gamesPlayed() { return Number(store.get(STORAGE_KEYS.gamesPlayed)) || 0; }

const listeners = [];
export const onUnlock = fn => listeners.push(fn);

let roundUnlocks = [];
export const takeRoundUnlocks = () => { const r = roundUnlocks; roundUnlocks = []; return r; };

function unlock(id) {
  if (unlocked[id]) return;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return;
  unlocked = { ...unlocked, [id]: Date.now() };
  store.set(STORAGE_KEYS.achievements, JSON.stringify(unlocked));
  roundUnlocks = [...roundUnlocks, def];
  listeners.forEach(fn => fn(def));
}

// ---------- 一局内的计数（存档时一起保存） ----------
const freshRound = () => ({ made: new Array(MAX + 1).fill(0), shiny: 0 });
let round = freshRound();
export const roundStats = () => ({ made: [...round.made], shiny: round.shiny });
export function resetRoundStats(saved) {
  const ok = saved && Array.isArray(saved.made) && saved.made.length === MAX + 1 && saved.made.every(Number.isFinite);
  round = ok ? { made: [...saved.made], shiny: Number(saved.shiny) || 0 } : freshRound();
  roundUnlocks = [];
}

function checkScore(score) {
  Object.entries(SCORE_TIERS).forEach(([id, need]) => { if (score >= need) unlock(id); });
}

// ---------- 事件 ----------
export function onMerge({ lv, combo, score, shiny, playedMs }) {
  round.made[lv] += 1;
  if (lv === MAX) {
    unlock('first-max');
    if (playedMs < 5 * 60 * 1000) unlock('flash');
    if (shiny) unlock('gold-max');
  }
  if (combo >= 5) unlock('combo-5');
  if (round.made[QUESHEN] >= 13) unlock('thirteen');
  if (round.made[WAJUEJI] >= 3) unlock('digger');
  checkScore(score);
}

// fresh：新出现的（不是遗传延续的）
export function onShiny({ lv, fresh }) {
  if (fresh) round.shiny += 1;
  if (round.shiny >= 5) unlock('gold-5');
  if (lv === MAX) unlock('gold-max');
  if (loadDex().length >= LEVELS.length) unlock('gold-dex');
}

export function onFuse({ fusions, score }) {
  unlock('fuse');
  if (fusions >= 3) unlock('fuse-3');
  checkScore(score);
}

// 场上各级张楷的数量（每次投放和合成后调用）
export function onBoard(counts) {
  if (counts[ZHONGZHI] >= 3) unlock('finger-3');
}

export function onRoundEnd({ score, playedMs, now = new Date() }) {
  const games = gamesPlayed() + 1;
  store.set(STORAGE_KEYS.gamesPlayed, String(games));
  Object.entries(GAME_TIERS).forEach(([id, need]) => { if (games >= need) unlock(id); });
  checkScore(score);
  if (playedMs < 30 * 1000) unlock('instant');
  if (now.getHours() < 5) unlock('night');
}

export const onMute = () => unlock('mute');
export const onMessage = () => unlock('message');
export function onWeekRank(rank) { if (rank && rank <= 3) unlock('week-star'); }
