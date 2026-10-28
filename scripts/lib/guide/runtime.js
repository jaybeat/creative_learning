// 引导模块的浏览器端（"念到哪，看到哪"）：拍内状态、元素滑动、指示框、框旁批注。用法见同目录 README.md。
// 课程播放器生成页面时把本文件内联进去（去掉 export），所以这里不能 import，也不能在载入时碰 document。
// 画面只由时间 t 决定：同一个 t 画出来的东西永远一样，导出视频时逐帧调用。
// 上半部分是纯计算（tests/unit/guide-runtime.test.ts 直接测），下半部分 createGuide 是和 DOM 打交道的部分。

export const MOVE = 0.35 // 元素滑过去
export const FOCUS_IN = 0.25 // 一串聚焦开头淡入、结尾淡出
export const GLIDE = 0.3 // 指示框从上一个目标滑到下一个
export const SETTLE = 0.45 // 指示框到达时从略大收到贴合
export const NOTE_ARROW = 0.2 // 批注箭头画出来
export const NOTE_FADE = 0.2 // 框要滑走前批注淡出

export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3))
export const near = (a, b) => Math.abs(a - b) < 0.05
export const mid = (r) => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]
const clamp01 = (x) => Math.max(0, Math.min(1, x))

/** 一次点名几个东西：挨着的格子（同一行、间隔不超过 6px）合成一个框，分开的各自一个框。rs 是 { x0, y0, x1, y1 } */
export function groupRects(rs) {
  const sorted = [...rs].sort((p, q) => p.x0 - q.x0)
  const groups = []
  for (const r of sorted) {
    const g = groups.find((u) => r.y0 < u.y1 - 4 && r.y1 > u.y0 + 4 && r.x0 <= u.x1 + 6)
    if (g) Object.assign(g, { x0: Math.min(g.x0, r.x0), y0: Math.min(g.y0, r.y0), x1: Math.max(g.x1, r.x1), y1: Math.max(g.y1, r.y1) })
    else groups.push({ ...r })
  }
  return groups
}

/**
 * 第 i 个聚焦区间 f 在时刻 time 的状态：
 * g 是从上一组框滑过来的进度（没有上一组就是 1），pad 是框比目标大出的边距（到达时从 9 收到 4），a 是透明度
 */
export function focusState(f, time, hasPrev, goesOn) {
  const g = hasPrev ? ease((time - f.t0) / GLIDE) : 1
  const pad = 4 + 5 * (1 - ease((time - f.t0) / SETTLE))
  const a = ease(Math.max(0, Math.min(hasPrev ? 1 : (time - f.t0) / FOCUS_IN, goesOn ? 1 : (f.t1 - time) / FOCUS_IN)))
  return { g, pad, a }
}

/** 框 r 在滑动进度 g 时的位置：从上一组里离它最近的那个框滑过来 */
export function glideRect(R0, r, g) {
  const c = mid(r)
  const dist = (q) => Math.hypot(...mid(q).map((v, t) => v - c[t]))
  const from = R0.length ? R0.reduce((p, q) => (dist(q) < dist(p) ? q : p)) : r
  const L = (k) => from[k] + (r[k] - from[k]) * g
  return { x0: L('x0'), y0: L('y0'), x1: L('x1'), y1: L('y1') }
}

/**
 * 批注写在哪：R 是第一个目标的框，w×h 是字的大小，side 默认右边；右边出画布就改左边，左边也放不下就写下面（和目标左边对齐）。
 * 返回字的位置 (tx, ty)，箭头起点 (ax, ay)、终点 (bx, by)（指向框边），以及让箭头带一点弯的控制点 (cx, cyc)
 */
export function notePlace(R, w, h, side0) {
  const cy = (R.y0 + R.y1) / 2, gap = 26
  let side = side0 || 'r'
  if (side === 'r' && R.x1 + gap + w > 632) side = R.x0 - gap - w > 8 ? 'l' : 'b'
  let tx, ty, ax, ay, bx, by
  if (side === 'r') { tx = R.x1 + gap; ty = cy - h / 2 - 6; ax = tx - 3; ay = cy - 4; bx = R.x1 + 7; by = cy }
  else if (side === 'l') { tx = R.x0 - gap - w; ty = cy - h / 2 - 6; ax = R.x0 - gap + 3; ay = cy - 4; bx = R.x0 - 7; by = cy }
  else { tx = Math.min(632 - w, Math.max(8, R.x0)); ty = R.y1 + gap - 4; ax = tx + 14; ay = ty - 2; bx = Math.min(R.x1 - 6, tx + 8); by = R.y1 + 7 }
  return { side, tx, ty, ax, ay, bx, by, cx: (ax + bx) / 2, cyc: Math.min(ay, by) - 10 }
}

