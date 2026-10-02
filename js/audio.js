// 音效：WebAudio 现场合成，不需要音频文件。浏览器要求先有一次点击才会出声。
import { STORAGE_KEYS } from './config.js';
import { store } from './skin.js';

let audioCtx = null;
let muted = store.get(STORAGE_KEYS.muted) === '1';

export const isMuted = () => muted;

export function toggleMuted() {
  muted = !muted;
  store.set(STORAGE_KEYS.muted, muted ? '1' : '0');
  return muted;
}

function tone(freq, start, dur, vol = 0.16, type = 'triangle') {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + start;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* 浏览器不支持就静默 */ }
}

export const sfx = {
  drop: () => tone(180, 0, 0.12, 0.08, 'sine'),
  // 等级越高、连击越多，音调越高
  merge: (lv, combo = 1) => {
    const f = 330 * Math.pow(2, lv / 9 + Math.min(combo - 1, 6) / 12);
    tone(f, 0, 0.18); tone(f * 1.5, 0.07, 0.22, 0.12);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.35, 0.18)),
  over: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.18, 0.3, 0.14, 'sawtooth'))
};
