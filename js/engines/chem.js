/**
 * 化学 / 原子物理 引擎（工厂注册名：'chem'）
 * 覆盖 19 种模式 / 20 个实验 ID：
 *   浓度 / 摩尔浓度 / pH值 / pH基础 / 酸碱溶液 / 比尔定律 /
 *   配平方程式 / 反应物产物剩余 / 构建原子 / 构建原子核 / 同位素 /
 *   卢瑟福散射 / 氢原子模型 / 量子硬币 / 量子测量 / 分子与光 /
 *   分子形状(+基础) / 分子极性 / 构建分子
 * 契约：顶层仅注册工厂，不触碰 document；运行期通过 loader 与画布交互。
 */
(function () {
'use strict';

/* ============================================================
 * 一、通用工具（对 Kit 的安全兜底：缺什么用原生实现补）
 * ============================================================ */
var KIT = function () { return (typeof window !== 'undefined' && window.Kit) ? window.Kit : null; };

/* 移动端降级：平台 Mobile 对象缺失时按桌面端原值处理（行为不变） */
var MOB = function () { return (typeof window !== 'undefined' && window.Mobile) ? window.Mobile : null; };
function mobReduce(n) { var M = MOB(); return M && typeof M.reduceParticleCount === 'function' ? M.reduceParticleCount(n) : n; }
function mobPS() { var M = MOB(); return M && typeof M.particleScale === 'number' ? M.particleScale : 1; }

var FB_COLORS = {
    red:'#e74c3c', blue:'#3498db', green:'#27ae60', orange:'#f39c12',
    purple:'#8e44ad', teal:'#16a085', pink:'#fd79a8', yellow:'#f1c40f',
    gray:'#95a5a6', dark:'#2c3e50', light:'#ecf0f1', white:'#ffffff',
    sky:'#dff3ff', ground:'#f4efe6'
};
function COL(name) {
    var k = KIT();
    return (k && k.COLORS && k.COLORS[name]) || FB_COLORS[name] || '#8899aa';
}
function CLAMP(v, a, b) { if (v < a) return a; if (v > b) return b; return v; }
function LERP(a, b, t) { return a + (b - a) * t; }
function FMT(v, d) {
    if (!isFinite(v)) return '∞';
    var s = Number(v).toFixed(d === undefined ? 2 : d);
    if (parseFloat(s) === 0) s = (0).toFixed(d === undefined ? 2 : d);
    return s;
}
function RGBA(hex, a) {
    if (/^(rgb|hsl)a?\(/.test(hex)) return hex.replace(/\)\s*$/, ',' + a + ')');
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function HEX2RGB(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return [136, 136, 136];
    var n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
}
function MIX(h1, h2, t) {
    t = CLAMP(t, 0, 1);
    var a = HEX2RGB(h1), b = HEX2RGB(h2);
    var r = Math.round(LERP(a[0], b[0], t)), g = Math.round(LERP(a[1], b[1], t)), bl = Math.round(LERP(a[2], b[2], t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}
function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
}
function makeRng(seed) {
    var k = KIT();
    if (k && typeof k.rng === 'function') { try { return k.rng(seed); } catch (e) {} }
    var s = (seed >>> 0) || 1;
    return function () {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        var t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/* 波长(nm)→近似 RGB（分段插值即可满足教学展示） */
function WCOL(lam) {
    var r = 0, g = 0, b = 0;
    if (lam < 380) return '#3a0ca3';
    if (lam > 750) return '#3d0000';
    if (lam < 440) { r = -(lam - 440) / 60; b = 1; }
    else if (lam < 490) { g = (lam - 440) / 50; b = 1; }
    else if (lam < 510) { g = 1; b = -(lam - 510) / 20; }
    else if (lam < 580) { r = (lam - 510) / 70; g = 1; }
    else if (lam < 645) { r = 1; g = -(lam - 645) / 65; }
    else { r = 1; }
    var f = 1;
    if (lam < 420) f = 0.35 + 0.65 * (lam - 380) / 40;
    else if (lam > 700) f = 0.35 + 0.65 * (750 - lam) / 50;
    var c = function (x) { return Math.round(255 * CLAMP(x, 0, 1) * f); };
    return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1);
}
function PH2C(pH) {
    var hue = pH <= 7 ? LERP(0, 90, pH / 7) : LERP(90, 285, (pH - 7) / 7);
    return 'hsl(' + hue.toFixed(1) + ',78%,52%)';
}
var SUP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻' };
var SUB = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
function sup(n) { return String(n).split('').map(function (c) { return SUP[c] || c; }).join(''); }
function sub(n) { return String(n).split('').map(function (c) { return SUB[c] || c; }).join(''); }

/* ---------- 原生 canvas 绘制助手 ---------- */
function RR(g, x, y, w, h, r) {
    r = Math.min(r || 8, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}
function TXT(g, s, x, y, o) {
    o = o || {};
    g.save();
    g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    g.fillStyle = o.color || '#334155';
    g.font = (o.weight || '') + ' ' + (o.size || 14) + 'px "Microsoft YaHei","PingFang SC",sans-serif'.replace(/^\s/, '');
    g.textAlign = o.align || 'left';
    g.textBaseline = o.baseline || 'alphabetic';
    g.fillText(s, x, y);
    g.restore();
}
function PANEL(g, x, y, w, h, o) {
    o = o || {};
    RR(g, x, y, w, h, o.r === undefined ? 12 : o.r);
    g.fillStyle = o.fill || 'rgba(255,255,255,0.92)';
    g.fill();
    if (o.stroke !== false) { g.strokeStyle = o.strokeC || '#dbe4ef'; g.lineWidth = 1.5; g.stroke(); }
    if (o.title) TXT(g, o.title, x + 12, y + 22, { size: 13, weight: 'bold', color: '#475569' });
}
function PILL(g, x, y, text, fg, bg, size) {
    size = size || 12;
    g.save();
    g.font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif';
    var w = g.measureText(text).width + 16;
    RR(g, x, y, w, size + 10, (size + 10) / 2);
    g.fillStyle = bg || 'rgba(39,174,96,0.15)';
    g.fill();
    TXT(g, text, x + 8, y + size + 4, { size: size, weight: 'bold', color: fg || '#27ae60' });
    g.restore();
    return w;
}
/* 可拖拽元素提示标签（只读绘制，不改变任何状态） */
function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var w=ctx.measureText(text).width+12; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-w/2, y-11, w, 22); ctx.fillStyle='#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }
function CIRC(g, x, y, r, fill, stroke, lw) {
    g.beginPath(); g.arc(x, y, Math.max(r, 0.1), 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); }
}
function LINE(g, x1, y1, x2, y2, color, w, cap) {
    g.save(); g.strokeStyle = color; g.lineWidth = w || 2;
    g.lineCap = cap || 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
}
function DASHLN(g, x1, y1, x2, y2, color, w, dash) {
    g.save(); g.setLineDash(dash || [6, 5]); LINE(g, x1, y1, x2, y2, color, w || 1.5); g.restore();
}
function ARROW(g, x1, y1, x2, y2, color, w) {
    var ang = Math.atan2(y2 - y1, x2 - x1), hl = 9 + (w || 2) * 2;
    LINE(g, x1, y1, x2, y2, color, w || 2);
    g.save(); g.fillStyle = color; g.translate(x2, y2); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-hl, -hl * 0.55); g.lineTo(-hl, hl * 0.55); g.closePath(); g.fill();
    g.restore();
}
/* 度数弧线指示（偏振盘） */
function ARCdeg(g, cx, cy, r, deg) {
    var rad = deg * Math.PI / 180;
    g.save(); g.strokeStyle = 'rgba(148,163,184,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    DASHLN(g, cx - Math.cos(rad) * r, cy + Math.sin(rad) * r, cx + Math.cos(rad) * r, cy - Math.sin(rad) * r, '#60a5fa', 1.2);
    CIRC(g, cx + Math.cos(rad) * r, cy - Math.sin(rad) * r, 3.5, '#1d4ed8');
    g.restore();
}
/* 竖直强度条组 */
function bars(g, x, y, arr, maxH) {
    var bwid = 26;
    arr.forEach(function (b, i) {
        var h = CLAMP(b[1] / 100, 0, 1) * maxH;
        RR(g, x + i * (bwid + 14), y + maxH - h, bwid, h, 4);
        g.fillStyle = b[2]; g.fill();
        TXT(g, b[0], x + i * (bwid + 14) + bwid / 2, y + maxH + 14, { align: 'center', size: 11, color: '#475569' });
        TXT(g, FMT(b[1], 0), x + i * (bwid + 14) + bwid / 2, y + maxH - h - 5, { align: 'center', size: 10, color: b[2] });
    });
}
function BG(g, W, H) {
    var k = KIT();
    if (k && typeof k.background === 'function') { try { k.background(g, W, H); return; } catch (e) {} }
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#fbfcfe'); gr.addColorStop(1, '#eef2f7');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
/* 彩带粒子（短动画共用） */
function CONFspawn(S, n, cx, cy) {
    var cols = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
    for (var i = 0; i < n; i++) S.confetti.push({
        x: cx, y: cy, vx: (Math.random() - 0.5) * 420, vy: -260 - Math.random() * 260,
        c: cols[i % cols.length], life: 1.1 + Math.random() * 0.5, r: 3 + Math.random() * 4
    });
}
function CONFstep(S, dt) {
    if (!S.confetti || !S.confetti.length) return;
    for (var i = S.confetti.length - 1; i >= 0; i--) {
        var p = S.confetti[i];
        p.vy += 620 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) S.confetti.splice(i, 1);
    }
}
function CONFdraw(g, S) {
    if (!S.confetti) return;
    for (var i = 0; i < S.confetti.length; i++) {
        var p = S.confetti[i];
        g.save(); g.globalAlpha = CLAMP(p.life, 0, 1);
        g.translate(p.x, p.y); g.rotate(p.x * 0.05);
        g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        g.restore();
    }
}

/* ============================================================
 * 二、领域数据表
 * ============================================================ */
var ELEMENTS = [
    ['氢','H',1],['氦','He',4],['锂','Li',7],['铍','Be',9],['硼','B',11],['碳','C',12],
    ['氮','N',14],['氧','O',16],['氟','F',19],['氖','Ne',20],['钠','Na',23],['镁','Mg',24],
    ['铝','Al',27],['硅','Si',28],['磷','P',31],['硫','S',32],['氯','Cl',35.5],['氩','Ar',40]
];
var EQS = [
    { name: '水分解/合成', txt: 'H₂ + O₂ → H₂O', el: [{ H:2 },{ O:2 }, { H:2, O:1 }], ans: [2, 1, 2], lab: ['H₂', 'O₂', 'H₂O'] },
    { name: '合成氨', txt: 'N₂ + H₂ → NH₃', el: [{ N:2 },{ H:2 }, { N:1, H:3 }], ans: [1, 3, 2], lab: ['N₂', 'H₂', 'NH₃'] },
    { name: '天然气燃烧', txt: 'CH₄ + O₂ → CO₂ + H₂O', el: [{ C:1,H:4 },{ O:2 }, { C:1,O:2 },{ H:2,O:1 }], ans: [1, 2, 1, 2], lab: ['CH₄', 'O₂', 'CO₂', 'H₂O'] },
    { name: '铁生锈', txt: 'Fe + O₂ → Fe₂O₃', el: [{ Fe:1 },{ O:2 }, { Fe:2, O:3 }], ans: [4, 3, 2], lab: ['Fe', 'O₂', 'Fe₂O₃'] },
    { name: '自定义挑战', txt: 'C₂H₆ + O₂ → CO₂ + H₂O', el: [{ C:2,H:6 },{ O:2 }, { C:1,O:2 },{ H:2,O:1 }], ans: [2, 7, 4, 6], lab: ['C₂H₆', 'O₂', 'CO₂', 'H₂O'] }
];
var RECIPES = [
    { name: '三明治', items: [['🍞 面包', '面包', 2], ['🧀 奶酪', '奶酪', 1], ['🍖 火腿', '火腿', 1]], prod: ['🥪 三明治', '三明治', 1], emo: { 面包:'🍞', 奶酪:'🧀', 火腿:'🍖', 三明治:'🥪' } },
    { name: '汉堡', items: [['🍞 面包坯', '面包坯', 1], ['🥩 肉饼', '肉饼', 1], ['🥬 生菜', '生菜', 1], ['🍯 酱料', '酱料', 1]], prod: ['🍔 汉堡', '汉堡', 1], emo: { 面包坯:'🍞', 肉饼:'🥩', 生菜:'🥬', 酱料:'🍯', 汉堡:'🍔' } },
    { name: '鲜榨果汁', items: [['🍎 苹果', '苹果', 3]], prod: ['🧃 果汁', '果汁', 1], emo: { 苹果:'🍎', 果汁:'🧃' } }
];
var ISO_ELEMS = [
    { name: '碳', iso: [['碳-12', 12.0, 98.93], ['碳-13', 13.003, 1.07]], col: ['#16a085', '#8e44ad'] },
    { name: '氯', iso: [['氯-35', 34.97, 75.78], ['氯-37', 36.97, 24.22]], col: ['#16a085', '#e67e22'] },
    { name: '氢', iso: [['氕(¹H)', 1.008, 99.985], ['氘(²H)', 2.014, 0.015]], col: ['#16a085', '#e74c3c'] }
];
var VSEPR = {
    '2-0': ['直线形', 180],
    '3-0': ['平面三角形', 120], '3-1': ['V形(弯曲)', 119],
    '4-0': ['四面体', 109.5], '4-1': ['三角锥', 107], '4-2': ['V形', 104.5],
    '5-0': ['三角双锥', 90], '5-1': ['跷跷板形', 90], '5-2': ['T形', 90], '5-3': ['直线形', 180],
    '6-0': ['八面体', 90], '6-1': ['四方锥', 90], '6-2': ['平面四方形', 90]
};
var MOLS_IR = [
    { name: 'CO₂', atoms: [['O',-52,0],['C',0,0],['O',52,0]], bonds: [[0,1],[1,2]],
      modes: [[667, '弯曲振动'], [2350, '不对称伸缩']] },
    { name: 'H₂O', atoms: [['O',0,-8],['H',-46,26],['H',46,26]], bonds: [[0,1],[0,2]],
      modes: [[1595, '弯曲振动'], [3650, '对称伸缩']] },
    { name: 'CH₄', atoms: [['C',0,0],['H',0,-52],['H',50,17],['H',-50,17],['H',0,52]], bonds: [[0,1],[0,2],[0,3],[0,4]],
      modes: [[1306, '弯曲振动'], [3010, '对称伸缩']] }
];
var KNOWN_MOL = [
    ['H₂O', '水', { H:2, O:1 }], ['CO₂', '二氧化碳', { C:1, O:2 }], ['O₂', '氧气', { O:2 }],
    ['CH₄', '甲烷', { C:1, H:4 }], ['NH₃', '氨气', { N:1, H:3 }], ['C₂H₆', '乙烷', { C:2, H:6 }],
    ['CH₂O', '甲醛', { C:1, H:2, O:1 }], ['HCN', '氰化氢', { H:1, C:1, N:1 }]
];
var RYD = 1.097e-2; /* nm⁻¹ */
function rydLam(ni, nf) { return 1 / (RYD * (1 / (nf * nf) - 1 / (ni * ni))); }
/* 素材坐标转换 */
function mkView(minX, maxX, minY, maxY, mx, my, W, H) {
    var x0 = mx || 54, y0 = my || 40;
    return {
        X: function (x) { return x0 + (x - minX) / (maxX - minX) * (W - x0 * 2); },
        Y: function (y) { return H - y0 - (y - minY) / (maxY - minY) * (H - y0 * 2); }
    };
}

/* ============================================================
 * 三、各模式默认状态
 * ============================================================ */
var MODES = {
    concentration: { spoons: 1, sol: '白糖', V: 0.5, evap: false, cryKey: '', cryPts: [] },
    molarity: { mol: 0.4, V: 0.5 },
    phscale: { solKey: '自来水', fine: 0, drops: 0, dropMode: '酸', drip: 0 },
    phscaleBasics: { pH: 7 },
    acidbase: { C: 0.1, Kai: -3 },
    beers: { lam: 530, c: 0.20, l: 1.0 },
    eqbalance: { eqi: 0, coef: [0, 0, 0], msg: '', checked: false, confetti: [] },
    leftovers: { ri: 0, cnt: [2, 1, 1] },
    buildatom: { P: 6, N: 6, E: 6, sh: [0, 0, 0], showQ: true, showM: true },
    nucleus: { P: 6, N: 6 },
    isotopes: { ei: 0, p1: 98.93 },
    rutherford: { model: '核式', spd: 1.5, trails: true, total: 0, big: 0 },
    hydrogenatom: { ni: 2, wave: 656, auto: true, eAng: 0, dwell: 0, wobble: 0, ions: 0, lines: [], rays: [], lineMemo: {}, pht: [] },
    quantumtoss: { spin: false, rot: 0, face: null, n: 0, h: 0, hist: [], batch: 0 },
    quantmeas: { th1: 45, th2: 45, em: 0, p1c: 0, p2c: 0, phots: [] },
    molight: { mi: 0, nu: 667, vib: 0, hit: false, auto: true, rays: [] },
    molshapes: { lig: 4, lone: 0 },
    molpolarity: { xa: 2.20, xb: 3.44, band: true },
    buildmol: { atoms: [{ el: 'O', x: 340, y: 200 }, { el: 'H', x: 260, y: 265 }, { el: 'H', x: 420, y: 265 }], bonds: [[0, 1], [0, 2]], del: false, drag: -1, saved: [] }
};

/* 实验ID → 模式（覆盖平台 chemistry 分类里的 20 个 ID） */
var ID2MODE = {
    'concentration': 'concentration', 'molarity': 'molarity',
    'ph-scale': 'phscale', 'ph-scale-basics': 'phscaleBasics',
    'acid-base-solutions': 'acidbase', 'beers-law-lab': 'beers',
    'balancing-chemical-equations': 'eqbalance', 'reactants-products-leftovers': 'leftovers',
    'build-atom': 'buildatom', 'build-a-nucleus': 'nucleus', 'build-nucleus': 'nucleus',
    'isotopes-and-atomic-mass': 'isotopes', 'isotopes-atomic-mass': 'isotopes',
    'rutherford-scattering': 'rutherford', 'models-of-hydrogen-atom': 'hydrogenatom',
    'models-of-the-hydrogen-atom': 'hydrogenatom',
    'quantum-coin-toss': 'quantumtoss', 'quantum-measurement': 'quantmeas',
    'molecules-and-light': 'molight', 'molecules-light': 'molight',
    'molecule-shapes': 'molshapes', 'molecule-shapes-basics': 'molshapes',
    'molecule-polarity': 'molpolarity',
    'build-a-molecule': 'buildmol', 'build-molecule': 'buildmol'
};

/* ============================================================
 * 四、共享受控构造器
 * ============================================================ */
function SL(id, label, min, max, step, value, unit, fn) { return { type: 'slider', id: id, label: label, min: min, max: max, step: step, value: value, unit: unit || '', onChange: fn }; }
function SEL(id, label, opts, value, fn) { return { type: 'select', id: id, label: label, options: opts.map(function (o) { return { value: o[0], label: o[1] }; }), value: value, onChange: fn }; }
function CK(id, label, value, fn) { return { type: 'checkbox', id: id, label: label, value: value, onChange: fn }; }
function BTN(id, label, act) { return { type: 'button', id: id, label: label, action: act }; }

/* ============================================================
 * 五、共享场景绘制
 * ============================================================ */
function beakerRect(W, H, wf, hf) {
    var bw = Math.min(W * (wf || 0.42), 430), bh = Math.min(H * (hf || 0.62), 330);
    return { bx: W * 0.5 - bw / 2, by: H * 0.52 - bh * 0.38, bw: bw, bh: bh };
}
/* 烧杯剖面：R=beakerRect 输出; lvl 为液位比例; color 液体色; opt 可选溶质名/体积文本/晶体点/粒子列表 */
function drawBeaker(g, R, lvl, color, opt) {
    opt = opt || {};
    var bx = R.bx, by = R.by, bw = R.bw, bh = R.bh;
    var wall = 9, top = by + 20, bot = by + bh - 12, ix = bx + wall, iw = bw - wall * 2;
    /* 晶体（确定性摆放） */
    if (opt.crystals && opt.crystals.length) {
        for (var ci = 0; ci < opt.crystals.length; ci++) {
            var cp = opt.crystals[ci];
            g.save(); g.translate(ix + cp[0] * iw, bot - 3 - cp[2]); g.rotate(cp[3]);
            g.fillStyle = 'rgba(230,232,240,0.95)'; g.strokeStyle = '#b8c2cf'; g.lineWidth = 1;
            g.fillRect(-cp[1] / 2, -cp[1] / 2, cp[1], cp[1]); g.strokeRect(-cp[1] / 2, -cp[1] / 2, cp[1], cp[1]);
            g.restore();
        }
    }
    /* 液体（裁剪内腔） */
    var lh = (bot - top) * CLAMP(lvl, 0, 1);
    g.save();
    RR(g, ix, top, iw, bot - top, 4); g.clip();
    var grad = g.createLinearGradient(0, bot - lh, 0, bot);
    grad.addColorStop(0, RGBA(color, 0.82)); grad.addColorStop(1, RGBA(MIX(color, '#000000', 0.25), 0.92));
    g.fillStyle = grad; g.fillRect(ix, bot - lh, iw, lh);
    if (lh > 4) { /* 液面高光 */
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.ellipse(ix + iw / 2, bot - lh, iw * 0.47, 5, 0, 0, Math.PI * 2); g.fill();
    }
    if (opt.swimmers) { /* 电离小球等自由粒子 */
        for (var si = 0; si < opt.swimmers.length; si++) opt.swimmers[si](g);
    }
    g.restore();
    /* 杯壁 */
    g.save();
    g.strokeStyle = 'rgba(125,150,175,0.9)'; g.lineWidth = wall; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx + wall / 2, top - 14); g.lineTo(bx + wall / 2, bot - 10);
    g.quadraticCurveTo(bx + wall / 2, bot - wall / 2, bx + 16, bot - wall / 2);
    g.lineTo(bx + bw - 16, bot - wall / 2);
    g.quadraticCurveTo(bx + bw - wall / 2, bot - wall / 2, bx + bw - wall / 2, bot - 10);
    g.lineTo(bx + bw - wall / 2, top - 14); g.stroke();
    g.restore();
    if (opt.volText) TXT(g, opt.volText, bx + bw / 2, by + bh + 16, { align: 'center', size: 13, color: '#64748b' });
}
function bulbs(g, x, y, bright) { /* 电导率灯泡 */
    var br = CLAMP(bright, 0, 1);
    CIRC(g, x, y, 26, '#fdf6d8', '#94a3b8', 2.5);
    if (br > 0.02) {
        g.save(); g.globalAlpha = br;
        for (var i = 0; i < 8; i++) {
            var an = i / 8 * Math.PI * 2;
            LINE(g, x + Math.cos(an) * 30, y + Math.sin(an) * 30, x + Math.cos(an) * (36 + br * 14), y + Math.sin(an) * (36 + br * 14), '#f59e0b', 3);
        }
        g.restore();
        CIRC(g, x, y, 22, RGBA('#fde047', 0.35 + 0.6 * br));
    }
    LINE(g, x - 6, y - 10, x + 6, y, '#78716c', 2); LINE(g, x + 6, y, x - 6, y + 10, '#78716c', 2);
}
function elemIcon(g, x, y, r, color, sym, tsize) {
    CIRC(g, x, y, r, color, 'rgba(0,0,0,0.25)', 1.5);
    if (sym) TXT(g, sym, x, y + (tsize || 12) * 0.36, { align: 'center', size: tsize || 12, weight: 'bold', color: '#fff' });
}

/* ============================================================
 * 六、模式实现 IMPL[mode] = { know, presets, controls, update, draw, data, pt }
 * ============================================================ */
var SOLUTES = {
    '白糖': { csat: 1.2, per: 0.2, color: '#c9a84c' },
    '碳酸钠': { csat: 0.7, per: 0.106, color: '#7c5cd6' }
};

var IMPL = {

/* ---------- 1 concentration 浓度 ---------- */
concentration: {
    know: '<p><strong>浓度</strong> c = m ÷ V，单位 mol/L。搅拌溶解的溶质有限度——超过溶解度后会<strong>析出晶体</strong>。蒸发溶剂时浓度上升，可能再次析出。</p>',
    presets: function (S) {
        return [
            { name: '一杯清水', apply: function () { S.spoons = 0; S.evap = false; } },
            { name: '饱和糖水', apply: function () { S.sol = '白糖'; S.spoons = 5; } },
            { name: '过饱和析出', apply: function () { S.sol = '碳酸钠'; S.spoons = 4; S.V = 0.25; } }
        ];
    },
    controls: function (S) {
        return [
            SL('cc_sp', '溶质勺数', 0, 5, 0.5, S.spoons, '勺', function (v) { S.spoons = v; }),
            SEL('cc_so', '物种', [['白糖', '白糖'], ['碳酸钠', '碳酸钠']], S.sol, function (v) { S.sol = v; }),
            CK('cc_ev', '蒸发中（水面缓降）', S.evap, function (v) { S.evap = v; }),
            BTN('cc_aw', '加水（恢复水位）', function () { S.V = 0.5; })
        ];
    },
    update: function (S, dt) {
        if (S.evap) S.V = Math.max(0.12, S.V - dt * 0.02);
        /* 晶体确定摆放缓存 */
        var st = SOLUTES[S.sol];
        var total = S.spoons * st.per;
        var diss = Math.min(total, st.csat * S.V);
        var key = S.sol + '|' + FMT(total, 2) + '|' + FMT(S.V, 2);
        if (key !== S.cryKey) {
            S.cryKey = key; S.cryPts = [];
            var undiss = Math.max(0, total - diss), n = Math.floor(undiss / 0.04);
            var rnd = makeRng(hashStr(key));
            for (var i = 0; i < Math.min(n, mobReduce(220)); i++) {
                S.cryPts.push([rnd(), 3 + rnd() * 5, rnd() * 12, rnd() * Math.PI]);
            }
        }
    },
    draw: function (g, S, W, H, t) {
        var st = SOLUTES[S.sol];
        var total = S.spoons * st.per, diss = Math.min(total, st.csat * S.V);
        var c = diss / S.V, ratio = CLAMP(c / st.csat, 0, 1);
        var col = MIX('#f2ecdc', S.sol === '白糖' ? '#a3771f' : '#4a148c', ratio * ratio * 0.95 + ratio * 0.05);
        var R = beakerRect(W, H);
        drawBeaker(g, R, CLAMP(S.V / 0.55, 0.1, 0.95), col, { crystals: S.cryPts, volText: '体积 ' + FMT(S.V, 2) + ' L　溶质 ' + S.sol });
        /* 上方勺子 */
        var sx = R.bx + R.bw - 56, sy = R.by - 34;
        if (S.drag === 'spoon') { sx = S._px; sy = S._py; }
        LINE(g, sx, sy, sx, sy - 34, '#a16207', 5);
        CIRC(g, sx, sy, 13, S.drag === 'spoon' ? '#fde047' : '#eab308', '#a16207', 2);
        TXT(g, '勺', sx, sy + 4, { align: 'center', size: 11, color: '#7c5a09' });
        TXT(g, FMT(c, 3) + ' mol/L', R.bx, R.by - 18, { size: 22, weight: 'bold', color: '#4c1d95' });
        hintDrag(g, '👆 拖动勺子', R.bx + R.bw - 56, R.by - 70);
        hintDrag(g, '👆 拖动水面', R.bx + R.bw / 2, R.by + R.bh / 2 - 24);
        if (S.cryPts.length) PILL(g, R.bx + R.bw - 150, R.by + 6, '底部有晶体析出 · 过饱和', '#b91c1c', 'rgba(248,113,113,0.15)');
    },
    data: function (S) {
        var st = SOLUTES[S.sol];
        var total = S.spoons * st.per, diss = Math.min(total, st.csat * S.V);
        var c = diss / S.V, sat = c >= st.csat - 1e-9;
        return [
            { label: '加入溶质', value: FMT(total, 3), unit: 'mol' },
            { label: '已溶解', value: FMT(diss, 3), unit: 'mol' },
            { label: '体积', value: FMT(S.V, 2), unit: 'L' },
            { label: '浓度', value: FMT(c, 3), unit: 'mol/L', color: '#7c3aed' },
            { label: '是否饱和', value: sat ? '是（析出中）' : '否', unit: '', color: sat ? '#dc2626' : '#16a34a' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H);
        var sx = R.bx + R.bw - 56, sy = R.by - 34;
        if (Math.hypot(x - sx, y - sy) < 22) return true;
        var top = R.by + 20, bot = R.by + R.bh - 12;
        var surfY = bot - (bot - top) * CLAMP(S.V / 0.55, 0.1, 0.95);
        return x > R.bx && x < R.bx + R.bw && Math.abs(y - surfY) < 18;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H);
        var sx = R.bx + R.bw - 56, sy = R.by - 34;
        if (Math.hypot(x - sx, y - sy) < 22) { S.drag = 'spoon'; S._px = x; S._py = y; return; }
        var top = R.by + 20, bot = R.by + R.bh - 12;
        var surfY = bot - (bot - top) * CLAMP(S.V / 0.55, 0.1, 0.95);
        if (x > R.bx && x < R.bx + R.bw && Math.abs(y - surfY) < 18) S.drag = 'surf';
    },
    ptMove: function (S, x, y) {
        if (S.drag === 'spoon') { S._px = x; S._py = y; return; }
        if (S.drag === 'surf') {
            var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H);
            var top = R.by + 20, bot = R.by + R.bh - 12;
            S.V = CLAMP((bot - y) / (bot - top) * 0.55, 0.12, 0.55);
        }
    },
    ptUp: function (S) {
        if (S.drag === 'spoon') {
            var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H);
            if (S._px > R.bx && S._px < R.bx + R.bw && S._py > R.by && S._py < R.by + R.bh) {
                S.spoons = CLAMP(S.spoons + 0.5, 0, 5);
            }
        }
        S.drag = null;
    }
},

/* ---------- 2 molarity 摩尔浓度 ---------- */
molarity: {
    know: '<p><strong>摩尔浓度</strong> M = n ÷ V。拖动滑块改变溶质的量 n 与溶液体积 V，观察试管刻度与颜色深浅变化。</p>',
    controls: function (S) {
        return [
            SL('mo_n', '溶质摩尔数', 0, 1, 0.02, S.mol, 'mol', function (v) { S.mol = v; }),
            SL('mo_v', '溶液体积', 0.1, 1, 0.05, S.V, 'L', function (v) { S.V = v; })
        ];
    },
    draw: function (g, S, W, H, t) {
        var M = S.mol / S.V, sat = CLAMP(M / 2, 0, 1);
        var col = MIX('#f2ecdc', '#5b21b6', sat * sat);
        var R = beakerRect(W, H, 0.36, 0.58);
        drawBeaker(g, R, CLAMP(S.V, 0.08, 0.95), col, { volText: 'V = ' + FMT(S.V, 2) + ' L' });
        /* 溶质方块（可拖入烧杯/试管） */
        var cbx = R.bx - 44, cby = R.by + 10;
        if (S.drag === 'cube') { cbx = S._px; cby = S._py; }
        RR(g, cbx - 16, cby - 16, 32, 32, 5); g.fillStyle = S.drag === 'cube' ? '#a78bfa' : '#7c3aed'; g.fill();
        g.strokeStyle = '#4c1d95'; g.lineWidth = 2; g.stroke();
        TXT(g, '溶质', cbx, cby + 4, { align: 'center', size: 10, color: '#fff' });
        hintDrag(g, '👆 拖动溶质', R.bx - 44, R.by - 40);
        /* 大字读数 */
        TXT(g, 'M = ' + FMT(M, 2) + ' mol/L', W / 2, R.by - 26, { align: 'center', size: 26, weight: 'bold', color: '#5b21b6' });
        /* 试管刻度可视化 */
        var tx = R.bx + R.bw + 46, ty = R.by + 6, tw = 34, th = R.bh - 44;
        g.save(); RR(g, tx, ty, tw, th, 16);
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
        var fh = th * CLAMP(S.V, 0, 1);
        RR(g, tx, ty, tw, th, 16); g.save(); g.clip();
        g.fillStyle = RGBA(col, 0.9); g.fillRect(tx, ty + th - fh, tw, fh); g.restore();
        g.strokeStyle = '#94a3b8'; g.lineWidth = 2.5; RR(g, tx, ty, tw, th, 16); g.stroke();
        for (var i = 1; i <= 9; i++) {
            var yy = ty + th - th * i / 10;
            LINE(g, tx + tw - 10, yy, tx + tw, yy, '#64748b', 1.5);
            if (i % 2 === 0) TXT(g, FMT(i / 10, 1), tx - 6, yy + 4, { align: 'right', size: 10, color: '#64748b' });
        }
        TXT(g, '刻度/L', tx + tw / 2, ty + th + 16, { align: 'center', size: 11, color: '#64748b' });
        g.restore();
    },
    data: function (S) {
        var M = S.mol / S.V;
        return [
            { label: '溶质摩尔 n', value: FMT(S.mol, 2), unit: 'mol' },
            { label: '体积 V', value: FMT(S.V, 2), unit: 'L' },
            { label: '摩尔浓度 M', value: FMT(M, 2), unit: 'mol/L', color: '#7c3aed' },
            { label: '颜色深度', value: FMT(CLAMP(M / 2, 0, 1) * 100, 0), unit: '%' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H, 0.36, 0.58);
        var cbx = R.bx - 44, cby = R.by + 10;
        return Math.hypot(x - cbx, y - cby) < 24;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H, 0.36, 0.58);
        var cbx = R.bx - 44, cby = R.by + 10;
        if (Math.hypot(x - cbx, y - cby) < 24) { S.drag = 'cube'; S._px = x; S._py = y; }
    },
    ptMove: function (S, x, y) { if (S.drag === 'cube') { S._px = x; S._py = y; } },
    ptUp: function (S) {
        if (S.drag === 'cube') {
            var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H, 0.36, 0.58);
            if (S._px > R.bx && S._px < R.bx + R.bw && S._py > R.by && S._py < R.by + R.bh) {
                S.mol = CLAMP(S.mol + 0.05, 0, 1);
            }
        }
        S.drag = null;
    }
},

