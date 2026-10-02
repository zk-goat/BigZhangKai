// 黄金张楷的画法：照片按明暗映射成黄金质感（像金色雕像），平时只有偶尔划过的一道反光和一颗闪烁的小星星。
// 坐标都以张楷中心为原点，调用前已经平移/旋转好。t 是秒。

// 明暗 → 金色：深古铜 → 金 → 浅金高光
const GOLD_STOPS = [
  [0, [36, 16, 0]],
  [0.25, [118, 60, 0]],
  [0.5, [206, 138, 8]],
  [0.7, [255, 200, 48]],
  [0.86, [255, 236, 150]],
  [1, [255, 255, 240]]
];

function goldAt(l) {
  for (let i = 1; i < GOLD_STOPS.length; i++) {
    const [p1, c1] = GOLD_STOPS[i];
    if (l <= p1) {
      const [p0, c0] = GOLD_STOPS[i - 1], k = (l - p0) / (p1 - p0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return GOLD_STOPS[GOLD_STOPS.length - 1][1];
}

// 明暗映射表只算一次
const GOLD_LUT = Array.from({ length: 256 }, (_, i) => {
  const l = i / 255;
  return goldAt(Math.min(1, Math.max(0, (l - 0.5) * 1.55 + 0.52)));  // 拉开明暗对比，更像金属
});

const goldCache = new Map();

// 照片的黄金版本（按图片缓存，只生成一次）
export function goldImage(img) {
  const key = img.src;
  if (goldCache.has(key)) return goldCache.get(key);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const [r, g, b] = GOLD_LUT[Math.round(px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11)];
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
  x.putImageData(data, 0, 0);
  goldCache.set(key, c);
  return c;
}

let buffer = null;  // 反光用的离屏画布，所有黄金张楷共用
const GLINT_PERIOD = 3.2;  // 秒

// 黄金照片 + 偶尔划过的一道细反光（只落在轮廓里）
export function drawGoldPhoto(ctx, img, x, y, w, h, r, t) {
  const gold = goldImage(img);
  ctx.save();
  // 一圈深金色细轮廓，让金色的人和黄色背景分开；再一层淡淡的落影
  ctx.shadowColor = 'rgba(92,46,0,.95)'; ctx.shadowBlur = Math.max(2, r * 0.05);
  ctx.drawImage(gold, x, y, w, h);
  ctx.shadowColor = 'rgba(92,46,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
  ctx.drawImage(gold, x, y, w, h);
  ctx.restore();

  const p = ((t / GLINT_PERIOD) % 1) * 2 - 0.4;  // 前 0.8 个周期划过，之后停着
  if (p < -0.2 || p > 1.2 || r < 14) return;
  const bw = Math.max(1, Math.ceil(w)), bh = Math.max(1, Math.ceil(h)), span = bw + bh;
  buffer = buffer || document.createElement('canvas');
  if (buffer.width < bw || buffer.height < bh) {
    buffer.width = Math.max(buffer.width, bw);
    buffer.height = Math.max(buffer.height, bh);
  }
  const b = buffer.getContext('2d');
  // 先画一道斜向光带，再用金色照片的形状做遮罩，只留下轮廓里的那一段
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, buffer.width, buffer.height);
  b.translate(bw / 2, bh / 2);
  b.rotate(-0.7);
  const cx = (p - 0.5) * span, band = Math.max(6, r * 0.22);
  const g = b.createLinearGradient(cx - band, 0, cx + band, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  b.fillStyle = g;
  b.fillRect(-span, -span, span * 2, span * 2);
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'destination-in';
  b.drawImage(gold, 0, 0, bw, bh);
  b.globalCompositeOperation = 'source-over';
  ctx.drawImage(buffer, 0, 0, bw, bh, x, y, w, h);
}

// 四角星形
export function starPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
}

// 轮廓边上偶尔闪一颗小星星：每 1.1 秒换一个位置，亮一下就灭
export function drawTwinkle(ctx, points, r, t) {
  if (!points.length) return;
  const slot = Math.floor(t / 1.1), phase = (t / 1.1) % 1;
  if (phase > 0.5) return;
  const pt = points[(slot * 7) % points.length];
  const s = Math.max(3, r * 0.16) * Math.sin((phase / 0.5) * Math.PI);
  ctx.save();
  ctx.shadowColor = 'rgba(255,200,60,.9)'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  starPath(ctx, pt.x * 1.04, pt.y * 1.04, s);
  ctx.fill();
  ctx.restore();
}

// 照片加载不出来时的兜底：金色描边圆圈
export function drawGoldRing(ctx, r) {
  ctx.save();
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = '#e0a800';
  ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
