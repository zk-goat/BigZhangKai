// 成就界面：顶部“成就”页面、解锁时从上方滑出的提示。
import { state } from './state.js';
import { $ } from './dom.js';
import { ACHIEVEMENTS, GROUPS, isUnlocked, unlockedCount, onUnlock } from './achievements.js';

const ACHV_TOAST_MS = 2600;
let achvQueue = [];
let achvShowing = false;
let pausedByAchv = false;

// ---------- 解锁提示：一个接一个从上方滑出 ----------
function nextAchvToast() {
  if (achvShowing || !achvQueue.length) return;
  const [def, ...rest] = achvQueue;
  achvQueue = rest;
  achvShowing = true;
  const el = $('achv-toast');
  $('achv-toast-name').textContent = def.name;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;  // 重新触发动画
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; achvShowing = false; nextAchvToast(); }, 300);
  }, ACHV_TOAST_MS);
}

// ---------- 成就页面 ----------
function achvItemEl(a) {
  const got = isUnlocked(a.id);
  const li = document.createElement('li');
  li.className = got ? 'got' : '';
  const icon = document.createElement('span'); icon.className = 'achv-icon'; icon.textContent = got ? '🏆' : '🔒';
  const text = document.createElement('div'); text.className = 'achv-text';
  const name = document.createElement('b'); name.textContent = got || !a.hidden ? a.name : '？？？';
  const desc = document.createElement('small'); desc.textContent = got || !a.hidden ? a.desc : '隐藏成就，玩着玩着就解锁了';
  text.append(name, desc);
  if (a.goal && !got) {
    const n = Math.min(a.goal, a.progress());
    const bar = document.createElement('span'); bar.className = 'achv-bar';
    const fill = document.createElement('i'); fill.style.width = `${(n / a.goal) * 100}%`;
    bar.append(fill);
    const num = document.createElement('small'); num.className = 'achv-num'; num.textContent = `${n}/${a.goal}`;
    text.append(bar, num);
  }
  li.append(icon, text);
  return li;
}

function renderAchvPage() {
  $('achv-count').textContent = `已解锁 ${unlockedCount()}/${ACHIEVEMENTS.length}`;
  $('achv-list').replaceChildren(...GROUPS.map(g => {
    const sec = document.createElement('section');
    const h = document.createElement('h3'); h.textContent = g;
    const ul = document.createElement('ul');
    ul.append(...ACHIEVEMENTS.filter(a => a.group === g).map(achvItemEl));
    sec.append(h, ul);
    return sec;
  }));
}

function openAchvPage() {
  pausedByAchv = !state.over && !state.paused;
  if (pausedByAchv) state.paused = true;
  renderAchvPage();
  $('achv-page').hidden = false;
}

function closeAchvPage() {
  $('achv-page').hidden = true;
  if (pausedByAchv) state.paused = false;
  pausedByAchv = false;
}

// 战报卡上的“本局解锁”
export function showRoundUnlocks(defs) {
  $('report-achv').hidden = !defs.length;
  $('report-achv').textContent = defs.length ? `本局解锁成就：${defs.map(d => d.name).join('、')}` : '';
}

export function bindAchievements({ onCountChanged } = {}) {
  onUnlock(def => {
    achvQueue = [...achvQueue, def];
    nextAchvToast();
    if (onCountChanged) onCountChanged(unlockedCount());
  });
  $('btn-achv').addEventListener('click', openAchvPage);
  $('achv-close').addEventListener('click', closeAchvPage);
}