/* ---------- 3 phscale pH值 ---------- */
phscale: {
    know: '<p>pH = −log[H₃O⁺]，pOH = −log[OH⁻]，25 ℃ 时 pH + pOH = 14。滴加酸升高 [H₃O⁺] 使 pH 降低；滴加碱相反。选择对照溶液或微调按钮观察颜色梯度（红=强酸 → 紫=强碱）。</p>',
    presets: function (S) {
        var lst = this.SOLUTIONS;
        return lst.map(function (o) {
            return { name: o[0], apply: function () { S.solKey = o[0]; S.fine = 0; S.drops = 0; } };
        });
    },
    SOLUTIONS: [['自来水', 6.5], ['血液', 7.4], ['海水', 8.1], ['柠檬汁', 2.3], ['肥皂水', 10], ['稀盐酸', 1.5], ['氢氧化钠', 13], ['纯水', 7]],
    controls: function (S) {
        var self = this;
        var opts = self.SOLUTIONS.map(function (o) { return [o[0], o[0] + '（pH ' + o[1] + '）']; });
        return [
            SEL('ph_sol', '选择溶液', opts, S.solKey, function (v) { S.solKey = v; S.fine = 0; }),
            SL('ph_fine', '微调偏移', -2, 2, 0.1, S.fine, '', function (v) { S.fine = v; }),
            SEL('ph_dm', '滴管内容', [['酸', '酸性溶液（pH ↓）'], ['碱', '碱性溶液（pH ↑）']], S.dropMode, function (v) { S.dropMode = v; }),
            BTN('ph_drop', '滴一滴', function () { S.drip = 0.7; S.drops++; S.fine = CLAMP(S.fine + (S.dropMode === '酸' ? -0.1 : 0.1), -2, 2); })
        ];
    },
    update: function (S, dt) { if (S.drip > 0) S.drip -= dt; },
    draw: function (g, S, W, H, t) {
        var base = 7, lst = this.SOLUTIONS;
        for (var i = 0; i < lst.length; i++) if (lst[i][0] === S.solKey) base = lst[i][1];
        var pH = CLAMP(base + S.fine, 0, 14);
        var col = PH2C(pH), R = beakerRect(W, H, 0.4, 0.6);
        /* 滴管（可拖到量杯上方释放滴一滴） */
        var drx = W / 2, dry = R.by - 60;
        if (S.drag === 'drop') { drx = S._px; dry = S._py; }
        RR(g, drx - 8, dry - 26, 16, 30, 3); g.fillStyle = S.dropMode === '酸' ? '#ef4444' : '#3b82f6'; g.fill();
        g.strokeStyle = '#1e293b'; g.lineWidth = 1.5; g.stroke();
        RR(g, drx - 5, dry + 4, 10, 10, 2); g.fillStyle = '#94a3b8'; g.fill();
        hintDrag(g, '👆 拖动滴管', drx, dry - 46);
        /* 滴管动画 */
        if (S.drip > 0) {
            var dy = R.by - 40 + (0.7 - S.drip) * 90;
            CIRC(g, W / 2, dy, 6, S.dropMode === '酸' ? '#ef4444' : '#3b82f6');
        }
        drawBeaker(g, R, 0.72, col, { volText: '' });
        TXT(g, 'pH ' + FMT(pH, 1), W / 2, R.by - 20, { align: 'center', size: 30, weight: 'bold', color: col });
        /* 底部色条 0-14 */
        var sw = W * 0.6, sx0 = W * 0.2, sy = R.by + R.bh + 30;
        for (var pi = 0; pi <= 140; pi++) {
            g.fillStyle = PH2C(pi / 10); g.fillRect(sx0 + sw * pi / 140, sy, sw / 140 + 1, 14);
        }
        var mx = sx0 + sw * pH / 14;
        ARROW(g, mx, sy + 26, mx, sy + 16, '#0f172a', 2);
        TXT(g, FMT(pH, 1), mx, sy + 40, { align: 'center', size: 13, weight: 'bold', color: '#0f172a' });
        TXT(g, '0 强酸性', sx0, sy - 6, { size: 11, color: '#64748b' });
        TXT(g, '14 强碱性', sx0 + sw, sy - 6, { align: 'right', size: 11, color: '#64748b' });
        if (S.drops) TXT(g, '已滴加 ' + S.drops + ' 滴（当前' + S.dropMode + '）', W / 2, R.by + 18, { align: 'center', size: 12, color: '#475569' });
    },
    data: function (S) {
        var base = 7, lst = IMPL.phscale.SOLUTIONS;
        for (var i = 0; i < lst.length; i++) if (lst[i][0] === S.solKey) base = lst[i][1];
        var pH = CLAMP(base + S.fine, 0, 14), hyd = Math.pow(10, -pH), oh = Math.pow(10, pH - 14);
        function sci(v) { var e = Math.floor(Math.log10(v)); return FMT(v / Math.pow(10, e), 1) + '×10' + sup(e) + ' mol/L'; }
        return [
            { label: '[H₃O⁺]', value: sci(hyd), unit: '', color: '#dc2626' },
            { label: '[OH⁻]', value: sci(oh), unit: '', color: '#2563eb' },
            { label: 'pH', value: FMT(pH, 1), unit: '', color: PH2C(pH) },
            { label: 'pOH', value: FMT(14 - pH, 1), unit: '' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H, 0.4, 0.6);
        var drx = W / 2, dry = R.by - 60;
        return Math.hypot(x - drx, y - dry) < 24;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H, 0.4, 0.6);
        var drx = W / 2, dry = R.by - 60;
        if (Math.hypot(x - drx, y - dry) < 24) { S.drag = 'drop'; S._px = x; S._py = y; }
    },
    ptMove: function (S, x, y) { if (S.drag === 'drop') { S._px = x; S._py = y; } },
    ptUp: function (S) {
        if (S.drag === 'drop') {
            var W = S._W || 820, H = S._H || 480, R = beakerRect(W, H, 0.4, 0.6);
            if (S._px > R.bx && S._px < R.bx + R.bw && S._py > R.by - 50 && S._py < R.by + R.bh) {
                S.drip = 0.7; S.drops++;
                S.fine = CLAMP(S.fine + (S.dropMode === '酸' ? -0.1 : 0.1), -2, 2);
            }
        }
        S.drag = null;
    }
},

