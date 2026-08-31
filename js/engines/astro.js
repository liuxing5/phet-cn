/**
 * 天文 引擎（工厂注册名：'astro'）
 * 覆盖 5 种模式：
 *   kepler     开普勒定律 (keplers-laws)
 *   solarsys   我的太阳系 (my-solar-system)
 *   orbits     引力与轨道 (gravity-orbits)
 *   greenhouse 温室效应 (greenhouse-effect)
 *   blackbody  黑体光谱 (blackbody-spectrum)
 * 契约：顶层仅注册工厂，不触碰 document；运行期通过 loader 与画布交互。
 */
(function () {
'use strict';

/* ============================================================
 * 一、通用工具（对 Kit 的安全兜底：缺什么用原生实现补）
 * ============================================================ */
var KIT = function () { return (typeof window !== 'undefined' && window.Kit) ? window.Kit : null; };

var FB_COLORS = {
    red:'#e74c3c', blue:'#3498db', green:'#27ae60', orange:'#f39c12',
    purple:'#8e44ad', teal:'#16a085', pink:'#fd79a8', yellow:'#f1c40f',
    gray:'#95a5a6', dark:'#2d3436', light:'#ecf0f1', white:'#ffffff',
    sky:'#dff3ff', ground:'#f4efe6'
};
function COL(name) {
    var k = KIT();
    return (k && k.COLORS && k.COLORS[name]) || FB_COLORS[name] || '#8899aa';
}
function CLAMP(v, a, b) { if (v < a) return a; if (v > b) return b; return v; }
function LERP(a, b, t) { return a + (b - a) * t; }
function FMT(v, d) {
    if (!isFinite(v)) return '--';
    var s = Number(v).toFixed(d === undefined ? 1 : d);
    if (parseFloat(s) === 0) s = (0).toFixed(d === undefined ? 1 : d);
    return s;
}
function RGBA(hex, a) {
    var k = KIT();
    if (k && typeof k.rgba === 'function') { try { return k.rgba(hex, a); } catch (e) {} }
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + CLAMP(a, 0, 1) + ')';
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
/* 可拖拽元素提示标签（只读绘制，不改变任何状态） */
function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var w=ctx.measureText(text).width+12; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-w/2, y-11, w, 22); ctx.fillStyle='#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }

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
    g.fillStyle = o.color || '#eaf0fa';
    g.font = (o.weight || '') + ' ' + (o.size || 14) + 'px "Microsoft YaHei","PingFang SC",sans-serif';
    g.textAlign = o.align || 'left';
    g.textBaseline = o.baseline || 'alphabetic';
    g.fillText(String(s), x, y);
    g.restore();
}
function PANEL(g, x, y, w, h, o) {
    o = o || {};
    RR(g, x, y, w, h, o.r === undefined ? 12 : o.r);
    g.save(); g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    g.fillStyle = o.fill || 'rgba(255,255,255,0.06)';
    g.fill();
    if (o.stroke !== false) { g.strokeStyle = o.strokeC || 'rgba(255,255,255,0.22)'; g.lineWidth = o.lw || 1.5; g.stroke(); }
    g.restore();
}
function PILL(g, x, y, text, fg, bg, size) {
    size = size || 12;
    g.save();
    g.font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif';
    var w = g.measureText(String(text)).width + 16;
    RR(g, x, y, w, size + 10, (size + 10) / 2);
    g.fillStyle = bg || 'rgba(39,174,96,0.18)';
    g.fill();
    TXT(g, text, x + 8, y + size + 4.5, { size: size, weight: 'bold', color: fg || '#2ecc71' });
    g.restore();
    return w;
}
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
function ARROW(g, x1, y1, x2, y2, color, w, head) {
    head = head || 10;
    var ang = Math.atan2(y2 - y1, x2 - x1), hl = head;
    LINE(g, x1, y1, x2 - Math.cos(ang) * hl * 0.6, y2 - Math.sin(ang) * hl * 0.6, color, w || 2);
    g.save(); g.fillStyle = color; g.translate(x2, y2); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-hl, -hl * 0.5); g.lineTo(-hl, hl * 0.5); g.closePath(); g.fill();
    g.restore();
}
function BG(g, W, H) {
    var k = KIT();
    if (k && typeof k.background === 'function') { try { k.background(g, W, H); return; } catch (e) {} }
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#1a2036'); gr.addColorStop(1, '#11141f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
/* 背景 + 淡网格（部分模式直接调用 GRID） */
function GRID(g, W, H) {
    BG(g, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    var x, y;
    for (x = 50; x < W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (y = 50; y < H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
}

/* ---------- 共享：天体带光晕 ---------- */
function drawBody(g, x, y, r, opt) {
    opt = opt || {};
    var c = opt.color || '#f1c40f';
    var halo = (opt.halo === undefined ? 2.6 : opt.halo) * r;
    var gr = g.createRadialGradient(x, y, r * 0.4, x, y, halo);
    gr.addColorStop(0, RGBA(c, 0.45));
    gr.addColorStop(0.55, RGBA(c, 0.13));
    gr.addColorStop(1, RGBA(c, 0));
    g.beginPath(); g.arc(x, y, halo, 0, Math.PI * 2);
    g.fillStyle = gr; g.fill();
    var core = g.createRadialGradient(x - r * 0.32, y - r * 0.34, r * 0.12, x, y, r);
    core.addColorStop(0, MIX('#ffffff', c, 0.25));
    core.addColorStop(0.65, c);
    core.addColorStop(1, MIX(c, '#000000', opt.shade === undefined ? 0.34 : opt.shade));
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = core; g.fill();
    if (opt.ring) CIRC(g, x, y, r + 2, null, RGBA('#ffffff', 0.35), 1.2);
}
/* ---------- 共享：半圆仪表 ---------- */
function drawGauge(g, cx, cy, r, val01, labTxt, colHex, dispTxt) {
    val01 = CLAMP(isFinite(val01) ? val01 : 0, 0, 1);
    PANEL(g, cx - r - 12, cy - r - 26, 2 * r + 24, r + 44, { fill: 'rgba(255,255,255,0.05)', strokeC: 'rgba(255,255,255,0.18)', r: 12 });
    TXT(g, labTxt, cx, cy - r - 11, { align: 'center', size: 13, weight: 'bold', color: '#cfd8ea' });
    g.lineWidth = 9; g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.arc(cx, cy, r - 4, Math.PI, Math.PI * 2); g.stroke();
    g.strokeStyle = RGBA(colHex, 0.85); g.lineWidth = 9;
    g.beginPath(); g.arc(cx, cy, r - 4, Math.PI, Math.PI + Math.PI * val01); g.stroke();
    for (var j = 0; j <= 10; j++) {
        var a = Math.PI + Math.PI * j / 10, c1 = Math.cos(a), s1 = Math.sin(a);
        LINE(g, cx + c1 * (r + 1), cy + s1 * (r + 1), cx + c1 * (r + 7), cy + s1 * (r + 7), 'rgba(255,255,255,0.42)', 1.4);
    }
    var an = Math.PI + Math.PI * val01;
    ARROW(g, cx, cy, cx + Math.cos(an) * (r - 16), cy + Math.sin(an) * (r - 16), '#ffdf6b', 3, 9);
    CIRC(g, cx, cy, 5, colHex, '#ffffff', 1.5);
    TXT(g, dispTxt === undefined ? '' : dispTxt, cx, cy + 16, { align: 'center', size: 13, weight: 'bold', color: '#ffdf6b' });
}
/* ---------- 共享：竖直温度计 ---------- */
function thermometerVertical(g, x, yTop, yBot, frac, opt) {
    opt = opt || {};
    frac = CLAMP(isFinite(frac) ? frac : 0, 0, 1);
    var tw = 14, by = yBot + 26;
    PANEL(g, x - 18, yTop - 26, 52, yBot - yTop + 80, { fill: 'rgba(255,255,255,0.04)', strokeC: 'rgba(255,255,255,0.15)', r: 10 });
    TXT(g, opt.cap || '', x + 8, yTop - 12, { align: 'center', size: 12, weight: 'bold', color: '#cfd8ea' });
    CIRC(g, x, by, 11, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.55)', 1.5);
    RR(g, x - tw / 2, yTop, tw, yBot - yTop, 6);
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.stroke();
    var fh = (yBot - yTop) * frac;
    var hot = MIX(opt.cold || '#3498db', opt.hotc || '#e74c3c', frac);
    RR(g, x - tw / 2 + 2.5, yBot - fh, tw - 5, fh, 4); g.fillStyle = hot; g.fill();
    CIRC(g, x, by, 8, hot);
    for (var i = 0; i <= 4; i++) {
        var ty = yBot - (yBot - yTop) * i / 4;
        LINE(g, x + tw / 2 + 1, ty, x + tw / 2 + 8, ty, 'rgba(255,255,255,0.4)', 1.2);
    }
    TXT(g, opt.hiTxt !== undefined ? opt.hiTxt : '', x + 1, yTop - 1, { align: 'center', size: 10, color: '#9fb0cc' });
    TXT(g, opt.loTxt !== undefined ? opt.loTxt : '', x + 1, yBot + 16, { align: 'center', size: 10, color: '#9fb0cc' });
}
/* ---------- 共享：velocity-verlet N 体积分 ---------- */
function integrateVerlet(bs, dt, accFn) {
    var i, b;
    accFn(bs);                                    // 当前加速度 → ax/ay
    for (i = 0; i < bs.length; i++) {
        b = bs[i];
        if (!b.ax) b.ax = 0; if (!b.ay) b.ay = 0;
        b.ox = b.ax; b.oy = b.ay;                 // 记录旧加速度
        b.x += b.vx * dt + 0.5 * b.ax * dt * dt;
        b.y += b.vy * dt + 0.5 * b.ay * dt * dt;
    }
    accFn(bs);                                    // 新位置处的加速度
    for (i = 0; i < bs.length; i++) {
        b = bs[i];
        b.vx += 0.5 * (b.ox + b.ax) * dt;
        b.vy += 0.5 * (b.oy + b.ay) * dt;
    }
}
/* 天体合力（softening ε 防奇点） */
function gravityAcc(bs, GM) {
    var i, j, a, b, dx, dy, d2, d3inv, eps2 = 64, f;
    for (i = 0; i < bs.length; i++) { bs[i].ax = 0; bs[i].ay = 0; }
    for (i = 0; i < bs.length; i++) {
        for (j = i + 1; j < bs.length; j++) {
            a = bs[i]; b = bs[j];
            dx = b.x - a.x; dy = b.y - a.y;
            d2 = dx * dx + dy * dy + eps2;
            d3inv = 1 / (d2 * Math.sqrt(d2));
            f = GM * d3inv;
            a.ax += f * b.m * dx; a.ay += f * b.m * dy;
            b.ax -= f * a.m * dx; b.ay -= f * a.m * dy;
        }
    }
}
/* 轨迹记录与渐隐绘制 */
function pushTrail(tr, x, y, maxN) {
    tr.push({ x: x, y: y });
    if (tr.length > maxN) tr.shift();
}
function drawTrail(g, tr, colHex) {
    for (var i = 1; i < tr.length; i++) {
        g.strokeStyle = RGBA(colHex, 0.02 + 0.5 * i / tr.length);
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke();
    }
}
/* 波长 nm → 近似 RGB（可见光带） */
function WCOL(lam) {
    var r = 0, gg = 0, b = 0;
    lam = CLAMP(lam, 360, 780);
    if (lam < 440) { r = -(lam - 440) / 60; b = 1; }
    else if (lam < 490) { gg = (lam - 440) / 50; b = 1; }
    else if (lam < 510) { gg = 1; b = -(lam - 510) / 20; }
    else if (lam < 580) { r = (lam - 510) / 70; gg = 1; }
    else if (lam < 645) { r = 1; gg = -(lam - 645) / 65; }
    else { r = 1; }
    var f = 1;
    if (lam < 420) f = 0.4 + 0.6 * (lam - 360) / 60;
    else if (lam > 700) f = 0.4 + 0.6 * (780 - lam) / 80;
    var c = function (x) { return Math.round(255 * CLAMP(x, 0, 1) * f); };
    return '#' + ((1 << 24) + (c(r) << 16) + (c(gg) << 8) + c(b)).toString(16).slice(1);
}

/* loader 引用暂存（用于 toast 提示） */
var GLOBAL_LOADER = null;
function LOADER_MSG(msg) {
    if (GLOBAL_LOADER && typeof GLOBAL_LOADER.showToast === 'function') {
        try { GLOBAL_LOADER.showToast(msg); } catch (e) {}
    }
}
/* 移动端降级安全访问（桌面端 window.Mobile 存在但 isMobile=false、particleScale=1） */
function MOB() { return (typeof window !== 'undefined' && window.Mobile) ? window.Mobile : null; }

/* ============================================================
 * 二、ID → 模式映射 与 各模式实现（每个模式先列 defaults）
 * ============================================================ */
var ID2MODE = {
    'keplers-laws': 'kepler',
    'my-solar-system': 'solarsys',
    'gravity-orbits': 'orbits',
    'greenhouse-effect': 'greenhouse',
    'blackbody-spectrum': 'blackbody'
};

var IMPL = {};

/* ────────────────────────────────────────────────
 * 模式 1：kepler 开普勒定律
 * ──────────────────────────────────────────────── */
IMPL.kepler = {
    A_SEMI: 200, GM: 900000,
    defaults: function () {
        return {
            ecc: 0.4, theta: Math.PI,          // 从远日点出发
            sectors: [], secTimer: 0, SEC_INT: 0.9,
            showSec: true, showVec: true,
            rCur: 0, vCur: 0, periods: 0,
            drag: false
        };
    },
    know: '<p><b>开普勒定律</b>：① 行星沿椭圆轨道运动，太阳位于焦点上；② 相同时间内扫过相同面积'
        + '（近日点跑得快、远日点跑得慢）；③ 半长轴立方 ∝ 周期平方。调大离心率感受速度的剧烈变化！</p>',
    controls: function (S) {
        return [
            { id: 'kp_ecc', type: 'slider', label: '离心率 e', min: 0, max: 0.8, step: 0.01, value: S.ecc, onChange: function (v) { S.ecc = v; } },
            { id: 'kp_sec', type: 'checkbox', label: '显示等时扫掠扇形', value: !!S.showSec, onChange: function (v) {
                S.showSec = v;
                if (v) { S.sectors.length = 0; S.secTimer = 0; S.thetaPrev = S.theta; }   // 重新开启从当前角起算
            } },
            { id: 'kp_vec', type: 'checkbox', label: '显示速度矢量', value: !!S.showVec, onChange: function (v) { S.showVec = v; } }
        ];
    },
    geo: function (W, H) {
        var scale = CLAMP(Math.min(W * 0.62, H * 0.72) / this.A_SEMI / 2, 0.75, 1.5);
        return { cx: W * 0.46, cy: H * 0.52, scale: scale };   // cx,cy 即太阳(焦点)位置
    },
    posAt: function (S, th, geo) {
        var a = this.A_SEMI * geo.scale, e = S.ecc;
        var r = a * (1 - e * e) / (1 + e * Math.cos(th));
        var px = geo.cx + r * Math.cos(th);      // 近日点方向朝 +x，太阳位于右侧焦点
        var py = geo.cy - r * Math.sin(th);
        return { x: px, y: py, r: r };
    },
    update: function (S, dt, t) {
        if (S.drag) return;                       // 拖拽中冻结运动，由 move 直接定位 theta
        var geo = S._geo || this.geo(S._W || 900, S._H || 500);
        var e = S.ecc, h = Math.sqrt(this.GM * this.A_SEMI * geo.scale * geo.scale * geo.scale * (1 - e * e));
        /* 开普勒第二定律：dθ/dt = h / r² （面积速度守恒） */
        var st = this.posAt(S, S.theta, geo);
        var w = h / (st.r * st.r);
        var old = S.theta;
        S.theta += w * dt;
        if (Math.sin(old) <= 0 && Math.sin(S.theta) > 0) S.periods++;
        var st2 = this.posAt(S, S.theta, geo);
        S.rCur = st2.r; S.vCur = h / st2.r;
        /* 等时间隔记录扇形楔块（循环保留最近 8 块） */
        S.secTimer += dt;
        if (S.showSec && S.secTimer >= S.SEC_INT) {
            S.secTimer -= S.SEC_INT;
            S.sectors.push({ t0: S.thetaPrev || S.theta, t1: S.theta });
            if (S.sectors.length > (S.maxSectors || 8)) S.sectors.shift();
        }
        S.thetaPrev = S.theta;
        if (!isFinite(S.theta)) S.theta = Math.PI;
    },
    draw: function (g, S, W, H, t) {
        var geo = S._geo = this.geo(W, H);
        var a = this.A_SEMI * geo.scale, e = CLAMP(S.ecc, 0, 0.8);
        /* 太阳固定于焦点；posAt 的极点就是 (geo.cx, geo.cy) */
        var sunX = geo.cx, sunY = geo.cy;
        /* 星空点缀（确定性） */
        var rng = makeRng(77);
        for (var si = 0; si < 70; si++) {
            CIRC(g, rng() * W, rng() * H, rng() * 1.2 + 0.3, RGBA('#ffffff', 0.12 + rng() * 0.25));
        }
        /* 扫掠扇形（先画在最底层） */
        if (S.showSec) {
            for (var wi = 0; wi < S.sectors.length; wi++) {
                var wd = S.sectors[wi], pts2 = [];
                var steps = 6;
                for (var ss = 0; ss <= steps; ss++) {
                    var thq = wd.t0 + (wd.t1 - wd.t0) * ss / steps;
                    pts2.push(this.posAt(S, thq, geo));
                }
                pts2.unshift({ x: sunX, y: sunY });
                g.save(); g.globalAlpha = 0.30;
                g.beginPath(); g.moveTo(sunX, sunY);
                for (var pq = 1; pq < pts2.length; pq++) g.lineTo(pts2[pq].x, pts2[pq].y);
                g.closePath();
                g.fillStyle = wi % 2 ? 'rgba(155,89,182,0.55)' : 'rgba(52,152,219,0.55)';
                g.fill(); g.restore();
            }
            TXT(g, '相同时间 ⟶ 相同面积（循环展示 ' + (S.maxSectors || 8) + ' 块）', 50, H - 18, { size: 12, weight: 'bold', color: '#9fb0cc' });
        }
        /* 椭圆轨道（灰线）——posAt 以太阳(焦点)为极点 */
        var pts = [], i;
        for (i = 0; i <= 180; i++) pts.push(this.posAt(S, Math.PI * 2 * i / 180, geo));
        g.beginPath();
        for (i = 0; i < pts.length; i++) i ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y);
        g.closePath();
        g.strokeStyle = 'rgba(200,210,230,0.4)'; g.lineWidth = 1.5; g.stroke();
        /* 椭圆几何中心与空焦点 */
        var ccx = sunX - a * e;                 // 几何中心在焦点内侧偏移 a·e
        var focus2X = sunX - 2 * a * e;         // 第二空焦点
        DASHLN(g, sunX, sunY, focus2X, sunY, 'rgba(255,255,255,0.18)', 1.2);
        CIRC(g, focus2X, sunY, 3, 'rgba(255,255,255,0.25)');
        /* 近日点 / 远日点标注 */
        var periP = this.posAt(S, 0, geo), apoP = this.posAt(S, Math.PI, geo);
        CIRC(g, periP.x, periP.y, 4, '#2ecc71');
        TXT(g, '近日点 ' + FMT(this.A_SEMI * (1 - e), 0), periP.x + 8, periP.y + 14, { size: 11, color: '#2ecc71' });
        CIRC(g, apoP.x, apoP.y, 4, '#e67e22');
        TXT(g, '远日点 ' + FMT(this.A_SEMI * (1 + e), 0), apoP.x + 8, apoP.y - 10, { size: 11, color: '#e67e22' });
        /* 太阳 */
        drawBody(g, sunX, sunY, 15, { color: '#f1c40f' });
        /* 行星 + 速度矢量 */
        var pp = this.posAt(S, S.theta, geo);
        drawBody(g, pp.x, pp.y, 8, { color: '#74b9ff', shade: 0.28 });
        if (S.drag) CIRC(g, pp.x, pp.y, 14, null, '#ffffff', 1.8);   // 拖拽高亮光圈
        hintDrag(g, '👆 拖动行星', pp.x, pp.y - 22);
        if (S.showVec && S.vCur > 0.5) {
            var vt = S.vCur, ang = S.theta + Math.PI / 2;
            var vx = Math.cos(ang) * vt, vy = -Math.sin(ang) * vt;   // 屏幕上方为 -y
            var vl = Math.hypot(vx, vy), vv = Math.min(38, vt * 0.32);
            ARROW(g, pp.x, pp.y, pp.x + vx / vl * vv, pp.y + vy / vl * vv, '#a29bfe', 2.2, 8);
        }
        /* 左上信息卡 */
        PANEL(g, 44, 40, 232, 118, { fill: 'rgba(0,0,0,0.3)', r: 10 });
        TXT(g, '开普勒第二定律演示', 58, 60, { size: 13, weight: 'bold', color: '#ffd97b' });
        TXT(g, 'r = ' + FMT(S.rCur, 0) + ' px', 58, 84, { size: 13, color: '#ecf0f1' });
        TXT(g, 'v = ' + FMT(S.vCur, 1) + ' px/s', 58, 104, { size: 13, color: '#ecf0f1' });
        TXT(g, 'v_max/v_min = (' + FMT(1 + e, 2) + ')/(' + FMT(1 - e, 2) + ') = ' + FMT((1 + e) / Math.max(0.2, 1 - e), 2), 58, 124, { size: 12, color: '#74b9ff' });
        TXT(g, '已绕行 ' + FMT(S.periods, 0) + ' 圈', 58, 144, { size: 12, color: '#9fb0cc' });
        PILL(g, W - 178, 16, '太阳固定于焦点 ✱', '#ffd97b', 'rgba(241,196,15,0.16)', 12);
    },
    data: function (S) {
        var e = S.ecc;
        return [
            { label: '当前距离 r', value: FMT(S.rCur, 0), unit: 'px', color: '#74b9ff' },
            { label: '当前速率 v', value: FMT(S.vCur, 1), unit: 'px/s', color: '#a29bfe' },
            { label: 'vmax/vmin 理论比', value: FMT((1 + e) / Math.max(0.2, 1 - e), 2), unit: '', color: '#2ecc71' },
            { label: '已绕行圈数', value: FMT(S.periods, 0), unit: '圈', color: '#e67e22' }
        ];
    },
    onInit: function (S, W, H) {
        S._geo = this.geo(W || 900, H || 500);
        S.maxSectors = Math.round(8 * (MOB() ? MOB().particleScale : 1));
    },
    hitTest: function (x, y, W, H, S) {
        var geo = S._geo || this.geo(W, H);
        var pp = this.posAt(S, S.theta, geo);
        return Math.hypot(x - pp.x, y - pp.y) < 24;
    },
    /* —— 拖拽交互：暂停或播放态均可拖动行星到轨道任意位置（反算最近轨道点）—— */
    down: function (x, y, W, H, ev, S) {
        var geo = S._geo || this.geo(W, H);
        var pp = this.posAt(S, S.theta, geo);
        if (Math.hypot(x - pp.x, y - pp.y) < 24) {
            S.drag = true;
            S.sectors.length = 0; S.secTimer = 0; S.thetaPrev = S.theta;
        }
    },
    move: function (x, y, W, H, ev, S) {
        if (!S.drag) return;
        var geo = S._geo || this.geo(W, H);
        var bestT = S.theta, bestD = Infinity, i, th, p, d;
        /* 沿椭圆轨道采样 360 点，取离鼠标最近的极角 */
        for (i = 0; i < 360; i++) {
            th = Math.PI * 2 * i / 360;
            p = this.posAt(S, th, geo);
            d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
            if (d < bestD) { bestD = d; bestT = th; }
        }
        S.theta = bestT; S.thetaPrev = bestT;
        var st2 = this.posAt(S, bestT, geo);
        S.rCur = st2.r;
        var e = S.ecc, h = Math.sqrt(this.GM * this.A_SEMI * geo.scale * geo.scale * geo.scale * (1 - e * e));
        S.vCur = h / Math.max(st2.r, 1);
    },
    up: function (x, y, W, H, ev, S) { S.drag = false; }
};

/* ────────────────────────────────────────────────
 * 模式 2：solarsys 我的太阳系
 * ──────────────────────────────────────────────── */
IMPL.solarsys = {
    GM0: 60000, EPS: 8,
    defaults: function () {
        return {
            starMass: 1, planetCount: 3, launchF: 1.0, timeF: 0.25,
            showVec: true, showTrail: true,
            bodies: [], flashes: [], yr: 0, keInit: null, aliveAll: 0,
            drag: null, dragX: 0, dragY: 0
        };
    },
    know: '<p><b>N 体引力模拟</b>：行星按 v=√(GM/r) 起步是圆轨道；初速偏快成椭圆、超过逃逸速度则飞离！'
        + '天体两两碰撞会黏合（动量守恒）。试试<b>双星混沌</b>或<b>一键散架</b>，或把恒星质量调大抓住行星。</p>'
        + '<p><b>velocity-verlet 积分</b>保证长期稳定，软化参数避免近距奇点。</p>',
    PLANET_COLS: ['#74b9ff', '#55efc4', '#a29bfe', '#ffeaa7'],
    starGM: function (S) { return this.GM0 * S.starMass; },
    controls: function (S) {
        var self = this;
        return [
            { id: 'ss_mass', type: 'slider', label: '恒星质量', min: 0.5, max: 3, step: 0.1, value: S.starMass, unit: ' M☉', onChange: function (v) { S.starMass = v; self.setStarMass(v); } },
            { id: 'ss_n', type: 'select', label: '行星数量', value: String(S.planetCount), options: [
                { value: '1', label: '1 颗' }, { value: '2', label: '2 颗' }, { value: '3', label: '3 颗' }, { value: '4', label: '4 颗' }
            ].slice(0, S.maxPlanets || 4), onChange: function (v) { S.planetCount = CLAMP(+v | 0, 1, S.maxPlanets || 4); self.scenario('normal'); } },
            { id: 'ss_f', type: 'slider', label: '发射速度倍率', min: 0.7, max: 1.3, step: 0.01, value: S.launchF, unit: '×v_circ', onChange: function (v) { S.launchF = v; self.scenario('normal'); } },
            { id: 'ss_time', type: 'slider', label: '仿真速度', min: 0.05, max: 1, step: 0.05, value: S.timeF, unit: '×', onChange: function (v) { S.timeF = v; } },
            { id: 'ss_scen', type: 'select', label: '场景预设', value: S.sceneKey || 'normal', options: [
                { value: 'normal', label: '正常太阳系' }, { value: 'binary', label: '双星混沌' }, { value: 'scatter', label: '一键散架' }
            ], onChange: function (v) { self.scenario(String(v)); } },
            { id: 'ss_vec', type: 'checkbox', label: '显示速度矢量', value: !!S.showVec, onChange: function (v) { S.showVec = v; } },
            { id: 'ss_trail', type: 'checkbox', label: '显示尾迹', value: !!S.showTrail, onChange: function (v) { S.showTrail = v; } }
        ];
    },
    presets: [
        { name: '正常太阳系', apply: function (inst, S) { IMPL.solarsys.scenario('normal', S); } },
        { name: '双星混沌', apply: function (inst, S) { IMPL.solarsys.scenario('binary', S); } },
        { name: '一键散架', apply: function (inst, S) { IMPL.solarsys.scenario('scatter', S); } }
    ],
    mkStar: function (x, y, vx, vy, m, col, name) {
        return { x: x, y: y, vx: vx, vy: vy, m: m, isStar: true, name: name || '恒星', col: col || '#f1c40f', trail: [], ax: 0, ay: 0, ox: 0, oy: 0 };
    },
    mkPlanet: function (idx, orbR, vc, gmVal, dirSign) {
        var ang0 = idx * 2.1 + 0.6;
        var x = Math.cos(ang0) * orbR, y = Math.sin(ang0) * orbR;
        return {
            x: x, y: y,
            vx: -Math.sin(ang0) * vc * dirSign, vy: Math.cos(ang0) * vc * dirSign,
            m: 1, isStar: false, r: 7, col: this.PLANET_COLS[idx % 4],
            trail: [], ax: 0, ay: 0, ox: 0, oy: 0
        };
    },
    rOf: function (bd) {
        if (bd.isStar) return Math.cbrt(bd.m) * 14;
        return Math.max(5, Math.cbrt(bd.m) * 7);
    },
    buildNormal: function (S, scatterMode) {
        var self = this;
        S.bodies = [self.mkStar(0, 0, 0, 0, S.starMass)];
        var gmVal = self.starGM(S), i;
        for (i = 0; i < S.planetCount; i++) {
            var rr = 80 + 50 * i;
            var vc = Math.sqrt(gmVal / rr) * S.launchF * (scatterMode ? 1.7 : 1);
            S.bodies.push(self.mkPlanet(i, rr, vc, gmVal, i % 2 === 0 ? 1 : -1));
        }
        S.keInit = self.totalKE(S.bodies); S.aliveAll = S.bodies.length;
    },
    buildBinary: function (S) {
        var sep = 150, mm = Math.max(0.5, S.starMass);
        /* 双星绕质心：每颗速度 = √(G·M_other²/(sep·(m1+m2))) 的相对速度分量 */
        var mu = this.GM0 * 2 * mm;
        var vrel = Math.sqrt(mu / sep);
        var vEach = vrel * mm / (2 * mm);
        S.bodies = [
            this.mkStar(-sep / 2, 0, 0, -vEach * 0.9, mm, '#f1c40f', '恒星A'),
            this.mkStar(sep / 2, 0, 0, vEach * 0.9, mm, '#e67e22', '恒星B'),
            this.mkPlanet(0, 190, Math.sqrt(this.GM0 * mm / 190) * 0.95, 0, 1),
            this.mkPlanet(1, 250, Math.sqrt(this.GM0 * mm / 250), 0, -1)
        ];
        /* 双星起步时给行星的速度以质心近似（不含双星扰动——混沌即看点） */
        S.keInit = this.totalKE(S.bodies); S.aliveAll = S.bodies.length;
    },
    scenario: function (key, Sref) {
        var S = Sref || this._S;
        if (!S) return;
        S.sceneKey = key;
        S.flashes.length = 0;
        if (key === 'binary') this.buildBinary(S);
        else this.buildNormal(S, key === 'scatter');
        S.yr = 0;
        LOADER_MSG(key === 'normal' ? '' : key === 'binary' ? '🌌 双星系统启动 — 小心混乱！' : '💥 所有人以 1.7× 圆轨速度起飞！');
    },
    totalKE: function (bs) {
        var kk = 0, i;
        for (i = 0; i < bs.length; i++) kk += 0.5 * bs[i].m * (bs[i].vx * bs[i].vx + bs[i].vy * bs[i].vy);
        return kk;
    },
    setStarMass: function (mv) { /* 实时改质量：直接改主星质量保持其余不变 */ },
    update: function (S, dt, t) {
        this._S = S;
        var eff = dt * S.timeF;
        S.frame = (S.frame || 0) + 1;
        var self = this;
        /* 双帧合并小步积分提升稳定性 */
        var sub = 2, sd = eff / sub, bi;
        for (bi = 0; bi < sub; bi++) integrateVerlet(S.bodies, sd, function (bs) { gravityAcc(bs, self.GM0); });
        /* 拖拽中的天体固定在鼠标位置，速度清零，其余天体仍受其引力继续 N 体积分 */
        if (S.drag != null && S.bodies[S.drag]) {
            var db = S.bodies[S.drag];
            db.x = S.dragX; db.y = S.dragY; db.vx = 0; db.vy = 0;
        }
        S.yr += eff / 18.35;                         // 归一化"仿真年"
        /* NaN 防护 */
        var i, bd;
        for (i = 0; i < S.bodies.length; i++) {
            bd = S.bodies[i];
            if (!isFinite(bd.x) || !isFinite(bd.y) || !isFinite(bd.vx) || !isFinite(bd.vy)) {
                bd.x = bd.isStar ? 0 : (Math.random() * 400 - 200);
                bd.y = bd.isStar ? 0 : (Math.random() * 300 - 150);
                bd.vx = 0; bd.vy = 0;
            }
        }
        /* 碰撞合并（完全非弹性）：大吞小、动量守恒 */
        outer:
        for (i = 0; i < S.bodies.length; i++) {
            for (var j = i + 1; j < S.bodies.length; j++) {
                var A = S.bodies[i], B = S.bodies[j];
                var dx = B.x - A.x, dy = B.y - A.y;
                var radSum = self.rOf(A) + self.rOf(B);
                if (dx * dx + dy * dy < radSum * radSum) {
                    var big = A.m >= B.m ? A : B, sm = A.m >= B.m ? B : A;
                    var mtot = big.m + sm.m;
                    big.vx = (big.vx * big.m + sm.vx * sm.m) / mtot;
                    big.vy = (big.vy * big.m + sm.vy * sm.m) / mtot;
                    big.x = (big.x * big.m + sm.x * sm.m) / mtot;
                    big.y = (big.y * big.m + sm.y * sm.m) / mtot;
                    big.m = mtot;
                    S.flashes.push({ x: sm.x, y: sm.y, t: 0, col: sm.isStar ? '#e67e22' : '#ffffff' });
                    S.bodies.splice(S.bodies.indexOf(sm), 1);
                    break outer;
                }
            }
        }
        /* 逃逸移除 */
        for (i = S.bodies.length - 1; i >= 0; i--) {
            bd = S.bodies[i];
            if (Math.hypot(bd.x, bd.y) > 1600 && !bd.isStar) S.bodies.splice(i, 1);
        }
        /* 尾迹 */
        if (S.showTrail && S.frame % 2 === 0) {
            for (i = 0; i < S.bodies.length; i++) {
                bd = S.bodies[i];
                if (S.drag != null && i === S.drag) continue;   // 拖拽天体不入尾迹
                pushTrail(bd.trail, bd.x, bd.y, bd.isStar ? 60 : (S.trailMax || 120));
            }
        }
        for (i = S.flashes.length - 1; i >= 0; i--) {
            S.flashes[i].t += dt * 2.2;
            if (S.flashes[i].t > 1) S.flashes.splice(i, 1);
        }
    },
    draw: function (g, S, W, H) {
        GRID(g, W, H);
        var cx = W * 0.48, cy = H * 0.52;
        g.save(); g.translate(cx, cy);
        /* 尾迹 */
        var i, bd;
        if (S.showTrail) for (i = 0; i < S.bodies.length; i++) { bd = S.bodies[i]; drawTrail(g, bd.trail, bd.col); }
        /* 合并闪光 */
        for (i = 0; i < S.flashes.length; i++) {
            var fl = S.flashes[i];
            g.save(); g.globalAlpha = 1 - fl.t;
            CIRC(g, fl.x, fl.y, 4 + fl.t * 26, null, fl.col, 2.5);
            g.restore();
        }
        /* 天体 */
        for (i = 0; i < S.bodies.length; i++) {
            bd = S.bodies[i];
            if (bd.isStar) drawBody(g, bd.x, bd.y, this.rOf(bd), { color: bd.col, halo: 3.2 });
            else drawBody(g, bd.x, bd.y, this.rOf(bd), { color: bd.col, halo: 1.6, shade: 0.3 });
            if (S.drag === i && !bd.isStar) CIRC(g, bd.x, bd.y, this.rOf(bd) + 8, null, '#ffffff', 2);   // 选中高亮光圈
            if (S.showVec && !bd.isStar) {
                var vmag = Math.hypot(bd.vx, bd.vy);
                if (vmag > 2) ARROW(g, bd.x, bd.y, bd.x + bd.vx / vmag * Math.min(34, vmag * 0.55),
                                          bd.y + bd.vy / vmag * Math.min(34, vmag * 0.55), RGBA(bd.col, 0.95), 1.8, 7);
            }
        }
        g.restore();
        for (i = 0; i < S.bodies.length; i++) { bd = S.bodies[i]; if (!bd.isStar) { hintDrag(g, '👆 拖动行星', cx + bd.x, cy + bd.y - this.rOf(bd) - 14); break; } }
        /* 右上信息面板 */
        var keNow = this.totalKE(S.bodies);
        var pct = S.keInit ? keNow / S.keInit * 100 : 100;
        PANEL(g, W - 216, 40, 192, 108, { fill: 'rgba(0,0,0,0.32)', r: 10 });
        TXT(g, '动力学状态', W - 202, 60, { size: 13, weight: 'bold', color: '#ffd97b' });
        TXT(g, '仿真年：' + FMT(S.yr, 2) + ' 年', W - 202, 82, { size: 12.5, color: '#ecf0f1' });
        TXT(g, '存活天体：' + S.bodies.length + ' 个', W - 202, 102, { size: 12.5, color: '#55efc4' });
        TXT(g, '总动能：' + FMT(pct, 0) + '%（初始）', W - 202, 122, { size: 12.5, color: pct > 130 ? '#ff8f8f' : '#a29bfe' });
        TXT(g, 'G 已调参美化 · softening ε=' + this.EPS, W - 202, 140, { size: 10.5, color: '#64748b' });
        if (S.starMass > 2.4) PILL(g, 44, 44, '超重恒星，引力强劲 🧲', '#fff', 'rgba(230,126,34,0.35)', 12);
    },
    data: function (S) {
        var keNow = this.totalKE(S.bodies);
        return [
            { label: '仿真年', value: FMT(S.yr, 2), unit: '年', color: '#ffd97b' },
            { label: '存活天体数', value: S.bodies.length, unit: '个', color: '#55efc4' },
            { label: '总动能（缓变）', value: FMT(S.keInit ? keNow / S.keInit * 100 : 100, 1), unit: '%', color: '#a29bfe' },
            { label: '恒星质量', value: FMT(S.starMass, 1), unit: 'M☉', color: '#f1c40f' }
        ];
    },
    onInit: function (S) {
        var m = MOB();
        S.maxPlanets = (m && m.isMobile) ? 3 : 4;
        S.planetCount = Math.min(S.planetCount, S.maxPlanets);
        S.trailMax = m ? m.reduceParticleCount(120) : 120;
        this.scenario('normal', S); this._S = S;
    },
    hitTest: function (x, y, W, H, S) {
        var cx = W * 0.48, cy = H * 0.52;          // 与 draw 的 translate(cx, cy) 一致
        var lx = x - cx, ly = y - cy;
        for (var i = 0; i < S.bodies.length; i++) {
            var bd = S.bodies[i];
            if (bd.isStar) continue;
            var rr = this.rOf(bd) + 20;
            if ((bd.x - lx) * (bd.x - lx) + (bd.y - ly) * (bd.y - ly) < rr * rr) return true;
        }
        return false;
    },
    /* —— 拖拽交互：暂停或播放态均可拖动任意行星重新定位，释放后从新位置继续 N 体积分 —— */
    down: function (x, y, W, H, ev, S) {
        var cx = W * 0.48, cy = H * 0.52;          // 与 draw 的 translate(cx, cy) 一致
        var lx = x - cx, ly = y - cy;
        for (var i = 0; i < S.bodies.length; i++) {
            var bd = S.bodies[i];
            if (bd.isStar) continue;
            var rr = this.rOf(bd) + 20;
            if ((bd.x - lx) * (bd.x - lx) + (bd.y - ly) * (bd.y - ly) < rr * rr) {
                S.drag = i; S.dragX = bd.x; S.dragY = bd.y;
                bd.trail.length = 0;
                return;
            }
        }
    },
    move: function (x, y, W, H, ev, S) {
        if (S.drag == null) return;
        var cx = W * 0.48, cy = H * 0.52;
        var bd = S.bodies[S.drag];
        if (!bd) { S.drag = null; return; }
        S.dragX = x - cx; S.dragY = y - cy;
        bd.x = S.dragX; bd.y = S.dragY;
        bd.vx = 0; bd.vy = 0;
    },
    up: function (x, y, W, H, ev, S) { S.drag = null; }
};

/* ────────────────────────────────────────────────
 * 模式 3：orbits 引力与轨道 (gravity-and-orbits)
 * ──────────────────────────────────────────────── */
IMPL.orbits = {
    GM: 80000, R_SUN: 17, R_EARTH: 9, MOON_R: 16, MOON_OMEGA: 5,
    defaults: function () {
        return { f: 1.0, moonOn: false, ex: 0, ey: 0, evx: 0, evy: 0,
                 moonAng: 0, aliveTime: 0, dead: false, escaped: false,
                 eVal: 0, energy: 0, fx: [], msgShown: '', drag: false };
    },
    know: '<p><b>引力与轨道</b>：只有速度恰好等于 v<sub>circular</sub>=√(GM/r) 时才是完美圆轨道。'
        + '偏慢→椭圆缩向太阳甚至坠毁；偏快→拉长的椭圆乃至抛物线/双曲线一去不回。'
        + '观察实时偏心率与轨道类型标签的变化，也可以打开月球看看地月双星舞步。</p>',
    vc: function () { return Math.sqrt(this.GM / 140); },   // 地球起始半径 140 px 的圆轨速度
    controls: function (S) {
        var self = this;
        return [
            { id: 'ob_f', type: 'slider', label: '初速度倍率', min: 0.55, max: 1.45, step: 0.01, value: S.f, unit: '×v_circ', onChange: function (v) { S.f = v; self.launch(S); } },
            { id: 'ob_moon', type: 'checkbox', label: '显示月球', value: !!S.moonOn, onChange: function (v) { S.moonOn = v; } },
            { id: 'ob_relaunch', type: 'button', label: '🚀 重新发射（当前倍率）', action: function () { self.launch(S); } },
            { id: 'ob_reset', type: 'button', label: '↩️ 重来（恢复 1.0×）', action: function () { S.f = 1.0; self.launch(S); } }
        ];
    },
    launch: function (S) {
        var vc = this.vc() * S.f;
        S.ex = 140; S.ey = 0;
        S.evx = 0; S.evy = -vc;
        S.aliveTime = 0; S.dead = false; S.escaped = false;
        S.fx.length = 0; S.msgShown = '';
        S.trailEarth = []; S.moonAng = 0;
    },
    classify: function (S) {
        /* 由状态向量算偏心率：e² = 1 + 2Eh²/GM² */
        var gx = 0, gy = 0;
        var rx = S.ex - gx, ry = S.ey - gy;
        var r = Math.hypot(rx, ry);
        var v2 = S.evx * S.evx + S.evy * S.evy;
        var E = v2 / 2 - this.GM / Math.max(r, 1);
        var hx = rx * S.evy - ry * S.evx;
        var e2 = 1 + 2 * E * hx * hx / (this.GM * this.GM);
        S.eVal = Math.sqrt(Math.max(e2, 0)); S.energy = E;
        if (S.dead) return '撞';
        if (S.escaped) return '双曲线逃逸';
        if (S.eVal < 0.08) return '圆轨道';
        if (S.eVal < 1) return '椭圆轨道';
        return '双曲线逃逸';
    },
    update: function (S, dt, t) {
        var TF = 0.6;
        if (!S.drag && !S.dead) {
            var eff = dt * TF;
            S.aliveTime += eff;
            /* 太阳固定原点；半隐式欧拉足够稳健 */
            var r = Math.hypot(S.ex, S.ey);
            var acc = -this.GM / (r * r + 8);
            S.evx += acc * S.ex / r * eff; S.evy += acc * S.ey / r * eff;
            if (!isFinite(S.evx)) S.evx = 0; if (!isFinite(S.evy)) S.evy = 0;
            S.ex += S.evx * eff; S.ey += S.evy * eff;
            /* 坠入太阳 */
            if (r < this.R_SUN + this.R_EARTH) {
                S.dead = true;
                for (var fi = 0; fi < 14; fi++) {
                    S.fx.push({ a: Math.random() * Math.PI * 2, sp: 20 + Math.random() * 60, t: Math.random() });
                }
                if (S.msgShown !== 'crash') { S.msgShown = 'crash'; LOADER_MSG('🔥 地球坠毁！点击「重新发射」再试'); }
            }
            if (Math.hypot(S.ex, S.ey) > 2000 && !S.escaped) {
                S.escaped = true;
                if (S.msgShown !== 'esc') { S.msgShown = 'esc'; LOADER_MSG('🌍 地球飞出了星系范围（逃逸成功）'); }
            }
            this.classify(S);
            pushTrail(S.trailEarth || (S.trailEarth = []), S.ex, S.ey, S.trailMax || 260);
        }
        S.moonAng += dt * TF * this.MOON_OMEGA;
        var ft = 0;
        for (var i = 0; i < S.fx.length; i++) { S.fx[i].t += dt * 1.6; if (S.fx[i].t > 1) ft++; }
        while (ft-- > 0) S.fx.shift();
    },
    draw: function (g, S, W, H) {
        GRID(g, W, H);
        var cx = W * 0.5, cy = H * 0.52;
        g.save(); g.translate(cx, cy);
        var k = KIT(), pline = k && k.polyline;
        /* 尾迹 */
        var tr = S.trailEarth || [];
        if (pline) pline(g, tr, { color: RGBA('#74b9ff', 0.4), width: 1.4 });
        else for (var ti = 1; ti < tr.length; ti++) {
            g.strokeStyle = RGBA('#74b9ff', 0.3 * ti / tr.length);
            g.lineWidth = 1.4;
            g.beginPath(); g.moveTo(tr[ti - 1].x, tr[ti - 1].y); g.lineTo(tr[ti].x, tr[ti].y); g.stroke();
        }
        /* 月球轨道圈 + 月球 */
        var mx = S.ex + Math.cos(S.moonAng) * this.MOON_R;
        var my = S.ey + Math.sin(S.moonAng) * this.MOON_R;
        if (S.moonOn) DASHLN(g, S.ex, S.ey, mx, my, 'rgba(255,255,255,0.25)', 1);
        /* 太阳 */
        drawBody(g, 0, 0, this.R_SUN, { color: '#f1c40f', halo: 3.4 });
        /* 地球 */
        if (!S.dead) {
            drawBody(g, S.ex, S.ey, this.R_EARTH, { color: '#3498db', halo: 1.8, shade: 0.3 });
            if (S.drag) CIRC(g, S.ex, S.ey, this.R_EARTH + 6, null, '#ffffff', 2);   // 拖拽高亮光圈
            hintDrag(g, '👆 拖动地球', S.ex - 34, S.ey - 34);
            if (S.moonOn) drawBody(g, mx, my, 4, { color: '#ecf0f1', halo: 1.4, shade: 0.3 });
            PILL(g, S.ex + 12, S.ey - 22, '地球', '#cfeaff', 'rgba(52,152,219,0.25)', 11);
        } else {
            /* 坠毁火焰闪烁动画 */
            for (var fi = 0; fi < S.fx.length; fi++) {
                var fp = S.fx[fi], dist = 4 + fp.t * fp.sp * 0.35;
                g.save(); g.globalAlpha = 1 - fp.t;
                CIRC(g, Math.cos(fp.a) * dist, Math.sin(fp.a) * dist, 2.5 + 3 * (1 - fp.t),
                     fp.t < 0.4 ? '#f39c12' : '#e74c3c');
                g.restore();
            }
            var pulse = 8 + 10 * ((S.aliveTime * 3) % 1);
            g.save(); g.globalAlpha = 0.5;
            CIRC(g, 0, 0, pulse, null, '#e17055', 2);
            g.restore();
            TXT(g, '💥 地球已焚毁', -46, -this.R_SUN - 22, { size: 13, weight: 'bold', color: '#ff8f8f' });
        }
        /* 比例尺 1 AU */
        PANEL(g, 36, -H * 0.46 + 26, 148, 30, { fill: 'rgba(0,0,0,0.3)', r: 8 });
        LINE(g, 50, -H * 0.46 + 44, 150, -H * 0.46 + 44, '#ecf0f1', 2);
        LINE(g, 50, -H * 0.46 + 39, 50, -H * 0.46 + 49, '#ecf0f1', 2);
        LINE(g, 150, -H * 0.46 + 39, 150, -H * 0.46 + 49, '#ecf0f1', 2);
        TXT(g, '1 AU（示意比例）', 156, -H * 0.46 + 47, { size: 11, color: '#9fb0cc' });
        g.restore();
        /* 类型标签 */
        var cls = this.classify(S);
        var tagBg = S.dead ? 'rgba(231,76,60,0.5)' :
            cls.indexOf('圆') === 0 ? 'rgba(39,174,96,0.5)' :
            cls.indexOf('双') === 0 ? 'rgba(231,76,60,0.5)' : 'rgba(241,196,15,0.4)';
        PILL(g, W - 190, 44, '轨道类型：' + (S.dead ? '坠毁 🔥' : cls), '#fff', tagBg, 13);
        PILL(g, W - 190, 72, '初速度倍率 ' + FMT(S.f, 2) + '×', '#fff', 'rgba(116,185,255,0.25)', 12);
        if (S.moonOn && !S.dead) PILL(g, W - 190, 98, '🌙 月球同步绕转中', '#fff', 'rgba(149,165,166,0.3)', 11);
        TXT(g, '提示：绿色=圆 · 黄色=椭圆 · 红色=双曲线', 54, H - 20, { size: 12, weight: 'bold', color: '#9fb0cc' });
    },
    data: function (S) {
        this.classify(S);
        return [
            { label: '偏心率 e', value: FMT(S.eVal, 3), unit: '', color: '#ffd97b' },
            { label: '比机械能 E', value: FMT(S.energy / 1000, 2), unit: 'kJ/kg·标', color: '#74b9ff' },
            { label: '存活时长', value: FMT(S.aliveTime, 1), unit: 's', color: S.dead ? '#e74c3c' : '#2ecc71' },
            { label: '轨道类型', value: S.dead ? '坠毁' : this.classify(S), unit: '', color: S.dead ? '#e74c3c' : '#55efc4' }
        ];
    },
    onInit: function (S) {
        this.launch(S);
        var m = MOB();
        S.trailMax = m ? m.reduceParticleCount(260) : 260;
    },
    hitTest: function (x, y, W, H, S) {
        var cx = W * 0.5, cy = H * 0.52;            // 与 draw 的 translate(cx, cy) 一致
        return Math.hypot((x - cx) - S.ex, (y - cy) - S.ey) < this.R_EARTH + 20;
    },
    /* —— 拖拽交互：暂停或播放态均可拖动地球到任意位置，释放后以该距离为新轨道半径、重设圆轨道速度 —— */
    down: function (x, y, W, H, ev, S) {
        var cx = W * 0.5, cy = H * 0.52;            // 与 draw 的 translate(cx, cy) 一致
        var lx = x - cx, ly = y - cy;
        if (Math.hypot(lx - S.ex, ly - S.ey) < this.R_EARTH + 20) {
            S.drag = true;
            S.trailEarth = []; S.dead = false; S.escaped = false; S.fx.length = 0;
        }
    },
    move: function (x, y, W, H, ev, S) {
        if (!S.drag) return;
        var cx = W * 0.5, cy = H * 0.52;
        S.ex = x - cx; S.ey = y - cy;
        S.evx = 0; S.evy = 0;
        S.dead = false; S.escaped = false;
    },
    up: function (x, y, W, H, ev, S) {
        if (!S.drag) return;
        S.drag = false;
        var rr = Math.hypot(S.ex, S.ey);
        var rmin = this.R_SUN + this.R_EARTH + 6;
        if (rr < rmin) {                            // 推到最小安全半径，避免直接坠入太阳
            if (rr < 1) { S.ex = rmin; S.ey = 0; }
            else { S.ex = S.ex / rr * rmin; S.ey = S.ey / rr * rmin; }
            rr = rmin;
        }
        var vc = Math.sqrt(this.GM / rr);           // 圆轨道速度 √(GM/r)
        S.evx = -S.ey / rr * vc;                    // 速度方向垂直于位矢（逆时针）
        S.evy = S.ex / rr * vc;
        S.aliveTime = 0; S.dead = false; S.escaped = false;
        S.trailEarth = []; S.fx.length = 0; S.msgShown = '';
    }
};

/* ────────────────────────────────────────────────
 * 模式 4：greenhouse 温室效应
 * ──────────────────────────────────────────────── */
IMPL.greenhouse = {
    PREINDUSTRIAL_G: 0.40,
    defaults: function () {
        return {
            g: 0.7, showCounts: false,
            photons: [], spawnAcc: 0, poolCap: 44,
            inHits: [], escTops: [],
            tDisp: 16, bandInFlags: {},
            probe: null, probeDrag: false
        };
    },
    know: '<p><b>温室效应</b>：阳光（黄色光子）穿透大气加热地面；地面以红外长波（红色光子）向外辐射，'
        + '<b>温室气体浓度越高，红外越多被大气吸收并部分折返回地面</b>，形成能量回流，地表温度随之升高。'
        + '提高浓度观察温度计和通量计如何变化，最后到达新的热平衡。</p>',
    Ttarget: function (gv) { return 15 + 8 * gv + 5 * gv * gv; },   // 15℃(冰室) → 28℃(加倍CO₂)
    onInit: function (S) {
        var m = MOB(), mob = m && m.isMobile;
        S.poolCap = mob ? m.reduceParticleCount(40) : 44;
        S.spawnRateScale = mob ? m.particleScale : 1;
    },
    controls: function (S) {
        var self = this;
        return [
            { id: 'gh_g', type: 'slider', label: '温室气体浓度', min: 0, max: 1, step: 0.01, value: S.g, onChange: function (v) { S.g = v; } },
            { id: 'gh_cnt', type: 'checkbox', label: '显示光子计数', value: !!S.showCounts, onChange: function (v) { S.showCounts = v; } }
        ];
    },
    presets: [
        { name: '冰河期', g: 0.05 },
        { name: '工业前', g: 0.40 },
        { name: '现代', g: 0.70 },
        { name: '加倍 CO₂', g: 1.00 }
    ],
    geom: function (W, H) {
        var gy = H - 44;
        return { top: 8, bandTop: Math.round(H * 0.30), bandBot: Math.round(H * 0.46), ground: gy, midX: W / 2 };
    },
    emitPhoton: function (S, kind, x, y, vx, vy) {
        var i;
        for (i = 0; i < S.photons.length; i++) {
            if (!S.photons[i].alive) {
                var p = S.photons[i];
                p.alive = true; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.wasIn = false;
                return p;
            }
        }
        if (S.photons.length < S.poolCap) {
            p = { alive: true, kind: kind, x: x, y: y, vx: vx, vy: vy, wasIn: false };
            S.photons.push(p);
            return p;
        }
        return null;
    },
    update: function (S, dt, t) {
        S.simT = t;
        var geo = S._geo || this.geom(820, 480);
        var rng = S.rngRef ? S.rngRef() : Math.random;
        var self = this;
        /* 平滑趋近平衡温度 */
        S.tDisp += (self.Ttarget(S.g) - S.tDisp) * CLAMP(dt * 0.9, 0, 1);
        /* 光子注入（太阳雨滴式垂直下落） */
        S.spawnAcc += dt * 17 * (S.spawnRateScale || 1);
        var spanW = (S._W || 820) - 80;
        while (S.spawnAcc >= 1) {
            S.spawnAcc -= 1;
            var sx0 = 40 + rng() * Math.max(120, spanW);
            self.emitPhoton(S, 'vis', sx0, geo.top, (rng() - 0.5) * 14, 150);
        }
        /* 活跃数过低补种（防链式吸收耗尽画面） */
        var act = 0;
        for (var ci = 0; ci < S.photons.length; ci++) if (S.photons[ci].alive) act++;
        if (act < 14) S.spawnAcc += dt * 26 * (S.spawnRateScale || 1);

        /* 更新每个光子 */
        for (var i = S.photons.length - 1; i >= 0; i--) {
            var ph = S.photons[i];
            if (!ph.alive) continue;
            var wasInBand = ph.y > geo.bandTop && ph.y < geo.bandBot;
            ph.x += ph.vx * dt; ph.y += ph.vy * dt;
            var isInBand = ph.y > geo.bandTop && ph.y < geo.bandBot;
            /* 进入大气带的 IR 光子有概率被吸收并随机重发 */
            if (ph.kind === 'ir' && !wasInBand && isInBand) {
                var pAbs = Math.min(0.85, 0.22 + 0.62 * S.g);
                if (rng() < pAbs) {
                    ph.alive = false;
                    /* 重发：随机方向，向下概率随浓度升高（下行回流更强） */
                    var down = rng() < (0.35 + 0.3 * S.g);
                    self.emitPhoton(S, 'ir', ph.x + (rng() - 0.5) * 10,
                        geo.bandTop + rng() * (geo.bandBot - geo.bandTop),
                        (rng() - 0.5) * 46, down ? 100 : -100);
                    continue;
                }
            }
            /* 触地：可见光被吸收→生成红外上返；红外再入射同样反射回一份红外（维持粒子群循环） */
            if (ph.y >= geo.ground - 6) {
                ph.alive = false;
                if (ph.kind === 'vis') S.inHits.push({ ts: t });
                if (ph.kind === 'ir') { /* 地面也吸收这部分回流 */ }
                self.emitPhoton(S, 'ir', ph.x + (rng() - 0.5) * 8, geo.ground - 10, (rng() - 0.5) * 30, -(88 + rng() * 24));
            }
            /* 到达顶端：逃逸出射 */
            else if (ph.y < geo.top) {
                if (ph.kind === 'ir') S.escTops.push({ ts: t });
                ph.alive = false;
            }
        }
        /* 只保留最近 3 s 通量事件 */
        function prune(arr) { while (arr.length && arr[0].ts < t - 3) arr.shift(); }
        prune(S.inHits); prune(S.escTops);
    },
    inRate: function (S) { return S.inHits.length / 3; },
    outRate: function (S) { return S.escTops.length / 3; },
    draw: function (g, S, W, H, t) {
        GRID(g, W, H);
        var geo = S._geo = this.geom(W, H);
        if (!S.probe) S.probe = { x: 80, y: Math.round((geo.bandTop + geo.ground) / 2) };
        /* —— 大气层横带：绿色浓度随 g —— */
        var bandA = 0.08 + 0.34 * S.g;
        RR(g, 14, geo.bandTop, W - 28, geo.bandBot - geo.bandTop, 14);
        g.fillStyle = RGBA('#27ae60', bandA); g.fill();
        g.strokeStyle = RGBA('#27ae60', 0.5); g.lineWidth = 1.5; g.stroke();
        DASHLN(g, 14, geo.bandTop, W - 14, geo.bandTop, 'rgba(39,174,60,0.4)', 1);
        DASHLN(g, 14, geo.bandBot, W - 14, geo.bandBot, 'rgba(39,174,60,0.4)', 1);
        TXT(g, '大气层（温室气体浓度 ' + Math.round(S.g * 100) + '%）', 26, geo.bandTop - 10, { size: 12.5, weight: 'bold', color: RGBA('#27ae60', 0.9) });

        /* —— 光子雨滴束 —— */
        for (var i = 0; i < S.photons.length; i++) {
            var ph = S.photons[i];
            if (!ph.alive) continue;
            if (ph.kind === 'vis') {
                LINE(g, ph.x, ph.y - 9, ph.x, ph.y + 3, RGBA('#f1c40f', 0.85), 2.4);
                CIRC(g, ph.x, ph.y, 2.4, '#fdf37b');
            } else {
                LINE(g, ph.x - ph.vx * 0.09, ph.y - ph.vy * 0.09, ph.x, ph.y, RGBA('#e74c3c', 0.9), 3);
                CIRC(g, ph.x, ph.y, 2.8, '#ff7f66');
            }
        }

        /* —— 地面 + 发热辉光 —— */
        var hotN = CLAMP((S.tDisp - 15) / 14, 0, 1);
        g.fillStyle = '#6d4c33'; g.fillRect(0, geo.ground, W, H - geo.ground);
        var gl = g.createLinearGradient(0, geo.ground - 46, 0, geo.ground);
        gl.addColorStop(0, RGBA('#e74c3c', 0));
        gl.addColorStop(1, RGBA('#e74c3c', 0.06 + 0.4 * hotN));
        g.fillStyle = gl; g.fillRect(0, geo.ground - 46, W, 46);
        LINE(g, 0, geo.ground, W, geo.ground, '#8d6e63', 4);

        /* —— 左侧温度计 & 右侧针式仪表 —— */
        var t01 = CLAMP((S.tDisp + 5) / 45, 0, 1);
        thermometerVertical(g, W - 158, H * 0.34, H * 0.78, t01, {
            cap: '地表温度', hiTxt: '+40℃', loTxt: '−5℃', cold: '#3b7dd8', hotc: '#e74c3c'
        });
        drawGauge(g, W - 268, H * 0.72, 74, (S.tDisp + 5) / 45, '温度仪表盘', hotN > 0.75 ? '#e74c3c' : '#27ae60', FMT(S.tDisp, 1) + ' ℃');

        /* —— 可拖动温度探针：垂直移动到不同大气层高度，实时显示该高度温度 —— */
        var pH = (geo.ground - S.probe.y) / Math.max(1, geo.ground - geo.top);   // 高度归一化（0=顶端,1=地面）
        var pT = S.tDisp - 25 * pH;                                                // 简化递减率：每层降温 ~25℃
        pT = CLAMP(pT, -50, 60);
        CIRC(g, S.probe.x, S.probe.y, 8, '#ff7f66', '#ffffff', 1.6);
        if (S.probeDrag) CIRC(g, S.probe.x, S.probe.y, 14, null, '#ffffff', 2);
        PILL(g, S.probe.x + 14, S.probe.y - 10, '探针 T≈' + FMT(pT, 1) + '℃', '#ffffff', 'rgba(0,0,0,0.55)', 11);
        TXT(g, '探针（可垂直拖动）', S.probe.x - 10, geo.top - 2, { size: 10.5, color: '#9fb0cc' });
        hintDrag(g, '👆 拖动探针', S.probe.x + 66, S.probe.y - 10);

        /* —— 图例 chips —— */
        PILL(g, 28, 14, '黄色＝阳光（短波穿透）', '#fdf37b', 'rgba(241,196,15,0.15)', 12);
        PILL(g, 262, 14, '红色＝地面红外长波', '#ff7f66', 'rgba(231,76,60,0.15)', 12);
        if (S.showCounts) {
            PANEL(g, W - 330, geo.bandTop + 12, 172, 86, { fill: 'rgba(0,0,0,0.35)', r: 10 });
            TXT(g, '📉 通量计数（3s 窗口）', W - 316, geo.bandTop + 32, { size: 12, weight: 'bold', color: '#cfd8ea' });
            TXT(g, '入射(阳光触地)：' + FMT(this.inRate(S), 1) + ' /s', W - 316, geo.bandTop + 52, { size: 12, color: '#fdf37b' });
            TXT(g, '逃逸(顶部离开)：' + FMT(this.outRate(S), 1) + ' /s', W - 316, geo.bandTop + 72, { size: 12, color: '#ff7f66' });
            TXT(g, '入射−逃逸 = 净增益 → 回流升温', W - 316, geo.bandTop + 92, { size: 10.5, color: '#9fb0cc' });
        }
        if (S.g > 0.85) PILL(g, W - 350, 14, '🌡 极端温室：回馈汹涌，加速变暖！', '#ffb3ab', 'rgba(231,76,60,0.3)', 12);
    },
    data: function (S) {
        var deltaVs = S.tDisp - this.Ttarget(this.PREINDUSTRIAL_G);
        return [
            { label: '入射通量（阳光）', value: FMT(this.inRate(S), 1), unit: '/s', color: '#fdf37b' },
            { label: '逃逸通量（红外）', value: FMT(this.outRate(S), 1), unit: '/s', color: '#ff7f66' },
            { label: '地表温度', value: FMT(S.tDisp, 1), unit: '℃', color: S.tDisp > 24 ? '#e74c3c' : '#27ae60' },
            { label: 'Δ vs 工业前', value: (deltaVs >= 0 ? '+' : '') + FMT(deltaVs, 1), unit: '℃', color: deltaVs > 3 ? '#ff8f8f' : '#a29bfe' }
        ];
    },
    hitTest: function (x, y, W, H, S) {
        var geo = this.geom(W, H);
        var px = S.probe ? S.probe.x : 80;
        var py = S.probe ? S.probe.y : Math.round((geo.bandTop + geo.ground) / 2);
        return Math.hypot(x - px, y - py) < 20;
    },
    /* —— 拖拽交互：垂直拖动温度探针到不同大气层高度，实时显示该高度温度 —— */
    down: function (x, y, W, H, ev, S) {
        var geo = this.geom(W, H);
        if (!S.probe) S.probe = { x: 80, y: Math.round((geo.bandTop + geo.ground) / 2) };
        if (Math.hypot(x - S.probe.x, y - S.probe.y) < 20) S.probeDrag = true;
    },
    move: function (x, y, W, H, ev, S) {
        if (!S.probeDrag) return;
        var geo = this.geom(W, H);
        if (!S.probe) S.probe = { x: 80, y: Math.round((geo.bandTop + geo.ground) / 2) };
        S.probe.y = CLAMP(y, geo.top + 8, geo.ground - 8);   // 仅垂直移动
    },
    up: function (x, y, W, H, ev, S) { S.probeDrag = false; }
};

/* ────────────────────────────────────────────────
 * 模式 5：blackbody 黑体光谱
 * ──────────────────────────────────────────────── */
IMPL.blackbody = {
    C2: 14387768.7,        // nm·K
    defaults: function () {
        return { tempK: 5800, compare: false, ghosts: [], cache: null, drag: null };
    },
    know: '<p><b>黑体辐射 · 普朗克定律</b>：<i>B(λ,T) = 1/λ⁵ / (exp(c₂/λT) − 1)</i>。温度越高：'
        + '① 曲线整体抬升（总功率 ∝ T⁴）；② 峰值波长按<b>维恩位移律</b> λ<sub>max</sub>=2.898×10⁶ nm·K / T 向短波移动。'
        + '恒星颜色就是其光谱峰落在可见光区的位置——从红矮星到蓝白星！</p>',
    controls: function (S) {
        var self = this;
        return [
            { id: 'bb_T', type: 'slider', label: '温度 T', min: 1000, max: 6000, step: 100, value: S.tempK, unit: ' K', onChange: function (v) {
                if (S.compare) {
                    self.snapGhost(S);
                }
                S.tempK = v;
            } },
            { id: 'bb_cmp', type: 'checkbox', label: '叠加历史对比曲线', value: !!S.compare, onChange: function (v) { S.compare = v; if (!v) S.ghosts = []; else self.snapGhost(S); } }
        ];
    },
    snapGhost: function (S) {
        var cv = S.cache;
        if (!cv || !cv.samples) return;
        for (var i = 0; i < S.ghosts.length; i++) if (S.ghosts[i].T === cv.T) return;
        S.ghosts.push({ T: cv.T, samples: cv.samples.slice() });
        if (S.ghosts.length > 4) S.ghosts.shift();
    },
    planckNorm: function (T) {
        /* 返回归一样本（峰高=1），λ ∈ [100, 3000] nm 共 240 点 */
        var N = this.SAMPLE_N || 240, out = [], i, mx = 0;
        for (i = 0; i <= N; i++) {
            var lam = 100 + 2900 * i / N;
            var z = this.C2 / (lam * T);
            var val = z > 700 ? 0 : 1 / (Math.pow(lam, 5) * (Math.exp(z) - 1));
            out.push({ lam: lam, B: val });
            if (val > mx) mx = val;
        }
        for (i = 0; i <= N; i++) out[i].n = mx > 0 ? out[i].B / mx : 0;
        return out;
    },
    starColorFor: function (T) {
        var tab = [
            [1000, '#ff6a2b'], [2500, '#ff9d5c'], [3500, '#ffb774'], [4500, '#ffe0bd'],
            [5500, '#fff5ee'], [6500, '#dfe9ff'], [7500, '#c7d8ff']
        ];
        var tc = CLAMP(T, 1000, 7500), i;
        for (i = 1; i < tab.length; i++) {
            if (tc <= tab[i][0]) {
                var tt = (tc - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]);
                return MIX(tab[i - 1][1], tab[i][1], tt);
            }
        }
        return tab[tab.length - 1][1];
    },
    colorName: function (T) {
        if (T < 3700) return '红矮星（M 型）';
        if (T < 5300) return '黄矮星（G 型）';
        return '蓝白星（A/F 型）';
    },
    mappedXY: function (g, W, H) {
        var mg = 52;
        var viewMap = null, k = KIT();
        if (k && k.view) viewMap = k.view({ x: [100, 3000], px: [mg + 8, W - 30], y: [0, 1.06], py: [H - mg - 20, 56] });
        var X = viewMap ? viewMap.X : function (l) { return mg + 8 + (l - 100) / 2900 * (W - mg - 38); };
        var Y = viewMap ? viewMap.Y : function (v) { return H - mg - 20 - v / 1.06 * (H - mg - 76); };
        return { X: X, Y: Y, mg: mg };
    },
    update: function (dt) { /* 静态图无更新需求 */ },
    draw: function (g, S, W, H, t) {
        GRID(g, W, H);
        var XY = this.mappedXY(g, W, H);
        /* —— 顶部温度滑块（可拖动指针，横向改变温度 1000~6000K）—— */
        var slY = 30, slX0 = XY.mg + 8, slX1 = W - 30;
        PANEL(g, slX0, slY - 6, slX1 - slX0, 12, { fill: 'rgba(255,255,255,0.08)', strokeC: 'rgba(255,255,255,0.30)', r: 6, lw: 1 });
        var slP = slX0 + (S.tempK - 1000) / 5000 * (slX1 - slX0);
        CIRC(g, slP, slY, 8, '#f1c40f', '#ffffff', 2);
        if (S.drag === 'slider') CIRC(g, slP, slY, 14, null, '#ffffff', 1.8);
        TXT(g, 'T 滑块（可拖动）', slX0, slY - 12, { size: 10.5, color: '#9fb0cc' });
        TXT(g, FMT(S.tempK, 0) + ' K', slX1, slY - 12, { align: 'right', size: 10.5, color: '#ffd97b' });
        hintDrag(g, '👆 拖动温度', slP, slY + 26);
        /* 重建缓存样本 */
        if (!S.cache || S.cache.T !== S.tempK) {
            S.cache = { T: S.tempK, samples: this.planckNorm(S.tempK) };
        }
        /* 可见光彩虹底带（380–750nm） */
        var rbY = H - XY.mg - 20, rbH = 13;
        for (var lam = 380; lam <= 750; lam += 2) {
            g.fillStyle = WCOL(lam);
            g.fillRect(XY.X(lam) - 1, rbY, 3, rbH);
        }
        RR(g, XY.X(380) - 2, rbY, XY.X(750) - XY.X(380) + 4, rbH, 3);
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.2; g.stroke();
        TXT(g, '←紫外 可见光带 红外→', (XY.X(380) + XY.X(750)) / 2, rbY + rbH + 14, { align: 'center', size: 10.5, color: '#9fb0cc' });

        /* 幽灵对比曲线 */
        for (var gi = 0; gi < S.ghosts.length; gi++) {
            var gh = S.ghosts[gi];
            g.save(); g.globalAlpha = 0.35;
            g.setLineDash([4, 4]);
            g.beginPath();
            for (var gj = 0; gj < gh.samples.length; gj++) {
                var gp = gh.samples[gj];
                gj ? g.lineTo(XY.X(gp.lam), XY.Y(gp.n)) : g.moveTo(XY.X(gp.lam), XY.Y(gp.n));
            }
            g.strokeStyle = '#95a5a6'; g.lineWidth = 1.6; g.stroke();
            g.restore();
            var glx = XY.X(this.lamMaxOf(gh.T));
            TXT(g, FMT(gh.T, 0) + 'K', glx + 10, 74 + gi * 16, { size: 10.5, color: '#b7c3d6' });
        }
        /* 主普朗克曲线 */
        var kk = KIT();
        var mainPts = [];
        var ci;
        for (ci = 0; ci < S.cache.samples.length; ci++) {
            var sp = S.cache.samples[ci];
            mainPts.push({ x: XY.X(sp.lam), y: XY.Y(sp.n) });
        }
        if (kk && kk.polyline) kk.polyline(g, mainPts, { color: '#f1c40f', width: 2.8 });
        else { g.beginPath(); for (var mi = 0; mi < mainPts.length; mi++) mi ? g.lineTo(mainPts[mi].x, mainPts[mi].y) : g.moveTo(mainPts[mi].x, mainPts[mi].y); g.strokeStyle = '#f1c40f'; g.lineWidth = 2.8; g.stroke(); }

        /* 维恩峰位标注 */
        var lMax = this.lamMaxOf(S.tempK);
        DASHLN(g, XY.X(lMax), 56, XY.X(lMax), rbY, 'rgba(233,196,106,0.8)', 1.5);
        CIRC(g, XY.X(lMax), XY.Y(1), 4.5, '#f1c40f', '#fff', 1.5);
        PILL(g, XY.X(lMax) + 8, 60, '峰值 λmax = ' + Math.round(lMax) + ' nm', '#ffe9a8', 'rgba(241,196,15,0.2)', 12);

        /* 坐标轴 */
        this.drawAxes(g, W, H, XY);

        /* 恒星色样 swatch + 色名 */
        var swC = this.starColorFor(S.tempK);
        PANEL(g, 44, 44, 218, 112, { fill: 'rgba(0,0,0,0.32)', r: 10 });
        CIRC(g, 78, 78, 21, null);
        drawBody(g, 78, 78, 21, { color: swC, halo: 2.1, shade: 0.15 });
        CIRC(g, 78, 78, 21, null, 'rgba(255,255,255,0.35)', 1.4);
        if (S.drag === 'star') CIRC(g, 78, 78, 28, null, '#ffffff', 2);   // 拖拽星体色样高亮
        hintDrag(g, '👆 拖动色样', 150, 78);
        TXT(g, FMT(S.tempK, 0) + ' K', 110, 70, { size: 15, weight: 'bold', color: swC });
        TXT(g, 'λmax ' + Math.round(lMax) + ' nm', 110, 92, { size: 12, color: '#ffe9a8' });
        PILL(g, 46, 112, '星色：' + this.colorName(S.tempK), '#fff', RGBA(swC, 0.3), 12);
        PILL(g, W - 208, H - XY.mg - 46, '总面积 ∝ T⁴ 对比：' + FMT(Math.pow(S.tempK / 1000, 4), 1) + '×(@1000K)', '#fff', 'rgba(241,196,15,0.18)', 11.5);
    },
    lamMaxOf: function (T) { return 2.898e6 / T; },
    drawAxes: function (g, W, H, XY) {
        var k = KIT();
        if (k && k.axes) {
            k.axes(g, W, H, {
                margin: XY.mg, color: 'rgba(255,255,255,0.65)',
                xLabel: '波长 λ (nm)', yLabel: '辐射强度 B(λ,T)',
                minX: 100, maxX: 3000, minY: 0, maxY: 1.06
            });
            return;
        }
        /* 原生兜底简化坐标轴 */
        var ox = XY.mg, oy = H - XY.mg - 20;
        LINE(g, ox, oy - (oy - 56), ox, oy, 'rgba(255,255,255,0.65)', 1.5);
        LINE(g, ox, oy, W - 30, oy, 'rgba(255,255,255,0.65)', 1.5);
        [500, 1000, 1500, 2000, 2500, 3000].forEach(function (v) {
            var px = XY.X(v);
            LINE(g, px, oy, px, oy + 5, 'rgba(255,255,255,0.65)', 1.2);
            TXT(g, v, px, oy + 9, { align: 'center', size: 10, color: 'rgba(255,255,255,0.65)' });
        });
        [0, 0.5, 1].forEach(function (v) {
            var py = XY.Y(v);
            LINE(g, ox, py, ox - 5, py, 'rgba(255,255,255,0.65)', 1.2);
            TXT(g, v.toFixed(1), ox - 8, py + 3, { align: 'right', size: 10, color: 'rgba(255,255,255,0.65)' });
        });
        TXT(g, '波长 λ (nm)', ox + (W - 30 - ox) / 2, oy + 26, { align: 'center', size: 12, weight: 'bold', color: 'rgba(255,255,255,0.7)' });
        g.save(); g.translate(ox - 26, (oy + 56) / 2); g.rotate(-Math.PI / 2);
        TXT(g, '辐射强度 B(λ,T)', 0, 0, { align: 'center', size: 12, weight: 'bold', color: 'rgba(255,255,255,0.7)' });
        g.restore();
    },
    data: function (S) {
        var lMax = 2.898e6 / S.tempK;
        return [
            { label: '维恩峰值波长 λmax', value: Math.round(lMax), unit: 'nm', color: '#ffe9a8' },
            { label: '总功率 ∝ T⁴（@1000K基准）', value: FMT(Math.pow(S.tempK / 1000, 4), 1), unit: '×', color: '#f1c40f' },
            { label: '恒星色样归类', value: this.colorName(S.tempK), unit: '', color: this.starColorFor(S.tempK) },
            { label: '对比曲线数量', value: S.ghosts.length, unit: '条', color: '#95a5a6' }
        ];
    },
    onInit: function (S) {
        this.SAMPLE_N = (MOB() && MOB().isMobile) ? MOB().reduceParticleCount(200) : 240;
    },
    hitTest: function (x, y, W, H, S) {
        var mg = 52, slY = 30, slX0 = mg + 8, slX1 = W - 30;
        var pX = slX0 + (S.tempK - 1000) / 5000 * (slX1 - slX0);
        return (Math.abs(y - slY) < 18 && Math.abs(x - pX) < 22) || Math.hypot(x - 78, y - 78) < 28;
    },
    /* —— 拖拽交互：横向拖动温度滑块指针改温，或拖动星体色样到不同温度位置 —— */
    down: function (x, y, W, H, ev, S) {
        var mg = 52, slY = 30, slX0 = mg + 8, slX1 = W - 30;
        var pX = slX0 + (S.tempK - 1000) / 5000 * (slX1 - slX0);
        if (Math.abs(y - slY) < 18 && Math.abs(x - pX) < 22) { S.drag = 'slider'; return; }
        if (Math.hypot(x - 78, y - 78) < 28) { S.drag = 'star'; return; }       // 星体色样
    },
    move: function (x, y, W, H, ev, S) {
        if (!S.drag) return;
        var mg = 52, slX0 = mg + 8, slX1 = W - 30;
        var t01 = CLAMP((x - slX0) / (slX1 - slX0), 0, 1);
        var newT = Math.round((1000 + t01 * 5000) / 100) * 100;                  // 100K 步进，与滑块控件一致
        if (newT < 1000) newT = 1000; if (newT > 6000) newT = 6000;
        if (newT !== S.tempK) {
            if (S.compare) this.snapGhost(S);
            S.tempK = newT;
        }
    },
    up: function (x, y, W, H, ev, S) { S.drag = null; }
};

/* ============================================================
 * 三、工厂与注册
 * ============================================================ */
function freshState(modeKey) {
    var base = IMPL[modeKey];
    var s = base.defaults();
    var seedHolder = { cur: makeRng(19960505) };   // 固定种子 → reset 确定性
    s.rngRef = function () { return seedHolder.cur; };
    s.reseedRng = function () { seedHolder.cur = makeRng(19960505); };
    s.simT = 0;
    return s;
}

function createAstro(cfg) {
    cfg = cfg || {};
    var modeKey = cfg.mode || ID2MODE[cfg.id] || 'kepler';
    if (!IMPL[modeKey]) modeKey = 'kepler';
    var impl = IMPL[modeKey];
    var S = freshState(modeKey), LOADER = null, cacheStr = '';

    function pushData(force) {
        try {
            var arr = impl.data.call(impl, S);
            var key = JSON.stringify(arr.map(function (x) { return [x.label, x.value]; }));
            if (force || key !== cacheStr) { cacheStr = key; LOADER.updateDataDisplay(arr); }
        } catch (e) { /* 数据刷新失败不影响主循环 */ }
    }

    var inst = {
        init: function (loader) {
            LOADER = loader; GLOBAL_LOADER = loader;
            S = freshState(modeKey);
            impl._S = S;
            loader.setKnowledge(impl.know || '');
            var plist = [];
            if (impl.presets) {
                plist = impl.presets.map(function (ps) {
                    return { name: ps.name, apply: function () { ps.apply(inst, S); if (loader.refreshControls) try { loader.refreshControls(); } catch (e) {} } };
                });
            }
            if (modeKey === 'greenhouse') {
                var gh = IMPL.greenhouse;
                plist = gh.presets.map(function (ps) {
                    return { name: ps.name, apply: function () { S.g = ps.g; if (loader.refreshControls) try { loader.refreshControls(); } catch (e) {} } };
                });
            }
            loader.setPresets(plist);
            if (impl.onInit) impl.onInit.call(impl, S);
            pushData(true);
        },
        getControls: function () {
            return impl.controls.call(impl, S || freshState(modeKey));
        },
        update: function (dt, t) {
            if (!S) return;
            if (!(dt > 0)) dt = 0;
            if (dt > 0.05) dt = 0.05;
            S.simT = t;
            impl.update.call(impl, S, dt, t, S._W || 820, S._H || 480);
            pushData(false);
        },
        render: function (ctx, W, H, t) {
            BG(ctx, W, H);
            if (!S) return;
            S._W = W; S._H = H;
            impl.draw.call(impl, ctx, S, W, H, t);
        },
        reset: function () {
            S = freshState(modeKey);
            impl._S = S;
            if (impl.onInit) impl.onInit.call(impl, S);
            cacheStr = '';
            if (LOADER) pushData(true);
        },
        onResize: function (W, H) { S._W = W; S._H = H; },
        /* —— 指针事件转发：派发到当前模式的 down/move/up（坐标为画布 CSS 像素）—— */
        onPointerDown: function (x, y, ev) {
            if (!impl.down) return;
            try { impl.down.call(impl, x, y, S._W || 820, S._H || 480, ev, S); } catch (e) { /* 拖拽异常不影响主循环 */ }
        },
        onPointerMove: function (x, y, ev) {
            if (!impl.move) return;
            try { impl.move.call(impl, x, y, S._W || 820, S._H || 480, ev, S); } catch (e) { /* 拖拽异常不影响主循环 */ }
        },
        onPointerUp: function (x, y, ev) {
            if (!impl.up) return;
            try { impl.up.call(impl, x, y, S._W || 820, S._H || 480, ev, S); } catch (e) { /* 拖拽异常不影响主循环 */ }
        },
        /* —— 悬停抓手判定（只读，供 loader 显示拖拽光标）—— */
        hitTest: function (x, y) {
            if (!impl.hitTest) return false;
            try { return !!impl.hitTest.call(impl, x, y, S._W || 820, S._H || 480, S); } catch (e) { return false; }
        }
    };
    return inst;
}

if (typeof window !== 'undefined' && window.EngineRegistry) {
    window.EngineRegistry.register('astro', { create: createAstro });
}

})();
