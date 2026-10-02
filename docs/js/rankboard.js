// 排行榜界面：顶栏“排行榜”弹窗 + 战报卡上的自动上榜。
// 第一次结束时占一个昵称（全班唯一），以后每局结束自动上传；只有破了自己的纪录才传。
import { STORAGE_KEYS } from './config.js?v=19e16d6c';
import { skin, store } from './skin.js?v=c519b08c';
import { state } from './state.js?v=6ff1b6c5';
import { $ } from './dom.js?v=5b57db68';
import { leaderboardEnabled, fetchTop, submitScore, claimName, cleanName, canPersist } from './leaderboard.js?v=274d39d7';
import { avatarEl, makeAvatar } from './avatar.js?v=950f7d8a';
import { myAvatar, uploadAvatar } from './profile.js?v=6b30b260';

const playerName = () => store.get(STORAGE_KEYS.playerName) || '';
const uploadedBest = () => Number(store.get(STORAGE_KEYS.uploadedBest)) || 0;

// 没传上去的最好成绩（网络不通时暂存，联网后补传）
function pendingRun() {
  try {
    const r = JSON.parse(store.get(STORAGE_KEYS.pendingRun) || 'null');
    return r && Number.isFinite(r.score) && r.score > uploadedBest() ? r : null;
  } catch { return null; }
}
function savePending(run) {
  const old = pendingRun();
  if (!old || run.score > old.score) store.set(STORAGE_KEYS.pendingRun, JSON.stringify(run));
}
const clearPending = () => store.set(STORAGE_KEYS.pendingRun, 'null');

// 把一局成绩传上去：成功返回名次；本机身份不被认识返回 null
async function uploadRun(run) {
  const rank = await submitScore(run);
  if (rank !== null) {
    store.set(STORAGE_KEYS.uploadedBest, String(run.score));
    clearPending();
  }
  return rank;
}

// 打开游戏时悄悄补传上次没传上去的成绩
export async function flushPending() {
  const run = pendingRun();
  if (!leaderboardEnabled() || !playerName() || !run) return;
  try { await uploadRun(run); } catch { /* 还是连不上，下次再试 */ }
}

let uploadedThisRound = false;
let pausedByBoard = false;

// ---------- 排行榜弹窗 ----------
function renderList(rows) {
  $('rank-list').replaceChildren(...rows.map((r, i) => {
    const li = document.createElement('li');
    if (i < 3) li.classList.add('top' + (i + 1));
    if (r.is_me) li.classList.add('mine');
    const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1;
    const face = avatarEl(r.name, r.avatar, 32);
    const who = document.createElement('span'); who.className = 'who';
    const nm = document.createElement('b'); nm.textContent = r.name;
    const lv = document.createElement('small');
    lv.textContent = (skin[r.top_level] ? skin[r.top_level].name : '') + ' · '
      + new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    who.append(nm, lv);
    const sc = document.createElement('span'); sc.className = 'pts'; sc.textContent = r.score;
    li.append(no, face, who, sc);
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
    $('rank-msg').textContent = err.message + (err.network ? '，可以换个 WiFi 或流量，再点刷新' : '，点刷新重试');
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
  $('player-avatar').replaceChildren(avatarEl(name, myAvatar(), 24));
}

async function changeAvatar(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  setMsg('正在换头像…');
  try {
    await uploadAvatar(await makeAvatar(file));
    setMsg('头像换好了');
  } catch (err) {
    setMsg(err.message);
  }
  showNameLine(playerName());
}

function showRetry(message) {
  setMsg(message + '，');
  const retry = document.createElement('button');
  Object.assign(retry, { className: 'linkish', type: 'button', textContent: '点这里重试' });
  retry.addEventListener('click', autoUpload);
  $('upload-msg').append(retry);
}

async function autoUpload(reclaimed = false) {
  if (!playerName() || uploadedThisRound) return;
  // 先把本局数据拷出来：上传途中玩家可能已经点了“再来一局”
  const run = {
    score: state.score, topLevel: state.topLevel, merges: state.mergeCount,
    durationS: (Date.now() - state.startedAt) / 1000
  };
  // 之前有没传上去的更高分，就先补传那一局
  const pending = pendingRun();
  const toSend = pending && pending.score >= run.score ? pending : run;
  const best = uploadedBest();
  if (toSend.score <= 0 || toSend.score <= best) {
    setMsg(best > 0 ? `本局没破纪录，榜上保留你的最高分 ${best}` : '本局 0 分，没有上传');
    return;
  }
  uploadedThisRound = true;
  setMsg('正在上榜…');
  try {
    const rank = await uploadRun(toSend);
    if (rank === null) {
      // 服务器不认识这台设备（断网时先进的游戏 / 换了浏览器）：自动用本机昵称占一次，成功就重传
      const oldName = playerName();
      if (!reclaimed && oldName && await claimName(oldName).catch(() => false)) {
        uploadedThisRound = false;
        return autoUpload(true);
      }
      uploadedThisRound = false;
      store.set(STORAGE_KEYS.playerName, '');
      showNameForm(oldName, '保存并上榜');
      setMsg(`「${oldName}」在你离线时被别人用了，换一个昵称`);
      return;
    }
    setMsg(toSend === run ? `已自动上榜，全班第 ${rank} 名` : `已补传之前的最高分 ${toSend.score}，全班第 ${rank} 名`);
  } catch (err) {
    uploadedThisRound = false;
    if (err.network) {
      savePending(toSend);
      showRetry(err.message + '，成绩先存在手机里，下次联网自动补传。换个 WiFi 或流量也可以');
    } else {
      showRetry(err.message);
    }
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
  $('report-avatar').addEventListener('change', changeAvatar);
  $('btn-upload-board').addEventListener('click', openBoard);
}
