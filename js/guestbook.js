// 给张楷的留言墙：所有人都能看，署名用游戏昵称。打开时游戏暂停。
import { STORAGE_KEYS } from './config.js';
import { store } from './skin.js';
import { state } from './state.js';
import { $ } from './dom.js';
import { leaderboardEnabled, postMessage, listMessages, claimName, MESSAGES_PAGE } from './leaderboard.js';
import { avatarEl } from './avatar.js';
import { renderMeBar } from './profile.js';

const MAX_LEN = 200;
let oldestId = null;
let loading = false;
let sending = false;
let pausedByBook = false;

const myName = () => store.get(STORAGE_KEYS.playerName) || '';

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function messageItem(m) {
  const li = document.createElement('li');
  if (m.is_me) li.className = 'mine';
  const head = document.createElement('div'); head.className = 'msg-head';
  const who = document.createElement('b'); who.textContent = m.name;
  const when = document.createElement('span'); when.textContent = timeAgo(m.created_at);
  head.append(avatarEl(m.name, m.avatar, 26), who, when);
  const body = document.createElement('p'); body.className = 'msg-body';
  body.textContent = m.content;  // 用 textContent，留言里的任何内容都只当文字显示
  li.append(head, body);
  return li;
}

async function loadMessages(more = false) {
  if (loading) return;
  loading = true;
  $('book-more').hidden = true;
  $('book-status').textContent = more ? '加载中…' : '正在读留言…';
  try {
    const rows = await listMessages(more ? oldestId : null);
    const items = rows.map(messageItem);
    if (more) $('book-list').append(...items);
    else $('book-list').replaceChildren(...items);
    if (rows.length) oldestId = rows[rows.length - 1].id;
    const empty = !more && rows.length === 0;
    $('book-status').textContent = empty ? '还没有人留言，来写第一条吧' : '';
    $('book-more').hidden = rows.length < MESSAGES_PAGE;
  } catch (err) {
    $('book-status').textContent = err.message + (err.network ? '，可以换个 WiFi 或流量再打开' : '');
  } finally {
    loading = false;
  }
}

function updateCount() {
  const n = [...$('book-input').value].length;
  $('book-count').textContent = `${n}/${MAX_LEN}`;
  $('book-count').classList.toggle('over', n > MAX_LEN);
}

async function sendMessage() {
  if (sending) return;
  const text = $('book-input').value.trim();
  if (!text) { $('book-msg').textContent = '先写点什么'; $('book-input').focus(); return; }
  if ([...text].length > MAX_LEN) { $('book-msg').textContent = `最多 ${MAX_LEN} 个字`; return; }
  const name = myName();
  if (!name) { $('book-msg').textContent = '先玩一局起个昵称，再来留言'; return; }
  sending = true;
  $('book-send').disabled = true;
  $('book-msg').textContent = '发送中…';
  try {
    let result = await postMessage(text);
    // 服务器还不认识这台设备（之前断网时进的游戏）：先用本机昵称占一下再发
    if (result === null && await claimName(name).catch(() => false)) result = await postMessage(text);
    if (result === null) throw new Error(`昵称「${name}」还没确认，先玩完一局上榜后再来留言`);
    $('book-input').value = '';
    updateCount();
    $('book-msg').textContent = '留言成功';
    oldestId = null;
    await loadMessages();
  } catch (err) {
    $('book-msg').textContent = err.message;
  } finally {
    sending = false;
    $('book-send').disabled = false;
  }
}

function openBook() {
  pausedByBook = !state.over && !state.paused;
  if (pausedByBook) state.paused = true;
  $('book-msg').textContent = '';
  renderMeBar($('book-who'), { size: 22, onChanged: () => { oldestId = null; loadMessages(); } });
  $('guestbook').hidden = false;
  oldestId = null;
  loadMessages();
}

function closeBook() {
  $('guestbook').hidden = true;
  if (pausedByBook) state.paused = false;
  pausedByBook = false;
}

export function bindGuestbook() {
  $('btn-book').hidden = !leaderboardEnabled();
  $('btn-book').addEventListener('click', openBook);
  $('book-close').addEventListener('click', closeBook);
  $('book-send').addEventListener('click', sendMessage);
  $('book-more').addEventListener('click', () => loadMessages(true));
  $('book-input').addEventListener('input', updateCount);
  updateCount();
}
