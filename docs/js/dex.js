// 闪光图鉴：本机见过哪些等级的闪光张楷。只存在本机。
import { MAX, STORAGE_KEYS } from './config.js?v=10014806';
import { store } from './skin.js?v=78f85177';

export function loadDex() {
  try {
    const d = JSON.parse(store.get(STORAGE_KEYS.dex) || '[]');
    return Array.isArray(d) ? [...new Set(d.filter(x => Number.isInteger(x) && x >= 0 && x <= MAX))] : [];
  } catch { return []; }
}

// 记一笔；返回是不是第一次见到这一级的闪光
export function recordShiny(lv) {
  const dex = loadDex();
  if (dex.includes(lv)) return false;
  store.set(STORAGE_KEYS.dex, JSON.stringify([...dex, lv]));
  return true;
}
