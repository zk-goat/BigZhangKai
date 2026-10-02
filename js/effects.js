// 合成反馈：光圈、碎片、飘字、震屏、连击提示。只负责“看起来爽”，不影响玩法。
import { LEVELS, FIELD, COLORS } from './config.js';
import { skin } from './skin.js';

const SHAKE_FROM_LEVEL = 7;     // 合到这一级及以上才震屏
const NAME_POP_FROM_LEVEL = 7;  // 合到这一级及以上弹出名字
const MAX_PARTICLES = 260;

let rings = [], particles = [], floats = [];
let shakeUntil = 0, shakeAmp = 0, comboText = '', comboUntil = 0;
let flashUntil = 0, bannerAt = -Infinity;
const FLASH_MS = 450, BANNER_MS = 1700;
const GOLDS = ['#ffd54a', '#ffe9a0', '#f2b705', '#fff6d6', '#e8a400'];

export function resetEffects() {
  rings = []; particles = []; floats = [];
  shakeUntil = 0; comboUntil = 0; flashUntil = 0; bannerAt = -Infinity;
}

export function mergeEffects({ x, y, lv, gain, combo, now, shiny = false }) {
  rings = [...rings, { x, y, r: LEVELS[lv].r, t: 0, lv }];
  floats = [...floats, { x, y: y - LEVELS[lv].r * 0.6, text: '+' + gain, t: 0 }];
  const n = 10 + lv * 2;
  const fresh = Array.from({ length: n }, (_, i) => {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4, sp = 2 + Math.random() * (2 + lv * 0.35);
    return {
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, life: 1,
      size: 2 + Math.random() * (2 + lv * 0.25), color: shiny ? GOLDS[i % GOLDS.length] : LEVELS[lv].color
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

// 闪光张楷出现：画面泛金光、中央弹出字样、四周喷金色粒子
export function shinyEffects({ x, y, now }) {
  flashUntil = now + FLASH_MS;
  bannerAt = now;
  const n = 36;
  const fresh = Array.from({ length: n }, (_, i) => {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.2, sp = 3 + Math.random() * 5;
    return { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, life: 1, size: 2.5 + Math.random() * 3.5, color: GOLDS[i % GOLDS.length] };
  });
  particles = [...particles, ...fresh].slice(-MAX_PARTICLES);
}

function drawShinyBanner(ctx, now) {
  const age = now - bannerAt;
  if (age < 0 || age > BANNER_MS) return;
  const inP = Math.min(1, age / 220), outP = Math.max(0, (age - (BANNER_MS - 350)) / 350);
  const scale = 0.6 + 0.4 * (1 - Math.pow(1 - inP, 3)) + 0.04 * Math.sin(age / 90);
  ctx.save();
  ctx.globalAlpha = 1 - outP;
  ctx.translate(FIELD.width / 2, FIELD.height * 0.34);
  ctx.scale(scale, scale);
  ctx.font = '44px "ZCOOL KuaiLe", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, -22, 0, 22);
  g.addColorStop(0, '#fffdf0'); g.addColorStop(0.4, '#ffe14d'); g.addColorStop(0.75, '#ffb000'); g.addColorStop(1, '#ff8a00');
  ctx.shadowColor = 'rgba(255,255,255,.95)'; ctx.shadowBlur = 22;   // 外圈白色辉光
  ctx.lineWidth = 8; ctx.strokeStyle = '#5a2e00';
  ctx.strokeText('闪光张楷！', 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = g;
  ctx.fillText('闪光张楷！', 0, 0);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.8)';    // 字面一圈细亮边
  ctx.strokeText('闪光张楷！', 0, -1);
  ctx.restore();
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
  if (now < flashUntil) {
    ctx.fillStyle = `rgba(255,224,130,${0.38 * (flashUntil - now) / FLASH_MS})`;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
  }
  drawShinyBanner(ctx, now);
  ctx.fillStyle = COLORS.ink;
}