/* ---------- 4 phscaleBasics pH基础 ---------- */
phscaleBasics: {
    know: '<p>拖动滑块改变 pH，观察彩虹色液体和所在区间：<strong>强酸性 → 弱酸性 → 中性 → 弱碱性 → 强碱性</strong>。</p>',
    controls: function (S) { return [SL('pb_ph', 'pH', 0, 14, 0.1, S.pH, '', function (v) { S.pH = v; })]; },
    draw: function (g, S, W, H) {
        var col = PH2C(S.pH), R = beakerRect(W, H, 0.42, 0.56);
        drawBeaker(g, R, 0.7, col, {});
        TXT(g, 'pH = ' + FMT(S.pH, 1), W / 2, R.by - 18, { align: 'center', size: 30, weight: 'bold', color: col });
        var zones = [[0, 3, '强酸性', '#dc2626'], [3, 6.5, '酸性', '#ea580c'], [6.5, 7.5, '中性', '#65a30d'], [7.5, 11, '碱性', '#0891b2'], [11, 14, '强碱性', '#7c3aed']];
        for (var z = 0; z < zones.length; z++) {
            var zo = zones[z], zx = W * (0.12 + 0.76 * zo[0] / 14), zw = W * 0.76 * (zo[1] - zo[0]) / 14;
            TXT(g, zo[2], zx + zw / 2, R.by + R.bh + 26, { align: 'center', size: 13, weight: 'bold', color: zo[3], alpha: (S.pH >= zo[0] && S.pH < zo[1]) ? 1 : 0.45 });
        }
    },
    data: function (S) {
        var zone = '中性';
        if (S.pH < 3) zone = '强酸性'; else if (S.pH < 6.5) zone = '弱酸性';
        else if (S.pH > 11) zone = '强碱性'; else if (S.pH > 7.5) zone = '弱碱性';
        return [
            { label: 'pH', value: FMT(S.pH, 1), unit: '', color: PH2C(S.pH) },
            { label: '所处区间', value: zone, unit: '' }
        ];
    }
},

/* ---------- 5 acidbase 酸碱溶液电离平衡 ---------- */
acidbase: {
    know: '<p>弱酸存在电离平衡 HA ⇌ H⁺ + A⁻。电离度近似 α = √(Ka ÷ C)。离子越多，溶液导电性越强，灯泡越亮；pH = −log[H⁺]，其中 [H⁺] = α·C。</p>',
    controls: function (S) {
        var opts = []; for (var e = -1; e >= -10; e--) opts.push([String(e), 'Ka = 10' + sup(e)]);
        return [
            SL('ab_c', '初始浓度 C', 0.001, 0.5, 0.001, S.C, 'mol/L', function (v) { S.C = v; }),
            SEL('ab_k', '弱酸强度', opts, String(S.Kai), function (v) { S.Kai = parseInt(v, 10); })
        ];
    },
    calc: function (S) {
        var Ka = Math.pow(10, S.Kai);
        var al = CLAMP(Math.sqrt(Ka / S.C), 0, 0.9999);
        return { Ka: Ka, alpha: al, h: al * S.C, pH: -Math.log10(Math.max(al * S.C, 1e-14)) };
    },
    draw: function (g, S, W, H, t) {
        var r = this.calc(S), R = beakerRect(W, H, 0.44, 0.6);
        var n = 24, ionN = Math.round(n * r.alpha);
        var swimmers = [];
        var rnd = makeRng(20240001);
        for (var i = 0; i < n; i++) {
            var px = rnd(), py = rnd(), ph = rnd() * 6.28, isIon = i < ionN;
            (function (fx, fy, phase, ion) {
                swimmers.push(function (gg) {
                    var ox = fx * 0.86 + 0.07, oy = fy * 0.7 + 0.16;
                    var wob = ion ? Math.sin(t * 3 + phase) * 4 : 0;
                    var x = R.bx + R.bw * ox + wob, y = R.by + 30 + (R.bh - 60) * oy;
                    if (ion) {
                        CIRC(gg, x - 6, y, 7, '#ef4444'); CIRC(gg, x + 7, y + 3, 5, '#3b82f6');
                        TXT(gg, '+', x - 6, y + 3, { align: 'center', size: 10, color: '#fff', weight: 'bold' });
                        TXT(gg, '−', x + 7, y + 6, { align: 'center', size: 10, color: '#fff', weight: 'bold' });
                    } else {
                        CIRC(gg, x, y, 9, 'rgba(148,163,184,0.85)', '#475569', 1.5);
                        TXT(gg, 'HA', x, y + 3, { align: 'center', size: 9, weight: 'bold', color: '#fff' });
                    }
                });
            })(px, py, ph, isIon);
        }
        drawBeaker(g, R, 0.66, MIX('#f0fdf4', '#93c5fd', r.alpha), { swimmers: swimmers });
        bulbs(g, R.bx + R.bw + 52, R.by + 30, r.alpha * S.C / 0.4);
        LINE(g, R.bx + R.bw + 30, R.by + 42, R.bx + R.bw - 2, R.by + R.bh * 0.5, '#78716c', 2.5);
        LINE(g, R.bx + R.bw + 74, R.by + 42, R.bx + R.bw + 106, R.by + R.bh * 0.5, '#78716c', 2.5);
        TXT(g, 'α = ' + FMT(r.alpha * 100, 1) + '%', W / 2, R.by - 20, { align: 'center', size: 22, weight: 'bold', color: '#166534' });
        TXT(g, '灰球：HA 未电离　红蓝球：H⁺ / A⁻', W / 2, R.by + R.bh + 18, { align: 'center', size: 12, color: '#64748b' });
    },
    data: function (S) {
        var r = IMPL.acidbase.calc(S);
        return [
            { label: 'Ka', value: '1×10' + sup(S.Kai), unit: '' },
            { label: '电离度 α', value: FMT(r.alpha * 100, 1), unit: '%', color: '#16a34a' },
            { label: '[H⁺]', value: r.h.toExponential(2), unit: 'mol/L' },
            { label: 'pH', value: FMT(r.pH, 2), unit: '', color: '#dc2626' }
        ];
    }
},

/* ---------- 6 beers 比尔定律 ---------- */
beers: {
    know: '<p><strong>比尔定律</strong>：A = ε·c·l，透射率 T = e⁻ᴬ = P/P₀。浓度越大、比色皿越宽，吸收越强。溶液吸收与其互补的颜色，射出光即变暗变色。</p>',
    controls: function (S) {
        return [
            SL('be_lam', '波长 λ', 380, 750, 1, S.lam, 'nm', function (v) { S.lam = v; }),
            SL('be_c', '浓度 c', 0, 0.5, 0.005, S.c, 'mol/L', function (v) { S.c = v; }),
            SL('be_l', '皿宽 l', 0.5, 2, 0.05, S.l, 'cm', function (v) { S.l = v; })
        ];
    },
    eps: function (lam) { return 3.2 * Math.exp(-0.5 * Math.pow((lam - 520) / 70, 2)) + 0.02; },
    calc: function (S) {
        var eps = IMPL.beers.eps(S.lam);
        var A = eps * S.c * S.l;
        return { A: A, T: Math.exp(-A) * 100 };
    },
    draw: function (g, S, W, H, t) {
        var r = this.calc(S), lc = WCOL(S.lam);
        var cy = H * 0.46, cw = 46 + S.l * 62, cx = W / 2 - cw / 2, ch = 120;
        /* 光源 */
        elemIcon(g, W * 0.09, cy, 22, '#fef3c7', null); TXT(g, '💡', W * 0.09, cy + 7, { align: 'center', size: 20 });
        var inCol = RGBA(lc, CLAMP(r.T / 100, 0.08, 1)); /* 射出光：入射色按透射率调亮度 */
        LINE(g, W * 0.09 + 24, cy, cx, cy, inCol, 5);
        /* 入射白光条纹进入皿内逐渐吸收着色 */
        var segs = 7;
        for (var i = 0; i < segs; i++) {
            var fa = Math.exp(-r.A * (i + 1) / segs) / Math.exp(-r.A * i / segs);
            g.save(); g.globalAlpha = 0.9 - 0.75 * (1 - fa);
            LINE(g, cx + cw * i / segs, cy, cx + cw * (i + 1) / segs, cy, lc, 7); g.restore();
        }
        LINE(g, cx + cw, cy, W * 0.86 - 30, cy, inCol, 5 + 5 * r.T / 100);
        /* 比色皿 */
        RR(g, cx, cy - ch / 2, cw, ch, 8);
        g.fillStyle = 'rgba(226,232,240,0.4)'; g.fill();
        g.strokeStyle = '#7dd3fc'; g.lineWidth = 3; g.stroke();
        /* 溶液本色 */
        g.save(); RR(g, cx + 3, cy - ch / 2 + 3, cw - 6, ch - 6, 6); g.clip();
        var sol = MIX('#ffffff', lc, CLAMP(r.A / 2.5, 0.06, 0.85));
        g.fillStyle = RGBA(sol, 0.65); g.fillRect(cx, cy - ch / 2, cw, ch); g.restore();
        /* 探测器 */
        RR(g, W * 0.87, cy - 46, 118, 92, 10);
        g.fillStyle = '#0f172a'; g.fill(); g.stroke();
        TXT(g, '探测器', W * 0.87 + 59, cy - 22, { align: 'center', size: 12, color: '#94a3b8' });
        TXT(g, FMT(r.T, 1) + '%', W * 0.87 + 59, cy + 16, { align: 'center', size: 24, weight: 'bold', color: inCol });
        TXT(g, 'λ = ' + S.lam + ' nm（' + (S.lam < 450 ? '紫蓝' : S.lam < 560 ? '绿' : S.lam < 620 ? '黄橙' : '红') + '光）', W / 2, cy - ch / 2 - 34, { align: 'center', size: 13, color: '#475569' });
        /* 条纹装饰入射狭缝 */
        for (var s2 = 0; s2 < 3; s2++) LINE(g, W * 0.09 + 16 + s2 * 6, cy - 14, W * 0.09 + 16 + s2 * 6, cy + 14, '#d4d4d8', 2);
    },
    data: function (S) {
        var r = IMPL.beers.calc(S);
        return [
            { label: '吸光度 A', value: FMT(r.A, 3), unit: '', color: '#dc2626' },
            { label: '透射率 T', value: FMT(r.T, 1), unit: '%', color: '#2563eb' },
            { label: 'ε 摩尔吸光系数', value: FMT(IMPL.beers.eps(S.lam), 2), unit: '' }
        ];
    }
},

/* ---------- 7 eqbalance 配平化学方程式 ---------- */
eqbalance: {
    know: '<p>质量守恒：反应前后每种元素的原子个数必须相等。用 <strong>＋/－</strong> 步进按钮调整各物质系数，右侧元素计数全部变成 ✓ 才算配平成功！</p>',
    controls: function (S) {
        var eq = EQS[S.eqi], arr = [SEL('eq_sel', '选择方程式', EQS.map(function (e, i) { return [String(i), e.txt]; }), String(S.eqi), function (v) {
            S.eqi = parseInt(v, 10); S.coef = EQS[S.eqi].ans.map(function () { return 0; }); S.msg = ''; S.checked = false;
        })];
        for (var i = 0; i < eq.lab.length; i++) {
            (function (idx, name) {
                arr.push(BTN('eq_m' + idx, name + ' －1', function () { S.coef[idx] = Math.max(0, S.coef[idx] - 1); S.checked = false; }));
                arr.push(BTN('eq_p' + idx, name + ' ＋1', function () { S.coef[idx]++; S.checked = false; }));
            })(i, eq.lab[i]);
        }
        arr.push(BTN('eq_ck', '检查答案', function () {
            S.checked = true;
            var anyFilled = S.coef.some(function (c) { return c > 0; });
            if (!anyFilled) { S.msg = '请先用 ＋/－ 填入系数再检查'; return; }
            var r = IMPL.eqbalance.checks(S);
            if (r.allEq) {
                var okAns = true;
                for (var q = 0; q < EQS[S.eqi].ans.length; q++) if (S.coef[q] !== EQS[S.eqi].ans[q]) okAns = false;
                S.msg = okAns ? '🎉 配平成功！完美答案！' : '✓ 元素已守恒，但还可以再约简哦';
                S.confetti = [];
                CONFspawn(S, 70, (S._W || 800) / 2, (S._H || 400) * 0.4);
            } else {
                S.msg = '还没守恒：请看红色 ✗ 的元素再调整';
            }
        }));
        arr.push(BTN('eq_rs', '清零系数', function () { S.coef = EQS[S.eqi].ans.map(function () { return 0; }); S.msg = ''; }));
        return arr;
    },
    splitOf: function (eq) { return eq.ans.length - (eq.ans.length >= 4 ? 2 : 1); },
    checks: function (S) {
        var eq = EQS[S.eqi], nl = IMPL.eqbalance.splitOf(eq), res = {}, keys = {}, L = {}, Rt = {}, i, el;
        for (i = 0; i < eq.el.length; i++) {
            var mult = Math.max(S.coef[i] || 0, 0), grp = i < nl ? L : Rt;
            for (el in eq.el[i]) { keys[el] = 1; grp[el] = (grp[el] || 0) + eq.el[i][el] * mult; if (mult > 0) res.any = 1; }
        }
        var allEq = true;
        for (el in keys) { res.ok = (L[el] || 0) === (Rt[el] || 0); if (!res.ok) allEq = false; res.count = (res.count || 0) + 1; }
        res.allEq = allEq;
        return { detail: Object.keys(keys).map(function (k) { return { el: k, l: L[k] || 0, r: Rt[k] || 0 }; }), allEq: allEq };
    },
    draw: function (g, S, W, H, t) {
        var eq = EQS[S.eqi], ck = this.checks(S);
        var mid = (eq.ans.length >= 4) ? findSplit(eq) : eq.ans.length - 1;
        function findSplit(e) { return 2; }
        mid = eq.ans.length >= 4 ? 2 : eq.ans.length - 1;
        var eqy = H * 0.3, xpos = W * 0.06, gap = Math.min((W * 0.88) / (eq.ans.length + 1), 170);
        for (var i = 0; i < eq.ans.length; i++) {
            var x = xpos + i * gap + gap * 0.4;
            /* 系数框 */
            var filled = S.coef[i] > 0;
            RR(g, x, eqy - 34, 46, 40, 8);
            g.fillStyle = filled ? (ck.allEq && S.checked ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.12)') : 'rgba(239,68,68,0.08)';
            g.fill();
            g.strokeStyle = filled ? '#3b82f6' : '#ef4444'; g.lineWidth = 2; g.setLineDash(filled ? [] : [4, 4]); g.stroke(); g.setLineDash([]);
            TXT(g, filled ? String(S.coef[i]) : '?', x + 23, eqy - 5, { align: 'center', size: 22, weight: 'bold', color: filled ? '#1d4ed8' : '#ef4444' });
            TXT(g, eq.lab[i], x + 23, eqy + 26, { align: 'center', size: 17, weight: 'bold', color: '#0f172a' });
            if (i === mid - 1) ARROW(g, x + 58, eqy - 8, x + gap + gap * 0.4 - 62, eqy - 8, '#64748b', 2.5);
            else if (i < eq.ans.length - 1 && i !== mid - 1 && (i < mid - 1 || i >= mid)) {
                if (i !== mid - 1 && i + 1 !== mid) TXT(g, '+', x + gap / 2 + 12, eqy + 26, { align: 'center', size: 18, weight: 'bold', color: '#64748b' });
            }
        }
        /* 元素守恒 chip */
        var chy = H * 0.52, chx = W * 0.5 - (ck.detail.length * 110) / 2;
        TXT(g, '元素守恒检查：', chx - 130, chy + 16, { size: 14, color: '#475569' });
        for (var d = 0; d < ck.detail.length; d++) {
            var dd = ck.detail[d], okc = dd.l === dd.r;
            RR(g, chx + d * 110, chy, 100, 34, 17);
            g.fillStyle = okc ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.14)'; g.fill();
            g.strokeStyle = okc ? '#16a34a' : '#dc2626'; g.lineWidth = 1.5; g.stroke();
            TXT(g, dd.el + ': ' + dd.l + ' : ' + dd.r + ' ' + (okc ? '✓' : '✗'), chx + d * 110 + 50, chy + 22, { align: 'center', size: 13, weight: 'bold', color: okc ? '#15803d' : '#b91c1c' });
        }
        TXT(g, S.msg || '提示：将每个系数从 0 开始调整，直到所有元素左右计数相等', W / 2, chy + 64, { align: 'center', size: 13, color: S.msg ? '#15803d' : '#64748b' });
        TXT(g, eq.name + '　' + eq.txt, W / 2, H * 0.14, { align: 'center', size: 18, weight: 'bold', color: '#334155' });
        if (S.confetti && S.confetti.length) CONFdraw(g, S);
    },
    update: function (S, dt) { CONFstep(S, dt); },
    data: function (S) {
        var ck = IMPL.eqbalance.checks(S);
        return [
            { label: '方程式', value: EQS[S.eqi].name, unit: '' },
            { label: '元素种类', value: ck.detail.length, unit: '种' },
            { label: '是否配平', value: ck.allEq ? '✓ 已配平' : '✗ 未配平', unit: '', color: ck.allEq ? '#16a34a' : '#dc2626' },
            { label: '系数和', value: S.coef.reduce(function (a, b) { return a + b; }, 0), unit: '' }
        ];
    }
},
/* 说明：检查按钮在 controls 内注入动作见下方 wiring */

