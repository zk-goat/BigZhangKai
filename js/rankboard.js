// 排行榜界面：顶栏“排行榜”弹窗 + 战报卡上的“上传成绩”。
import { STORAGE_KEYS } from './config.js';
import { skin, store } from './skin.js';
import { state } from './state.js';
import { $ } from './dom.js';
import { leaderboardEnabled, fetchTop, submitScore, rankOf, cleanName } from './leaderboard.js';

const myIds = () => {
  try { return new Set(JSON.parse(store.get(STORAGE_KEYS.myScores) || '[]')); } catch { return new Set(); }
};
const rememberId = id => store.set(STORAGE_KEYS.myScores, JSON.stringify([...myIds(), id].slice(-50)));

let uploadedThisRound = false;
let pausedByBoard = false;

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

// 每局结束时调用：重置上传区
export function prepareUpload() {
  uploadedThisRound = false;
  $('upload').hidden = !leaderboardEnabled();
  $('player-name').value = store.get(STORAGE_KEYS.playerName) || '';
  $('btn-upload').disabled = false;
  $('btn-upload').textContent = '上传';
  $('upload-msg').textContent = '';
}

async function upload() {
  if (uploadedThisRound) return;
  const name = cleanName($('player-name').value);
  if (!name) { $('upload-msg').textContent = '先填一个昵称'; $('player-name').focus(); return; }
  store.set(STORAGE_KEYS.playerName, name);
  $('btn-upload').disabled = true;
  $('btn-upload').textContent = '上传中…';
  try {
    const id = await submitScore({
      name, score: state.score, topLevel: state.topLevel, merges: state.mergeCount,
      durationS: (Date.now() - state.startedAt) / 1000
    });
    uploadedThisRound = true;
    if (id) rememberId(id);
    $('btn-upload').textContent = '已上传';
    const rank = await rankOf(state.score).catch(() => null);
    $('upload-msg').textContent = rank ? `已上榜，全班第 ${rank} 名` : '已上榜';
  } catch (err) {
    $('btn-upload').disabled = false;
    $('btn-upload').textContent = '重试';
    $('upload-msg').textContent = err.message;
  }
}

export function bindRankboard() {
  $('btn-rank').hidden = !leaderboardEnabled();
  $('btn-rank').addEventListener('click', openBoard);
  $('btn-rank-close').addEventListener('click', closeBoard);
  $('btn-rank-refresh').addEventListener('click', loadRanking);
  $('btn-upload').addEventListener('click', upload);
  $('player-name').addEventListener('keydown', e => { if (e.key === 'Enter') upload(); });
  $('btn-upload-board').addEventListener('click', openBoard);
}
