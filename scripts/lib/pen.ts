// 手写笔画生成器（浏览器端代码，以字符串形式拼进页面脚本）。
// board.ts（白板版）和 paper.ts（纸面版）共用：单笔两端收尖、方框四笔、一笔绕圈；
// 随机数由种子决定，同样的种子画出同样的笔迹。依赖外层作用域里的常量 NS。
export const PEN_JS = String.raw`  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
  function rng(seed) { let a = seed || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  const f1 = (n) => n.toFixed(1)

  // 一笔：沿二次曲线采样，宽度两端收尖，生成填充多边形
  function stroke(pts, w) {
    const L = [], R = [], n = pts.length
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len
      const t = i / (n - 1), hw = (w / 2) * (0.25 + 0.75 * Math.pow(Math.sin(Math.PI * t), 0.45))
      L.push([p[0] - dy * hw, p[1] + dx * hw]); R.push([p[0] + dy * hw, p[1] - dx * hw])
    }
    const all = L.concat(R.reverse())
    return 'M' + all.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z'
  }
  function line(x1, y1, x2, y2, w, r, o = {}) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len
    const over = o.over ?? 2.5, j = o.jitter ?? 0.8
    const sx = x1 - ux * over * r() + (r() - 0.5) * j, sy = y1 - uy * over * r() + (r() - 0.5) * j
    const ex = x2 + ux * over * r() + (r() - 0.5) * j, ey = y2 + uy * over * r() + (r() - 0.5) * j
    const bow = (r() - 0.5) * Math.min(4, len * 0.025), mx = (sx + ex) / 2 - uy * bow, my = (sy + ey) / 2 + ux * bow
    const N = Math.max(6, Math.min(24, Math.round(len / 12))), pts = []
    for (let i = 0; i < N; i++) { const t = i / (N - 1), u = 1 - t; pts.push([u * u * sx + 2 * u * t * mx + t * t * ex, u * u * sy + 2 * u * t * my + t * t * ey]) }
    return stroke(pts, w)
  }
  // 方框：四笔，角上出头
  function box(x, y, w, h, sw, r) {
    return [line(x, y, x + w, y, sw, r), line(x + w, y, x + w, y + h, sw, r), line(x + w, y + h, x, y + h, sw, r), line(x, y + h, x, y, sw, r)].join('')
  }
  // 圈：一笔绕一圈多一点
  function loop(cx, cy, rx, ry, sw, r) {
    const a0 = -2.2 + r() * 0.6, sweep = Math.PI * 2 + 0.35, N = 44, pts = []
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), a = a0 + sweep * t, k = 1 + 0.05 * Math.sin(a * 2 + r()) + (t > 0.9 ? 0.06 * (t - 0.9) * 10 : 0)
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
    }
    return stroke(pts, sw)
  }

  function add(g, d, color, op) {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', color)
    if (op !== undefined && op < 1) p.setAttribute('opacity', op.toFixed(2))
    g.appendChild(p)
  }`
