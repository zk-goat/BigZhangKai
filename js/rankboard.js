// 排行榜界面：顶栏“排行榜”弹窗 + 战报卡上的自动上榜。
// 第一次结束时填一次昵称，以后每局结束自动上传；只有破了自己的纪录才传，榜上每人只显示最高分。
import { STORAGE_KEYS } from './config.js';
import { skin, store } from './skin.js';
import { state } from './state.js';
import { $ } from './dom.js';
import { leaderboardEnabled, fetchTop, submitScore, rankOf, cleanName } from './leaderboard.js';

const myIds = () => {
  try { return new Set(JSON.parse(store.get(STORAGE_KEYS.myScores) || '[]')); } catch { return new Set(); }
};
const rememberId = id => store.set(STORAGE_KEYS.myScores, JSON.stringify([...myIds(), id].slice(-50)));
const playerName = () => store.get(STORAGE_KEYS.playerName) || '';
const uploadedBest = () => Number(store.get(STORAGE_KEYS.uploadedBest)) || 0;

let uploadedThisRound = false;
let pausedByBoard = false;

// ---------- 排行榜弹窗 ----------
function renderList(rows) {
  const mine = myIds();
  $('rank-list').replaceChildren(...rows.map((r, i) => {
    const li = document.createElement('li');
    if (i < 3) li.classList.add('top' + (i + 1));
    if (mine.has(r.id)) li.classList.add('mine');
    const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1;
    const who = document.createElement('span'); who.className = 'who';
    const nm = document.createElement('b'); nm.textContent = r.name;
    const lv = document.createElement('small');
    lv.textContent = (skin[r.top_level] ? skin[r.top_level].name : '') + ' · '
      + new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    who.append(nm, lv);
    const sc = document.createElement('span'); sc.className = 'pts'; sc.textContent = r.score;
    li.append(no, who, sc);
    return li;
  }));
}

async function loadRanking() {
  $('rank-msg').textContent = '加载中…';
  try {
    const rows = await fetchTop();
    renderList(rows);
    $('rank-msg').textContent = rows.length ? '' : '还没有人上榜，玩一局去占第一';
  } catch (err) {
    $('rank-msg').textContent = err.message + '，点刷新重试';
  }
}

function openBoard() {
  pausedByBoard = !state.over && !state.paused;
  if (pausedByBoard) state.paused = true;
  $('rank').hidden = false;
  loadRanking();
}

function closeBoard() {
  $('rank').hidden = true;
  if (pausedByBoard) state.paused = false;
  pausedByBoard = false;
}

// ---------- 战报卡上的上榜区 ----------
function showNameForm(prefill, buttonText) {
  $('upload-ask').hidden = false;
  $('upload-auto').hidden = true;
  $('player-name').value = prefill;
  $('btn-upload').textContent = buttonText;
  $('btn-upload').disabled = false;
}

function showNameLine(name) {
  $('upload-ask').hidden = true;
  $('upload-auto').hidden = false;
  $('player-label').textContent = name;
}

async function autoUpload() {
  const name = playerName();
  if (!name || uploadedThisRound) return;
  const best = uploadedBest();
  if (state.score <= 0 || state.score <= best) {
    $('upload-msg').textContent = best > 0 ? `本局没破纪录，榜上保留你的最高分 ${best}` : '本局 0 分，没有上传';
    return;
  }
  uploadedThisRound = true;
  $('upload-msg').textContent = '正在上榜…';
  try {
    const id = await submitScore({
      name, score: state.score, topLevel: state.topLevel, merges: state.mergeCount,
      durationS: (Date.now() - state.startedAt) / 1000
    });
    if (id) rememberId(id);
    store.set(STORAGE_KEYS.uploadedBest, String(state.score));
    const rank = await rankOf(state.score).catch(() => null);
    $('upload-msg').textContent = rank ? `已自动上榜，全班第 ${rank} 名` : '已自动上榜';
  } catch (err) {
    uploadedThisRound = false;
    $('upload-msg').textContent = err.message + '，';
    const retry = document.createElement('button');
    retry.className = 'linkish'; retry.type = 'button'; retry.textContent = '点这里重试';
    retry.addEventListener('click', autoUpload);
    $('upload-msg').append(retry);
  }
}

function saveName() {
  const name = cleanName($('player-name').value);
  if (!name) { $('upload-msg').textContent = '先填一个昵称'; $('player-name').focus(); return; }
  // 换了昵称就从头记最高分，这局成绩用新昵称上榜
  if (name !== playerName()) {
    store.set(STORAGE_KEYS.uploadedBest, '0');
    uploadedThisRound = false;
  }
  store.set(STORAGE_KEYS.playerName, name);
  showNameLine(name);
  autoUpload();
}

// 每局结束时调用
export function onRoundOver() {
  uploadedThisRound = false;
  $('upload').hidden = !leaderboardEnabled();
  if (!leaderboardEnabled()) return;
  $('upload-msg').textContent = '';
  const name = playerName();
  if (name) {
    showNameLine(name);
    autoUpload();
  } else {
    showNameForm('', '保存并上榜');
  }
}

export function bindRankboard() {
  $('btn-rank').hidden = !leaderboardEnabled();
  $('btn-rank').addEventListener('click', openBoard);
  $('btn-rank-close').addEventListener('click', closeBoard);
  $('btn-rank-refresh').addEventListener('click', loadRanking);
  $('btn-upload').addEventListener('click', saveName);
  $('player-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
  $('btn-rename').addEventListener('click', () => showNameForm(playerName(), '保存'));
  $('btn-upload-board').addEventListener('click', openBoard);
}