/** 批注在时刻 time 的进度：pa 箭头画到哪，pw 字写到哪，op 透明度。delay 是框滑过来的时间，框到了才开始画 */
export function noteState(f, time, delay, a, goesOn) {
  const t0 = f.t0 + delay
  const pa = clamp01((time - t0) / NOTE_ARROW)
  const write = Math.min(0.6, 0.3 + 0.04 * f.note.length)
  const pw = clamp01((time - t0 - NOTE_ARROW) / write)
  const out = goesOn ? clamp01((f.t1 - time) / NOTE_FADE) : 1
  return { pa, pw, op: Math.min(a, out) }
}

/** 箭头尖：沿最后一段的方向画两笔 */
export function arrowHead(bx, by, cx, cyc) {
  const ang = Math.atan2(by - cyc, bx - cx), L = 6
  const p1 = [bx - L * Math.cos(ang - 0.5), by - L * Math.sin(ang - 0.5)], p2 = [bx - L * Math.cos(ang + 0.5), by - L * Math.sin(ang + 0.5)]
  return 'M' + p1.join(' ') + ' L' + bx + ' ' + by + ' L' + p2.join(' ')
}

/**
 * 和 DOM 打交道的部分。env：
 * - stage：放画面层的元素；cards：DATA.cards（每帧的 html、start、states、focus、cut、screen）；beatStart：拍号 → 开始秒数
 * - FADE、POP、BLANK_FADE：播放器的换帧淡化、新元素淡入、空位淡入的时长
 * 返回 { layer(ci), frame(time, ci, step) }：frame 画出 time 时刻的画面，返回签名（导出视频时判断两帧是否相同）
 */
