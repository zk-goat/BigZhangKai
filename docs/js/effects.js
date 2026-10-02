// 合成反馈：光圈、碎片、飘字、震屏、连击提示。只负责“看起来爽”，不影响玩法。
import { LEVELS, FIELD, COLORS } from './config.js?v=10014806';
import { skin } from './skin.js?v=78f85177';
import { starPath } from './shine.js?v=8bbb7766';

const SHAKE_FROM_LEVEL = 7;     // 合到这一级及以上才震屏
const NAME_POP_FROM_LEVEL = 7;  // 合到这一级及以上弹出名字
const MAX_PARTICLES = 260;

let rings = [], particles = [], floats = [];
let shakeUntil = 0, shakeAmp = 0, comboText = '', comboUntil = 0;
let flashUntil = 0, bannerAt = -Infinity;
const FLASH_MS = 300, BANNER_MS = 1300;
const GOLDS = ['#ffd54a', '#ffe9a0', '#f2b705', '#fff6d6', '#e8a400'];
const SPARKLE_COLORS = ['#ffffff', '#fff3b0', '#ffd54a', '#ffffff', '#ffe0f0', '#d8f4ff'];

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

// 黄金张楷出现：像宝可梦闪光那样在身边炸开一圈闪烁的星星，画面轻轻一亮，弹出一行字
export function shinyEffects({ x, y, now }) {
  flashUntil = now + FLASH_MS;
  bannerAt = now;
  const n = 14;
  const fresh = Array.from({ length: n }, (_, i) => {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.3, sp = 1.6 + Math.random() * 2.2;
    return {
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.6, life: 1, star: true,
      size: 5 + Math.random() * 6, color: SPARKLE_COLORS[i % SPARKLE_COLORS.length], spin: Math.random() * 6
    };
  });
  particles = [...particles, ...fresh].slice(-MAX_PARTICLES);
}

function drawShinyBanner(ctx, now) {
  const age = now - bannerAt;
  if (age < 0 || age > BANNER_MS) return;
  const inP = Math.min(1, age / 220), outP = Math.max(0, (age - (BANNER_MS - 350)) / 350);
  const scale = 0.7 + 0.3 * (1 - Math.pow(1 - inP, 3));
  ctx.save();
  ctx.globalAlpha = 1 - outP;
  ctx.translate(FIELD.width / 2, FIELD.height * 0.3 - 10 * inP);
  ctx.scale(scale, scale);
  ctx.font = '32px "ZCOOL KuaiLe", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, -16, 0, 16);
  g.addColorStop(0, '#fffdf0'); g.addColorStop(0.4, '#ffe14d'); g.addColorStop(0.75, '#ffb000'); g.addColorStop(1, '#ff8a00');
  ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 14;   // 外圈白色辉光
  ctx.lineWidth = 6; ctx.strokeStyle = '#5a2e00';
  ctx.strokeText('黄金张楷！', 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = g;
  ctx.fillText('黄金张楷！', 0, 0);
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.8)';    // 字面一圈细亮边
  ctx.strokeText('黄金张楷！', 0, -1);
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
    .map(q => (q.star
      ? { ...q, x: q.x + q.vx, y: q.y + q.vy, vx: q.vx * 0.94, vy: q.vy * 0.94, life: q.life - 0.018 }
      : { ...q, x: q.x + q.vx, y: q.y + q.vy, vy: q.vy + 0.18, vx: q.vx * 0.98, life: q.life - 0.025 }))
    .filter(q => q.life > 0);
  particles.forEach(q => {
    ctx.fillStyle = q.color;
    if (q.star) {
      const twinkle = 0.55 + 0.45 * Math.sin(now / 60 + q.spin * 10);
      ctx.globalAlpha = Math.min(1, q.life * 1.6) * twinkle;
      ctx.save();
      ctx.shadowColor = 'rgba(255,210,80,.9)'; ctx.shadowBlur = 6;
      ctx.translate(q.x, q.y); ctx.rotate(q.spin + now / 900);
      starPath(ctx, 0, 0, q.size * (0.6 + 0.4 * q.life));
      ctx.fill();
      ctx.restore();
    } else {
      ctx.globalAlpha = q.life;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + q.life * 0.5), 0, Math.PI * 2); ctx.fill();
    }
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
    ctx.fillStyle = `rgba(255,248,215,${0.22 * (flashUntil - now) / FLASH_MS})`;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
  }
  drawShinyBanner(ctx, now);
  ctx.fillStyle = COLORS.ink;
}
