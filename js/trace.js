// 把抠好图的照片变成碰撞轮廓：裁掉透明边，沿不透明像素求凸包。没抠的照片就是一个方块。
import { TRACE } from './config.js';
import { convexHull, simplify, polygonAreaCentroid } from './geometry.js';

export function traceImage(img) {
  const k = Math.min(1, TRACE.maxSize / Math.max(img.width, img.height));
  const w0 = Math.round(img.width * k), h0 = Math.round(img.height * k);
  const c0 = document.createElement('canvas');
  c0.width = w0; c0.height = h0;
  const x0 = c0.getContext('2d');
  x0.drawImage(img, 0, 0, w0, h0);
  const a = x0.getImageData(0, 0, w0, h0).data;
  const solid = (x, y) => a[(y * w0 + x) * 4 + 3] > TRACE.alphaCut;

  const pts = [];
  for (let y = 0; y < h0; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w0; x++) if (solid(x, y)) { if (l < 0) l = x; r = x; }
    if (l >= 0) pts.push([l, y], [r + 1, y], [l, y + 1], [r + 1, y + 1]);
  }
  if (!pts.length) throw new Error('图片是全透明的，换一张');

  const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]));
  const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
  const w = maxX - minX, h = maxY - minY;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(c0, minX, minY, w, h, 0, 0, w, h);

  const hull = simplify(convexHull(pts.map(([x, y]) => [x - minX, y - minY])), TRACE.hullVertices);
  const { area, cx, cy } = polygonAreaCentroid(hull);
  return {
    photo: c.toDataURL('image/png'),
    shape: { w, h, cx, cy, area, hull: hull.map(([x, y]) => [x - cx, y - cy]) }
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败：' + src.slice(0, 40)));
    img.src = src;
  });
}