export function createGuide(env) {
  const { stage, cards, beatStart, FADE, POP, BLANK_FADE } = env

  // —— 画面层：每帧一个 .f，只在第一次用到时创建；帧里写了 cue 的，拍内的每个画面状态也各是一个 .f ——
  const layers = new Map()
  function mkState(c, html, at, spread) {
    const el = document.createElement('div'); el.className = 'f'; el.innerHTML = html; el.style.display = 'none'
    stage.appendChild(el)
    // 按拍填的空位（data-beat）不跟着帧一起出现，到那一拍才淡入；分镜墙上它们也带 new，这里排除
    const items = [...el.querySelectorAll('.new:not([data-beat])')]
    const span = spread ? Math.max(0.6, c.speak * 0.85) : Math.min(0.6, 0.12 * items.length)
    const fills = [...el.querySelectorAll('[data-beat]')].map((node) => ({ node, at: beatStart.get(Number(node.dataset.beat)) ?? 0 }))
    return { el, at, items: items.map((node, i) => ({ node, at: items.length > 1 ? (span * i) / items.length : 0 })), fills, pos: null, ring: null }
  }
  function layer(ci) {
    if (layers.has(ci)) return layers.get(ci)
    const c = cards[ci]
    const states = [mkState(c, c.html, c.start, c.reveal === 'spread'), ...(c.states || []).map((s) => mkState(c, s.html, s.at, false))]
    const L = { el: states[0].el, states, keyed: states.some((s) => s.el.querySelector('[data-k]')) }
    layers.set(ci, L); return L
  }

  // —— 移动要量元素在画布里的位置：用 offset（不受缩放和 translate 影响），量一次记下来 ——
  // offsetLeft 是相对上一层边框以内算的，每过一层要补上那层的边框宽（clientLeft），不然套了几层卡片就偏几像素
  function posOf(node, root) {
    let x = 0, y = 0, n = node
    while (n && n !== root) {
      x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent
      if (n && n !== root) { x += n.clientLeft; y += n.clientTop }
    }
    return { x, y, w: node.offsetWidth, h: node.offsetHeight }
  }
  function measure(st) {
    if (st.pos) return st.pos
    const hidden = st.el.style.display === 'none'
    if (hidden) { st.el.style.visibility = 'hidden'; st.el.style.display = '' }
    const pos = new Map()
    for (const node of st.el.querySelectorAll('[data-k]')) pos.set(node.dataset.k, posOf(node, st.el))
    if (hidden) { st.el.style.display = 'none'; st.el.style.visibility = '' }
    // 字体还没加载完时量的不准，下次再量
    if (document.fonts.status === 'loaded') st.pos = pos
    return pos
  }
  // 从 prev 换到 cur 的第 e（0–1）程：data-k 相同的元素从旧位置滑过来；带 data-src 的新元素从那个元素的位置滑过来
  const moved = new Set()
  function slide(prev, cur, e, sig) {
    const P = measure(prev), C = measure(cur)
    for (const node of cur.el.querySelectorAll('[data-k],[data-src]')) {
      const k = node.dataset.k
      let from = k ? P.get(k) : undefined
      if (!from && node.dataset.src && !(k && P.has(k))) from = P.get(node.dataset.src)
      const to = k ? C.get(k) : posOf(node, cur.el)
      if (!from || !to) continue
      const dx = from.x - to.x, dy = from.y - to.y
      if (Math.abs(dx) + Math.abs(dy) < 0.5) continue
      node.style.translate = (dx * (1 - e)).toFixed(1) + 'px ' + (dy * (1 - e)).toFixed(1) + 'px'
      node.style.opacity = '1'; moved.add(node); sig.push('m' + e.toFixed(3))
    }
  }

  // —— 指示框：跟着旁白走（像激光笔）。不压暗别的东西——大面积的明暗变化比目标本身更抢眼 ——
  // 聚焦框按屏幕上的实际位置量（边框、正在滑动的 translate 都算进去，框跟着元素走），再换回画布坐标
  function rectsOf(st, keys) {
    const hidden = st.el.style.display === 'none'
    if (hidden) { st.el.style.visibility = 'hidden'; st.el.style.display = '' }
    const base = st.el.getBoundingClientRect(), sc = base.width / 640 || 1
    const rs = keys.split(',').flatMap((k) => [...st.el.querySelectorAll('[data-k="' + k.trim() + '"]')])
      .map((n) => n.getBoundingClientRect())
      .map((r) => ({ x0: (r.left - base.left) / sc, y0: (r.top - base.top) / sc, x1: (r.right - base.left) / sc, y1: (r.bottom - base.top) / sc }))
    if (hidden) { st.el.style.display = 'none'; st.el.style.visibility = '' }
    return groupRects(rs)
  }
  function focusOn(st, ci, time, sig) {
    st.rings = st.rings || []
    const card = cards[ci], F = card.focus || []
    const i = F.findIndex((f) => time >= f.t0 && time < f.t1)
    const f = F[i], R = f ? rectsOf(st, f.k) : []
    while (st.rings.length < R.length) { const d = document.createElement('div'); d.className = 'fx-ring'; st.el.appendChild(d); st.rings.push(d) }
    st.rings.forEach((d, j) => { if (j >= R.length) d.style.opacity = '0' })
    if (!R.length) { noteOn(st, null, 0, 0, false, time, sig); return }
    // 前一组框：同一帧里紧挨着的上一个聚焦，或同一屏上一帧最后一个聚焦正好在这一帧开头结束
    let R0 = []
    if (i > 0 && near(F[i - 1].t1, f.t0)) R0 = rectsOf(st, F[i - 1].k)
    else if (i === 0 && ci > 0) {
      const pc = cards[ci - 1], pf = pc.focus && pc.focus[pc.focus.length - 1]
      if (pf && pc.screen === card.screen && near(pf.t1, f.t0)) R0 = rectsOf(layer(ci - 1).states[layer(ci - 1).states.length - 1], pf.k)
    }
    // 后面接着还有聚焦（同一帧或同一屏下一帧开头），这一个结束时就不淡出
    const nc = cards[ci + 1], nf = nc && nc.focus && nc.focus[0]
    const goesOn = (F[i + 1] && near(F[i + 1].t0, f.t1)) || (i === F.length - 1 && nf && nc.screen === card.screen && near(nf.t0, f.t1))
    const { g, pad, a } = focusState(f, time, R0.length > 0, goesOn)
    R.forEach((r, j) => {
      const q = glideRect(R0, r, g)
      Object.assign(st.rings[j].style, { left: q.x0 - pad + 'px', top: q.y0 - pad + 'px', width: q.x1 - q.x0 + 2 * pad + 'px', height: q.y1 - q.y0 + 2 * pad + 'px', opacity: String(a) })
    })
    sig.push('f' + i + ':' + R.length + ':' + g.toFixed(3) + ':' + pad.toFixed(2) + ':' + a.toFixed(3))
    noteOn(st, f, R0.length ? GLIDE : 0, a, goesOn, time, sig)
  }

  // —— 框旁批注：老师顺手写的一句"为什么"。框到了以后，先画一根短弯箭头指向框，再沿书写方向写出红字 ——
  function noteOn(st, f, delay, a, goesOn, time, sig) {
    if (!st.note) {
      st.note = document.createElement('div'); st.note.className = 'fx-note'; st.el.appendChild(st.note)
      st.arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); st.arrow.setAttribute('class', 'fx-arrow'); st.arrow.setAttribute('viewBox', '0 0 640 360')
      st.arrow.innerHTML = '<path class="ln" pathLength="1" stroke-dasharray="1"/><path class="hd"/>'; st.el.appendChild(st.arrow)
    }
    const note = st.note, arrow = st.arrow
    if (!f || !f.note) { note.style.opacity = '0'; arrow.style.opacity = '0'; return }
    const R = rectsOf(st, f.k.split(',')[0])[0]
    if (!R) { note.style.opacity = '0'; arrow.style.opacity = '0'; return }
    if (note.textContent !== f.note) note.textContent = f.note
    const p = notePlace(R, note.offsetWidth, note.offsetHeight, f.side)
    const { pa, pw, op } = noteState(f, time, delay, a, goesOn)
    const ln = arrow.querySelector('.ln'), hd = arrow.querySelector('.hd')
    ln.setAttribute('d', 'M' + p.ax + ' ' + p.ay + ' Q' + p.cx + ' ' + p.cyc + ' ' + p.bx + ' ' + p.by)
    ln.style.strokeDashoffset = String(1 - ease(pa))
    hd.setAttribute('d', arrowHead(p.bx, p.by, p.cx, p.cyc))
    hd.style.opacity = pa >= 1 ? '1' : '0'
    arrow.style.opacity = String(op)
    Object.assign(note.style, { left: p.tx + 'px', top: p.ty + 'px', opacity: String(op), clipPath: 'inset(0 ' + ((1 - ease(pw)) * 100).toFixed(1) + '% 0 0)' })
    sig.push('n' + pa.toFixed(2) + ':' + pw.toFixed(2) + ':' + op.toFixed(2))
  }

  // —— 画出 time 时刻的画面（第 ci 帧，step 是这一刻所在的段）——
  let shown = []
  function frame(time, ci, step) {
    const sig = []
    const card = cards[ci], L = layer(ci)
    let sk = 0
    while (sk + 1 < L.states.length && L.states[sk + 1].at <= time) sk++
    const cur = L.states[sk], local = time - cur.at
    // 前一个画面：同一帧的上一个状态（拍内换状态，直接换、元素滑过去），或上一帧的最后一个状态（换帧）。
    // 练习暂停时时钟停在暂停帧的第一刻：它不做淡入，直接显示（卡上作答就在这一帧上，淡入会停在全透明）
    let prev = null, fade = false
    if (sk > 0) prev = L.states[sk - 1]
    else if (ci > 0 && step.k !== 'pause') {
      const P = layer(ci - 1)
      prev = P.states[P.states.length - 1]
      // 同一屏里、两帧都有带名字的元素：不交叉淡化，直接换，元素滑过去（读头、栈连续地动）；否则照旧淡化；cut 的帧（闪回）也淡化
      fade = card.cut || !(L.keyed && P.keyed && cards[ci - 1].screen === card.screen)
    }
    const vis = [cur]; if (prev && fade && local < FADE) vis.push(prev)
    for (const s of shown) if (!vis.includes(s)) s.el.style.display = 'none'
    shown = vis
    for (const node of moved) { node.style.translate = ''; node.style.opacity = '' }
    moved.clear()
    cur.el.style.display = ''; cur.el.style.opacity = fade ? String(ease(local / FADE)) : '1'; cur.el.style.zIndex = '2'
    // 上一个画面里就有的元素（同名）不算新出现：不淡入
    const had = prev && !fade ? measure(prev) : null
    for (const it of cur.items) {
      if (had && it.node.dataset.k && had.has(it.node.dataset.k)) { it.node.style.opacity = ''; it.node.style.translate = ''; continue }
      const e = ease((local - it.at) / POP)
      // data-from：从这个透明度亮起来，原地变亮不上移（"由淡变亮"）；没有就从 0 淡入加上移
      const from = parseFloat(it.node.dataset.from ?? '0')
      sig.push(e.toFixed(3)); it.node.style.opacity = String(from + (1 - from) * e)
      it.node.style.translate = e < 1 && !it.node.dataset.from ? '0 ' + ((1 - e) * 8).toFixed(1) + 'px' : ''
    }
    for (const it of cur.fills) {
      const e = Math.max(0, Math.min(1, (time - it.at) / BLANK_FADE))
      sig.push('b' + e.toFixed(3)); it.node.style.opacity = String(e)
    }
    if (prev && !fade && local < MOVE) slide(prev, cur, ease(local / MOVE), sig)
    sig.unshift(ci, sk, cur.el.style.opacity)
    if (vis.length > 1) { sig.push('p'); prev.el.style.display = ''; prev.el.style.opacity = String(1 - ease(local / FADE)); prev.el.style.zIndex = '1' }
    focusOn(cur, ci, time, sig)
    return sig
  }

  return { layer, frame }
}
