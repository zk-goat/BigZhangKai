// 画一个张楷：有照片画照片轮廓，没照片画一个带表情的彩色圆球。
import { LEVELS, MAX, COLORS } from './config.js';
import { skin, photoImg, shapeFor } from './skin.js';
import { drawRays, drawShinyImage, drawSparkles, drawShinyRing } from './shine.js';

const NAME_MIN_R = 40;  // 半径小于它不写名字

export function drawKai(ctx, x, y, r, lv, angle = 0, shiny = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const shape = shapeFor(lv, r);
  const img = shape && photoImg(lv);
  if (img) drawPhoto(ctx, r, lv, shape, img, shiny);
  else drawBall(ctx, r, lv, shiny);
  ctx.restore();
}

function drawPhoto(ctx, r, lv, { s, sh, top, bottom, verts }, img, shiny) {
  const x = -sh.cx * s, y = -sh.cy * s, w = sh.w * s, h = sh.h * s;
  if (shiny) {
    const t = performance.now() / 1000;
    drawRays(ctx, r, t);
    drawShinyImage(ctx, img, x, y, w, h, r, t);
    drawSparkles(ctx, verts, r, t);
  } else {
    ctx.shadowColor = 'rgba(59,42,20,.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.drawImage(img, x, y, w, h);
    ctx.shadowColor = 'transparent';
  }
  if (r >= NAME_MIN_R) drawName(ctx, r, lv, bottom * 0.45);
  if (lv === MAX) { ctx.translate(0, top + r * 0.98); drawCrown(ctx, r); }
}

function drawBall(ctx, r, lv, shiny) {
  if (shiny) drawShinyRing(ctx, r, performance.now() / 1000);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = LEVELS[lv].color; ctx.fill();
  drawFace(ctx, r);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = 2; ctx.strokeStyle = COLORS.ink; ctx.stroke();
  if (r >= NAME_MIN_R) drawName(ctx, r, lv, r * 0.62);
  if (lv === MAX) drawCrown(ctx, r);
}

function drawName(ctx, r, lv, y) {
  const name = skin[lv].name;
  const fs = Math.min(r * 0.32, (r * 1.6) / Math.max(name.length, 1));
  ctx.font = `${fs}px "ZCOOL KuaiLe", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = fs * 0.22; ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.strokeText(name, 0, y);
  ctx.fillStyle = COLORS.ink; ctx.fillText(name, 0, y);
}

// 照片加载失败时的兜底笑脸
function drawFace(ctx, r) {
  const ey = -r * 0.12, ex = r * 0.32, es = Math.max(1.6, r * 0.09);
  ctx.fillStyle = COLORS.ink;
  [-ex, ex].forEach(dx => { ctx.beginPath(); ctx.arc(dx, ey, es, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#fff';
  [-ex, ex].forEach(dx => { ctx.beginPath(); ctx.arc(dx + es * 0.35, ey - es * 0.35, es * 0.35, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,90,90,.35)';
  [-r * 0.52, r * 0.52].forEach(dx => { ctx.beginPath(); ctx.ellipse(dx, r * 0.1, r * 0.13, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); });
  ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.lineCap = 'round'; ctx.strokeStyle = COLORS.ink;
  ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
}

function drawCrown(ctx, r) {
  const w = r * 0.9, h = r * 0.38, y = -r * 0.98;
  ctx.beginPath();
  ctx.moveTo(-w / 2, y);
  ctx.lineTo(-w / 2, y - h); ctx.lineTo(-w / 4, y - h * 0.45);
  ctx.lineTo(0, y - h * 1.15); ctx.lineTo(w / 4, y - h * 0.45);
  ctx.lineTo(w / 2, y - h); ctx.lineTo(w / 2, y); ctx.closePath();
  ctx.fillStyle = COLORS.crown; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = COLORS.ink; ctx.stroke();
}

// 把某一级画进一个独立小画布（战报大图、进度格、庆祝画面、设置面板）
export function paintLevel(canvas, lv, { fill = 0.42, tries = 0, shiny = false } = {}) {
  if (skin[lv].photo && !photoImg(lv) && tries < 20) {
    setTimeout(() => paintLevel(canvas, lv, { fill, tries: tries + 1, shiny }), 100);
  }
  const pc = canvas.getContext('2d');
  pc.clearRect(0, 0, canvas.width, canvas.height);
  const base = canvas.width * 0.3;
  const shape = shapeFor(lv, base);
  const reach = shape ? Math.max(shape.ext, -shape.top, shape.bottom) : base;
  const r = base * Math.min(1, (canvas.height * fill) / reach);
  drawKai(pc, canvas.width / 2, canvas.height / 2 + canvas.height * 0.04, r, lv, 0, shiny);
}
