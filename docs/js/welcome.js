// 欢迎页：第一次打开时输入昵称（全班唯一）。已经有昵称的老玩家直接进游戏。
// 连不上排行榜时也放行：昵称先存在本机，等下次上榜时再向服务器确认。
import { STORAGE_KEYS, MAX } from './config.js?v=cc9230d0';
import { store } from './skin.js?v=4723788e';
import { paintLevel } from './draw.js?v=312b01fb';
import { state } from './state.js?v=0eefd06e';
import { $ } from './dom.js?v=5b57db68';
import { leaderboardEnabled, claimName, cleanName, canPersist } from './leaderboard.js?v=c18f727f';
import { makeAvatar, avatarEl } from './avatar.js?v=f69b1bf0';
import { uploadAvatar } from './profile.js?v=bc3b2c02';

export const needsWelcome = () => leaderboardEnabled() && !store.get(STORAGE_KEYS.playerName);

let entering = false;
let pendingAvatar = '';

function renderPreview() {
  const name = cleanName($('welcome-name').value) || '?';
  $('welcome-avatar-preview').replaceChildren(avatarEl(name, pendingAvatar, 72));
}

async function pickAvatar(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    pendingAvatar = await makeAvatar(file);
    $('welcome-avatar-tip').textContent = '换一张';
  } catch (err) {
    $('welcome-msg').textContent = err.message;
  }
  renderPreview();
}

function enterGame(name) {
  store.set(STORAGE_KEYS.playerName, name);
  if (pendingAvatar) uploadAvatar(pendingAvatar).catch(() => { /* 头像已存本机，下次再传 */ });
  store.set(STORAGE_KEYS.uploadedBest, '0');
  store.set(STORAGE_KEYS.weekBest, 'null');
  $('welcome').hidden = true;
  state.paused = false;
}

async function submitName() {
  if (entering) return;
  const name = cleanName($('welcome-name').value);
  const msg = $('welcome-msg');
  if (!name) { msg.textContent = '先起个昵称'; $('welcome-name').focus(); return; }
  if (!canPersist()) { msg.textContent = '这个浏览器不能保存数据（可能是无痕模式），换个浏览器打开吧'; return; }
  entering = true;
  $('btn-welcome').disabled = true;
  msg.textContent = '检查昵称有没有人用…';
  try {
    if (await claimName(name)) {
      enterGame(name);
    } else {
      msg.textContent = `「${name}」已经被别人用了，换一个`;
      $('welcome-name').select();
    }
  } catch (err) {
    if (err.network) {
      enterGame(name);  // 先进去玩，昵称等联网后再确认
    } else {
      msg.textContent = err.message;
    }
  } finally {
    entering = false;
    $('btn-welcome').disabled = false;
  }
}

// 需要的话显示欢迎页，并在它关掉之前暂停游戏
export function showWelcomeIfNeeded() {
  if (!needsWelcome()) return;
  state.paused = true;
  paintLevel($('welcome-pic'), MAX);
  renderPreview();
  $('welcome').hidden = false;
  $('welcome-name').focus();
}

export function bindWelcome() {
  $('btn-welcome').addEventListener('click', submitName);
  $('welcome-name').addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });
  $('welcome-name').addEventListener('input', renderPreview);
  $('welcome-avatar').addEventListener('change', pickAvatar);
}
