// 皮肤：每一级的名字、照片和碰撞轮廓。照片统一用 config.js 里的内置照片，玩家不能自己换。
import { LEVELS, RULES, STORAGE_KEYS } from './config.js?v=70a9d4eb';
import { traceImage, loadImage } from './trace.js?v=f73bf07e';

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
};

const blankSkin = () => LEVELS.map(l => ({ name: l.name, photo: null }));

export let skin = blankSkin();
const photoCache = new Map();

// 读取内置照片并生成轮廓。以前版本允许玩家在本机换照片，那份存档已作废，顺手清掉腾出空间
export async function initSkin() {
  try { localStorage.removeItem(STORAGE_KEYS.skin); } catch { /* 存储不可用就算了 */ }
  skin = await Promise.all(LEVELS.map(async l => {
    try { return { name: l.name, ...traceImage(await loadImage(l.image)) }; }
    catch { return { name: l.name, photo: null }; }
  }));
  skin.forEach((_, i) => photoImg(i));  // 预加载，避免第一次出现时退回卡通脸
}

// 已解码好的照片；还没好返回 null
export function photoImg(i) {
  const src = skin[i].photo;
  if (!src) return null;
  let img = photoCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    photoCache.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// 照片轮廓按面积换算成与同级圆一样大；细长照片再限制最长边
export function shapeFor(lv, r = LEVELS[lv].r) {
  const sh = skin[lv].photo && skin[lv].shape;
  if (!sh) return null;
  const s = Math.min(Math.sqrt((Math.PI * r * r) / sh.area), (RULES.tallCap * r) / Math.max(sh.w, sh.h));
  const verts = sh.hull.map(([x, y]) => ({ x: x * s, y: y * s }));
  return {
    s, sh, verts,
    ext: Math.max(...verts.map(v => Math.abs(v.x))),
    top: Math.min(...verts.map(v => v.y)),
    bottom: Math.max(...verts.map(v => v.y))
  };
}

export function halfWidth(lv, r = LEVELS[lv].r) {
  const shape = shapeFor(lv, r);
  return shape ? shape.ext : r;
}
