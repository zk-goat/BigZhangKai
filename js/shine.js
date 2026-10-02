// 闪光张楷的画法：背后旋转金光 → 带呼吸金色光晕的照片（叠一层淡金色和周期扫过的流光）→ 轮廓上闪烁的星芒。
// 坐标都以张楷中心为原点，调用前已经平移/旋转好。t 是秒。

let buffer = null;  // 流光用的离屏画布，所有闪光张楷共用

// 背后：一圈缓慢旋转的放射金光 + 柔和光团
export function drawRays(ctx, r, t) {
  const R = r * 1.8, n = 12;
  ctx.save();
  ctx.rotate(t * 0.5);
  // 背景是黄色，光芒用“中心白 → 外圈橙金”才看得清
  const rays = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, R);
  rays.addColorStop(0, 'rgba(255,255,255,.95)');
  rays.addColorStop(0.45, 'rgba(255,170,30,.55)');
  rays.addColorStop(1, 'rgba(255,140,0,0)');
  ctx.fillStyle = rays;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, half = (Math.PI / n) * 0.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a - half, a + half); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.25);
  halo.addColorStop(0, 'rgba(255,255,255,.8)');
  halo.addColorStop(0.6, 'rgba(255,236,170,.35)');
  halo.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2); ctx.fill();
}

// 照片本体：呼吸的金色外光 + 淡金色调 + 斜向扫过的流光（只落在人物轮廓里）
export function drawShinyImage(ctx, img, x, y, w, h, r, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.save();
  // 先一圈橙色描边勾出轮廓，再一圈会呼吸的亮白辉光
  ctx.shadowColor = 'rgba(255,128,0,.95)';
  ctx.shadowBlur = Math.max(3, r * 0.08);
  ctx.drawImage(img, x, y, w, h);
  ctx.shadowColor = `rgba(255,255,240,${0.75 + 0.25 * pulse})`;
  ctx.shadowBlur = Math.max(8, r * (0.28 + 0.2 * pulse));
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  const bw = Math.max(1, Math.ceil(w)), bh = Math.max(1, Math.ceil(h));
  buffer = buffer || document.createElement('canvas');
  if (buffer.width < bw || buffer.height < bh) {
    buffer.width = Math.max(buffer.width, bw);
    buffer.height = Math.max(buffer.height, bh);
  }
  const b = buffer.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, buffer.width, buffer.height);
  b.drawImage(img, 0, 0, bw, bh);
  b.globalCompositeOperation = 'source-atop';  // 下面画的东西只留在人物轮廓里
  b.fillStyle = 'rgba(255,200,60,.14)';
  b.fillRect(0, 0, bw, bh);
  // 每 2.4 秒扫过一次，扫完停一会儿
  const span = bw + bh, p = ((t / 2.4) % 1) * 1.6 - 0.3;
  if (p > -0.2 && p < 1.2) {
    b.translate(bw / 2, bh / 2);
    b.rotate(-0.6);
    const cx = (p - 0.5) * span, band = Math.max(10, r * 0.45);
    const g = b.createLinearGradient(cx - band, 0, cx + band, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,248,220,.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,.85)');
    g.addColorStop(0.6, 'rgba(255,214,90,.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = g;
    b.fillRect(-span, -span, span * 2, span * 2);
  }
  ctx.drawImage(buffer, 0, 0, bw, bh, x, y, w, h);
}

function star(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

// 轮廓上此起彼伏的四角星芒
export function drawSparkles(ctx, points, r, t) {
  ctx.save();
  ctx.shadowColor = 'rgba(255,140,0,.95)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffffff';
  points.forEach((pt, i) => {
    const phase = Math.sin(t * 2.6 + i * 2.1);
    if (phase < 0.35) return;
    const s = Math.max(3, r * 0.17) * ((phase - 0.35) / 0.65);
    star(ctx, pt.x * 1.08, pt.y * 1.08, s);
  });
  ctx.restore();
}

// 照片加载不出来时的兜底：金色描边圆圈
export function drawShinyRing(ctx, r, t) {
  ctx.save();
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = `rgba(255,200,40,${0.7 + 0.3 * Math.sin(t * 3)})`;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