/* ---------- 8 leftovers 反应物产物与剩余 ---------- */
leftovers: {
    know: '<p>按“配方”投放原料：产物数量由最短缺的原料决定 <strong>n产物 = min(aᵢ ÷ 需求ᵢ)</strong>，其余原料即为剩余物。</p>',
    presets: function (S) { return [{ name: '刚好用完', apply: function () { var rc = RECIPES[S.ri]; S.cnt = rc.items.map(function (it) { return it[2] * 2; }); } }]; },
    controls: function (S) {
        var rc = RECIPES[S.ri], arr = [SEL('lf_r', '配方', RECIPES.map(function (r, i) { return [String(i), r.name]; }), String(S.ri), function (v) {
            S.ri = parseInt(v, 10); S.cnt = RECIPES[S.ri].items.map(function () { return 2; });
        })];
        rc.items.forEach(function (it, i) {
            arr.push(SL('lf_i' + i, it[1], 0, 10, 1, S.cnt[i] || 0, '个', function (v) { S.cnt[i] = v; }));
        });
        return arr;
    },
    calc: function (S) {
        var rc = RECIPES[S.ri], prod = Infinity;
        rc.items.forEach(function (it, i) { prod = Math.min(prod, Math.floor((S.cnt[i] || 0) / it[2])); });
        if (!isFinite(prod)) prod = 0;
        var left = rc.items.map(function (it, i) { return Math.max(0, (S.cnt[i] || 0) - prod * it[2]); });
        return { prod: prod, left: left };
    },
    draw: function (g, S, W, H) {
        var rc = RECIPES[S.ri], r = this.calc(S);
        TXT(g, '配方：' + rc.items.map(function (it) { return it[1] + '×' + it[2]; }).join(' ＋ ') + ' → ' + rc.prod[0], W / 2, H * 0.14, { align: 'center', size: 16, weight: 'bold', color: '#334155' });
        /* 产物行 */
        var y = H * 0.3;
        TXT(g, '产物', W * 0.1, y + 8, { size: 14, weight: 'bold', color: '#16a34a' });
        for (var p = 0; p < Math.min(r.prod, 10); p++) {
            TXT(g, rc.emo[rc.prod[1]] || rc.prod[1], W * 0.2 + p * 46, y + 10, { size: 26 });
        }
        if (r.prod > 10) TXT(g, '×' + r.prod, W * 0.2 + 10 * 46, y + 10, { size: 18, weight: 'bold', color: '#16a34a' });
        if (!r.prod) TXT(g, '原料不足，无产物', W * 0.2, y + 10, { size: 14, color: '#94a3b8' });
        /* 剩余行 */
        rc.items.forEach(function (it, i) {
            var yy = y + 62 + i * 54;
            TXT(g, it[1], W * 0.1, yy + 8, { size: 14, weight: 'bold', color: '#475569' });
            for (var q = 0; q < Math.min(r.left[i], 10); q++) TXT(g, rc.emo[it[1]], W * 0.2 + q * 46, yy + 10, { size: 26 });
            if (r.left[i] > 10) TXT(g, '×' + r.left[i], W * 0.2 + 10 * 46, yy + 10, { size: 16, weight: 'bold', color: '#b45309' });
            if (!r.left[i]) TXT(g, '恰好用完 ✓', W * 0.22, yy + 10, { size: 13, color: '#16a34a' });
        });
        /* 原料池（可拖到上方反应区 +1） */
        PANEL(g, W * 0.06, H - 70, W * 0.5, 56, { title: '原料池（拖到上方反应区 +1）' });
        hintDrag(g, '👆 拖动原料', W * 0.30, H - 84);
        rc.items.forEach(function (it, i) {
            var ix = W * 0.10 + i * 56, iy = H - 40;
            if (S.drag === 'item' && S._di === i) { ix = S._px; iy = S._py; }
            TXT(g, rc.emo[it[1]], ix, iy, { size: 26, align: 'center' });
        });
        if (S.drag === 'item') { g.save(); g.strokeStyle = '#2563eb'; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(W * 0.18, H * 0.24, W * 0.7, 60); g.restore(); }
        TXT(g, '限 limiting reactant：' + (r.prod ? RECIPES[S.ri].items[r.argmin || 0][1] : '—'), W / 2, H - 26, { align: 'center', size: 12, color: '#64748b' });
    },
    data: function (S) {
        var r = IMPL.leftovers.calc(S), rc = RECIPES[S.ri];
        var arr = [{ label: rc.prod[1] + '产量', value: r.prod, unit: '个', color: '#16a34a' }];
        rc.items.forEach(function (it, i) { arr.push({ label: '剩余 ' + it[1], value: r.left[i], unit: '个', color: r.left[i] ? '#b45309' : '#16a34a' }); });
        return arr;
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, rc = RECIPES[S.ri];
        for (var i = 0; i < rc.items.length; i++) {
            var ix = W * 0.10 + i * 56, iy = H - 40;
            if (Math.hypot(x - ix, y - iy) < 26) return true;
        }
        return false;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, rc = RECIPES[S.ri];
        for (var i = 0; i < rc.items.length; i++) {
            var ix = W * 0.10 + i * 56, iy = H - 40;
            if (Math.hypot(x - ix, y - iy) < 26) { S.drag = 'item'; S._di = i; S._px = x; S._py = y; return; }
        }
    },
    ptMove: function (S, x, y) { if (S.drag === 'item') { S._px = x; S._py = y; } },
    ptUp: function (S) {
        if (S.drag === 'item') {
            var W = S._W || 820, H = S._H || 480;
            if (S._px > W * 0.18 && S._px < W * 0.88 && S._py > H * 0.24 && S._py < H * 0.34) {
                S.cnt[S._di] = (S.cnt[S._di] || 0) + 1;
            }
        }
        S.drag = null; S._di = -1;
    }
},

