// 纯几何函数，不依赖浏览器，可以单独测试。

// 单调链法求凸包，返回逆时针顶点（屏幕坐标下为顺时针）
export function convexHull(points) {
  const p = [...points].sort((m, n) => m[0] - n[0] || m[1] - n[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => list.reduce((acc, pt) => {
    const out = [...acc];
    while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], pt) <= 0) out.pop();
    return [...out, pt];
  }, []);
  const lower = half(p), upper = half([...p].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// 反复删掉贡献面积最小的顶点，直到顶点数不超过 maxN（顶点少物理更稳）
export function simplify(hull, maxN) {
  let h = hull;
  while (h.length > maxN) {
    const tri = h.map((b, i) => {
      const a = h[(i - 1 + h.length) % h.length], c = h[(i + 1) % h.length];
      return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    });
    const drop = tri.indexOf(Math.min(...tri));
    h = h.filter((_, i) => i !== drop);
  }
  return h;
}

// 多边形面积（取绝对值）与重心
export function polygonAreaCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  poly.forEach(([x1, y1], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cr = x1 * y2 - x2 * y1;
    a += cr; cx += (x1 + x2) * cr; cy += (y1 + y2) * cr;
  });
  a /= 2;
  return { area: Math.abs(a), cx: cx / (6 * a), cy: cy / (6 * a) };
}

// 新合成的张楷弹出放大的缓动（0.55 → 略超 1 → 1）
export function popScale(ageMs, durationMs = 240) {
  if (ageMs >= durationMs) return 1;
  const p = ageMs / durationMs, c = 1.70158;
  return 0.55 + 0.45 * (1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2));
}
