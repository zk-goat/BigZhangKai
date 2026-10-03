// 一局进行中的存档：场上每个张楷 + 本局状态。退出再进来能接着玩。
// 只存在本机；游戏结束或主动重开时清空。
import { MAX, FIELD, STORAGE_KEYS } from './config.js';
import { store } from './skin.js';

const SAVE_VERSION = 1;
const MAX_BODIES = 400;

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isLevel = v => Number.isInteger(v) && v >= 0 && v <= MAX;

// snapshot：{ bodies: [{lv, x, y, angle}], state: {...} }，由 game.js 生成
export function writeSave(snapshot) {
  store.set(STORAGE_KEYS.save, JSON.stringify({ v: SAVE_VERSION, at: Date.now(), ...snapshot }));
}

export function clearSave() {
  store.set(STORAGE_KEYS.save, 'null');
}

// 读存档并逐项校验；格式不对就当没有存档
export function readSave() {
  try {
    const s = JSON.parse(store.get(STORAGE_KEYS.save) || 'null');
    if (!s || s.v !== SAVE_VERSION || !Array.isArray(s.bodies) || !s.state) return null;
    const bodies = s.bodies.filter(b =>
      b && isLevel(b.lv) && isNum(b.x) && isNum(b.y) && isNum(b.angle)
      && b.x >= 0 && b.x <= FIELD.width && b.y <= FIELD.height)
      .slice(0, MAX_BODIES)
      .map(b => ({ lv: b.lv, x: b.x, y: b.y, angle: b.angle, shiny: b.shiny === true }));
    const st = s.state;
    const fields = ['score', 'topLevel', 'current', 'next', 'mergeCount', 'maxCombo', 'playedMs'];
    if (!fields.every(k => isNum(st[k]) && st[k] >= 0)) return null;
    if (![st.topLevel, st.current, st.next].every(isLevel)) return null;
    if (bodies.length === 0 && st.score === 0) return null;  // 刚开局什么都没有，不值得恢复
    return {
      bodies,
      state: {
        ...st,
        wonThisGame: Boolean(st.wonThisGame),
        currentShiny: st.currentShiny === true,
        nextShiny: st.nextShiny === true,
        shinySeen: isNum(st.shinySeen) && st.shinySeen >= 0 ? st.shinySeen : 0,
        fusions: isNum(st.fusions) && st.fusions >= 0 ? st.fusions : 0,
        dangerShift: isNum(st.dangerShift) && st.dangerShift >= 0 && st.dangerShift <= 200 ? st.dangerShift : 0,
        round: st.round && typeof st.round === 'object' ? st.round : null
      }
    };
  } catch { return null; }
}