/* ---------- 9 buildatom 构建原子 ---------- */
buildatom: {
    know: '<p>质子数 Z 决定元素种类；质子数 ≠ 电子数时成为<strong>离子</strong>（电荷 = Z − 电子数）；中子数不同则为<strong>同位素</strong>（质量数 A = Z + N）。核外电子按 2、8、8 分层排布。</p>',
    presets: function (S) {
        function pz(p, n, e) { return function () { S.P = p; S.N = n; S.E = e; }; }
        return [
            { name: '氢原子', apply: pz(1, 0, 1) },
            { name: '碳-12', apply: pz(6, 6, 6) },
            { name: '氧-16', apply: pz(8, 8, 8) },
            { name: '钠离子 Na⁺', apply: pz(11, 12, 10) }
        ];
    },
    controls: function (S) {
        function sp(pre, label, key) {
            return [BTN(pre + '_dec', label + ' －', function () { S[key] = Math.max(0, S[key] - 1); }),
                    BTN(pre + '_inc', label + ' ＋', function () { S[key] = Math.min(key === 'P' ? 18 : 24, S[key] + 1); })];
        }
        return [].concat(sp('ba_p', '质子', 'P'), sp('ba_n', '中子', 'N'), sp('ba_e', '电子', 'E'),
            [CK('ba_q', '显示电荷标签', S.showQ, function (v) { S.showQ = v; }),
             CK('ba_m', '显示质量数标签', S.showM, function (v) { S.showM = v; })]);
    },
    update: function (S, dt) {
        var caps = [2, 8, 8], left = S.E;
        for (var s = 0; s < 3; s++) { var put = Math.min(left, caps[s]); S.sh[s] = put; left -= put; }
        if (left > 0) S.sh[2] += left;
    },
    draw: function (g, S, W, H, t) {
        var cx = W / 2, cy = H * 0.44, ks = Math.min(W, H) / 480;
        /* 壳层 */
        var radii = [52 * ks * 1.15, 96 * ks * 1.15, 138 * ks * 1.15];
        for (var s = 0; s < 3; s++) if (S.sh[s]) CIRC(g, cx, cy, radii[s], null, 'rgba(148,163,184,0.4)', 1.5);
        /* 核 */
        var tot = S.P + S.N;
        for (var i = 0; i < tot; i++) {
            var rr = i === 0 ? 0 : Math.sqrt(i) * 9 * ks * 1.1;
            var an = i * 2.39996 + Math.sin(t * 2 + i * 1.7) * 0.09;
            var isP = i % Math.max(1, Math.ceil(tot / Math.max(S.P, 1))) < 0 ? false : i < 0;
            var px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr;
            if (i < S.P) { CIRC(g, px, py, 8 * ks * 1.1, '#0d9488', '#0f766e', 1); }
            else { CIRC(g, px, py, 8 * ks * 1.1, '#ef4444', '#b91c1c', 1); }
        }
        if (!tot) TXT(g, '空核！', cx, cy, { align: 'center', size: 14, color: '#94a3b8' });
        /* 电子轨道运动 */
        var speeds = [1.7, 1.05, 0.7];
        for (var sh = 0; sh < 3; sh++) {
            var ne = S.sh[sh];
            for (var e2 = 0; e2 < ne; e2++) {
                var av = t * speeds[sh] + e2 * (Math.PI * 2 / ne) + sh;
                var ex = cx + Math.cos(av) * radii[sh], ey = cy + Math.sin(av) * radii[sh];
                CIRC(g, ex, ey, 5.5 * ks * 1.2, '#3b82f6', '#1d4ed8', 1);
            }
        }
        /* 标签 */
        var Z = S.P, el = ELEMENTS[Z - 1];
        var head = el ? (el[0] + '（' + el[1] + '）') : '未知元素（Z=' + Z + '）';
        TXT(g, head, cx, H * 0.1, { align: 'center', size: 26, weight: 'bold', color: '#0f172a' });
        var charge = Z - S.E;
        var cls = charge > 0 ? '阳离子（+' + charge + '）' : charge < 0 ? '阴离子（' + charge + '）' : '中性原子';
        TXT(g, cls, cx, H * 0.1 + 26, { align: 'center', size: 15, color: charge > 0 ? '#ea580c' : charge < 0 ? '#2563eb' : '#16a34a' });
        if (S.showM) PILL(g, cx - 160, H - 44, '质量数 A = ' + (Z + S.N) + '　同位素记法：' + (el ? el[0] : '元素') + '-' + (Z + S.N), '#334155', 'rgba(100,116,139,0.12)', 12);
        if (S.showQ) PILL(g, cx + 30, H - 44, '电荷 = Z − E = ' + charge, charge ? '#ea580c' : '#15803d', 'rgba(100,116,139,0.12)', 12);
        /* 核子池（可拖入核中） */
        var npxs = [W * 0.30, W * 0.70], npys = [H - 36, H - 36];
        for (var npi = 0; npi < 2; npi++) {
            var nix = npxs[npi], niy = npys[npi];
            if (S.drag === 'nuc' && S._dk === npi) { nix = S._px; niy = S._py; }
            CIRC(g, nix, niy, 16, npi === 0 ? '#0d9488' : '#ef4444', npi === 0 ? '#0f766e' : '#b91c1c', 2);
            TXT(g, npi === 0 ? 'p⁺' : 'n', nix, niy + 4, { align: 'center', size: 12, weight: 'bold', color: '#fff' });
        }
        TXT(g, '拖动核子到核中添加', W / 2, H - 60, { align: 'center', size: 11, color: '#64748b' });
        hintDrag(g, '👆 拖动核子', W / 2, H - 80);
        /* 图例 */
        var lgx = W - 128;
        CIRC(g, lgx, 30, 7, '#0d9488'); TXT(g, '质子 +' + S.P, lgx + 14, 34, { size: 12, color: '#334155' });
        CIRC(g, lgx, 52, 7, '#ef4444'); TXT(g, '中子 ' + S.N, lgx + 14, 56, { size: 12, color: '#334155' });
        CIRC(g, lgx, 74, 5, '#3b82f6'); TXT(g, '电子 ' + S.E, lgx + 14, 78, { size: 12, color: '#334155' });
    },
    data: function (S) {
        var el = ELEMENTS[S.P - 1];
        return [
            { label: '元素', value: el ? el[0] + '(' + el[1] + ')' : '未知', unit: 'Z=' + S.P, color: '#0f766e' },
            { label: '质量数 A', value: S.P + S.N, unit: '' },
            { label: '电荷', value: S.P - S.E, unit: '', color: (S.P - S.E) ? '#ea580c' : '#16a34a' },
            { label: '分类', value: (S.P - S.E) > 0 ? '阳离子' : (S.P - S.E) < 0 ? '阴离子' : '中性原子', unit: '' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, npxs = [W * 0.30, W * 0.70], npys = [H - 36, H - 36];
        for (var i = 0; i < 2; i++) if (Math.hypot(x - npxs[i], y - npys[i]) < 22) return true;
        return false;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, npxs = [W * 0.30, W * 0.70], npys = [H - 36, H - 36];
        for (var i = 0; i < 2; i++) if (Math.hypot(x - npxs[i], y - npys[i]) < 22) { S.drag = 'nuc'; S._dk = i; S._px = x; S._py = y; return; }
    },
    ptMove: function (S, x, y) { if (S.drag === 'nuc') { S._px = x; S._py = y; } },
    ptUp: function (S) {
        if (S.drag === 'nuc') {
            var W = S._W || 820, H = S._H || 480, cx = W / 2, cy = H * 0.44;
            if (Math.hypot(S._px - cx, S._py - cy) < 150) {
                if (S._dk === 0) S.P = Math.min(18, S.P + 1); else S.N = Math.min(24, S.N + 1);
            }
        }
        S.drag = null;
    }
},

/* ---------- 10 nucleus 构建原子核 ---------- */
nucleus: {
    know: '<p>稳定核素大致位于 β 稳定线附近。当 <strong>N/Z 失衡</strong>（N 太多可能 β⁻ 衰变；质子太多倾向 α 衰变或 β⁺/电子俘获）时，原子核不稳定。</p>',
    presets: function (S) {
        function pz(p, n) { return function () { S.P = p; S.N = n; }; }
        return [
            { name: '碳-12 稳定', apply: pz(6, 6) },
            { name: '碳-14 放射', apply: pz(6, 8) },
            { name: '氦-4', apply: pz(2, 2) },
            { name: '铀-238', apply: pz(92, 146) }
        ];
    },
    controls: function (S) {
        return [
            BTN('nu_p_inc', '添加质子 ＋', function () { S.P++; }),
            BTN('nu_p_dec', '移除质子 －', function () { S.P = Math.max(0, S.P - 1); }),
            BTN('nu_n_inc', '添加中子 ＋', function () { S.N++; }),
            BTN('nu_n_dec', '移除中子 －', function () { S.N = Math.max(0, S.N - 1); })
        ];
    },
    status: function (S) {
        var Z = S.P, N = S.N;
        if (!Z && !N) return { txt: '空核', bad: 0 };
        if (N > Z && N / Math.max(Z, 1) > 1.6) return { txt: '不稳定！中子过多，可能发生 β 衰变', bad: 1 };
        if (Z > N && Z >= 8) return { txt: '不稳定！质子太多，可能发生 α 衰变', bad: 2 };
        if (Math.abs(N - Z) > Math.max(2, Z * 0.5)) return { txt: '较不稳定（偏离稳定线）', bad: 1 };
        return { txt: '稳定 ✓', bad: 0 };
    },
    draw: function (g, S, W, H, t) {
        var st = this.status(S), warn = st.bad > 0;
        var cx = W * 0.42, cy = H * 0.42, ks = Math.min(W, H) / 460;
        if (warn) { g.save(); g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 9); CIRC(g, cx, cy, 120 * ks, '#fecaca'); g.restore(); }
        var tot = S.P + S.N;
        for (var i = 0; i < tot; i++) {
            var rr = i === 0 ? 0 : Math.sqrt(i) * 11 * ks * 1.1;
            var an = i * 2.39996 + Math.sin(t * 3 + i * 1.31) * 0.07;
            var px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr;
            var rad = 9.5 * ks * 1.1;
            if (i < S.P) { CIRC(g, px, py, rad, '#14b8a6', st.bad === 2 ? '#f97316' : '#0f766e', 1.5); TXT(g, '+', px, py + 4, { align: 'center', size: 11, weight: 'bold', color: '#fff' }); }
            else { CIRC(g, px, py, rad, '#ef4444', '#b91c1c', 1.5); }
        }
        TXT(g, 'A = ' + tot, cx, cy - 150 * ks * 1.1, { align: 'center', size: 20, weight: 'bold', color: st.bad ? '#b91c1c' : '#0f172a' });
        PILL(g, cx - 105 * ks * 1.4, cy + 132 * ks * 1.4, st.txt, st.bad ? '#b91c1c' : '#15803d', st.bad ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', 13);
        /* 底部 N-Z 平面小图 */
        var gx = W * 0.76, gy = H * 0.62, gw = Math.min(190, W * 0.2), gh = gw * 0.8;
        PANEL(g, gx, gy, gw, gh, { title: '稳定谷 N–Z 平面' });
        var u = function (n, z) { return [gx + 14 + (gw - 28) * CLAMP(n / Math.max(tot, 20), 0, 1), gy + gh - 14 - (gh - 34) * CLAMP(z / Math.max(tot, 20), 0, 1)]; };
        var p1 = u(0, 0), p2 = u(Math.max(tot, 20), Math.max(tot, 20));
        DASHLN(g, gx + 14, gy + gh - 14, p2[0], p2[1], '#94a3b8', 1.5);
        if (tot) { var cur = u(S.N, S.Z || S.P); CIRC(g, cur[0], cur[1], 6, warn ? '#ef4444' : '#16a34a'); }
        TXT(g, 'N →', gx + gw - 30, gy + gh - 2, { size: 10, color: '#64748b' });
        TXT(g, 'Z↑', gx + 4, gy + 26, { size: 10, color: '#64748b' });
        /* 核子池（可拖入核中） */
        var npxs = [W * 0.18, W * 0.30], npys = [H - 36, H - 36];
        for (var npi = 0; npi < 2; npi++) {
            var nix = npxs[npi], niy = npys[npi];
            if (S.drag === 'nuc' && S._dk === npi) { nix = S._px; niy = S._py; }
            CIRC(g, nix, niy, 16, npi === 0 ? '#14b8a6' : '#ef4444', npi === 0 ? '#0f766e' : '#b91c1c', 2);
            TXT(g, npi === 0 ? 'p⁺' : 'n', nix, niy + 4, { align: 'center', size: 12, weight: 'bold', color: '#fff' });
        }
        TXT(g, '拖动核子到核中添加', W * 0.24, H - 60, { align: 'center', size: 11, color: '#64748b' });
        hintDrag(g, '👆 拖动核子', W * 0.24, H - 80);
        var lgx = W - 120, lgy = 24;
        CIRC(g, lgx, lgy, 7, '#14b8a6'); TXT(g, '质子 ' + S.P, lgx + 14, lgy + 4, { size: 12 });
        CIRC(g, lgx, lgy + 22, 7, '#ef4444'); TXT(g, '中子 ' + S.N, lgx + 14, lgy + 26, { size: 12 });
    },
    data: function (S) {
        var st = IMPL.nucleus.status(S);
        return [
            { label: '质子 Z', value: S.P, unit: '', color: '#0d9488' },
            { label: '中子 N', value: S.N, unit: '', color: '#dc2626' },
            { label: '质量数 A', value: S.P + S.N, unit: '' },
            { label: '稳定性', value: st.txt, unit: '', color: st.bad ? '#dc2626' : '#16a34a' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, npxs = [W * 0.18, W * 0.30], npys = [H - 36, H - 36];
        for (var i = 0; i < 2; i++) if (Math.hypot(x - npxs[i], y - npys[i]) < 22) return true;
        return false;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, npxs = [W * 0.18, W * 0.30], npys = [H - 36, H - 36];
        for (var i = 0; i < 2; i++) if (Math.hypot(x - npxs[i], y - npys[i]) < 22) { S.drag = 'nuc'; S._dk = i; S._px = x; S._py = y; return; }
    },
    ptMove: function (S, x, y) { if (S.drag === 'nuc') { S._px = x; S._py = y; } },
    ptUp: function (S) {
        if (S.drag === 'nuc') {
            var W = S._W || 820, H = S._H || 480, cx = W * 0.42, cy = H * 0.42;
            if (Math.hypot(S._px - cx, S._py - cy) < 130) {
                if (S._dk === 0) S.P = Math.min(118, S.P + 1); else S.N = Math.min(180, S.N + 1);
            }
        }
        S.drag = null;
    }
},

/* ---------- 11 isotopes 同位素与原子质量 ---------- */
isotopes: {
    know: '<p>同位素质子数相同、中子数不同。元素的<strong>平均原子量</strong>是天然丰度的加权平均：M̄ = Σ pᵢ·mᵢ。拖动占比滑块（另一同位素自动互补到 100%）观察平均值移动。</p>',
    controls: function (S) {
        var e = ISO_ELEMS[S.ei];
        return [
            SEL('is_el', '选择元素', ISO_ELEMS.map(function (o, i) { return [String(i), o.name]; }), String(S.ei), function (v) {
                S.ei = parseInt(v, 10); S.p1 = ISO_ELEMS[S.ei].iso[0][2];
            }),
            SL('is_p1', e.iso[0][0] + ' 占比', 0, 100, 0.01, S.p1, '%', function (v) { S.p1 = v; })
        ];
    },
    draw: function (g, S, W, H) {
        var e = ISO_ELEMS[S.ei], p1 = CLAMP(S.p1, 0, 100), p2 = 100 - p1;
        var avg = e.iso[0][1] * p1 / 100 + e.iso[1][1] * p2 / 100;
        var cx = W * 0.32, cy = H * 0.42, R = Math.min(W, H) * 0.21;
        var a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * p1 / 100;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath();
        g.fillStyle = e.col[0]; g.fill();
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a1, a0 + Math.PI * 2); g.closePath();
        g.fillStyle = e.col[1]; g.fill();
        CIRC(g, cx, cy, R, null, '#fff', 3);
        if (S.drag === 'pie') { CIRC(g, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 10, '#fbbf24', '#b45309', 2); }
        /* 迷你原子图标 半径∝丰度 */
        e.iso.forEach(function (iso, i) {
            var p = i ? p2 : p1;
            var ax = cx + (i ? 1 : -1) * (R + 64), ay = cy;
            CIRC(g, ax, ay, 8 + p / 100 * 30, e.col[i], 'rgba(0,0,0,0.2)', 1.5);
            TXT(g, iso[0] + '  ' + FMT(p, 2) + '%', ax, ay + 48 + (i ? 16 : 0), { align: 'center', size: 12, weight: 'bold', color: e.col[i] });
            /* 自然丰度参考虚线标记 */
            var ny = ay + 64;
            LINE(g, ax - 40, ny, ax - 40 + 80 * iso[2] / 100, ny, RGBA(e.col[i], 0.9), 3);
            DASHLN(g, ax - 40 + 80 * iso[2] / 100, ny - 5, ax - 40 + 80 * iso[2] / 100, ny + 5, '#334155', 1);
            TXT(g, '自然丰度 ' + FMT(iso[2], 2) + '%', ax, ny + 14, { align: 'center', size: 10, color: '#64748b' });
        });
        TXT(g, e.name + ' 的同位素丰度', cx, cy - R - 20, { align: 'center', size: 17, weight: 'bold', color: '#0f172a' });
        hintDrag(g, '👆 拖动占比', cx, cy - R - 42);
        TXT(g, '平均原子量 M̄ = ' + FMT(avg, 3) + ' u', W * 0.72, H * 0.34, { align: 'center', size: 21, weight: 'bold', color: '#7c3aed' });
        /* 天然值对照 */
        var nat = e.iso[0][1] * e.iso[0][2] / 100 + e.iso[1][1] * e.iso[1][2] / 100;
        DASHLN(g, W * 0.60, H * 0.40, W * 0.86, H * 0.40, '#cbd5e1', 1.5);
        TXT(g, '天然平均 ≈ ' + FMT(nat, 3) + ' u（虚线对照）', W * 0.73, H * 0.40 + 18, { align: 'center', size: 12, color: '#64748b' });
    },
    data: function (S) {
        var e = ISO_ELEMS[S.ei], p1 = CLAMP(S.p1, 0, 100), p2 = 100 - p1;
        var avg = e.iso[0][1] * p1 / 100 + e.iso[1][1] * p2 / 100;
        return [
            { label: e.iso[0][0] + ' 质量', value: FMT(e.iso[0][1], 3), unit: 'u' },
            { label: '占比', value: FMT(p1, 2), unit: '%', color: e.col[0] },
            { label: e.iso[1][0] + ' 占比', value: FMT(p2, 2), unit: '%', color: e.col[1] },
            { label: '平均原子量', value: FMT(avg, 3), unit: 'u', color: '#7c3aed' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, e = ISO_ELEMS[S.ei];
        var cx = W * 0.32, cy = H * 0.42, R = Math.min(W, H) * 0.21;
        var a1 = -Math.PI / 2 + Math.PI * 2 * CLAMP(S.p1, 0, 100) / 100;
        var bx = cx + Math.cos(a1) * R, by = cy + Math.sin(a1) * R;
        return Math.hypot(x - bx, y - by) < 24;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, e = ISO_ELEMS[S.ei];
        var cx = W * 0.32, cy = H * 0.42, R = Math.min(W, H) * 0.21;
        var a1 = -Math.PI / 2 + Math.PI * 2 * CLAMP(S.p1, 0, 100) / 100;
        var bx = cx + Math.cos(a1) * R, by = cy + Math.sin(a1) * R;
        if (Math.hypot(x - bx, y - by) < 24) S.drag = 'pie';
    },
    ptMove: function (S, x, y) {
        if (S.drag !== 'pie') return;
        var W = S._W || 820, H = S._H || 480, cx = W * 0.32, cy = H * 0.42;
        var ang = Math.atan2(y - cy, x - cx), d = ang - (-Math.PI / 2);
        d = d - Math.floor(d / (Math.PI * 2)) * Math.PI * 2;
        S.p1 = CLAMP(d / (Math.PI * 2) * 100, 0, 100);
    },
    ptUp: function (S) { S.drag = null; }
},

/* ---------- 12 rutherford 卢瑟福散射 ---------- */
rutherford: {
    know: '<p><strong>汤姆孙“李子布丁”模型</strong>预言 α 粒子只轻微偏转；而<strong>卢瑟福核式模型</strong>中，少数粒子靠近致密核电荷会大角度甚至反弹（>90°）——这就是原子有核的证据。</p>',
    controls: function (S) {
        return [
            SEL('ru_m', '原子模型', [['pudding', '李子布丁模型'], ['nuclear', '核式模型']], S.model === 'pudding' ? 'pudding' : 'nuclear', function (v) { S.model = v; }),
            SL('ru_s', '粒子速率', 1, 3, 0.1, S.spd, '×', function (v) { S.spd = v; }),
            CK('ru_t', '显示径迹', S.trails, function (v) { S.trails = v; }),
            BTN('ru_c', '清空轨迹并重新统计', function () { S.alp = []; S.total = 0; S.big = 0; })
        ];
    },
    update: function (S, dt, t, W0, H0) {
        S.alp = S.alp || [];
        var W = W0 || 820, H = H0 || 480;
        var foilX = W / 2, cy = H / 2, k = 900000;
        S.emitAcc = (S.emitAcc || 0) + dt;
        var rate = 0.09 / mobPS();
        var trailMax = Math.max(6, mobReduce(12));
        while (S.emitAcc > rate) {
            S.emitAcc -= rate;
            S.total++;
            var ecy = S.srcY != null ? S.srcY : cy;
            S.alp.push({ x: -20, y: ecy + (makeRng(S.total * 7919)() - 0.5) * H * 0.40, vx: 150 * S.spd, vy: 0, bounced: false, dead: false, tr: [] });
        }
        for (var i = S.alp.length - 1; i >= 0; i--) {
            var p = S.alp[i];
            var dx = p.x - foilX, dy = p.y - cy, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
            if (S.model === 'nuclear') {
                if (d < 190 && d > 4) {
                    var F = k / (d2 + 600);
                    p.vx += F * dx / d * dt; p.vy += F * dy / d * dt;
                }
            } else {
                p.vx -= 6 * dt; /* 弥散正电荷：整体微小减速 */
                p.vy += Math.sin(t * 7 + i * 2.7) * 140 * dt * (makeRng(i * 131 + (S.total >>> 3))() - 0.35);
            }
            p.x += p.vx * dt; p.y += p.vy * dt;
            /* 记录 strobe 轨迹：每4帧存点保留12个 */
            S.fc = (S.fc || 0) + 1;
            if (S.trails && S.fc % 4 === 0) { p.tr.push([p.x, p.y]); if (p.tr.length > trailMax) p.tr.shift(); }
            if (!p.bounced && p.x > foilX + 20 && p.vx < 0) { p.bounced = true; S.big++; }
            if (p.x < -60 || p.x > W + 60 || Math.abs(p.y - cy) > H) S.alp.splice(i, 1);
        }
        this.lastFrame = true;
    },
    resize: function (W, H) { this.lastW = W; this.lastH = H; },
    draw: function (g, S, W, H) {
        var foilX = W / 2, cy = H / 2;
        /* 金箔 */
        var fg = g.createLinearGradient(foilX - 7, 0, foilX + 7, 0);
        fg.addColorStop(0, '#b8860b'); fg.addColorStop(0.5, '#facc15'); fg.addColorStop(1, '#b8860b');
        g.fillStyle = fg; g.fillRect(foilX - 6, cy - H * 0.36, 12, H * 0.72);
        TXT(g, '金箔', foilX, cy - H * 0.36 - 10, { align: 'center', size: 12, color: '#a16207' });
        /* 发射源 */
        var sy = S.srcY != null ? S.srcY : cy;
        RR(g, 8, sy - 20, 52, 40, 8); g.fillStyle = S.drag === 'src' ? '#f59e0b' : '#475569'; g.fill();
        if (S.drag === 'src') { g.strokeStyle = '#fbbf24'; g.lineWidth = 3; g.stroke(); }
        TXT(g, 'α源', 34, sy + 5, { align: 'center', size: 13, color: '#fff' });
        hintDrag(g, '👆 上下拖动', 34, sy + 40);
        /* 轨迹与粒子 */
        (S.alp || []).forEach(function (p) {
            if (S.trails && p.tr.length > 1) {
                for (var i = 1; i < p.tr.length; i++) {
                    g.globalAlpha = i / p.tr.length * 0.5;
                    LINE(g, p.tr[i - 1][0], p.tr[i - 1][1], p.tr[i][0], p.tr[i][1], '#ef4444', 1.6);
                }
                g.globalAlpha = 1;
            }
            CIRC(g, p.x, p.y, 4.5, '#f87171', '#7f1d1d', 1);
        });
        /* 模型内的“原子”暗示 */
        if (S.model === 'nuclear') { CIRC(g, foilX, cy, 7, '#f59e0b', '#b45309', 1.5); }
        else { CIRC(g, foilX, cy, 60, 'rgba(250,204,21,0.08)', 'rgba(180,83,9,0.35)', 1.5, ); }
        PILL(g, W * 0.06, H * 0.06, S.model === 'nuclear' ? '核式模型：大角度散射可见' : '李子布丁模型：仅轻微偏转', '#b45309', 'rgba(250,204,21,0.15)');
    },
    data: function (S) {
        S.alp = S.alp || [];
        return [
            { label: '已发射 α 粒子', value: S.total, unit: '个' },
            { label: '飞行中', value: S.alp.length, unit: '个' },
            { label: '>90° 反弹', value: S.big, unit: '个', color: '#dc2626' },
            { label: '反弹占比', value: S.total ? FMT(S.big / S.total * 100, 1) : '0.0', unit: '%', color: S.big ? '#dc2626' : '#334155' }
        ];
    },
    hitTest: function (S, x, y) {
        var H = S._H || 480, cy = H / 2, sy = S.srcY != null ? S.srcY : cy;
        return x > 0 && x < 64 && Math.abs(y - sy) < 26;
    },
    ptDown: function (S, x, y) {
        var H = S._H || 480, cy = H / 2, sy = S.srcY != null ? S.srcY : cy;
        if (x > 0 && x < 64 && Math.abs(y - sy) < 26) S.drag = 'src';
    },
    ptMove: function (S, x, y) { if (S.drag === 'src') S.srcY = CLAMP(y, 40, (S._H || 480) - 40); },
    ptUp: function (S) { S.drag = null; }
},

/* ---------- 13 hydrogenatom 氢原子模型 ---------- */
hydrogenatom: {
    know: '<p>玻尔模型中电子只能处在分立能级 n = 1,2,3…，半径 ∝ n²。光子能量须精确等于能级差才能被吸收：<strong>1/λ = R(1/n低² − 1/n高²)</strong>。吸收后电子跃迁（随机选择允许的高能级），回落时再辐射出对应波长的光子，记录在下方光谱带上。</p>',
    controls: function (S) {
        return [
            SL('hy_w', '光子波长', 90, 1600, 1, S.wave, 'nm', function (v) { S.wave = v; }),
            SEL('hy_n0', '设电子回到能级', [['1', '基态 n=1'], ['2', 'n=2'], ['3', 'n=3']], String(S.home || 1), function (v) { S.home = parseInt(v, 10); }),
            CK('hy_a', '连续发射光子枪', S.auto, function (v) { S.auto = v; }),
            BTN('hy_f', '手动发射一个光子', function () { IMPL.hydrogenatom.fire(S); }),
            BTN('hy_r', '电子回基态', function () { S.ni = S.home || 1; S.ph = null; })
        ];
    },
    fire: function (S) { S.gun = 0.001; S.wantFire = true; },
    update: function (S, dt, t, W0, H0) {
        var WV = W0 || 820, HV = H0 || 480;
        S._ax = WV * 0.4; S._ay = HV * 0.42; S._aw = WV; S._ah = HV;
        S.eAng += dt * (1.9 / (S.ni * S.ni));
        if (S.flash > 0) S.flash -= dt;
        if (S.wobble > 0) S.wobble -= dt;
        var axc0 = this.ax(S);
        /* 光子枪发射 */
        if (S.auto) S.gunAcc = (S.gunAcc || 0) + dt;
        var fireInterval = S.auto ? 0.75 : Infinity;
        if (S.wantFire) { S.wantFire = false; if (!S.ph) this.spawnPhoton(S); }
        if (S.auto && S.gunAcc > fireInterval && !S.ph) { S.gunAcc = 0; this.spawnPhoton(S); }
        /* 光子飞行与命中判定 */
        if (S.ph) {
            var p = S.ph;
            p.x -= 320 * dt;
            var axc = axc0, orp = Math.max(this.orbPx(S), 26);
            if (!p.hitDone && p.x <= axc + orp && Math.abs(p.y - this.ay(S)) < orp + 12) {
                p.hitDone = true;
                var cand = [], nf;
                for (nf = S.ni + 1; nf <= 8; nf++) {
                    if (Math.abs(rydLam(S.ni, nf) - S.wave) < 4) cand.push(nf);
                }
                if (cand.length && !S.busy) {
                    var pick = cand[Math.floor(makeRng((Date.now() % 999983) + S.lines.length)() * cand.length)];
                    S.fromN = S.ni; S.ni = pick; S.flash = 0.5; S.wobble = 0.9; S.busy = true;
                    S.lineMemo = S.lineMemo || {};
                    S.lineMemo[FMT(S.wave, 1)] = 1;
                    S.ph = null;
                }
            } else if (p.x < -30) { S.ph = null; }
        }
        /* 吸收后延迟回落，级联发射低能级间跃迁的光子 */
        if (S.busy) {
            S.casc = (S.casc || 0) + dt;
            if (S.casc > 0.7) {
                S.casc = 0; S.wobble = 0.45;
                var lower = Math.max(S.home || 1, S.fromN || 1);
                if (S.ni > lower) {
                    var stepMax = S.ni - lower;
                    var dStep = stepMax === 1 ? 1 : 1 + Math.floor(makeRng((Date.now() >> 3) % 524287)() * stepMax);
                    var drop = S.ni - dStep;
                    var lam2 = rydLam(drop, S.ni);
                    S.rays.push({ x: axc, y: this.ay(S), lam: lam2, vx: 340, life: 4, ph: Date.now() % 97 });
                    S.lineMemo[FMT(lam2, 1)] = 1;
                    S.ni = drop;
                } else { S.busy = false; }
            }
        }
        /* 再辐射光子飞出屏幕 */
        for (var ri = (S.rays || []).length - 1; ri >= 0; ri--) {
            var q = S.rays[ri];
            q.x += q.vx * dt; q.y = this.ay(S) - 46; q.life -= dt;
            if (q.x > WV + 40 || q.life <= 0) S.rays.splice(ri, 1);
        }
    },
    ax: function (S) { return S._ax || 320; },
    ay: function (S) { return S._ay || 200; },
    orbPx: function (S) {
        var HV = S._ah || 480;
        var u = Math.min(HV * 0.4 / 36, (this.ax(S) - 60) / 36);
        return u * S.ni * S.ni;
    },
    spawnPhoton: function (S) {
        S.ph = { x: (S._aw || 820) - 54, y: (S.gunY != null) ? S.gunY : this.ay(S), hitDone: false };
    },
    draw: function (g, S, W, H, t) {
        var self = this, cx = W / 2, cy = H * 0.44, uvY = H * 0.66;
        /* 能级环 */
        for (var n = 1; n <= 6; n++) {
            var rr = this.orbPxOf(S, n);
            CIRC(g, cx, cy, rr, null, 'rgba(100,116,139,' + (n === S.ni ? 0.55 : 0.22) + ')', n === S.ni ? 2 : 1);
            TXT(g, 'n=' + n, cx + 4, cy - rr - 3, { size: 10, color: '#94a3b8' });
        }
        /* 原子核 */
        CIRC(g, cx, cy, 9, '#ef4444', '#b91c1c', 1.5);
        TXT(g, '+', cx, cy + 4, { align: 'center', size: 12, weight: 'bold', color: '#fff' });
        /* 电子 */
        var wob = S.wobble > 0 ? Math.sin(t * 26) * (S.wobble * 10) : 0;
        var eR = this.orbPxOf(S, S.ni) + wob;
        var ex = cx + Math.cos(S.eAng) * eR, ey = cy + Math.sin(S.eAng) * eR;
        CIRC(g, ex, ey, 7, '#2563eb', '#1e3a8a', 1.5);
        if (S.flash > 0) { g.save(); g.globalAlpha = CLAMP(S.flash * 2, 0, 1); CIRC(g, ex, ey, 20, RGBA('#60a5fa', 0.45)); g.restore(); }
        /* 光子枪 */
        var gx0 = W - 74, gy = (S.gunY != null) ? S.gunY : cy;
        RR(g, gx0, gy - 26, 58, 52, 10); g.fillStyle = S.drag === 'gun' ? '#f59e0b' : '#334155'; g.fill();
        TXT(g, '光子枪', gx0 + 29, gy + 38, { align: 'center', size: 11, color: '#64748b' });
        hintDrag(g, '👆 上下拖动', gx0 + 29, gy + 58);
        LINE(g, gx0 - 4, gy, cx + this.orbPxOf(S, 6) + 14, cy, WCOL(S.wave), 4);
        TXT(g, FMT(S.wave, 0) + 'nm', gx0 + 29, gy - 34, { align: 'center', size: 11, weight: 'bold', color: WCOL(S.wave) });
        /* 入射光子 */
        if (S.ph) CIRC(g, S.ph.x, S.ph.y, 6, WCOL(S.wave), '#fff', 1.5);
        /* 再辐射光子（波浪线） */
        (S.rays || []).forEach(function (r) {
            g.save(); g.globalAlpha = CLAMP(r.life, 0, 1); g.strokeStyle = WCOL(r.lam); g.lineWidth = 2.5;
            g.beginPath();
            for (var xx = 0; xx <= 64; xx += 4) {
                var yy = r.y + Math.sin(xx * 0.28 + t * 18 + r.ph) * 7;
                if (xx === 0) g.moveTo(r.x + xx, yy); else g.lineTo(r.x + xx, yy);
            }
            g.stroke(); g.restore();
            TXT(g, FMT(r.lam, 0) + 'nm', r.x + 30, r.y - 14, { align: 'center', size: 10, color: WCOL(r.lam) });
        });
        /* 底部光谱带：UV / 可见 / IR */
        var bx0 = W * 0.08, bw0 = W * 0.84, by0 = H * 0.88, bh0 = 16;
        var wlToX = function (wl) { return bx0 + bw0 * (CLAMP(wl, 90, 1600) - 90) / 1510; };
        g.fillStyle = '#2e1065'; g.fillRect(bx0, by0, wlToX(380) - bx0, bh0);
        for (var wl = 380; wl < 750; wl += 10) { g.fillStyle = WCOL(wl + 5); g.fillRect(wlToX(wl), by0, wlToX(wl + 10) - wlToX(wl) + 1, bh0); }
        g.fillStyle = '#3d0000'; g.fillRect(wlToX(750), by0, bx0 + bw0 - wlToX(750), bh0);
        g.strokeStyle = '#cbd5e1'; g.lineWidth = 1; g.strokeRect(bx0, by0, bw0, bh0);
        TXT(g, 'UV(<380)', bx0 + 4, by0 - 4, { size: 10, color: '#7c3aed' });
        TXT(g, '可见光', wlToX(565), by0 - 4, { align: 'center', size: 10, color: '#16a34a' });
        TXT(g, '红外(>750)', bx0 + bw0 - 4, by0 - 4, { align: 'right', size: 10, color: '#b91c1c' });
        /* 已记录谱线：白色刻度 */
        Object.keys(S.lineMemo || {}).forEach(function (kk) {
            var lx = wlToX(parseFloat(kk));
            LINE(g, lx, by0 - 2, lx, by0 + bh0 + 2, '#ffffff', 2);
        });
        if (!S.lineMemo || !Object.keys(S.lineMemo).length)
            TXT(g, '调整波长至允许值附近（±4nm）后发射即可记录谱线', W / 2, by0 + bh0 + 16, { align: 'center', size: 12, color: '#64748b' });
    },
    orbPxOf: function (S, n) {
        var HV = S._ah || 480;
        var u = Math.min(HV * 0.17 / 36 * 2.2, 7);
        return u * n * n;
    },
    data: function (S) {
        var uniq = S.lineMemo ? Object.keys(S.lineMemo).length : 0;
        return [
            { label: '当前能级', value: 'n=' + S.ni, unit: '', color: '#2563eb' },
            { label: '枪波长', value: FMT(S.wave, 0), unit: 'nm', color: WCOL(S.wave) },
            { label: '已记录谱线', value: uniq, unit: '条' },
            { label: '最近一次 λ→λ', value: FMT(rydLam(Math.max(1, S.fromN || 1), Math.max(S.ni, 2)), 0), unit: 'nm' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, gx0 = W - 74, gy = (S.gunY != null) ? S.gunY : this.ay(S);
        return x > gx0 - 8 && x < gx0 + 66 && Math.abs(y - gy) < 30;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, gx0 = W - 74, gy = (S.gunY != null) ? S.gunY : this.ay(S);
        if (x > gx0 - 8 && x < gx0 + 66 && Math.abs(y - gy) < 30) S.drag = 'gun';
    },
    ptMove: function (S, x, y) { if (S.drag === 'gun') S.gunY = CLAMP(y, 40, (S._H || 480) - 60); },
    ptUp: function (S) { S.drag = null; }
},
/* ---------- 14 quantumtoss 量子硬币投掷 ---------- */
quantumtoss: {
    know: '<p>抛掷中的量子硬币处于<strong>叠加态</strong>：正面与反面同时存在。点击“观测”才会坍缩为确定结果。大量重复后，正面频率收敛于 1/2，波动幅度约 ±√(p(1−p)/n)（标准误差带）。</p>',
    controls: function (S) {
        return [
            BTN('qt_throw', '抛一次（进入叠加态）', function () { S.spin = true; S.rot = 0; S.face = null; }),
            BTN('qt_obsv', '观测！（波函数坍缩）', function () {
                if (S.spin) { S.spin = false; S.face = makeRng((Date.now() % 104729) + S.n * 31)() < 0.5 ? 'H' : 'T';
                    S.n++; if (S.face === 'H') S.h++;
                    S.hist.push(S.h / S.n); if (S.hist.length > 400) S.hist.shift(); }
            }),
            BTN('qt_100', '连续快抛 100 次', function () { S.batch += 100; }),
            CK('qt_auto', '自动连续观测', false, function (v) { S.autoObs = v; })
        ];
    },
    update: function (S, dt) {
        if (S.spin) S.rot += dt * 14;
        /* 批量快速统计：每帧结算若干次，不做逐次动画 */
        var k = Math.min(S.batch, 5);
        while (k-- > 0 && S.batch > 0) {
            S.batch--;
            var f = makeRng((Date.now() + S.n * 7919) % 1300727)();
            S.n++; if (f < 0.5) S.h++;
            S.hist.push(S.h / S.n); if (S.hist.length > 400) S.hist.shift();
        }
        if (S.autoObs && (S.autoT = (S.autoT || 0) + dt) > 0.25 && !S.spin && !S.batch) { S.autoT = 0; this.doThrow(S); }
    },
    doThrow: function (S) {
        S.spin = true; S.rot = 0; S.face = null;
        this.pendObs = (this.pendObs || 0) + 1;
        if (this.pendObs > 3) { this.pendObs = 0; S.face = makeRng((Date.now() % 99991) + S.n) () < 0.5 ? 'H' : 'T'; S.spin = false;
            S.n++; if (S.face === 'H') S.h++; S.hist.push(S.h / S.n); if (S.hist.length > 400) S.hist.shift(); }
    },
    draw: function (g, S, W, H, t) {
        var cx = W / 2, cy = H * 0.34, R = Math.min(W, H) * 0.13;
        var p = S.n ? S.h / S.n : 0.5, se = Math.sqrt(p * (1 - p) / Math.max(S.n, 1));
        /* 硬币 */
        g.save(); g.translate(cx, cy);
        var squash = S.spin ? Math.abs(Math.cos(S.rot)) : 1;
        CIRC(g, 0, 0, R, '#fde68a', '#b45309', 3);
        if (S.spin) {
            for (var i = 0; i < 4; i++) { g.globalAlpha = 0.16 - i * 0.03; LINE(g, -R * squash, -R + i * 6, R * squash, -R + i * 6, '#b45309', 2); }
            g.globalAlpha = 1;
        }
        TXT(g, S.spin ? '?' : (S.face === 'H' ? '正' : S.face === 'T' ? '反' : '?'), 0, R * 0.34,
            { align: 'center', size: R * 0.9, weight: 'bold', color: '#92400e' });
        g.restore();
        TXT(g, S.spin ? '叠加态 Σ 中……点击「观测！」坍缩' : (S.face === 'H' ? '结果：正面 🪙' : S.face === 'T' ? '结果：反面 🌙' : '等待首次投掷'),
            cx, cy + R + 30, { align: 'center', size: 15, weight: 'bold', color: S.spin ? '#7c3aed' : '#334155' });
        /* 频率收敛曲线 + 误差带 */
        var px0 = W * 0.1, pw = W * 0.8, py0 = H * 0.68, ph = H * 0.24;
        PANEL(g, px0 - 10, py0 - 26, pw + 20, ph + 44, { title: '正面频率收敛（n=' + S.n + '）' });
        DASHLN(g, px0, py0 + ph * 0.5, px0 + pw, py0 + ph * 0.5, '#94a3b8', 1.5);
        TXT(g, '理论 p=0.5', px0 + pw - 4, py0 + ph * 0.5 - 5, { align: 'right', size: 10, color: '#64748b' });
        /* σ 误差带 */
        var yTop = py0 + ph * (0.5 - CLAMP(se, 0, 0.5)), yBot = py0 + ph * (0.5 + CLAMP(se, 0, 0.5));
        g.fillStyle = 'rgba(124,58,237,0.10)'; g.fillRect(px0, yTop, pw, yBot - yTop);
        DASHLN(g, px0, yTop, px0 + pw, yTop, 'rgba(124,58,237,0.45)', 1);
        DASHLN(g, px0, yBot, px0 + pw, yBot, 'rgba(124,58,237,0.45)', 1);
        /* 折线 */
        if (S.hist.length > 1) {
            g.save(); g.strokeStyle = '#2563eb'; g.lineWidth = 2; g.beginPath();
            for (var hI = 0; hI < S.hist.length; hI++) {
                var xx2 = px0 + pw * hI / Math.max(S.hist.length - 1, 1);
                var yy2 = py0 + ph * (1 - CLAMP(S.hist[hI], 0, 1));
                if (!hI) g.moveTo(xx2, yy2); else g.lineTo(xx2, yy2);
            }
            g.stroke(); g.restore();
        }
        PILL(g, px0 + 8, py0 + 8, 'σ ≈ ±' + FMT(se * 100, 2) + '%　|偏差| 在 σ 内？' +
            (Math.abs(p - 0.5) <= se || !S.n ? '✓ 是' : '✗ 否'), '#7c3aed', 'rgba(124,58,237,0.12)', 11);
    },
    data: function (S) {
        var p = S.n ? S.h / S.n : 0.5, se = Math.sqrt(0.25 / Math.max(S.n, 1));
        return [
            { label: '投掷次数 n', value: S.n, unit: '次' },
            { label: '正面次数', value: S.h, unit: '次' },
            { label: '正面频率', value: FMT(p * 100, 1), unit: '%', color: '#2563eb' },
            { label: 'vs 理论 50%', value: FMT((p - 0.5) * 100, 1), unit: '%（σ=' + FMT(se * 100, 1) + '%）', color: Math.abs(p - 0.5) <= se ? '#16a34a' : '#dc2626' }
        ];
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, cx = W / 2, cy = H * 0.34, R = Math.min(W, H) * 0.13;
        if (Math.hypot(x - cx, y - cy) < R + 18) {
            if (S.spin) {
                S.spin = false; S.face = makeRng((Date.now() % 104729) + S.n * 31)() < 0.5 ? 'H' : 'T';
                S.n++; if (S.face === 'H') S.h++;
                S.hist.push(S.h / S.n); if (S.hist.length > 400) S.hist.shift();
            } else { S.spin = true; S.rot = 0; S.face = null; }
        }
    }
},
/* ---------- 15 quantmeas 量子测量（偏振） ---------- */
quantmeas: {
    know: '<p><strong>Malus 定律</strong>：I = I₀·cos²(Δθ)。光子通过第一个偏振滤光片时以 cos²θ₁ 的概率被透过，测量使光子极化方向“坍缩”为 θ₁；再经第二片，概率为 cos²(θ₂−θ₁)。</p>',
    controls: function (S) {
        return [
            SL('qm_t1', '第一滤光片角度 θ₁', 0, 180, 1, S.th1, '°', function (v) { S.th1 = v; }),
            SL('qm_t2', '第二滤光片角度 θ₂', 0, 180, 1, S.th2, '°', function (v) { S.th2 = v; }),
            BTN('qm_rs', '重置统计', function () { S.em = 0; S.p1c = 0; S.p2c = 0; S.phots = []; })
        ];
    },
    update: function (S, dt, t, W0, H0) {
        var W = W0 || 820;
        /* 按理论强度比例投放视觉光子：I0→100/s 上限 */
        S.acc = (S.acc || 0) + dt * 55 * mobPS();
        while (S.acc >= 1) {
            S.acc -= 1; S.em++;
            S.phots.push({ x: -10, y: (H0 || 480) * 0.4 + Math.sin(S.em * 12.9898) * 40, stg: 0, ang: makeRng(S.em * 7717)() < 0.5 ? S.th1 : null });
        }
        var fX = [W * 0.38, W * 0.66];
        for (var i = S.phots.length - 1; i >= 0; i--) {
            var q = S.phots[i];
            q.x += 260 * dt;
            if (q.stg === 0 && q.x >= fX[0]) {
                q.stg = 1;
                if (makeRng((Date.now() % 32749) + i * 911)() < Math.cos(S.th1 * Math.PI / 180) ** 2) { S.p1c++; q.ang = S.th1; }
                else { S.phots.splice(i, 1); continue; }
            }
            if (q.stg === 1 && q.x >= fX[1]) {
                q.stg = 2;
                if (makeRng((Date.now() % 65521) + i * 337)() < Math.cos((S.th2 - S.th1) * Math.PI / 180) ** 2) { S.p2c++; q.ang = S.th2; }
                else { S.phots.splice(i, 1); continue; }
            }
            if (q.x > W + 20) S.phots.splice(i, 1);
        }
    },
    draw: function (g, S, W, H, t) {
        var cy = H * 0.42, fX = [W * 0.38, W * 0.66], ths = [S.th1, S.th2];
        /* 光源 */
        RR(g, 10, cy - 22, 50, 44, 8); g.fillStyle = '#0f172a'; g.fill();
        TXT(g, '光源\nI₀', 35, cy + 5, { align: 'center', size: 11, color: '#fbbf24' });
        TXT(g, '(100/s)', 35, cy + 40, { align: 'center', size: 10, color: '#64748b' });
        LINE(g, 60, cy, fX[0] - 26, cy, '#fbbf24', 2);
        /* 两级滤光片：圆盘+旋转缝隙 */
        for (var fi = 0; fi < 2; fi++) {
            CIRC(g, fX[fi], cy, 30, 'rgba(59,130,246,0.15)', (S.drag === 'filt' && S._di === fi) ? '#f59e0b' : '#2563eb', (S.drag === 'filt' && S._di === fi) ? 4 : 2.5);
            g.save(); g.translate(fX[fi], cy); g.rotate(ths[fi] * Math.PI / 180);
            LINE(g, -28, 0, 28, 0, '#1d4ed8', 5);
            DASHLN(g, -24, -8, 24, -8, 'rgba(29,78,216,0.4)', 2);
            g.restore();
            ARCdeg(g, fX[fi], cy, 40, ths[fi]);
            TXT(g, 'θ' + (fi + 1) + '=' + ths[fi] + '°', fX[fi], cy + 56, { align: 'center', size: 12, weight: 'bold', color: '#1d4ed8' });
            hintDrag(g, '👆 拖动角度', fX[fi], cy + 76);
        }
        LINE(g, fX[1] + 30, cy, W * 0.86, cy, '#fbbf24', 2);
        /* 强度条 */
        var I1 = 100 * Math.cos(S.th1 * Math.PI / 180) ** 2;
        var I2 = I1 * Math.cos((S.th2 - S.th1) * Math.PI / 180) ** 2;
        bars(g, W * 0.88, H * 0.16, [
            ['I₀', 100, '#94a3b8'], ['I₁', I1, '#2563eb'], ['I₂', I2, '#16a34a']
        ], H * 0.52);
        /* 光子 */
        (S.phots || []).forEach(function (q) {
            g.save(); g.translate(q.x, q.y); g.rotate((q.ang || 0) * Math.PI / 180);
            CIRC(g, 0, 0, 5, RGBA('#fbbf24', 0.95));
            LINE(g, -11, 0, 11, 0, RGBA('#f59e0b', 0.8), 2);
            g.restore();
        });
    },
    data: function (S) {
        var r1 = Math.cos(S.th1 * Math.PI / 180) ** 2, r2 = Math.cos((S.th2 - S.th1) * Math.PI / 180) ** 2;
        return [
            { label: 'I₁ 理论值', value: FMT(r1 * 100, 1), unit: '/s', color: '#2563eb' },
            { label: 'I₂ = I₁cos²Δθ', value: FMT(r1 * r2 * 100, 1), unit: '/s', color: '#16a34a' },
            { label: '总透射率', value: FMT(r1 * r2 * 100, 1), unit: '%' },
            { label: '累计通过/发射', value: S.p2c + ' / ' + S.em, unit: '', color: '#b45309' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, cy = H * 0.42, fX = [W * 0.38, W * 0.66];
        for (var i = 0; i < 2; i++) if (Math.hypot(x - fX[i], y - cy) < 34) return true;
        return false;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, cy = H * 0.42, fX = [W * 0.38, W * 0.66];
        for (var i = 0; i < 2; i++) if (Math.hypot(x - fX[i], y - cy) < 34) { S.drag = 'filt'; S._di = i; return; }
    },
    ptMove: function (S, x, y) {
        if (S.drag !== 'filt') return;
        var W = S._W || 820, H = S._H || 480, cy = H * 0.42, fX = [W * 0.38, W * 0.66], i = S._di;
        var th = Math.atan2(y - cy, x - fX[i]) * 180 / Math.PI;
        th = ((th % 360) + 360) % 360; if (th >= 180) th -= 180;
        if (i === 0) S.th1 = Math.round(th); else S.th2 = Math.round(th);
    },
    ptUp: function (S) { S.drag = null; }
},
/* ---------- 16 molight 分子与光 ---------- */
molight: {
    know: '<p>分子的键像小弹簧，只在特定的<strong>振动频率</strong>（波数 cm⁻¹）附近共振吸收入射光：CO₂ 667（弯曲）、2350（不对称伸缩）；H₂O 1595、3650；CH₄ 1306、3010。吸收后振幅激增并发光，随后以更低频率再辐射。可见光波段分子几乎不吸收。</p>',
    controls: function (S) {
        return [
            SEL('ml_m', '选择分子', MOLS_IR.map(function (m, i) { return [String(i), m.name]; }), String(S.mi), function (v) { S.mi = parseInt(v, 10); }),
            SL('ml_nu', '入射光波数 ν', 1000, 4000, 5, S.nu, 'cm⁻¹', function (v) { S.nu = v; }),
            CK('ml_a', '连续辐射', S.auto, function (v) { S.auto = v; })
        ];
    },
    match: function (S) {
        var mol = MOLS_IR[S.mi], hits = [];
        mol.modes.forEach(function (m2) { if (Math.abs(S.nu - m2[0]) < 150) hits.push(m2[1] + ' @' + m2[0]); });
        return hits;
    },
    update: function (S, dt, t, W0, H0) {
        var hits = this.match(S), on = hits.length > 0;
        var H = H0 || 480;
        if (on && S.auto) {
            S.vib = Math.min(S.vib + dt * 3, 1);
            S.emitT = (S.emitT || 0) + dt;
            if (S.emitT > 0.55) {
                S.emitT = 0;
                S.rays.push({ x: (W0 || 820) / 2, y: H * 0.5, vy: 160, life: 1.6, ph: Math.random() * 7 });
            }
        } else S.vib = Math.max(0, S.vib - dt * 1.4);
        for (var i = S.rays.length - 1; i >= 0; i--) {
            var r = S.rays[i];
            r.y += r.vy * dt; r.life -= dt;
            if (r.life <= 0 || r.y > H) S.rays.splice(i, 1);
        }
    },
    draw: function (g, S, W, H, t) {
        var mol = MOLS_IR[S.mi], vib = S.vib, cx = W * 0.42, cy = H * 0.44;
        /* 入射波 */
        var onI = this.match(S).length > 0;
        g.save();
        g.strokeStyle = onI ? '#f97316' : '#94a3b8'; g.lineWidth = 2.2;
        g.beginPath();
        for (var xx = W * 0.04; xx < cx - 70; xx += 6) {
            var yy = cy + Math.sin(xx * 0.09 - t * 12) * (9 + vib * 5);
            if (xx <= W * 0.05) g.moveTo(xx, yy); else g.lineTo(xx, yy);
        }
        g.stroke(); g.restore();
        TXT(g, 'IR 光束 ν=' + FMT(S.nu, 0) + ' cm⁻¹', W * 0.05, cy - 26, { size: 11, color: '#b45309' });
        /* 分子：原子球+锯齿弹簧键，共振时放大振动 */
        var sc = 1.35, amp = 3 + vib * 9;
        function ap(i) {
            var a = mol.atoms[i], jx = a[1] * sc, jy = a[2] * sc;
            if (vib > 0.02) {
                var dir = i % 2 ? 1 : -1;
                jy += dir * Math.sin(t * (14 + vib * 10)) * amp;
                jx += Math.cos(t * (9 + vib * 8)) * amp * 0.4;
            }
            return [cx + jx, cy + jy];
        }
        mol.bonds.forEach(function (bd) {
            var p1 = ap(bd[0]), p2 = ap(bd[1]);
            if (vib > 0.02) { CIRC(g, (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 16, RGBA('#fbbf24', 0.25 * vib)); }
            g.save(); g.strokeStyle = vib > 0.15 ? '#f59e0b' : '#64748b'; g.lineWidth = 3;
            g.beginPath(); g.moveTo(p1[0], p1[1]);
            var mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
            var dx = p2[0] - p1[0], dy = p2[1] - p1[1], L2 = Math.hypot(dx, dy) || 1;
            var zig = 5 + vib * 6;
            g.lineTo(mx - dy / L2 * zig, my + dx / L2 * zig);
            g.lineTo(p2[0], p2[1]); g.stroke(); g.restore();
        });
        var elCol = { O: '#ef4444', C: '#334155', H: '#f8fafc' };
        for (var ai = 0; ai < mol.atoms.length; ai++) {
            var P2 = ap(ai), aEl = mol.atoms[ai][0];
            elemIcon(g, P2[0], P2[1], aEl === 'H' ? 13 : 19, elCol[aEl], aEl, aEl === 'H' ? 11 : 14);
        }
        /* 匹配提示 */
        var hits = this.match(S);
        if (hits.length) {
            PILL(g, cx - 60, cy - 90, '⚡ 共振吸收：' + hits.join('、'), '#b45309', 'rgba(250,204,21,0.2)', 12);
        } else {
            PILL(g, cx - 60, cy - 90, '未匹配振动模式 → 直接透射', '#64748b', 'rgba(148,163,184,0.15)', 12);
        }
        /* 再发射低频波浪 */
        (S.rays || []).forEach(function (r) {
            g.save(); g.globalAlpha = CLAMP(r.life, 0, 1);
            g.strokeStyle = '#ef4444'; g.lineWidth = 2;
            g.beginPath();
            for (var yy2 = 0; yy2 <= 52; yy2 += 4) {
                var xr = r.x + Math.sin(yy2 * 0.3 + t * 16 + r.ph) * 8;
                if (!yy2) g.moveTo(xr, r.y + yy2); else g.lineTo(xr, r.y + yy2);
            }
            g.stroke(); g.restore();
        });
        TXT(g, '吸收后再辐射：更低频 · 方向随机', cx, H - 24, { align: 'center', size: 11, color: '#94a3b8' });
    },
    data: function (S) {
        var hits = IMPL.molight.match(S);
        return [
            { label: '当前波数', value: FMT(S.nu, 0), unit: 'cm⁻¹' },
            { label: '匹配模式', value: hits.length ? hits.join('、') : '无（透射）', unit: '', color: hits.length ? '#dc2626' : '#64748b' },
            { label: '振动幅度', value: FMT(S.vib * 100, 0), unit: '%', color: '#ea580c' },
            { label: '特征峰参考', value: MOLS_IR[S.mi].modes.map(function (m) { return m[0]; }).join(' / '), unit: 'cm⁻¹' }
        ];
    }
},
/* ---------- 17 molshapes 分子形状（VSEPR，basics 简化） ---------- */
molshapes: {
    know: '<p><strong>VSEPR 价层电子对互斥理论</strong>：电子对（成键 σ 对 + 孤对）尽量远离排布。几何由“电对总数”决定；孤对斥力更大，会压缩键角并改变分子名称（如 AX₂E₂ 为 V 形）。中央原子缓慢摆动便于观察立体投影。</p>',
    presets: function (S) {
        function st(l2, lo) { return function () { S.lig = l2; S.lone = lo; }; }
        return [
            { name: 'BeF₂ 直线', apply: st(2, 0) },
            { name: 'BF₃ 三角', apply: st(3, 0) },
            { name: 'H₂O V形', apply: st(2, 1) },
            { name: 'CH₄ 四面体', apply: st(4, 0) },
            { name: 'NH₃ 三角锥', apply: st(3, 1) },
            { name: 'SF₆ 八面体', apply: st(6, 0) },
            { name: 'PCl₅ 双锥', apply: st(5, 0) }
        ];
    },
    controls: function (S, basic) {
        return [
            SL('ms_l', '配体原子数 B', basic ? 2 : 2, basic ? 4 : 6, 1, CLAMP(S.lig, 2, basic ? 4 : 6), '', function (v) {
                S.lig = v; if ((v + S.lone) > 6) S.lone = Math.max(0, 6 - v);
            }),
            SL('ms_e', '孤对电子对数 E', 0, 2, 1, CLAMP(S.lone, 0, Math.max(0, 6 - S.lig)), '', function (v) {
                S.lone = Math.min(v, 6 - S.lig);
            })
        ];
    },
    layout: function (S) {
        var d = S.lig + S.lone;
        var info = VSEPR[d + '-' + S.lone] || ['未知构型', 109.5];
        var pts = [], lobes = [];
        var start = -Math.PI / 2;
        for (var i = 0; i < d; i++) {
            var an = start + i * (Math.PI * 2 / d);
            if (i < S.lig) pts.push([Math.cos(an), Math.sin(an)]);
            else lobes.push([Math.cos(an), Math.sin(an)]);
        }
        return { d: d, name: info[0], angle: info[1], pts: pts, lobes: lobes };
    },
    draw: function (g, S, W, H, t) {
        var L = this.layout(S), cx = W * 0.46, cy = H * 0.42;
        var sw = Math.sin(t * 0.45) * 0.28 + Math.sin(t * 0.23) * 0.12;
        var R = S.blen || (Math.min(W, H) * 0.21), cr = Math.max(R, 60);
        /* 键 */
        L.pts.forEach(function (pv) {
            var an = Math.atan2(pv[1], pv[0]) + sw;
            var ex = cx + Math.cos(an) * R, ey = cy + Math.sin(an) * R;
            LINE(g, cx, cy, ex, ey, '#64748b', 5);
            CIRC(g, ex, ey, 17, S.drag === 'lig' ? '#fbbf24' : '#34d399', '#059669', 2);
            TXT(g, 'B', ex, ey + 5, { align: 'center', size: 13, weight: 'bold', color: '#fff' });
        });
        /* 孤对：楔形双点 */
        L.lobes.forEach(function (lv) {
            var an = Math.atan2(lv[1], lv[0]) + sw;
            var bx = cx + Math.cos(an) * R, by = cy + Math.sin(an) * R;
            g.save(); g.fillStyle = 'rgba(148,163,184,0.28)';
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(bx - 12, by - 9); g.lineTo(bx + 12, by - 9); g.closePath(); g.fill();
            g.strokeStyle = '#94a3b8'; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.stroke(); g.restore();
            CIRC(g, cx + Math.cos(an) * (R - 14) - 7, cy + Math.sin(an) * (R - 14), 4.5, '#475569');
            CIRC(g, cx + Math.cos(an) * (R - 14) + 7, cy + Math.sin(an) * (R - 14), 4.5, '#475569');
        });
        /* 中央原子 */
        elemIcon(g, cx, cy, Math.max(R * 0.34, 26), '#f472b6', 'A', 20);
        /* 键角标注（第一、二配体之间） */
        if (L.pts.length >= 2) {
            var a1 = Math.atan2(L.pts[0][1], L.pts[0][0]) + sw;
            var a2 = Math.atan2(L.pts[1][1], L.pts[0].length && L.pts[1] ? L.pts[1][0] : 1) + (L.pts.length > 1 ? 0 : 0);
            a2 = (function () { var v = startOf(L); return isFinite(v) ? v : a1 + 0.4; })();
            function startOf(L2) { return Math.atan2(L2.pts[1][1], L2.pts[1][0]) + sw; }
            var rA = cr * 0.42;
            g.save(); g.strokeStyle = '#b45309'; g.lineWidth = 2;
            g.beginPath(); g.arc(cx, cy, rA, -a1, -(a2 < a1 ? a2 + Math.PI * 2 : a2)); g.stroke(); g.restore();
            TXT(g, FMT(L.angle, 1) + '°', cx + Math.cos((a1 + a2) / 2) * (rA + 22), cy + Math.sin((a1 + a2) / 2) * (rA + 22),
                { align: 'center', size: 13, weight: 'bold', color: '#b45309' });
        }
        /* 名称与 AXE */
        var axeStr = 'AX' + sub(S.lig) + (S.lone ? ('E' + sub(S.lone)) : '');
        TXT(g, axeStr + '：' + L.name, W / 2, H * 0.12, { align: 'center', size: 24, weight: 'bold', color: '#334155' });
        hintDrag(g, '👆 拖动 B 改键长', W / 2, H * 0.17);
        /* 底部键长杆示意 */
        var rx = W * 0.32, ry = H * 0.86, rw = W * 0.36;
        LINE(g, rx, ry, rx + rw, ry, '#64748b', 3);
        LINE(g, rx, ry - 8, rx, ry + 8, '#334155', 2);
        LINE(g, rx + rw, ry - 8, rx + rw, ry + 8, '#334155', 2);
        LINE(g, rx + rw / 2, ry, rx + rw / 2, ry - 16, '#16a34a', 2);
        CIRC(g, rx + rw / 2, ry - 22, 8, '#34d399');
        TXT(g, '键长示意 ≈ 1.0 Å（同种配体等长）', rx + rw / 2, ry + 22, { align: 'center', size: 11, color: '#64748b' });
    },
    data: function (S) {
        var L = IMPL.molshapes.layout(S);
        return [
            { label: 'σ 键电子对', value: S.lig, unit: '对' },
            { label: '孤对电子', value: S.lone, unit: '对' },
            { label: '电对总数', value: L.d, unit: '' },
            { label: '几何构型', value: L.name, unit: '(' + FMT(L.angle, 1) + '°)', color: '#0891b2' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, L = this.layout(S), cx = W * 0.46, cy = H * 0.42;
        var R = S.blen || (Math.min(W, H) * 0.21);
        for (var i = 0; i < L.pts.length; i++) {
            var an = Math.atan2(L.pts[i][1], L.pts[i][0]);
            var ex = cx + Math.cos(an) * R, ey = cy + Math.sin(an) * R;
            if (Math.hypot(x - ex, y - ey) < 26) return true;
        }
        return false;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, L = this.layout(S), cx = W * 0.46, cy = H * 0.42;
        var R = S.blen || (Math.min(W, H) * 0.21);
        for (var i = 0; i < L.pts.length; i++) {
            var an = Math.atan2(L.pts[i][1], L.pts[i][0]);
            var ex = cx + Math.cos(an) * R, ey = cy + Math.sin(an) * R;
            if (Math.hypot(x - ex, y - ey) < 26) { S.drag = 'lig'; S._px = x; S._py = y; return; }
        }
    },
    ptMove: function (S, x, y) {
        if (S.drag !== 'lig') return;
        var W = S._W || 820, H = S._H || 480, cx = W * 0.46, cy = H * 0.42;
        S.blen = CLAMP(Math.hypot(x - cx, y - cy), 50, Math.min(W, H) * 0.42);
    },
    ptUp: function (S) { S.drag = null; }
},
/* ---------- 18 molpolarity 分子极性 ---------- */
molpolarity: {
    know: '<p>电负性差 Δχ 决定键的极性：Δχ≈0 为非极性共价键；差值越大，共用电子对越偏向电负性强的一方（δ⁻），另一端呈 δ⁺，形成<strong>偶极矩 μ</strong>，方向由正电荷指向负电荷。</p>',
    controls: function (S) {
        return [
            SL('mp_xa', 'A 的电负性 χ_A', 2.1, 3.44, 0.01, S.xa, '', function (v) { S.xa = v; }),
            SL('mp_xb', 'B 的电负性 χ_B', 2.1, 3.44, 0.01, S.xb, '', function (v) { S.xb = v; }),
            CK('mp_b', '显示静电势背景带', S.band, function (v) { S.band = v; })
        ];
    },
    draw: function (g, S, W, H, t) {
        var cx = W / 2, cy = H * 0.44, r = Math.min(W * 0.09, 52);
        var dCh = S.xb - S.xa;               /* >0 : B 更强 → B 端 δ− */
        var q = CLAMP(Math.abs(dCh) / 1.34, 0, 1);
        var bw = S.bw || (W * 0.62);
        /* 静电势带：红(+) → 蓝(−)，随 Δχ 方向 */
        if (S.band) {
            var gr2 = g.createLinearGradient(cx - bw / 2 - r, 0, cx + bw / 2 + r, 0);
            gr2.addColorStop(0, RGBA('#ef4444', 0.25)); gr2.addColorStop(0.5, 'rgba(148,163,184,0.10)');
            gr2.addColorStop(1, RGBA('#3b82f6', 0.25));
            if (dCh < 0) { g.save(); g.translate(W, 0); g.scale(-1, 1); }
            g.fillStyle = gr2;
            if (dCh < 0) { g.fillRect(W - (cx + bw / 2 + r), cy - r * 2.4, bw + r * 2, r * 4.8); g.restore(); }
            else g.fillRect(cx - bw / 2 - r, cy - r * 2.4, bw + r * 2, r * 4.8);
        }
        /* 键与原子 */
        LINE(g, cx - bw / 2, cy, cx + bw / 2, cy, S.drag === 'atom' ? '#f59e0b' : '#64748b', 6);
        var colA = MIX('#94a3b8', '#ef4444', q), colB = MIX('#94a3b8', '#3b82f6', q);
        if (dCh < 0) { var tmpc = colA; colA = colB; colB = tmpc; }
        elemIcon(g, cx - bw / 2, cy, r, colA, 'A', 22);
        elemIcon(g, cx + bw / 2, cy, r, colB, 'B', 22);
        /* 电子云偏向 */
        var eoff = dCh > 0 ? 1 : -1;
        for (var ei = 0; ei < 3; ei++) {
            CIRC(g, cx + bw / 2 * (dCh === 0 ? 0 : eoff * (0.35 + ei * 0.14)), cy - 12 - ei * 6,
                3.5, RGBA('#2563eb', 0.85));
            CIRC(g, cx - bw / 2 * (dCh === 0 ? 0 : eoff * (0.35 + ei * 0.14)), cy + 12 + ei * 6,
                3.5, RGBA('#ef4444', 0.85));
        }
        /* 偶极箭头 μ：正 → 负 */
        var muLen = bw * (0.15 + 0.5 * q);
        var mxs = dCh >= 0 ? cx - muLen / 2 : cx + muLen / 2;
        var mxe = dCh >= 0 ? cx + muLen / 2 : cx - muLen / 2;
        ARROW(g, mxs, cy - r - 26, mxe, cy - r - 26, dCh === 0 ? '#94a3b8' : '#7c3aed', 3);
        TXT(g, 'μ 偶极（相对）=' + FMT(q, 2), W / 2, cy - r - 40, { align: 'center', size: 13, weight: 'bold', color: '#7c3aed' });
        hintDrag(g, '👆 拖动原子', W / 2, cy - r - 62);
        /* δ 标注 */
        TXT(g, dCh === 0 ? 'Δχ=0 无偏移' : 'δ' + (dCh > 0 ? '+' : '−') + FMT(q, 2), cx - bw / 2, cy + r + 26,
            { align: 'center', size: 14, weight: 'bold', color: dCh < 0 ? '#dc2626' : '#16a34a' });
        TXT(g, dCh === 0 ? '' : 'δ' + (dCh > 0 ? '−' : '+') + FMT(q, 2), cx + bw / 2, cy + r + 26,
            { align: 'center', size: 14, weight: 'bold', color: dCh > 0 ? '#2563eb' : '#0891b2' });
        TXT(g, 'χ_A=' + FMT(S.xa, 2), cx - bw / 2, cy - r - 8, { align: 'center', size: 12, color: '#334155' });
        TXT(g, 'χ_B=' + FMT(S.xb, 2), cx + bw / 2, cy - r - 8, { align: 'center', size: 12, color: '#334155' });
    },
    data: function (S) {
        var dCh = S.xb - S.xa, q = CLAMP(Math.abs(dCh) / 1.34, 0, 1);
        var lvl = q < 0.05 ? '非极性键' : q < 0.25 ? '弱极性' : q < 0.55 ? '中等极性' : q < 0.85 ? '较强极性' : '强极性/近离子';
        return [
            { label: 'Δχ 电负性差', value: FMT(Math.abs(dCh), 2), unit: '', color: '#7c3aed' },
            { label: '偶极矩（相对）', value: FMT(q, 2), unit: '', color: '#7c3aed' },
            { label: '极性判定', value: lvl, unit: '' },
            { label: '电子对偏向', value: dCh === 0 ? '居中' : (dCh > 0 ? '偏向 B' : '偏向 A'), unit: '', color: dCh > 0 ? '#2563eb' : '#dc2626' }
        ];
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, cx = W / 2, cy = H * 0.44, r = Math.min(W * 0.09, 52);
        var bw = S.bw || (W * 0.62);
        return Math.hypot(x - (cx - bw / 2), y - cy) < r + 8 || Math.hypot(x - (cx + bw / 2), y - cy) < r + 8;
    },
    ptDown: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480, cx = W / 2, cy = H * 0.44, r = Math.min(W * 0.09, 52);
        var bw = S.bw || (W * 0.62);
        if (Math.hypot(x - (cx - bw / 2), y - cy) < r + 8) { S.drag = 'atom'; return; }
        if (Math.hypot(x - (cx + bw / 2), y - cy) < r + 8) { S.drag = 'atom'; return; }
    },
    ptMove: function (S, x, y) {
        if (S.drag !== 'atom') return;
        var W = S._W || 820, cx = W / 2;
        S.bw = CLAMP(2 * Math.abs(x - cx), 120, W * 0.82);
    },
    ptUp: function (S) { S.drag = null; }
},
/* ---------- 19 buildmol 构建分子 ---------- */
buildmol: {
    know: '<p>点击画布<strong>放置原子</strong>（或拖动已有原子）；拖到另一个原子附近自动成键。勾选「删除模式」后点击原子可移除。组成完成后按「识别分子」与常见分子表比对；支持：O₂、H₂O、CO₂、CH₄、NH₃、C₂H₆、CH₂O、HCN。</p>',
    presets: function (S) { return [{ name: '示例：水 H₂O', apply: function () {
        S.atoms = [{ el: 'O', x: 330, y: 210 }, { el: 'H', x: 250, y: 270 }, { el: 'H', x: 410, y: 270 }];
        S.bonds = [[0, 1], [0, 2]];
    } }]; },
    controls: function (S) {
        var self = this;
        return [
            BTN('bm_H', '＋ 氢 H', function () { S.atoms.push({ el: 'H', x: 150 + Math.random() * 300, y: 110 + Math.random() * 160 }); }),
            BTN('bm_O', '＋ 氧 O', function () { S.atoms.push({ el: 'O', x: 180 + Math.random() * 280, y: 120 + Math.random() * 150 }); }),
            BTN('bm_C', '＋ 碳 C', function () { S.atoms.push({ el: 'C', x: 160 + Math.random() * 300, y: 130 + Math.random() * 140 }); }),
            BTN('bm_N', '＋ 氮 N', function () { S.atoms.push({ el: 'N', x: 170 + Math.random() * 290, y: 115 + Math.random() * 155 }); }),
            CK('bm_del', '删除模式（点击原子移除）', S.del, function (v) { S.del = v; }),
            BTN('bm_id', '识别分子', function () { self.identify(S); }),
            BTN('bm_save', '保存到收藏', function () {
                if (!S.atoms.length) return;
                S.saved.push(IMPL.buildmol.formulaOf(S));
                if (S.saved.length > 8) S.saved.shift();
            }),
            BTN('bm_cl', '清空工作台', function () { S.atoms = []; S.bonds = []; })
        ];
    },
    formulaOf: function (S) {
        var cnt = {};
        S.atoms.forEach(function (a) { cnt[a.el] = (cnt[a.el] || 0) + 1; });
        var order = ['C', 'H', 'N', 'O'].filter(function (e2) { return cnt[e2]; });
        Object.keys(cnt).forEach(function (e2) { if (order.indexOf(e2) < 0) order.push(e2); });
        return order.map(function (e2) { return e2 + (cnt[e2] > 1 ? sub(cnt[e2]) : ''); }).join('');
    },
    countsOf: function (S) {
        var c = {};
        S.atoms.forEach(function (a) { c[a.el] = (c[a.el] || 0) + 1; });
        return c;
    },
    identify: function (S) {
        var c = this.countsOf(S), found = null;
        KNOWN_MOL.forEach(function (k3) {
            var t = k3[2];
            var okc = true, nKeys = 0;
            for (var kk in c) { nKeys++; if ((t[kk] || 0) !== c[kk]) okc = false; }
            for (var kk2 in t) if (!(kk2 in c)) okc = false;
            if (okc && nKeys === Object.keys(t).length) found = k3;
        });
        S.msgFound = found ? ('🎉 识别成功：' + found[1] + '（' + found[0] + '）') : '暂未匹配常见分子，试试调整组成';
        if (found) { S.confetti = S.confetti || []; CONFspawn(S, Math.max(3, mobReduce(60)), (S._W || 700) / 2, (S._H || 420) / 2); }
    },
    update: function (S, dt) {
        CONFstep(S, dt);
        /* 自动成键提示距离缓存 */
        S._bondHint = null;
        if (S.drag >= 0 && S.drag < S.atoms.length) {
            var a0 = S.atoms[S.drag];
            for (var i = 0; i < S.atoms.length; i++) {
                if (i === S.drag) continue;
                var d = Math.hypot(a0.x - S.atoms[i].x, a0.y - S.atoms[i].y);
                if (d < 56) { S._bondHint = [S.drag, i]; break; }
            }
        }
    },
    hitTest: function (S, x, y) {
        if (S.del) return false;
        for (var j = 0; j < S.atoms.length; j++) {
            if (Math.hypot(S.atoms[j].x - x, S.atoms[j].y - y) < 26) return true;
        }
        return false;
    },
    ptDown: function (S, x, y) {
        if (S.del) {
            for (var i = S.atoms.length - 1; i >= 0; i--) {
                if (Math.hypot(S.atoms[i].x - x, S.atoms[i].y - y) < 24) {
                    S.atoms.splice(i, 1);
                    S.bonds = S.bonds.filter(function (b) { return b[0] !== i && b[1] !== i; }).map(function (b) {
                        return [b[0] > i ? b[0] - 1 : b[0], b[1] > i ? b[1] - 1 : b[1]];
                    });
                    return;
                }
            }
            return;
        }
        var best = -1, bd = 26;
        for (var j = 0; j < S.atoms.length; j++) {
            var d2 = Math.hypot(S.atoms[j].x - x, S.atoms[j].y - y);
            if (d2 < bd) { bd = d2; best = j; }
        }
        if (best >= 0) S.drag = best;
        else { S.drag = -1; }
    },
    ptMove: function (S, x, y) {
        if (S.drag >= 0 && S.drag < S.atoms.length) {
            S.atoms[S.drag].x = CLAMP(x, 20, (S._W || 700) - 20);
            S.atoms[S.drag].y = CLAMP(y, 20, (S._H || 420) - 40);
        }
    },
    ptUp: function (S) {
        var hint = S._bondHint;
        if (S.drag >= 0 && hint) {
            var lo = Math.min(hint[0], hint[1]), hi = Math.max(hint[0], hint[1]);
            var dup = S.bonds.some(function (b) { return b[0] === lo && b[1] === hi; });
            if (!dup) S.bonds.push([lo, hi]);
        }
        S.drag = -1; S._bondHint = null;
    },
    draw: function (g, S, W, H, t) {
        var elCol2 = { H: '#f1f5f9', O: '#ef4444', C: '#334155', N: '#3b82f6' };
        /* 键 */
        S.bonds.forEach(function (b) {
            var a1 = S.atoms[b[0]], a2 = S.atoms[b[1]];
            if (a1 && a2) LINE(g, a1.x, a1.y, a2.x, a2.y, '#94a3b8', 6);
        });
        /* 成键提示虚线 */
        if (S._bondHint) {
            var ha = S.atoms[S._bondHint[0]], hb = S.atoms[S._bondHint[1]];
            DASHLN(g, ha.x, ha.y, hb.x, hb.y, '#22c55e', 2.5);
        }
        /* 原子 */
        S.atoms.forEach(function (a, i) {
            var r2 = a.el === 'H' ? 16 : 21;
            elemIcon(g, a.x, a.y, r2, elCol2[a.el] || '#999', a.el, 13);
            CIRC(g, a.x, a.y, r2 + 3, null, a.el === 'H' ? '#cbd5e1' : 'rgba(255,255,255,0.5)', 1.5);
            if (i === S.drag) CIRC(g, a.x, a.y, r2 + 7, null, '#f59e0b', 2.5);
        });
        if (S.del) PILL(g, W - 150, 10, '🗑 删除模式：点击原子移除', '#b91c1c', 'rgba(239,68,68,0.12)', 11);
        if (S.atoms.length && !S.del) hintDrag(g, '👆 拖动原子', S.atoms[0].x, S.atoms[0].y - 28);
        /* 组成式 */
        TXT(g, '当前组成：' + (S.atoms.length ? IMPL.buildmol.formulaOf(S) : '（空）'), 14, H - 18, { size: 15, weight: 'bold', color: '#334155' });
        if (S.msgFound) {
            TXT(g, S.msgFound, 14, 26, { size: 15, weight: 'bold', color: S.msgFound.indexOf('🎉') >= 0 ? '#15803d' : '#92400e' });
        }
        /* 收藏 chips */
        (S.saved || []).forEach(function (fs, i) {
            PILL(g, W - 100 - i * 84, 40, fs, '#0f766e', 'rgba(20,184,166,0.12)', 12);
        });
        if ((S.saved || []).length) TXT(g, '收藏:', W - 106 - S.saved.length * 84, 52, { align: 'right', size: 12, color: '#64748b' });
    },
    data: function (S) {
        var c = IMPL.buildmol.countsOf(S), nBonds = S.bonds.length;
        var comp = Object.keys(c).map(function (k) { return k + '×' + c[k]; }).join(' ') || '—';
        return [
            { label: '组成式', value: S.atoms.length ? IMPL.buildmol.formulaOf(S) : '空', unit: '', color: '#0f766e' },
            { label: '原子明细', value: comp, unit: '' },
            { label: '原子数 / 键数', value: S.atoms.length + ' / ' + nBonds, unit: '' },
            { label: '已收藏分子', value: (S.saved || []).length, unit: '个' }
        ];
    }
}
};

/* ============================================================
 * 七、工厂与注册
 * ============================================================ */
function freshState(modeKey, basic) {
    var base = MODES[modeKey];
    var s = JSON.parse(JSON.stringify(base));
    s._mode = modeKey; s._basic = basic; s.confetti = s.confetti || [];
    return s;
}

function createChem(cfg) {
    cfg = cfg || {};
    var modeKey = cfg.mode || ID2MODE[cfg.id] || 'concentration';
    if (!IMPL[modeKey]) modeKey = 'concentration';
    var basic = !!cfg.basic || cfg.id === 'molecule-shapes-basics';
    var impl = IMPL[modeKey];
    var S = null, LOADER = null, cacheStr = '';

    function pushData(force) {
        if (!S || !LOADER || !impl.data) return;
        try {
            var arr = impl.data.call(impl, S);
            var key = JSON.stringify(arr.map(function (x) { return [x.label, x.value]; }));
            if (force || key !== cacheStr) { cacheStr = key; LOADER.updateDataDisplay(arr); }
        } catch (e) { /* 单次数据计算失败不阻塞主循环 */ }
    }

    var inst = {
        init: function (loader) {
            LOADER = loader;
            S = freshState(modeKey, basic);
            loader.setKnowledge(impl.know || '<p>探索本实验的规律。</p>');
            loader.setPresets(impl.presets ? impl.presets.call(impl, S) : []);
            pushData(true);
        },
        getControls: function () {
            return impl.controls.call(impl, S || freshState(modeKey, basic), basic);
        },
        update: function (dt, t) {
            if (!S) return;
            if (!(dt > 0)) dt = 0;
            if (dt > 0.05) dt = 0.05;
            if (impl.update) impl.update.call(impl, S, dt, t, S._W || 820, S._H || 480);
            pushData(false);
        },
        render: function (ctx, W, H, t) {
            BG(ctx, W, H);
            if (!S) return;
            S._W = W; S._H = H;
            impl.draw.call(impl, ctx, S, W, H, t);
            CONFdraw(ctx, S);
        },
        reset: function () {
            S = freshState(modeKey, basic);
            cacheStr = '';
            pushData(true);
        }
    };

    /* 指针转发（仅声明了 pt* 的模式有效，如 构建分子） */
    inst.onPointerDown = impl.ptDown ? function (x, y, ev) { if (S) try { impl.ptDown.call(impl, S, x, y, ev); } catch (e) {} } : undefined;
    inst.onPointerMove = impl.ptMove ? function (x, y, ev) { if (S) try { impl.ptMove.call(impl, S, x, y, ev); } catch (e) {} } : undefined;
    inst.onPointerUp = impl.ptUp ? function (x, y, ev) { if (S) try { impl.ptUp.call(impl, S, x, y, ev); } catch (e) {} } : undefined;
    inst.hitTest = impl.hitTest ? function (x, y) { if (S) try { return !!impl.hitTest.call(impl, S, x, y); } catch (e) { return false; } return false; } : undefined;

    return inst;
}

if (typeof window !== 'undefined' && window.EngineRegistry) {
    window.EngineRegistry.register('chem', { create: createChem });
}

})();