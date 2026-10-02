// 排行榜界面：顶栏“排行榜”弹窗 + 战报卡上的自动上榜。
// 第一次结束时占一个昵称（全班唯一），以后每局结束自动上传；只有破了自己的纪录才传。
import { STORAGE_KEYS } from './config.js';
import { skin, store } from './skin.js';
import { state } from './state.js';
import { $ } from './dom.js';
import { leaderboardEnabled, fetchTop, submitScore, claimName, cleanName, canPersist } from './leaderboard.js';

const playerName = () => store.get(STORAGE_KEYS.playerName) || '';
const uploadedBest = () => Number(store.get(STORAGE_KEYS.uploadedBest)) || 0;

let uploadedThisRound = false;
let pausedByBoard = false;

// ---------- 排行榜弹窗 ----------
function renderList(rows) {
  $('rank-list').replaceChildren(...rows.map((r, i) => {
    const li = document.createElement('li');
    if (i < 3) li.classList.add('top' + (i + 1));
    if (r.is_me) li.classList.add('mine');
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
const setMsg = text => { $('upload-msg').textContent = text; };

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

function showRetry(message) {
  setMsg(message + '，');
  const retry = document.createElement('button');
  Object.assign(retry, { className: 'linkish', type: 'button', textContent: '点这里重试' });
  retry.addEventListener('click', autoUpload);
  $('upload-msg').append(retry);
}

async function autoUpload() {
  if (!playerName() || uploadedThisRound) return;
  // 先把本局数据拷出来：上传途中玩家可能已经点了“再来一局”
  const run = {
    score: state.score, topLevel: state.topLevel, merges: state.mergeCount,
    durationS: (Date.now() - state.startedAt) / 1000
  };
  const best = uploadedBest();
  if (run.score <= 0 || run.score <= best) {
    setMsg(best > 0 ? `本局没破纪录，榜上保留你的最高分 ${best}` : '本局 0 分，没有上传');
    return;
  }
  uploadedThisRound = true;
  setMsg('正在上榜…');
  try {
    const rank = await submitScore(run);
    if (rank === null) {
      // 服务器不认识这台设备（换了浏览器/数据被清）：重新占一次昵称
      const oldName = playerName();
      uploadedThisRound = false;
      store.set(STORAGE_KEYS.playerName, '');
      showNameForm(oldName, '保存并上榜');
      setMsg('需要重新确认一下昵称');
      return;
    }
    store.set(STORAGE_KEYS.uploadedBest, String(run.score));
    setMsg(`已自动上榜，全班第 ${rank} 名`);
  } catch (err) {
    uploadedThisRound = false;
    showRetry(err.message);
  }
}

let savingName = false;

async function saveName() {
  if (savingName) return;  // 回车和按钮连着触发时只提交一次
  if (!canPersist()) { setMsg('这个浏览器不能保存数据（可能是无痕模式），没法上榜'); return; }
  const name = cleanName($('player-name').value);
  if (!name) { setMsg('先填一个昵称'); $('player-name').focus(); return; }
  if (name === playerName()) { showNameLine(name); return; }
  $('btn-upload').disabled = true;
  savingName = true;
  setMsg('检查昵称…');
  try {
    if (!(await claimName(name))) {
      $('btn-upload').disabled = false;
      setMsg(`「${name}」已经被别人用了，换一个（如果是你自己换了手机或清了数据，找管理员释放）`);
      $('player-name').focus();
      return;
    }
    const isRename = Boolean(playerName());
    store.set(STORAGE_KEYS.playerName, name);
    showNameLine(name);
    if (isRename) {
      setMsg(`昵称已改成「${name}」，之前的成绩也跟着改名`);
    } else {
      store.set(STORAGE_KEYS.uploadedBest, '0');
      autoUpload();
    }
  } catch (err) {
    $('btn-upload').disabled = false;
    setMsg(err.message);
  } finally {
    savingName = false;
  }
}

// 每局结束时调用
export function onRoundOver() {
  uploadedThisRound = false;
  $('upload').hidden = !leaderboardEnabled();
  if (!leaderboardEnabled()) return;
  setMsg('');
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
