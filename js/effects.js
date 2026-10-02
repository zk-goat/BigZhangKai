// 合成反馈：光圈、碎片、飘字、震屏、连击提示。只负责“看起来爽”，不影响玩法。
import { LEVELS, FIELD, COLORS } from './config.js';
import { skin } from './skin.js';

const SHAKE_FROM_LEVEL = 7;     // 合到这一级及以上才震屏
const NAME_POP_FROM_LEVEL = 7;  // 合到这一级及以上弹出名字
const MAX_PARTICLES = 260;

let rings = [], particles = [], floats = [];
let shakeUntil = 0, shakeAmp = 0, comboText = '', comboUntil = 0;

export function resetEffects() {
  rings = []; particles = []; floats = [];
  shakeUntil = 0; comboUntil = 0;
}

export function mergeEffects({ x, y, lv, gain, combo, now }) {
  rings = [...rings, { x, y, r: LEVELS[lv].r, t: 0, lv }];
  floats = [...floats, { x, y: y - LEVELS[lv].r * 0.6, text: '+' + gain, t: 0 }];
  const n = 10 + lv * 2;
  const fresh = Array.from({ length: n }, (_, i) => {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4, sp = 2 + Math.random() * (2 + lv * 0.35);
    return {
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, life: 1,
      size: 2 + Math.random() * (2 + lv * 0.25), color: LEVELS[lv].color
    };
  });
  particles = [...particles, ...fresh].slice(-MAX_PARTICLES);
  if (lv >= SHAKE_FROM_LEVEL) {
    shakeUntil = now + 220 + lv * 15;
    shakeAmp = Math.min(9, (lv - 5) * 1.1);
  }
  if (combo >= 2) {
    comboText = '连击 ×' + combo;
    comboUntil = now + 900;
  }
}

// 在画面最开始调用：震屏偏移
export function applyShake(ctx, now) {
  if (now >= shakeUntil) return;
  const k = shakeAmp * ((shakeUntil - now) / 300);
  ctx.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);
}

function outlinedText(ctx, text, x, y, size, alpha, lineWidth) {
  ctx.font = `${size}px "ZCOOL KuaiLe", sans-serif`;
  ctx.lineWidth = lineWidth; ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = `rgba(226,73,47,${alpha})`;
  ctx.fillText(text, x, y);
}

// 在所有张楷画完之后调用
export function drawEffects(ctx, now) {
  particles = particles
    .map(q => ({ ...q, x: q.x + q.vx, y: q.y + q.vy, vy: q.vy + 0.18, vx: q.vx * 0.98, life: q.life - 0.025 }))
    .filter(q => q.life > 0);
  particles.forEach(q => {
    ctx.globalAlpha = q.life;
    ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + q.life * 0.5), 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  floats = floats.map(f => ({ ...f, t: f.t + 0.022 })).filter(f => f.t < 1);
  floats.forEach(f => outlinedText(ctx, f.text, f.x, f.y - f.t * 40, 22, 1 - f.t, 4));

  if (now < comboUntil) {
    outlinedText(ctx, comboText, FIELD.width / 2, 80, 34, Math.min(1, (comboUntil - now) / 300), 6);
  }

  rings = rings.map(e => ({ ...e, t: e.t + 0.05 })).filter(e => e.t < 1);
  rings.forEach(e => {
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 + e.t * 0.6), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${1 - e.t})`; ctx.lineWidth = 6 * (1 - e.t); ctx.stroke();
    if (e.lv >= NAME_POP_FROM_LEVEL) {
      ctx.font = `${20 + e.t * 10}px "ZCOOL KuaiLe", sans-serif`;
      ctx.fillStyle = `rgba(226,73,47,${1 - e.t})`;
      ctx.fillText(skin[e.lv].name + '！', e.x, e.y - e.r - 10 - e.t * 20);
    }
  });
  ctx.fillStyle = COLORS.ink;
}
