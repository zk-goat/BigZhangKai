// 自己的头像：本机缓存一份，换头像时同时上传到服务器
import { STORAGE_KEYS } from './config.js?v=19e16d6c';
import { store } from './skin.js?v=c519b08c';
import { setAvatar, myProfile, claimName } from './leaderboard.js?v=274d39d7';
import { avatarEl, makeAvatar } from './avatar.js?v=950f7d8a';

export const myAvatar = () => store.get(STORAGE_KEYS.avatar) || '';

// 上传头像；服务器还不认识本机时先用本机昵称占一下再传
export async function uploadAvatar(dataUrl) {
  store.set(STORAGE_KEYS.avatar, dataUrl);
  let result = await setAvatar(dataUrl);
  const name = store.get(STORAGE_KEYS.playerName) || '';
  if (result === null && name && await claimName(name).catch(() => false)) result = await setAvatar(dataUrl);
  if (result === null) throw new Error('头像先存在本机了，等昵称确认后会再上传');
}

// 打开游戏时对一下本机和服务器的头像：服务器有、本机没有就拿回来；本机有、服务器没有（之前断网没传上）就补传
export async function syncMyAvatar() {
  if (!store.get(STORAGE_KEYS.playerName)) return;
  try {
    const p = await myProfile();
    if (p && p.avatar && !myAvatar()) store.set(STORAGE_KEYS.avatar, p.avatar);
    else if (p && !p.avatar && myAvatar()) await setAvatar(myAvatar());
  } catch { /* 连不上就下次再说 */ }
}

// 头像 + 昵称 + 换头像，排行榜和留言墙共用；onChanged 在换完头像后调用（比如刷新列表）
export function renderMeBar(el, { size = 28, onChanged } = {}) {
  const name = store.get(STORAGE_KEYS.playerName) || '';
  el.hidden = !name;
  if (!name) return;
  const nm = document.createElement('b');
  nm.textContent = name;
  // 文件框不能用 display:none 藏起来，苹果手机上点了会没反应，所以用视觉隐藏
  const pick = document.createElement('label');
  pick.className = 'linkish me-pick';
  pick.append(document.createTextNode(myAvatar() ? '换头像' : '上传头像'));
  const input = document.createElement('input');
  Object.assign(input, { type: 'file', accept: 'image/*', className: 'sr-only' });
  pick.append(input);
  const msg = document.createElement('span');
  msg.className = 'me-msg';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    msg.textContent = '上传中…';
    try {
      await uploadAvatar(await makeAvatar(file));
      renderMeBar(el, { size, onChanged });
      if (onChanged) onChanged();
    } catch (err) {
      msg.textContent = err.message;
    }
  });
  el.replaceChildren(avatarEl(name, myAvatar(), size), nm, pick, msg);
}
