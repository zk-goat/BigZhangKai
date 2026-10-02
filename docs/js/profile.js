// 自己的头像：本机缓存一份，换头像时同时上传到服务器
import { STORAGE_KEYS } from './config.js?v=19e16d6c';
import { store } from './skin.js?v=c519b08c';
import { setAvatar, myProfile, claimName } from './leaderboard.js?v=274d39d7';

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
