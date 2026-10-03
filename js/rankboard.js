// 排行榜界面：顶栏“排行榜”弹窗 + 战报卡上的自动上榜。
// 第一次结束时占一个昵称（全班唯一），以后每局结束自动上传；破了自己本周最好成绩才传（历史最高自然也在里面）。
import { STORAGE_KEYS } from './config.js';
import { skin, store } from './skin.js';
import { state } from './state.js';
import { $ } from './dom.js';
import { leaderboardEnabled, fetchTop, myWeekRank, submitScore, claimName, cleanName, canPersist } from './leaderboard.js';
import { weekKey, daysLeft } from './week.js';
import { onWeekRank } from './achievements.js';
import { avatarEl, makeAvatar } from './avatar.js';
import { myAvatar, uploadAvatar, renderMeBar } from './profile.js';

const playerName = () => store.get(STORAGE_KEYS.playerName) || '';
const uploadedBest = () => Number(store.get(STORAGE_KEYS.uploadedBest)) || 0;

// 本周已经传上去的最好成绩（换了一周自动归零）
function weekBest() {
  try {
    const w = JSON.parse(store.get(STORAGE_KEYS.weekBest) || 'null');
    return w && w.week === weekKey() && Number.isFinite(w.score) ? w.score : 0;
  } catch { return 0; }
}

// 没传上去的最好成绩（网络不通时暂存，联网后补传）；上周存下的不再补传，免得算进这周
function pendingRun() {
  try {
    const r = JSON.parse(store.get(STORAGE_KEYS.pendingRun) || 'null');
    return r && Number.isFinite(r.score) && r.week === weekKey() && r.score > weekBest() ? r : null;
  } catch { return null; }
}
function savePending(run) {
  const old = pendingRun();
  if (!old || run.score > old.score) store.set(STORAGE_KEYS.pendingRun, JSON.stringify({ ...run, week: weekKey() }));
}
const clearPending = () => store.set(STORAGE_KEYS.pendingRun, 'null');

// 把一局成绩传上去：成功返回名次；本机身份不被认识返回 null
async function uploadRun(run) {
  const rank = await submitScore(run);
  if (rank !== null) {
    store.set(STORAGE_KEYS.uploadedBest, String(Math.max(uploadedBest(), run.score)));
    store.set(STORAGE_KEYS.weekBest, JSON.stringify({ week: weekKey(), score: run.score }));
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
let scope = 'week';  // 'week' 本周榜 | 'all' 总榜

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
    if (r.badges > 0) {
      const badge = document.createElement('span'); badge.className = 'badge-count'; badge.textContent = '🏆' + r.badges;
      badge.title = `解锁了 ${r.badges} 个成就`;
      nm.append(badge);
    }
    const lv = document.createElement('small');
    lv.textContent = (skin[r.top_level] ? skin[r.top_level].name : '') + ' · '
      + new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    who.append(nm, lv);
    const sc = document.createElement('span'); sc.className = 'pts'; sc.textContent = r.score;
    li.append(no, face, who, sc);
    return li;
  }));
}

function setScope(next) {
  scope = next;
  [['tab-week', 'week'], ['tab-all', 'all']].forEach(([id, s]) => {
    $(id).classList.toggle('on', s === scope);
    $(id).setAttribute('aria-selected', String(s === scope));
  });
  loadRanking();
}

async function showWeekInfo() {
  const left = daysLeft();
  $('rank-info').textContent = `每周一 0 点重新开始，还剩 ${left} 天`;
  try {
    const [champ] = await fetchTop({ week: true, weeksAgo: 1, limit: 1 });
    if (champ && scope === 'week') $('rank-info').textContent = `上周冠军：${champ.name} · ${champ.score} 分
还剩 ${left} 天重新开始`;
  } catch { /* 拿不到上周冠军就只显示剩余天数 */ }
}

async function loadRanking() {
  $('rank-msg').textContent = '加载中…';
  $('rank-list').replaceChildren();
  if (scope === 'week') showWeekInfo();
  else $('rank-info').textContent = '所有时间里每个人的最高分';
  try {
    const rows = await fetchTop({ week: scope === 'week' });
    renderList(rows);
    $('rank-msg').textContent = rows.length ? ''
      : scope === 'week' ? '本周还没有人上榜，快去抢第一' : '还没有人上榜，玩一局去占第一';
  } catch (err) {
    $('rank-msg').textContent = err.message + (err.network ? '，可以换个 WiFi 或流量，再点刷新' : '，点刷新重试');
  }
}

function openBoard() {
  pausedByBoard = !state.over && !state.paused;
  if (pausedByBoard) state.paused = true;
  $('rank').hidden = false;
  renderMeBar($('rank-me'), { size: 30, onChanged: loadRanking });
  setScope('week');
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
  const wb = weekBest();
  if (toSend.score <= 0 || toSend.score <= wb) {
    setMsg(wb > 0 ? `本周你最好是 ${wb} 分，这局没超过` : '本局 0 分，没有上传');
    return;
  }
  const isRecord = toSend.score > uploadedBest();
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
    const wr = await myWeekRank().catch(() => null);
    onWeekRank(wr);
    const ranks = (wr ? `本周第 ${wr} 名，` : '') + `总榜第 ${rank} 名`;
    setMsg(toSend !== run ? `已补传之前的 ${toSend.score} 分：${ranks}`
      : isRecord ? `新纪录！${ranks}` : `已上榜：${ranks}`);
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
      store.set(STORAGE_KEYS.weekBest, 'null');
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
  $('tab-week').addEventListener('click', () => setScope('week'));
  $('tab-all').addEventListener('click', () => setScope('all'));
  $('btn-upload').addEventListener('click', saveName);
  $('player-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
  $('btn-rename').addEventListener('click', () => showNameForm(playerName(), '保存'));
  $('report-avatar').addEventListener('change', changeAvatar);
  $('btn-upload-board').addEventListener('click', openBoard);
}
