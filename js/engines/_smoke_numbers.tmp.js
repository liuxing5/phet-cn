/* 临时冒烟测试：模拟环境跑通 numbers.js 全部 18 种模式。验证后即删除。 */
'use strict';

/* ---------- 浏览器全局桩（numbers.js 顶层依赖 window） ---------- */
globalThis.window = globalThis;

/* ---------- ctx 桩 ---------- */
function makeCtx() {
  const calls = { count: 0 };
  const grad = { addColorStop: () => {} };
  const noopNames = ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'fill',
    'stroke', 'clip', 'arc', 'arcTo', 'rect', 'roundRect', 'setLineDash', 'translate', 'rotate',
    'scale', 'transform', 'bezierCurveTo', 'quadraticCurveTo', 'ellipse', 'clearRect', 'drawImage'];
  noopNames.forEach(n => { calls[n] = () => { calls.count++; }; });
  return new Proxy(calls, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'measureText') return (s) => ({ width: String(s == null ? '' : s).length * 7 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => grad;
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

/* ---------- Kit 桩 ---------- */
const COLORS = { red: '#ff6b6b', blue: '#7fb2ff', green: '#63e2a5', orange: '#ffa940', purple: '#b37feb',
  teal: '#3fb8af', pink: '#ffb6d9', yellow: '#ffe58f', gray: '#9aa3b0', dark: '#20242f',
  light: '#f2f5fa', white: '#ffffff', sky: '#8fd3ff', ground: '#4a7f4a' };

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
window.Kit = {
  COLORS,
  rgba(hex, a = 1) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; },
  clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },
  lerp(a, b, k) { return a + (b - a) * k; },
  fmt(v, d = 1) {
    if (typeof v !== 'number' || !isFinite(v)) return '--';
    let s = v.toFixed(Math.max(0, d | 0));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return parseFloat(s) === 0 ? '0' : s;
  },
  roundRect,
  panel(ctx, x, y, w, h, opt = {}) {
    roundRect(ctx, x, y, w, h, opt.radius == null ? 10 : opt.radius);
    if (opt.fill) { ctx.fillStyle = opt.fill; ctx.fill(); }
    if (opt.stroke) { ctx.strokeStyle = opt.stroke; ctx.lineWidth = opt.lineWidth || 1; ctx.stroke(); }
  },
  circle(ctx, x, y, r, opt = {}) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0), 0, Math.PI * 2); ctx.closePath();
    if (opt.fill) { ctx.fillStyle = opt.fill; ctx.fill(); }
    if (opt.stroke) { ctx.strokeStyle = opt.stroke; ctx.lineWidth = opt.lineWidth || 1; ctx.stroke(); }
  },
  arrow(ctx, x1, y1, x2, y2, opt = {}) { void opt; ctx.save(); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); },
  dashLine(ctx, x1, y1, x2, y2, dash = [4, 4], color = '#fff', width = 1) { void dash; ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); },
  polyline(ctx, pts, opt = {}) { void opt; ctx.save(); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); if (opt.closed) ctx.closePath(); ctx.stroke(); ctx.restore(); },
  label(ctx, text, x, y, opt = {}) { void opt; ctx.fillText(String(text), x, y); },
  chip(ctx, text, x, y, opt = {}) {
    void opt;
    const w = String(text).length * 7 + 12, h = (opt && opt.size || 12) + 12;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    return w;
  },
  grid() {}, axes() {},
  view(v) {
    const X = x => { const [a, b] = v.px, [c, d] = v.x; return a + (x - c) / ((d - c) || 1) * (b - a); };
    const Y = y => v.py ? v.py[0] + (y - v.y[0]) / ((v.y[1] - v.y[0]) || 1) * (v.py[1] - v.py[0]) : 0;
    const XI = p => v.x[0] + (p - v.px[0]) / ((v.px[1] - v.px[0]) || 1) * (v.x[1] - v.x[0]);
    return { X, Y, XI, YI: p => 0 };
  },
  ticks(min, max, n) {
    n = n || 5;
    const span = (max - min) / n;
    const out = [];
    for (let i = 0; i <= n; i++) out.push(min + span * i);
    return out;
  },
  rng(seed) { let a = seed >>> 0; return function () { let t = (a += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  background(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2036'); g.addColorStop(1, '#11141f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
};
void COLORS;

/* ---------- EngineRegistry 桩 ---------- */
window.EngineRegistry = (() => {
  const factories = {};
  return {
    register(name, def) { factories[name] = def; },
    has(name) { return !!factories[name]; },
    build(cfg) { return factories[cfg.engine].create(Object.assign({}, cfg)); }
  };
})();

/* ---------- loader 桩 ---------- */
let toastLog = [];
function makeLoader() {
  return {
    setKnowledge(html) { this._know = html; },
    setPresets(list) { this._presets = list; },
    updateDataDisplay(rows) { this._rows = rows; },
    showToast(msg) { toastLog.push(String(msg)); }
  };
}

/* ---------- 加载被测引擎 ---------- */
require('./numbers.js');
if (!window.EngineRegistry.has('numbers')) throw new Error('引擎未注册！');

const MODE_LIST = ['arithmetic', 'make-ten', 'numcompare', 'numplay', 'numpairs', 'nlint', 'nldist',
  'nlops', 'ratioxy', 'unitrate', 'proppl', 'fracintro', 'fraceq', 'fracmixed', 'fracmatch',
  'buildfrac', 'quadshape', 'areabuild'];

/* 驱动一个模式完整生命周期 */
function driveMode(mode) {
  const inst = window.EngineRegistry.build({ engine: 'numbers', mode, id: mode });
  for (const k of ['init', 'getControls', 'update', 'render', 'reset']) {
    if (typeof inst[k] !== 'function') throw new Error(`缺少方法 ${k}`);
  }
  const loader = makeLoader();
  inst.init(loader);
  if (!/<h4>/.test(loader._know || '')) throw new Error('知识卡缺失');

  const W = 900, H = 520, ctx = makeCtx();
  /* 控件遍历：button 执行、slider/select/checkbox onChange */
  const ctrls1 = inst.getControls();
  ctrls1.forEach(c => {
    if (c.type === 'button') c.action();
    else if (c.type === 'slider') c.onChange(c.min != null ? (c.min + (c.max != null ? c.max : c.min)) / 2 : 0);
    else if (c.type === 'select') c.onChange((c.options[0] || {}).value);
    else if (c.type === 'checkbox') c.onChange(!c.value);
  });

  /* 更新+渲染多帧 */
  let t = 0;
  for (let f = 0; f < 240; f++) { t += 0.033; inst.update(0.033, t); inst.render(ctx, W, H, t); }
  if (ctx.count < 50) throw new Error('渲染指令过少，疑似空白画面');

  /* 网格点击扫描：命中每个注册热区 */
  inst.render(ctx, W, H, 0);
  const step = 26;
  let hits = 0;
  for (let py = 10; py < H; py += step) {
    for (let px = 10; px < W; px += step) {
      inst.onPointerDown(px, py, { button: 0 });
      hits++;
    }
  }
  /* 拖拽事件流（quadshape 等） */
  inst.onPointerMove(W / 2, H / 2, {});
  inst.onPointerUp(W / 2, H / 2, {});

  /* 中途控件再来一轮 */
  inst.getControls().forEach(c => { if (c.type === 'button') c.action(); });
  for (let f = 0; f < 60; f++) inst.update(0.05, t += 0.05);

  /* presets 应用 */
  (loader._presets || []).forEach(p => { if (!p.name || typeof p.apply !== 'function') throw new Error('preset 结构非法'); p.apply(); });
  /* reset 与收尾渲染 */
  inst.reset();
  (loader._presets || []).forEach(p => p.apply());
  for (let f = 0; f < 30; f++) { inst.update(0.02, t += 0.02); inst.render(ctx, W, H, t); }

  /* 数据行结构校验 */
  inst.update(0.016, t += 0.016);
  (loader._rows || []).forEach(r => {
    if (typeof r.label !== 'string' || !('value' in r)) throw new Error('数据行缺字段');
  });
  return { controls: ctrls1.length, presets: (loader._presets || []).length, rows: (loader._rows || []).length };
}

let pass = 0;
for (const m of MODE_LIST) {
  try {
    const info = driveMode(m);
    console.log(`  ✅ ${m.padEnd(11)} 控件${info.controls} 预设${info.presets} 数据行${info.rows}`);
    pass++;
  } catch (err) {
    console.error(`  ❌ ${m}: ${err.message}\n${err.stack.split('\n').slice(1, 4).join('\n')}`);
    process.exitCode = 1;
  }
}
console.log(`\n冒烟结果：${pass}/${MODE_LIST.length} 模式通过；toast 总量 ${toastLog.length} 条（无异常弹出视为正常）`);
