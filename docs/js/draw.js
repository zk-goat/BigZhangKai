// 画一个张楷：有照片画照片轮廓，没照片画一个带表情的彩色圆球。
import { LEVELS, MAX, COLORS } from './config.js?v=21648a52';
import { skin, photoImg, shapeFor } from './skin.js?v=83f93ead';
import { drawGoldPhoto, drawTwinkle, drawGoldRing } from './shine.js?v=8bbb7766';
import { loadImage } from './trace.js?v=a4757da2';

const NAME_MIN_R = 40;  // 半径小于它不写名字
let crownSprite = null;

export async function initCrown() {
  try {
    const image = await loadImage('images/crown-royal-v2.png?v=a1e6a6ba');
    // 启动时预缩放一次，避免每帧处理大图；源图的透明留白不参与佩戴尺寸。
    const sprite = document.createElement('canvas');
    sprite.width = 384; sprite.height = 176;
    sprite.getContext('2d').drawImage(image, 132, 84, 1510, 692, 0, 0, 384, 176);
    crownSprite = sprite;
  } catch { /* 网络失败时继续使用矢量皇冠，游戏照常启动。 */ }
}

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

function drawPhoto(ctx, r, lv, { s, sh, bottom, verts }, img, shiny) {
  const x = -sh.cx * s, y = -sh.cy * s, w = sh.w * s, h = sh.h * s;
  if (shiny) {
    const t = performance.now() / 1000;
    drawGoldPhoto(ctx, img, x, y, w, h, r, t);
    drawTwinkle(ctx, verts, r, t);
  } else {
    ctx.shadowColor = 'rgba(59,42,20,.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.drawImage(img, x, y, w, h);
    ctx.shadowColor = 'transparent';
  }
  if (r >= NAME_MIN_R) drawName(ctx, r, lv, bottom * 0.45);
  if (lv === MAX) {
    // 第 14 级照片的人头偏左，皇冠跟着照片里的头走，而不是跟着整张照片的重心走。
    ctx.translate(x + w * 0.29, y + h * 0.055);
    drawCrown(ctx, w * 0.42);
  }
}

function drawBall(ctx, r, lv, shiny) {
  if (shiny) drawGoldRing(ctx, r);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = LEVELS[lv].color; ctx.fill();
  drawFace(ctx, r);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = 2; ctx.strokeStyle = COLORS.ink; ctx.stroke();
  if (r >= NAME_MIN_R) drawName(ctx, r, lv, r * 0.62);
  if (lv === MAX) {
    ctx.translate(0, -r * 0.9);
    drawCrown(ctx, r * 0.9);
  }
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

function drawCrown(ctx, width) {
  ctx.save();
  ctx.rotate(-0.07);
  if (crownSprite) {
    const height = width * crownSprite.height / crownSprite.width;
    ctx.shadowColor = 'rgba(46,28,7,.25)';
    ctx.shadowBlur = 1.5; ctx.shadowOffsetY = 1;
    ctx.drawImage(crownSprite, -width / 2, -height + width * 0.025, width, height);
    ctx.restore();
    return;
  }
  ctx.scale(width, width);
  // 用归一化坐标画，游戏内、庆祝页和战报上的小图都能保持同一比例。
  ctx.beginPath();
  ctx.moveTo(-0.5, -0.11);
  ctx.lineTo(-0.48, -0.43);
  ctx.quadraticCurveTo(-0.47, -0.48, -0.43, -0.44);
  ctx.lineTo(-0.22, -0.29);
  ctx.lineTo(-0.04, -0.57);
  ctx.quadraticCurveTo(0, -0.63, 0.04, -0.57);
  ctx.lineTo(0.22, -0.29);
  ctx.lineTo(0.43, -0.44);
  ctx.quadraticCurveTo(0.47, -0.48, 0.48, -0.43);
  ctx.lineTo(0.5, -0.11);
  ctx.quadraticCurveTo(0, 0.03, -0.5, -0.11);
  ctx.closePath();
  const gold = ctx.createLinearGradient(0, -0.62, 0, 0.03);
  gold.addColorStop(0, '#fff4b5');
  gold.addColorStop(0.45, COLORS.crown);
  gold.addColorStop(1, '#b87412');
  ctx.fillStyle = gold;
  ctx.shadowColor = 'rgba(77,41,7,.35)';
  ctx.shadowBlur = 0.08;
  ctx.shadowOffsetY = 0.04;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = '#835013';
  ctx.stroke();

  // 下沿的亮边和中央红宝石让小尺寸的皇冠也有层次。
  ctx.beginPath();
  ctx.moveTo(-0.46, -0.13);
  ctx.quadraticCurveTo(0, -0.01, 0.46, -0.13);
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = '#fff4bd';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -0.17, 0.065, 0.075, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#a92827';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.02, -0.2, 0.018, 0, Math.PI * 2);
  ctx.fillStyle = '#fff1dc';
  ctx.fill();
  ctx.restore();
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
