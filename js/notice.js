// 公告牌：有没看过的更新时自动弹一次；顶栏“公告”按钮随时回看。
import { STORAGE_KEYS } from './config.js';
import { ANNOUNCEMENTS } from './announcements.js';
import { store } from './skin.js';
import { state } from './state.js';
import { $ } from './dom.js';

const latestId = () => (ANNOUNCEMENTS[0] ? ANNOUNCEMENTS[0].id : '');
const markSeen = () => store.set(STORAGE_KEYS.noticeSeen, latestId());
let pausedByNotice = false;

function renderNotices() {
  $('notice-list').replaceChildren(...ANNOUNCEMENTS.map((a, i) => {
    const sec = document.createElement('section');
    sec.className = 'notice-item' + (i === 0 ? ' latest' : '');
    const head = document.createElement('h3');
    const date = document.createElement('span'); date.className = 'notice-date'; date.textContent = a.date;
    head.append(date, document.createTextNode(a.title));
    const ul = document.createElement('ul');
    ul.append(...a.items.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    sec.append(head, ul);
    return sec;
  }));
}

function openNotice() {
  pausedByNotice = !state.over && !state.paused;
  if (pausedByNotice) state.paused = true;
  renderNotices();
  $('notice').hidden = false;
}

function closeNotice() {
  markSeen();
  $('notice').hidden = true;
  if (pausedByNotice) state.paused = false;
  pausedByNotice = false;
}

// 老玩家有没看过的最新公告就弹出来；第一次来的新玩家不用看“更新了什么”，直接记为已读
export function showNoticeIfNew({ isNewPlayer }) {
  if (!latestId()) return;
  if (isNewPlayer) { markSeen(); return; }
  if (store.get(STORAGE_KEYS.noticeSeen) !== latestId()) openNotice();
}

export function bindNotice() {
  $('btn-notice').addEventListener('click', openNotice);
  $('btn-notice-close').addEventListener('click', closeNotice);
}
