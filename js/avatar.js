// 个人头像：选好的照片在手机上裁成正方形、压成 96×96 小图；没有头像时显示昵称首字的彩色圆。
import { loadImage } from './trace.js';

const SIZE = 96;
const MAX_CHARS = 30000;   // 与数据库里的长度限制一致
const PALETTE = ['#e2492f', '#2e86de', '#10ac84', '#ff9f43', '#8e44ad', '#16a085', '#d35400', '#3fb8af', '#c0392b', '#5a5ad6'];

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('读取图片失败'));
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(file);
  });
}

// 照片 → 正方形小头像 data URL（优先 WebP，不支持的浏览器用 JPEG；太大就降质量）
export async function makeAvatar(file) {
  let img;
  try { img = await loadImage(await readAsDataURL(file)); } catch { throw new Error('这个文件不是可识别的图片'); }
  const side = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SIZE, SIZE);  // 透明图片垫白底
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    let url = c.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', q);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error('图片压缩后还是太大，换一张试试');
}

function colorFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const SAFE_AVATAR = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/;

// 生成头像元素：有头像显示图片，没有显示首字彩色圆
export function avatarEl(name, avatar, size = 32) {
  const el = document.createElement('span');
  el.className = 'avatar';
  el.style.width = el.style.height = size + 'px';
  if (avatar && SAFE_AVATAR.test(avatar)) {
    const img = document.createElement('img');
    img.src = avatar;
    img.alt = '';
    el.append(img);
  } else {
    el.style.background = colorFor(name || '?');
    el.style.fontSize = Math.round(size * 0.48) + 'px';
    el.textContent = [...(name || '?')][0];
  }
  return el;
}
