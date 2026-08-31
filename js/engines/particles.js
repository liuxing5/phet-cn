/**
 * 粒子/热学 引擎（工厂注册名：'particles'）
 * 覆盖 5 种模式 / 6 个实验 ID：
 *   gasprops   气体性质 (gas-properties)
 *   gasintro   气体介绍 (gases-intro)
 *   statesMatter 物质状态 (states-of-matter / states-of-matter-basics)
 *   diffuse    扩散 (diffusion)
 *   atomicpair 原子相互作用 (atomic-interactions)
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
function GRID(g, W, H) {
    var k = KIT();
    if (k && typeof k.grid === 'function') { try { k.grid(g, W, H); return; } catch (e) {} }
    g.save(); g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    for (var x = 50; x < W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (var y = 50; y < H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.restore();
}
function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var w=ctx.measureText(text).width+12; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-w/2, y-11, w, 22); ctx.fillStyle='#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }
/* 球体（带高光渐变，粒子通用外观） */
function BALL(g, x, y, r, cBase) {
    var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.25, MIX('#ffffff', cBase, 0.35));
    gr.addColorStop(1, MIX(cBase, '#000000', 0.25));
    g.beginPath(); g.arc(x, y, Math.max(r, 0.2), 0, Math.PI * 2);
    g.fillStyle = gr; g.fill();
}
/* ---------- 共享仪表 ---------- */
/* 半圆压力计/温度表：val01 ∈[0,1]，指针从左到右扫过上半圆 */
function drawGauge(g, cx, cy, r, val01, labTxt, colHex) {
    val01 = CLAMP(isFinite(val01) ? val01 : 0, 0, 1);
    PANEL(g, cx - r - 14, cy - r - 26, 2 * r + 28, r + 42, { fill: 'rgba(255,255,255,0.05)', strokeC: 'rgba(255,255,255,0.18)', r: 12 });
    TXT(g, labTxt, cx, cy - r - 12, { align: 'center', size: 13, weight: 'bold', color: '#cfd8ea' });
    g.lineWidth = 9; g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.arc(cx, cy, r - 4, Math.PI, Math.PI * 2); g.stroke();
    var segs = 5;
    for (var i = 0; i < segs; i++) {
        g.strokeStyle = RGBA(colHex, 0.15 + 0.85 * i / (segs - 1));
        g.lineWidth = 9;
        g.beginPath(); g.arc(cx, cy, r - 4, Math.PI + Math.PI * i / segs, Math.PI + Math.PI * (i + 1) / segs); g.stroke();
    }
    /* 刻度线 */
    for (var j = 0; j <= 10; j++) {
        var a = Math.PI + Math.PI * j / 10;
        var c1 = Math.cos(a), s1 = Math.sin(a);
        LINE(g, cx + c1 * (r + 1), cy + s1 * (r + 1), cx + c1 * (r + 7), cy + s1 * (r + 7), 'rgba(255,255,255,0.45)', 1.5);
    }
    /* 指针 */
    var an = Math.PI + Math.PI * val01;
    ARROW(g, cx, cy, cx + Math.cos(an) * (r - 16), cy + Math.sin(an) * (r - 16), '#ffdf6b', 3, 9);
    CIRC(g, cx, cy, 5, colHex, '#ffffff', 1.5);
}
/* 竖直温度计：frac∈[0,1] 表示液柱高度，色随温度冷蓝→暖红 */
function thermometerVertical(g, x, yTop, yBot, frac, opt) {
    opt = opt || {};
    frac = CLAMP(isFinite(frac) ? frac : 0, 0, 1);
    var tw = 14, by = yBot + 26;
    PANEL(g, x - 18, yTop - 24, 48, yBot - yTop + 76, { fill: 'rgba(255,255,255,0.04)', strokeC: 'rgba(255,255,255,0.15)', r: 10 });
    TXT(g, opt.cap || '', x + 26, yTop - 12, { align: 'center', size: 12, weight: 'bold', color: '#cfd8ea' });
    CIRC(g, x, by, 11, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.55)', 1.5);
    RR(g, x - tw / 2, yTop, tw, yBot - yTop, 6);
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.stroke();
    var fh = (yBot - yTop) * frac;
    var hot = MIX('#3498db', '#e74c3c', frac);
    RR(g, x - tw / 2 + 2.5, yBot - fh, tw - 5, fh, 4); g.fillStyle = hot; g.fill();
    CIRC(g, x, by, 8, hot);
    for (var i = 0; i <= 4; i++) {
        var ty = yBot - (yBot - yTop) * i / 4;
        LINE(g, x + tw / 2 + 1, ty, x + tw / 2 + 8, ty, 'rgba(255,255,255,0.4)', 1.2);
    }
    if (opt.loTxt !== undefined) TXT(g, opt.loTxt, x + 1, yBot + 6, { align: 'center', size: 10, color: '#9fb0cc' });
}
/* NaN 防护：速度或坐标不合法时按给定范围重生 */
function guardParticle(p, box, randFn, spMin, spMax) {
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.vx) || !isFinite(p.vy) ||
        Math.abs(p.x) > 1e5 || Math.abs(p.y) > 1e5 || Math.abs(p.vx) > 1e5 || Math.abs(p.vy) > 1e5) {
        p.x = LERP(box.x0, box.x1, randFn());
        p.y = LERP(box.y0, box.y1, randFn());
        var a = randFn() * Math.PI * 2, sp = LERP(spMin, spMax, randFn());
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        return true;
    }
    return false;
}

/* 移动端降级助手（桌面端返回原值，不改变行为） */
function MOB_REDUCE(n) {
    return (typeof window !== 'undefined' && window.Mobile && typeof window.Mobile.reduceParticleCount === 'function')
        ? window.Mobile.reduceParticleCount(n) : n;
}
function MOB_SCALE() {
    return (typeof window !== 'undefined' && window.Mobile && typeof window.Mobile.particleScale === 'number')
        ? window.Mobile.particleScale : 1;
}

/* ============================================================
 * 二、ID → 模式映射
 * ============================================================ */
var ID2MODE = {
    'gas-properties': 'gasprops',
    'gases-intro': 'gasintro',
    'states-of-matter': 'statesMatter',
    'states-of-matter-basics': 'statesMatter',
    'diffusion': 'diffuse',
    'atomic-interactions': 'atomicpair'
};

/* ============================================================
 * 三、模式实现（每个模式先列 defaults）
 * ============================================================ */
var IMPL = {};

/* ────────────────────────────────────────────────
 * 模式 1：gasprops 气体性质
 * ──────────────────────────────────────────────── */
IMPL.gasprops = {
    MAXN: 200,
    BASE_RMS: 120,          // px/s @300K 的方均根速率
    defaults: function () {
        return {
            tempK: 300, volFrac: 0.75, slowMo: false,
            parts: [], pool: [], pressEMA: 0, pressAccum: 0,
            histBins: new Array(24), frame: 0, pumps: [], simT: 0
        };
    },
    know: '<p><b>理想气体</b>：大量分子做无规则热运动。温度反映分子平均动能，'
        + '方均根速率 <i>v<sub>rms</sub> = √(kT/m)</i>；压强来自分子对器壁单位时间单位面积的动量传递。'
        + '缩小体积或升温都会让碰壁更频繁 → 压强升高。</p>',
    box: function (S, W, H) {
        var x0 = 46, y0 = 66, y1 = H - 46;
        var availW = W - 236 - x0;
        return { x0: x0, y0: y0, x1: x0 + Math.max(140, availW * S.volFrac), y1: y1, fullX: x0 + availW };
    },
    spawn: function (S, rng, box, fading) {
        var self = this, p;
        if (S.pool.length) p = S.pool.pop();
        else p = { x: 0, y: 0, vx: 0, vy: 0, r: 5, born: -10 };
        var rms = self.BASE_RMS * Math.sqrt(S.tempK / 300);
        var u = rng(), spd = rms * Math.sqrt(-Math.log(1 - 0.999 * u)); // 二维 Maxwell 速率抽样
        var a = rng() * Math.PI * 2;
        p.x = LERP(box.x0 + 20, box.x1 - 20, rng());
        p.y = LERP(box.y0 + 20, box.y1 - 20, rng());
        p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd;
        p.born = fading ? S.simT : -10;
        return p;
    },
    controls: function (S) {
        var self = this;
        return [
            { id: 'gp_temp', type: 'slider', label: '温度', min: 100, max: 900, step: 10, value: S.tempK, unit: ' K', onChange: function (v) { S.tempK = v; } },
            { id: 'gp_vol', type: 'slider', label: '体积', min: 40, max: 100, step: 1, value: Math.round(S.volFrac * 100), unit: ' %', onChange: function (v) { S.volFrac = v / 100; } },
            { id: 'gp_slow', type: 'checkbox', label: '慢动作 (0.05×)', value: !!S.slowMo, onChange: function (v) { S.slowMo = v; } },
            { id: 'gp_pump', type: 'button', label: '🔺 泵入 +' + self.PUMP_N, action: function () { self.pump(S, +self.PUMP_N); } },
            { id: 'gp_drain', type: 'button', label: '🔻 泵出 −10', action: function () { self.pump(S, -10); } }
        ];
    },
    pump: function (S, n) {
        n = n | 0;
        var box = S._boxCache || this.box(S, S._W || 820, S._H || 480);
        if (n > 0) {
            var rng = S.rngRef();
            for (var i = 0; i < n; i++) {
                if (S.parts.length >= this.MAXN) break;
                var np = this.spawn(S, rng, box, true);
                /* 从右上角"泵口"注入：位置在角落，速度指向盒内左下方 */
                np.x = box.x1 - 26 - rng() * 26;
                np.y = box.y0 + 16 + rng() * 26;
                var spd = Math.hypot(np.vx, np.vy);
                var angIn = Math.PI * (0.55 + rng() * 0.45);   // 指向左下扇区
                np.vx = Math.cos(angIn) * spd; np.vy = Math.sin(angIn) * spd;
                S.parts.push(np);
                S.pumps.push({ t: S.simT });
            }
            if (S.parts.length >= this.MAXN) LOADER_MSG(S, '已达粒子上限 ' + this.MAXN);
        } else {
            while (n++ < 0 && S.parts.length) { S.pool.push(S.parts.pop()); }
        }
    },
    update: function (S, dt, t, W, H) {
        var self = this, box = self.box(S, W, H);
        S._boxCache = box;
        var eff = dt * (S.slowMo ? 0.05 : 1);
        S.simT += eff; S.frame++;
        var rng = S.rngRef();

        /* 温度重整化：向目标 rms 渐变（保持方向、拉模长），等能量感觉平滑 */
        var tgt = self.BASE_RMS * Math.sqrt(S.tempK / 300), cur = 0;
        var i, p;
        for (i = 0; i < S.parts.length; i++) cur += S.parts[i].vx * S.parts[i].vx + S.parts[i].vy * S.parts[i].vy;
        cur = Math.sqrt(cur / Math.max(1, S.parts.length));
        if (cur > 1) {
            var tc = tgt * tgt, cc = cur * cur;
            var nc2 = cc + (tc - cc) * CLAMP(eff * 2.2, 0, 1);
            var fac = Math.sqrt(nc2 / cc);
            for (i = 0; i < S.parts.length; i++) { S.parts[i].vx *= fac; S.parts[i].vy *= fac; }
        }

        /* 移动 + 弹性墙反弹（同时累计动量传递→压强） */
        var accum = 0;
        for (i = S.parts.length - 1; i >= 0; i--) {
            p = S.parts[i];
            guardParticle(p, box, rng, 30, tgt * 2);
            p.x += p.vx * eff; p.y += p.vy * eff;
            if (p.x < box.x0 + p.r) { p.x = box.x0 + p.r; accum += Math.abs(p.vx); p.vx *= -1; }
            else if (p.x > box.x1 - p.r) { p.x = box.x1 - p.r; accum += Math.abs(p.vx); p.vx *= -1; }
            if (p.y < box.y0 + p.r) { p.y = box.y0 + p.r; accum += Math.abs(p.vy); p.vy *= -1; }
            else if (p.y > box.y1 - p.r) { p.y = box.y1 - p.r; accum += Math.abs(p.vy); p.vy *= -1; }
        }
        /* 相对压强 = 单位时间单位壁长动量传递，指数平滑 */
        var wallLen = 2 * (box.y1 - box.y0) + (box.x1 - box.x0);
        var inst = eff > 1e-5 ? accum / wallLen / eff : 0;
        S.pressEMA += (inst - S.pressEMA) * CLAMP(eff * 2.5, 0, 1);

        /* 粒子间等质量弹性碰撞（网格哈希 cell=2r 加速近邻查找） */
        self.collide(S.parts, box);

        /* 泵入淡入动画清理 */
        for (i = 0; i < S.pumps.length; ) {
            if (S.simT - S.pumps[i].t > 0.6) S.pumps.splice(i, 1); else i++;
        }
    },
    collide: function (ps, box) {
        var cs = 12, gridMap = {}, i, j, p, key;
        for (i = 0; i < ps.length; i++) {
            p = ps[i];
            key = ((p.x / cs) | 0) + '_' + ((p.y / cs) | 0);
            (gridMap[key] || (gridMap[key] = [])).push(i);
        }
        var seen = {};
        var offs = [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]];
        for (key in gridMap) {
            var bx = +(key.split('_')[0]), by = +(key.split('_')[1]);
            for (var o = 0; o < offs.length; o++) {
                var nb = gridMap[(bx + offs[o][0]) + '_' + (by + offs[o][1])];
                if (!nb) continue;
                var listA = gridMap[key], sameCell = o === 4;
                for (var a = 0; a < listA.length; a++) {
                    var st = sameCell ? a + 1 : 0;
                    for (var bIdx = st; bIdx < nb.length; bIdx++) {
                        var i1 = listA[a], i2 = nb[bIdx];
                        if (i1 === i2) continue;
                        var pk = i1 < i2 ? i1 * 1000 + i2 : i2 * 1000 + i1;
                        if (seen[pk]) continue;
                        seen[pk] = 1;
                        resolvePair(ps[i1], ps[i2]);
                    }
                }
            }
        }
        function resolvePair(A, B) {
            var dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), minD = A.r + B.r;
            if (!(d > 0) || d >= minD) return;
            var nx = dx / d, ny = dy / d, ov = minD - d;
            A.x -= nx * ov / 2; A.y -= ny * ov / 2;
            B.x += nx * ov / 2; B.y += ny * ov / 2;
            var rvn = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (rvn >= 0) return;              // 正在分离则不处理
            A.vx += rvn * nx; A.vy += rvn * ny; // 等质量：交换法向分量
            B.vx -= rvn * nx; B.vy -= rvn * ny;
        }
    },
    draw: function (g, S, W, H, t) {
        GRID(g, W, H);
        var box = S._boxCache || this.box(S, W, H);
        /* 容器：右侧滑动盖子（体积） */
        var k = COL('sky');
        PANEL(g, box.x0 - 4, box.y0 - 4, box.fullX - box.x0 + 8, box.y1 - box.y0 + 8, { fill: 'rgba(255,255,255,0.02)' });
        g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 3;
        g.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
        /* 滑动盖子 */
        PANEL(g, box.x1 - 2, box.y0 - 10, 8, box.y1 - box.y0 + 20, { fill: '#f39c12', stroke: false, r: 4 });
        TXT(g, '⟷ 盖子可滑动（体积）', box.x0 + 6, box.y0 - 18, { size: 12, color: '#93a5c4' });
        TXT(g, '体积 ' + Math.round(S.volFrac * 100) + '%', (box.x0 + box.x1) / 2, box.y1 + 22, { align: 'center', size: 13, color: '#f39c12', weight: 'bold' });

        /* 粒子 */
        var i, p;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i];
            var fade = p.born > 0 && S.simT - p.born < 0.6 ? CLAMP((S.simT - p.born) / 0.6, 0.15, 1) : 1;
            g.save(); g.globalAlpha = fade;
            BALL(g, p.x, p.y, p.r, '#74b9ff');
            g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.stroke();
            g.restore();
        }
        /* 泵入提示（右上角淡入进入动画） */
        for (i = 0; i < S.pumps.length; i++) {
            var pr = S.pumps[i], a2 = CLAMP(1 - (S.simT - pr.t) / 0.6, 0, 1);
            g.save(); g.globalAlpha = a2;
            PILL(g, box.x1 - 96, box.y0 + 12 - (1 - a2) * 18, '+10 ▶', '#fff', 'rgba(46,204,113,0.5)', 12);
            g.restore();
        }

        /* 右侧面板：半圆压力计 + 速度直方图 */
        var gx = W - 126, gy = 92;
        var pval = CLAMP(S.pressEMA / 900, 0.02, 1);
        drawGauge(g, gx, gy, 62, pval, '相对压强 P', '#e67e22');
        TXT(g, FMT(S.pressEMA, 1), gx, gy + 18, { align: 'center', size: 13, weight: 'bold', color: '#ffb86b' });

        selfDrawHist(g, S, W, H);
        if (S.slowMo) PILL(g, W - 128, 14, '🐌 慢动作 ×0.05', '#ffd', 'rgba(155,89,182,0.4)', 12);

        function selfDrawHist(ctx2, St, Ww, Hh) {
            var hx = Ww - 218, hy = Hh - 52, hw = 196, hh = 150;
            PANEL(ctx2, hx - 6, hy - 34, hw + 12, hh + 52, { fill: 'rgba(0,0,0,0.28)', r: 10 });
            TXT(ctx2, '分子速率分布', hx, hy - 20, { size: 12, weight: 'bold', color: '#cfd8ea' });
            var rms = IMPL.gasprops.BASE_RMS * Math.sqrt(St.tempK / 300);
            var vmax = rms * 2.6, bins = 24;
            var hist = new Array(bins);
            for (var q = 0; q < bins; q++) hist[q] = 0;
            for (var q2 = 0; q2 < St.parts.length; q2++) {
                var sp = Math.hypot(St.parts[q2].vx, St.parts[q2].vy);
                var bi = CLAMP((sp / vmax * bins) | 0, 0, bins - 1);
                hist[bi]++;
            }
            var mx = 1;
            for (var q3 = 0; q3 < bins; q3++) if (hist[q3] > mx) mx = hist[q3];
            var bwid = hw / bins;
            for (var q4 = 0; q4 < bins; q4++) {
                var bh = hist[q4] / mx * (hh - 18);
                ctx2.fillStyle = 'rgba(52,152,219,0.8)';
                ctx2.fillRect(hx + q4 * bwid + 1, hy + hh - bh, bwid - 2, bh);
                ctx2.strokeStyle = 'rgba(255,255,255,0.85)';
                ctx2.lineWidth = 1;
                ctx2.strokeRect(hx + q4 * bwid + 1, hy + hh - bh, bwid - 2, bh);
            }
            DASHLN(ctx2, hx + (rms / vmax) * hw, hy, hx + (rms / vmax) * hw, hy + hh, '#2ecc71', 1.5);
            TXT(ctx2, 'v_rms', hx + (rms / vmax) * hw + 3, hy + 8, { size: 10, color: '#2ecc71' });
            LINE(ctx2, hx, hy + hh, hx + hw, hy + hh, 'rgba(255,255,255,0.4)', 1);
            TXT(ctx2, '0', hx, hy + hh + 12, { size: 10, color: '#9fb0cc' });
            TXT(ctx2, '速率 →', hx + hw, hy + hh + 12, { align: 'right', size: 10, color: '#9fb0cc' });
        }
    },
    data: function (S) {
        return [
            { label: '粒子数 N', value: S.parts.length, unit: '个', color: '#3498db' },
            { label: '温度 T', value: FMT(S.tempK, 0), unit: 'K', color: '#e74c3c' },
            { label: '体积', value: Math.round(S.volFrac * 100), unit: '%', color: '#f39c12' },
            { label: '相对压强', value: FMT(S.pressEMA, 1), unit: '', color: '#2ecc71' }
        ];
    },
    onInit: function (S) {
        var box = S._boxCache || { x0: 60, y0: 80, x1: 500, y1: 420 };
        var rng = S.rngRef();
        var n0 = MOB_REDUCE(40);
        for (var i = 0; i < n0; i++) S.parts.push(IMPL.gasprops.spawn(S, rng, box, false));
    }
};

/* ────────────────────────────────────────────────
 * 模式 2：gasintro 气体介绍
 * ──────────────────────────────────────────────── */
IMPL.gasintro = {
    SPECIES: [
        { name: '氖 Ne', m: 20, r: 6, col: '#a29bfe' },
        { name: '氧 O₂', m: 32, r: 7.5, col: '#e74c3c' },
        { name: '氮 N₂', m: 28, r: 7, col: '#3498db' },
        { name: '水汽 H₂O', m: 18, r: 5.5, col: '#1abc9c' }
    ],
    defaults: function () {
        return { tempK: 300, show: 'all', showVec: false, parts: [], pool: [], simT: 0 };
    },
    know: '<p><b>气体分子模型</b>：不同气体的分子质量和大小不同——同温度下轻分子的平均速率更大'
        + '（平均动能相同）。把温度调高，观察"热运动"如何加剧；单选一种气体看清它的运动轨迹。</p>',
    baseSpeed: function (m, T) { return 110 * Math.sqrt(20 / m) * Math.sqrt(T / 300); },
    controls: function (S) {
        var self = this;
        return [
            { id: 'gi_species', type: 'select', label: '气体种类', value: S.show, options: [
                { value: 'all', label: '全部混合' },
                { value: '0', label: '仅氖' }, { value: '1', label: '仅氧' },
                { value: '2', label: '仅氮' }, { value: '3', label: '仅水汽' }
            ], onChange: function (v) { S.show = String(v); self.reseed(S); } },
            { id: 'gi_temp', type: 'slider', label: '温度', min: 100, max: 900, step: 10, value: S.tempK, unit: ' K', onChange: function (v) { S.tempK = v; } },
            { id: 'gi_vec', type: 'checkbox', label: '显示速度箭头', value: !!S.showVec, onChange: function (v) { S.showVec = v; } },
            { id: 'gi_reset', type: 'button', label: '🔄 重置气体', action: function () { self.reseed(S); } }
        ];
    },
    reseed: function (S) {
        var sc = MOB_SCALE();
        while (S.pool.length < Math.round(120 * sc)) S.pool.push({ x: 0, y: 0, vx: 0, vy: 0, r: 5, sp: 0, seed: Math.random() });
        S.parts.length = 0;
        var rng = S.rngRef(), spec = this.SPECIES;
        var plan = S.show === 'all' ? [Math.round(30 * sc), Math.round(25 * sc), Math.round(25 * sc), Math.round(20 * sc)] : ([0, 1, 2, 3].indexOf(+S.show) >= 0 ? null : [Math.round(30 * sc), Math.round(25 * sc), Math.round(25 * sc), Math.round(20 * sc)]);
        var total = plan ? (plan[0] + plan[1] + plan[2] + plan[3]) : Math.round(100 * sc);
        var si, counts = [0, 0, 0, 0];
        for (si = 0; si < total; si++) {
            var idx = plan ? (si < plan[0] ? 0 : si < plan[0] + plan[1] ? 1 : si < plan[0] + plan[1] + plan[2] ? 2 : 3)
                           : +S.show;
            var sd = spec[idx], p = S.pool.pop() || {};
            var spd = this.baseSpeed(sd.m, S.tempK), ang = rng() * Math.PI * 2;
            p.sp = idx; p.r = sd.r;
            p.x = 80 + rng() * 640; p.y = 90 + rng() * 320;
            p.vx = Math.cos(ang) * spd; p.vy = Math.sin(ang) * spd;
            p.jag = 0.6 + rng() * 0.8;
            S.parts.push(p);
        }
    },
    update: function (S, dt, t, W, H) {
        S.simT += dt;
        var rng = S.rngRef(), box = { x0: 56, y0: 74, x1: W - 36, y1: H - 52 };
        S._box = box;
        var i, p, spec;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i]; spec = this.SPECIES[p.sp];
            /* 向本温度的目标速率渐变（轻分子更快） */
            var target = this.baseSpeed(spec.m, S.tempK);
            var cur = Math.hypot(p.vx, p.vy);
            if (cur > 1) { var f = LERP(1, target / cur, CLAMP(dt * 3, 0, 1)); p.vx *= f; p.vy *= f; }
            /* 抖动（jiggle）：随机小角度旋转 + 随机脉冲 + 偶发大转向 */
            var rot = (rng() - 0.5) * dt * 16 * (p.jag || 1);
            var cs = Math.cos(rot), sn = Math.sin(rot);
            var nvx = p.vx * cs - p.vy * sn + (rng() - 0.5) * 240 * dt;
            var nvy = p.vx * sn + p.vy * cs + (rng() - 0.5) * 240 * dt;
            if (rng() < dt * 0.55) { var ang2 = rng() * Math.PI * 2, spd2 = Math.hypot(nvx, nvy); nvx = Math.cos(ang2) * spd2; nvy = Math.sin(ang2) * spd2; }
            var vmax = target * 2.4;
            if (!isFinite(nvx) || !isFinite(nvy)) { nvx = target; nvy = 0; }
            if (vmax > 0 && (nvx * nvx + nvy * nvy) > vmax * vmax) {
                var s3 = vmax / Math.hypot(nvx, nvy); nvx *= s3; nvy *= s3;
            }
            p.vx = nvx; p.vy = nvy;
            guardParticle(p, box, rng, 20, 300);
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.x < box.x0 + p.r) { p.x = box.x0 + p.r; p.vx = Math.abs(p.vx); }
            if (p.x > box.x1 - p.r) { p.x = box.x1 - p.r; p.vx = -Math.abs(p.vx); }
            if (p.y < box.y0 + p.r) { p.y = box.y0 + p.r; p.vy = Math.abs(p.vy); }
            if (p.y > box.y1 - p.r) { p.y = box.y1 - p.r; p.vy = -Math.abs(p.vy); }
        }
    },
    draw: function (g, S, W, H) {
        GRID(g, W, H);
        var box = S._box || { x0: 56, y0: 74, x1: W - 36, y1: H - 52 };
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3;
        g.beginPath();                                  // 无盖：左侧 + 底部 + 右侧
        g.moveTo(box.x0, box.y0); g.lineTo(box.x0, box.y1); g.lineTo(box.x1, box.y1); g.lineTo(box.x1, box.y0);
        g.stroke();
        DASHLN(g, box.x0, box.y0, box.x1, box.y0, 'rgba(255,255,255,0.15)', 1.5);
        TXT(g, '↑ 开口盒（示意无盖）', (box.x0 + box.x1) / 2, box.y0 - 12, { align: 'center', size: 12, color: '#7f90ad' });

        var legendX = box.x0 + 4, i, p, spec;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i]; spec = this.SPECIES[p.sp];
            BALL(g, p.x, p.y, p.r, spec.col);
            g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.stroke();
            if (S.showVec) {
                var vl = Math.hypot(p.vx, p.vy);
                if (vl > 4) ARROW(g, p.x, p.y, p.x + p.vx / vl * (p.r + 12), p.y + p.vy / vl * (p.r + 12), spec.col, 1.5, 6);
            }
        }
        /* 图例 */
        var lx = 66;
        for (i = 0; i < this.SPECIES.length; i++) {
            spec = this.SPECIES[i];
            var active = S.show === 'all' || S.show === String(i);
            BALL(g, lx, H - 20, spec.r, active ? spec.col : '#556');
            TXT(g, spec.name, lx + spec.r + 5, H - 16, { size: 11, color: active ? '#e8eefb' : '#5a6a84' });
            lx += spec.r + 12 + g.measureText(spec.name).width + 26;
        }
        TXT(g, '同温下轻分子更快 → 动能均分', W - 50, H - 16, { align: 'right', size: 12, color: '#93a5c4' });
    },
    data: function (S) {
        var out = [], cnt = [0, 0, 0, 0], sumV = [0, 0, 0, 0], i;
        for (i = 0; i < S.parts.length; i++) {
            var p = S.parts[i];
            cnt[p.sp]++;
            sumV[p.sp] += Math.hypot(p.vx, p.vy);
        }
        for (i = 0; i < 4; i++) {
            if (cnt[i] === 0) continue;
            out.push({ label: this.SPECIES[i].name, value: cnt[i] + ' · v̄=' + FMT(sumV[i] / cnt[i], 0), unit: 'px/s', color: this.SPECIES[i].col });
        }
        out.unshift({ label: '总粒子数', value: S.parts.length, unit: '个', color: '#ecf0f1' });
        return out.slice(0, 6);
    },
    onInit: function (S) { this.reseed(S); }
};

/* ────────────────────────────────────────────────
 * 模式 3：statesMatter 物质状态 (+basics)
 * ──────────────────────────────────────────────── */
IMPL.statesMatter = {
    SUBSTANCES: [
        { key: 'Ne', name: '氖 Ne', mp: 24, bp: 27, col: '#a29bfe' },
        { key: 'Ar', name: '氩 Ar', mp: 84, bp: 87, col: '#f39c12' },
        { key: 'O2', name: '氧 O₂', mp: 54, bp: 90, col: '#e74c3c' },
        { key: 'H2O', name: '水 H₂O', mp: 273, bp: 373, col: '#1abc9c' }
    ],
    defaults: function () {
        return {
            sub: 3, tempK: 300, phase: 'liquid', pendPhase: 'liquid', pendT: 0,
            parts: [], simT: 0
        };
    },
    know: '<p><b>物质三态</b>：固态分子在晶格位置附近振动；液态分子可以流动但聚集在下部；'
        + '气态分子自由充满全容器。跨越熔点/沸点时排列方式连续过渡（近似演示，熔沸点仅取整示意）。'
        + '尝试把水从 50 K 升到 500 K 观察固→液→气。</p>',
    getSub: function (S, basic) { return this.SUBSTANCES[basic ? 3 : S.sub]; },
    phaseOf: function (sub, T) { return T < sub.mp ? 'solid' : T <= sub.bp ? 'liquid' : 'gas'; },
    controls: function (S, basic) {
        var self = this, list = [];
        if (!basic) {
            list.push({
                id: 'sm_sub', type: 'select', label: '物质', value: String(S.sub), options:
                    this.SUBSTANCES.map(function (sb, i) { return { value: String(i), label: sb.name }; }),
                onChange: function (v) { S.sub = CLAMP(+v | 0, 0, 3); self.retuneAll(S); }
            });
        }
        list.push({ id: 'sm_temp', type: 'slider', label: basic ? '温度' : '温度 T', min: 50, max: 500, step: 1, value: S.tempK, unit: ' K', onChange: function (v) { S.tempK = v; } });
        return list;
    },
    retuneAll: function (S) {
        /* 换物质后重新计算相并平滑迁移到新排列 */
        S.phase = 'unknown'; S.phaseTimer = 0;
        for (var i = 0; i < S.parts.length; i++) { S.parts[i].hx = S.parts[i].x; S.parts[i].hy = S.parts[i].y; }
    },
    layoutParts: function (S, basic) {
        S.parts.length = 0;
        var n = MOB_REDUCE(80), cols, rows;
        if (n >= 80) { cols = 10; rows = 8; }
        else if (n >= 48) { cols = 8; rows = 6; }
        else { cols = 6; rows = 5; }
        n = cols * rows;
        S._cols = cols; S._rows = rows;
        var i;
        for (i = 0; i < n; i++) S.parts.push({
            x: 200 + (i % cols) * 44, y: 180 + ((i / cols) | 0) * 38,
            hx: 0, hy: 0, ph: i * 2.399, wander: makeRng(97 + i), wx: 0, wy: 0,
            wT: 0,
            vx: 0, vy: 0
        });
    },
    update: function (S, dt, t, W, H, basic) {
        S.simT += dt;
        var sub = this.getSub(S, basic);
        var target = this.phaseOf(sub, S.tempK);
        /* 滞回 0.4 s 防抖动切换 */
        if (target !== S.phase) {
            if (S.phase === 'unknown') S.phase = target;
            else {
                S.phaseTimer += dt;
                if (S.phaseTimer > 0.4) { S.phase = target; S.phaseTimer = 0; }
            }
        } else S.phaseTimer = 0;

        var box = { x0: 70, y0: 76, x1: W - 240, y1: H - 58 };
        S._box = box;
        var midY = (box.y0 + box.y1) / 2;

        /* 目标锚点分配 */
        var ampSolid = CLAMP((S.tempK - 50) / Math.max(1, sub.mp - 50), 0, 1) * 7 + 2;
        var cols = S._cols || 10, rows = S._rows || 8;
        var spanX = box.x1 - box.x0, spanY = box.y1 - box.y0;
        var gy0 = midY - spanY * 0.42;
        var i, p;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i];
            var ci = i % cols, ri = (i / cols) | 0;
            var slotX = box.x0 + spanX * (ci + 1) / (cols + 1);
            var slotY = gy0 + spanY * 0.72 * ri / (rows - 1);
            if (S.phase === 'solid') {
                p.hx = slotX + Math.cos(t * 5 + p.ph) * ampSolid;
                p.hy = slotY + Math.sin(t * 6.2 + p.ph * 1.7) * ampSolid;
            } else if (S.phase === 'liquid') {
                /* 缓慢布朗游走目标点（约束下半部） */
                p.wT = (p.wT || 0) - dt;
                if (p.wT <= 0 || !isFinite(p.wx)) {
                    p.wT = 0.9 + p.wander() * 1.4;
                    p.wx = CLAMP(p.wx + (p.wander() - 0.5) * 130, box.x0 + 22, box.x1 - 22);
                    p.wy = CLAMP(p.wy + (p.wander() - 0.5) * 100, midY - 8, box.y1 - 20);
                }
                p.hx = p.wx; p.hy = p.wy;
            }
        }
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i];
            if (S.phase === 'gas') {
                /* 全箱匀速反弹 */
                if (!isFinite(p.vx) || !isFinite(p.vy)) { p.vx = 90; p.vy = 60; }
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.x < box.x0 + 8) { p.x = box.x0 + 8; p.vx = Math.abs(p.vx); }
                if (p.x > box.x1 - 8) { p.x = box.x1 - 8; p.vx = -Math.abs(p.vx); }
                if (p.y < box.y0 + 8) { p.y = box.y0 + 8; p.vy = Math.abs(p.vy); }
                if (p.y > box.y1 - 8) { p.y = box.y1 - 8; p.vy = -Math.abs(p.vy); }
            } else {
                var ks = S.phase === 'solid' ? 8 : 2.4;
                p.x += (p.hx - p.x) * Math.min(1, dt * ks);
                p.y += (p.hy - p.y) * Math.min(1, dt * ks);
            }
        }
        S._phaseInfo = { sub: sub, phase: S.phase };
    },
    draw: function (g, S, W, H, t, basic) {
        GRID(g, W, H);
        var info = S._phaseInfo || { sub: this.SUBSTANCES[S.sub], phase: 'liquid' };
        var sub = info.sub, box = S._box || { x0: 70, y0: 76, x1: W - 240, y1: H - 58 };
        /* 容器 */
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3;
        g.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
        /* 相区着色（液态下部微蓝 / 气态满箱极浅） */
        if (S.phase === 'liquid') {
            RR(g, box.x0 + 1.5, (box.y0 + box.y1) / 2 - 6, box.x1 - box.x0 - 3, (box.y1 - box.y0) / 2 + 5, 4);
            g.fillStyle = RGBA(sub.col, 0.08); g.fill();
        } else if (S.phase === 'gas') {
            RR(g, box.x0 + 1.5, box.y0 + 1.5, box.x1 - box.x0 - 3, box.y1 - box.y0 - 3, 4);
            g.fillStyle = RGBA(sub.col, 0.045); g.fill();
        }
        var i, p;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i];
            BALL(g, p.x, p.y, 9, sub.col);
            g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.stroke();
        }
        /* 温度计（左） */
        var frac = CLAMP((S.tempK - 50) / 450, 0, 1);
        thermometerVertical(g, W - 186, H * 0.32, H * 0.82, frac, {
            cap: (basic ? '' : sub.name + ' '), loTxt: FMT(S.tempK, 0) + ' K'
        });
        /* 相变条带（右下）：固 | 液 | 气 三段，指针显示当前 T */
        var sx = W - 218, sy = H - 96, sw = 190, sh = 12;
        TXT(g, basic ? '状态' : '相变图示', sx, sy - 14, { size: 12, weight: 'bold', color: '#cfd8ea' });
        var zones = [
            { w: CLAMP(sub.mp / 500, 0.06, 0.9), col: '#5fa8ff', txt: '固' },
            { w: CLAMP((sub.bp - sub.mp) / 500, 0.05, 0.9), col: '#43d9b8', txt: '液' },
            { w: 1, col: '#ff8f6b', txt: '气' }
        ];
        var zx = sx, tfx;
        zones.forEach(function (z) {
            var wz = z === zones[2] ? sw - (zones[0].w + zones[1].w) * sw : z.w * sw;
            g.fillStyle = z.col; g.fillRect(zx, sy, wz - 2, sh);
            zx += wz;
        });
        var tNorm = CLAMP((S.tempK - 50) / 450, 0, 1);
        tfx = sx + tNorm * sw;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(tfx, sy + sh + 3); g.lineTo(tfx - 6, sy + sh + 11); g.lineTo(tfx + 6, sy + sh + 11); g.closePath(); g.fill();
        var phaseName = S.phase === 'solid' ? '固态' : S.phase === 'liquid' ? '液态' : '气态';
        PILL(g, sx, sy + sh + 16, phaseName, '#fff', RGBA(info.sub.col, 0.55), 12);
        PILL(g, sx + 66, sy + sh + 16, '熔点 ' + sub.mp + 'K · 沸点 ' + sub.bp + 'K', '#cfd8ea', 'rgba(255,255,255,0.08)', 11);
        if (!basic) TXT(g, sub.name + '（熔沸点为示意值）', box.x0 + 4, box.y0 - 14, { size: 12, weight: 'bold', color: sub.col });
    },
    data: function (S, basic) {
        var info = S._phaseInfo || { sub: this.SUBSTANCES[basic ? 3 : S.sub], phase: S.phase };
        var sub = info.sub;
        var nearMp = Math.abs(S.tempK - sub.mp) < 8, nearBp = Math.abs(S.tempK - sub.bp) < 8;
        return [
            { label: '温度', value: FMT(S.tempK, 0), unit: 'K', color: '#ff8f6b' },
            { label: '摄氏温度', value: FMT(S.tempK - 273.15, 1), unit: '°C', color: '#5fa8ff' },
            { label: '物态', value: S.phase === 'solid' ? '固' : S.phase === 'liquid' ? '液' : '气', unit: '', color: info.sub.col },
            { label: nearMp ? '⚠ 接近熔点' : nearBp ? '⚠ 接近沸点' : '物质', value: nearMp || nearBp ? FMT(nearMp ? sub.mp : sub.bp, 0) : sub.name.split(' ')[0], unit: nearMp || nearBp ? 'K' : '', color: nearMp || nearBp ? '#f1c40f' : '#ecf0f1' }
        ];
    },
    onInit: function (S) { this.layoutParts(S); }
};

/* ────────────────────────────────────────────────
 * 模式 4：diffuse 扩散
 * ──────────────────────────────────────────────── */
IMPL.diffuse = {
    NL: MOB_REDUCE(60), NR: MOB_REDUCE(60), BASE_SPD: 95,
    defaults: function () {
        return { open: false, speedMul: 1, parts: [], openTime: 0, converged: false, msgT: -10 };
    },
    know: '<p><b>扩散</b>：两种气体最初各占一边。抽掉隔板后，粒子沿随机方向运动，自发地混合均匀——'
        + '最终每种颜色的粒子在左右两半各占约 50%。这就是扩散的不可逆性（熵增的一种表现）。'
        + '温度越高混合越快。</p>',
    controls: function (S) {
        var self = this;
        return [
            { id: 'df_open', type: 'checkbox', label: '打开隔板', value: !!S.open, onChange: function (v) {
                if (v && !S.open) S.msgT = S.simT;   // 打开瞬间开始计时
                S.open = v;
            } },
            { id: 'df_speed', type: 'slider', label: '温度（速度倍率）', min: 0.5, max: 2, step: 0.05, value: S.speedMul, unit: '×', onChange: function (v) { S.speedMul = v; } },
            { id: 'df_reset', type: 'button', label: '🔄 重置重排', action: function () { self.reseed(S); LOADER_MSG(S, ''); } }
        ];
    },
    reseed: function (S) {
        var rng = S.rngRef(), i, p;
        S.parts.length = 0;
        var box = S._box || { x0: 70, y0: 84, x1: 900, y1: 392, cx: 485 };
        var halfW = box.cx - box.x0;
        for (i = 0; i < this.NL + this.NR; i++) {
            var leftSide = i < this.NL;
            p = {
                side: leftSide ? 'blue' : 'yellow',
                r: 6,
                x: 0, y: 0, vx: 0, vy: 0
            };
            p.x = leftSide ? box.x0 + 20 + rng() * (halfW - 40) : box.x1 - 20 - rng() * (halfW - 40);
            p.y = box.y0 + 18 + rng() * (box.y1 - box.y0 - 36);
            var ang = rng() * Math.PI * 2, sp = this.BASE_SPD;
            p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
            S.parts.push(p);
        }
        S.openTime = 0; S.converged = false;
    },
    update: function (S, dt, t) {
        S.simT = t;
        if (!S._box) return;
        var box = S._box, cx = box.cx;
        if (S.open && !S.converged) S.openTime += dt;
        var mul = S.speedMul, i, p;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i];
            guardParticle(p, { x0: box.x0 + 6, y0: box.y0 + 6, x1: box.x1 - 6, y1: box.y1 - 6 }, S.rngRef(), 30, 260);
            p.x += p.vx * mul * dt; p.y += p.vy * mul * dt;
            if (p.x < box.x0 + p.r) { p.x = box.x0 + p.r; p.vx = Math.abs(p.vx); }
            if (p.x > box.x1 - p.r) { p.x = box.x1 - p.r; p.vx = -Math.abs(p.vx); }
            if (p.y < box.y0 + p.r) { p.y = box.y0 + p.r; p.vy = Math.abs(p.vy); }
            if (p.y > box.y1 - p.r) { p.y = box.y1 - p.r; p.vy = -Math.abs(p.vy); }
            /* 隔板反射（关闭时） */
            if (!S.open) {
                if (p.side === 'blue' && p.x > cx - p.r) { p.x = cx - p.r; p.vx = -Math.abs(p.vx); }
                if (p.side === 'yellow' && p.x < cx + p.r) { p.x = cx + p.r; p.vx = Math.abs(p.vx); }
            }
        }
        /* 收敛判定：左蓝% 与右黄% 都接近 50±3% */
        var st = this.stats(S);
        if (!S.converged && S.open && Math.abs(st.lb - 50) < 3 && Math.abs(st.ry - 50) < 3) {
            S.converged = true;
            LOADER_MSG(S, '🎉 已均匀混合！用时 ' + FMT(S.openTime, 1) + ' s');
        }
    },
    stats: function (S) {
        var lb = 0, ry = 0, nl = 0, nr = 0, i, p;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i];
            var isLeft = p.x < S._box.cx;
            if (p.side === 'blue') { if (isLeft) lb++; }
            else { if (!isLeft) ry++; }
            if (isLeft) nl++; else nr++;
        }
        return {
            lb: nl ? lb / nl * 100 : 0,      // 左区内蓝色占比 %
            ry: nr ? ry / nr * 100 : 0,      // 右区内黄色占比 %
            nl: nl, nr: nr
        };
    },
    draw: function (g, S, W, H) {
        GRID(g, W, H);
        var box = S._box;
        if (!box) box = S._box = { x0: 70, y0: 84, x1: W - 36, y1: H - 130, cx: (70 + W - 36) / 2 };
        S._boxLx0 = function () { return box.x0; };
        S._boxRx1 = function () { return box.x1; };
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3;
        g.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
        /* 隔板 */
        if (!S.open) {
            PANEL(g, box.cx - 4, box.y0, 8, box.y1 - box.y0, { fill: '#e17055', stroke: false, r: 3 });
        } else {
            DASHLN(g, box.cx, box.y0, box.cx, box.y1, 'rgba(225,112,85,0.35)', 2, [5, 6]);
        }
        var i, p;
        for (i = 0; i < S.parts.length; i++) {
            p = S.parts[i];
            BALL(g, p.x, p.y, p.r, p.side === 'blue' ? '#5fa8ff' : '#f6d365');
            g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.stroke();
        }
        TXT(g, '蓝 ●×' + this.NL, (box.x0 + box.cx) / 2, box.y0 - 16, { align: 'center', size: 12, color: '#5fa8ff', weight: 'bold' });
        TXT(g, '●×' + this.NR + ' 黄', (box.cx + box.x1) / 2, box.y0 - 16, { align: 'center', size: 12, color: '#f6d365', weight: 'bold' });

        /* 底部双向汇聚占比条 */
        var st = this.stats(S);
        var bxx = box.x0, byy = box.y1 + 16, bw2 = box.x1 - box.x0;
        TXT(g, '左区构成', bxx, byy + 12, { size: 12, weight: 'bold', color: '#cfd8ea' });
        this.barPair(g, bxx + 78, byy + 3, bw2 * 0.42, st.lb);
        TXT(g, '蓝' + FMT(st.lb, 0) + '%｜黄' + FMT(100 - st.lb, 0) + '%', bxx + 88 + bw2 * 0.42, byy + 12, { size: 12, color: '#cfd8ea' });
        TXT(g, '右区构成', bxx, byy + 34, { size: 12, weight: 'bold', color: '#cfd8ea' });
        this.barPair(g, bxx + 78, byy + 25, bw2 * 0.42, st.ry, true);
        TXT(g, '黄' + FMT(st.ry, 0) + '%｜蓝' + FMT(100 - st.ry, 0) + '%', bxx + 88 + bw2 * 0.42, byy + 34, { size: 12, color: '#cfd8ea' });
        PILL(g, W - 132, 14, S.open ? '⏱ ' + FMT(S.openTime, 1) + ' s' : '隔板关闭中', '#fff', S.open ? 'rgba(41,128,185,0.45)' : 'rgba(150,150,160,0.3)', 12);
        if (S.converged) PILL(g, box.cx - 56, box.y0 + 10, '✔ 已均匀 50%', '#fff', 'rgba(39,174,96,0.55)', 12);
    },
    barPair: function (g, x, y, w, pct, yellowFirst) {
        pct = CLAMP(pct, 0, 100);
        var wa = w * pct / 100;
        PANEL(g, x, y, w, 16, { fill: 'rgba(255,255,255,0.06)', strokeC: 'rgba(255,255,255,0.25)', r: 8 });
        g.fillStyle = yellowFirst ? '#f6d365' : '#5fa8ff';
        g.fillRect(x + 1, y + 1, Math.max(wa - 1, 0), 14);
        g.fillStyle = yellowFirst ? '#5fa8ff' : '#f6d365';
        g.fillRect(x + 1 + Math.max(wa - 1, 0), y + 1, Math.max(w - wa - 1, 0), 14);
        DASHLN(g, x + w / 2, y - 2, x + w / 2, y + 18, 'rgba(255,255,255,0.6)', 1);
    },
    data: function (S) {
        if (!S._box || !S.stats) return [{ label: '初始化…', value: '--', unit: '' }];
        var st = this.stats(S);
        return [
            { label: '左区蓝占比', value: FMT(st.lb, 1), unit: '%', color: '#5fa8ff' },
            { label: '右区黄占比', value: FMT(st.ry, 1), unit: '%', color: '#f6d365' },
            { label: S.converged ? '混合完成用时' : '混合进行时', value: FMT(S.openTime, 1), unit: 's', color: '#2ecc71' },
            { label: '粒子总数', value: this.NL + this.NR, unit: '个', color: '#ecf0f1' }
        ];
    },
    onInit: function (S, loader, W, H) {
        var bw = loader && loader.state ? 820 : 820;   // 尺寸由首帧 render 校正
        S._box = null;
        S._pendingInit = true;
    }
};

/* ────────────────────────────────────────────────
 * 模式 5：atomicpair 原子相互作用 (Lennard-Jones)
 * ──────────────────────────────────────────────── */
IMPL.atomicpair = {
    SIGMA: 40,          // σ → 40 px
    ACC: 420,           // 加速度换算 px/s² per (势梯度 1/px)
    defaults: function () {
        return {
            noDamp: false, showForce: true,
            ax: 0, bxRel: 2.6,     // B 相对 A 的距离（σ 单位）
            bv: 0, dragging: false, hover: false,
            started: false
        };
    },
    know: '<p><b>伦纳德-琼斯 (LJ) 势</b>：<i>V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]</i>。r&lt;σ 强烈排斥，'
        + 'r≈1.12σ 处势阱最低最稳定，远处吸引迅速衰减。拖动 B 原子改变间距后释放，'
        + '它将沿 −dV/dr 方向受力振动；关掉阻尼可以看到永久振荡。</p>',
    Vof: function (rq) { return 4 * (Math.pow(1 / rq, 12) - Math.pow(1 / rq, 6)); },       // 输入 r/σ
    Fof: function (rq) { return 24 * (2 * Math.pow(1 / rq, 12) - Math.pow(1 / rq, 6)) / rq; }, // dV/dr (σ 单位)，>0 斥
    geom: function (S, W, H) {
        var curveH = Math.min(H * 0.40, 250);
        var stageY0 = curveH + 30, stageY1 = H - 34;
        var ax = Math.max(W * 0.26, 170);
        return { curveH: curveH, stageY0: stageY0, stageY1: stageY1, sy: (stageY0 + stageY1) / 2, ax: ax, sigma: this.SIGMA };
    },
    controls: function (S) {
        return [
            { id: 'ap_damp', type: 'checkbox', label: '无阻尼（永久振动）', value: !!S.noDamp, onChange: function (v) { S.noDamp = v; } },
            { id: 'ap_force', type: 'checkbox', label: '显示力箭头', value: !!S.showForce, onChange: function (v) { S.showForce = v; } },
            { id: 'ap_eq', type: 'button', label: '🎯 回到平衡点', action: function () { S.bxRel = 1.1224620; S.bv = 0; } }
        ];
    },
    setRelFromPx: function (S, geo, x) {
        var rel = CLAMP((x - geo.ax) / geo.sigma, 0.85, 3.0);
        S.bxRel = rel; S.bv = 0;
    },
    update: function (S, dt, t) {
        S.simT = t;
        if (S.dragging || !S._geo) return;
        var geo = S._geo;
        var rel = S.bxRel;
        if (!isFinite(rel)) { rel = S.bxRel = 2.6; S.bv = 0; }
        var rPx = rel * geo.sigma;
        var Fsig = this.Fof(rel);                 // 以 σ 为长度的力（>0 向外斥力）
        var aPx = -Fsig / geo.sigma * this.ACC;   // px/s²：dV/dr 的 px 版本再反向
        S.bv += aPx * dt;
        if (!S.noDamp) S.bv *= Math.exp(-0.55 * dt);   // 阻尼
        if (!isFinite(S.bv)) S.bv = 0;
        rPx += S.bv * dt;
        var hardMin = 0.85 * geo.sigma, hardMax = 3.0 * geo.sigma;
        if (rPx < hardMin) { rPx = hardMin; S.bv = Math.abs(S.bv) * 0.5; }
        if (rPx > hardMax) { rPx = hardMax; S.bv = -Math.abs(S.bv) * 0.3; }
        S.bxRel = rPx / geo.sigma;
    },
    hitTest: function (S, x, y) {
        var W = S._W || 820, H = S._H || 480;
        var geo = S._geo || this.geom(S, W, H);
        var bxPix = geo.ax + (S.bxRel != null ? S.bxRel : 2.6) * geo.sigma;
        return Math.hypot(x - bxPix, y - geo.sy) < 24;
    },
    ptDown: function (S, x, y) {
        if (!S._geo) return;
        var geo = S._geo;
        var bxPix = geo.ax + S.bxRel * geo.sigma;
        if (Math.hypot(x - bxPix, y - geo.sy) < 24) { S.dragging = true; S.started = true; }
    },
    ptMove: function (S, x, y) {
        if (S.dragging) this.setRelFromPx(S, S._geo, x);
        else if (S._geo) {
            var bxPix = S._geo.ax + S.bxRel * S._geo.sigma;
            S.hover = Math.hypot(x - bxPix, y - S._geo.sy) < 24;
        }
    },
    ptUp: function (S) { S.dragging = false; },
    draw: function (g, S, W, H) {
        GRID(g, W, H);
        var geo = S._geo = this.geom(S, W, H);
        var rel = CLAMP(S.bxRel, 0.85, 3), V = this.Vof(rel), Fs = this.Fof(rel);
        /* —— 顶部势能曲线 —— */
        var k = KIT(), viewMap = null;
        if (k && k.view) viewMap = k.view({ x: [0.85, 3], px: [54, W - 26], y: [-1, 3], py: [geo.curveH - 8, 30] });
        var X = viewMap ? viewMap.X : function (r) { return 54 + (r - 0.85) / 2.15 * (W - 80); };
        var Y = viewMap ? viewMap.Y : function (v) { return geo.curveH - 8 - (v + 1) / 4 * (geo.curveH - 38); };
        PANEL(g, 40, 14, W - 66, geo.curveH - 4, { fill: 'rgba(0,0,0,0.22)', r: 10 });
        TXT(g, '势能曲线  V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]', 54, 30, { size: 13, weight: 'bold', color: '#cfd8ea' });
        var pts = [], i;
        for (i = 0; i <= 160; i++) {
            var rq = 0.85 + 2.15 * i / 160;
            pts.push({ x: X(rq), y: Y(this.Vof(rq)) });
        }
        /* 零线与 V=−ε 参考线 */
        DASHLN(g, 54, Y(0), W - 26, Y(0), 'rgba(255,255,255,0.25)', 1);
        TXT(g, 'V=0', 54, Y(0) - 4, { size: 10, color: '#8fa0bd' });
        DASHLN(g, 54, Y(-1), W - 26, Y(-1), 'rgba(46,204,113,0.3)', 1);
        TXT(g, 'V=−ε', 54, Y(-1) + 12, { size: 10, color: '#2ecc71' });
        var kk = KIT();
        if (kk && kk.polyline) kk.polyline(g, pts, { color: '#74b9ff', width: 2.5 });
        else { g.beginPath(); pts.forEach(function (pt, ix) { ix ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y); }); g.strokeStyle = '#74b9ff'; g.lineWidth = 2.5; g.stroke(); }
        /* 平衡点标注 */
        CIRC(g, X(1.122462), Y(this.Vof(1.122462)), 4, '#2ecc71');
        TXT(g, '平衡 1.12σ', X(1.122462) + 8, Y(-1) - 4, { size: 11, color: '#2ecc71' });
        /* 当前小红点 */
        var dotX = X(rel), dotY = Y(V);
        CIRC(g, dotX, dotY, 6, '#e74c3c', '#fff', 1.6);
        DASHLN(g, dotX, dotY, dotX, geo.stageY0, 'rgba(231,76,60,0.35)', 1);

        /* —— 主舞台：A 固定 + B 可拖 —— */
        PANEL(g, 40, geo.stageY0 - 10, W - 66, geo.stageY1 - geo.stageY0 + 24, { fill: 'rgba(0,0,0,0.18)', r: 10 });
        var baseY = geo.sy;
        /* 区域底色带（以 A 为参照画横带） */
        function bandFor(r1, r2, colr, alpha) {
            var xa = geo.ax + r1 * geo.sigma, xb = geo.ax + r2 * geo.sigma;
            g.fillStyle = RGBA(colr, alpha);
            g.fillRect(Math.max(46, xa), geo.stageY0 + 6, Math.max(0, xb - Math.max(46, xa)), geo.stageY1 - geo.stageY0 - 10);
        }
        bandFor(0.85, 1.0, '#e74c3c', 0.10);
        bandFor(1.0, 1.35, '#2ecc71', 0.09);
        bandFor(2.2, 3.0, '#3498db', 0.07);
        TXT(g, '排斥区 (<σ)', XofLocal(0.92), geo.stageY1 - 2, { size: 11, color: '#ff8f8f', align: 'center' });
        TXT(g, '势阱吸引 (~1.12σ)', XofLocal(1.16), geo.stageY1 - 2, { size: 11, color: '#7be0ae', align: 'center' });
        TXT(g, '远处忽略 (>2.2σ)', XofLocal(2.62), geo.stageY1 - 2, { size: 11, color: '#8fc4ff', align: 'center' });
        function XofLocal(r) { return geo.ax + r * geo.sigma; }
        /* 连线 */
        var axP = geo.ax, bxP = geo.ax + rel * geo.sigma;
        DASHLN(g, axP, baseY, bxP, baseY, 'rgba(255,255,255,0.5)', 1.5, [4, 5]);
        TXT(g, 'r', (axP + bxP) / 2, baseY + 14, { align: 'center', size: 13, color: '#cfd8ea' });
        /* A 原子（固定居左） */
        BALL(g, axP, baseY, 21, '#9b59b6');
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; g.stroke();
        TXT(g, 'A（固定）', axP, baseY - 34, { align: 'center', size: 12, weight: 'bold', color: '#cfb3ee' });
        /* B 原子 */
        BALL(g, bxP, baseY, 21, '#3498db');
        g.strokeStyle = S.dragging || S.hover ? '#f1c40f' : 'rgba(255,255,255,0.75)';
        g.lineWidth = S.dragging || S.hover ? 3 : 2; g.stroke();
        TXT(g, 'B' + (S.dragging ? '（拖动中）' : S.hover ? '（按住拖动）' : ''), bxP, baseY - 34, { align: 'center', size: 12, weight: 'bold', color: '#a9cff5' });
        hintDrag(g, '👆 拖动 B 原子', bxP, baseY + 34);
        /* 力箭头 */
        if (S.showForce && !S.dragging && Math.abs(Fs) > 0.01) {
            var repulse = Fs > 0;
            var dir = repulse ? 1 : -1;
            var mag = CLAMP(Math.abs(Fs) * 22, 12, 64);
            ARROW(g, bxP, baseY - 40, bxP + dir * mag, baseY - 40, repulse ? '#e74c3c' : '#2ecc71', 2 + CLAMP(Math.abs(Fs) * 2, 0, 4), 9);
            TXT(g, repulse ? '排斥 F' : '吸引 F', bxP + dir * (mag + 8), baseY - 40, { size: 12, weight: 'bold', color: repulse ? '#e74c3c' : '#2ecc71' });
        }
        /* 读数 chips */
        PILL(g, 54, geo.stageY0 + 2, 'r/σ = ' + FMT(rel, 3), '#fff', 'rgba(116,185,255,0.25)', 12);
        PILL(g, 168, geo.stageY0 + 2, 'V = ' + FMT(V, 2) + ' ε', '#fff', 'rgba(233,196,106,0.25)', 12);
        PILL(g, 296, geo.stageY0 + 2, Fs > 0 ? 'F：排斥 ⤴' : (Fs < 0 ? 'F：吸引 ⤵' : 'F ≈ 0'), '#fff', Fs > 0 ? 'rgba(231,76,60,0.3)' : 'rgba(46,204,113,0.3)', 12);
        if (!S.started) TXT(g, '👉 用鼠标左右拖动蓝色 B 原子后松手试试！', geo.ax + 1.6 * geo.sigma, geo.sy + 52, { size: 14, weight: 'bold', color: '#ffd97b' });
    },
    data: function (S) {
        var rel = CLAMP(S.bxRel, 0.85, 3);
        return [
            { label: '原子间距 r/σ', value: FMT(rel, 3), unit: '', color: '#74b9ff' },
            { label: '势能 V/ε', value: FMT(this.Vof(rel), 2), unit: '', color: '#f1c40f' },
            { label: '相互作用力', value: this.Fof(rel) > 0 ? '排斥' : this.Fof(rel) < 0 ? '吸引' : '≈0', unit: '', color: this.Fof(rel) > 0 ? '#e74c3c' : '#2ecc71' }
        ];
    }
};

/* loader 引用暂存（用于 toast 提示） */
var GLOBAL_LOADER = null;
function LOADER_MSG(S, msg) {
    if (GLOBAL_LOADER && typeof GLOBAL_LOADER.showToast === 'function') {
        try { GLOBAL_LOADER.showToast(msg); } catch (e) {}
    }
}

/* ============================================================
 * 四、工厂与注册
 * ============================================================ */
function freshState(modeKey) {
    var base = IMPL[modeKey];
    var s = base.defaults();
    var seedHolder = { cur: null };                // 固定种子：每次 reset 排布完全一致（确定性）
    s.rngRef = function () {
        if (!seedHolder.cur) seedHolder.cur = makeRng(20240817);
        return seedHolder.cur;
    };
    s.reseedRng = function () { seedHolder.cur = null; };
    s.simT = 0;
    return s;
}

function createParticles(cfg) {
    cfg = cfg || {};
    var modeKey = cfg.mode || ID2MODE[cfg.id] || 'gasprops';
    if (!IMPL[modeKey]) modeKey = 'gasprops';
    var impl = IMPL[modeKey];
    var basic = !!cfg.basic;
    var S = freshState(modeKey), LOADER = null, cacheStr = '';

    function pushData(force) {
        try {
            var arr = impl.data.call(impl, S, basic);
            var key = JSON.stringify(arr.map(function (x) { return [x.label, x.value]; }));
            if (force || key !== cacheStr) { cacheStr = key; LOADER.updateDataDisplay(arr); }
        } catch (e) { /* 数据刷新失败不影响主循环 */ }
    }

    var inst = {
        init: function (loader) {
            LOADER = loader; GLOBAL_LOADER = loader;
            S = freshState(modeKey);
            loader.setKnowledge(impl.know || '');
            loader.setPresets([]);
            if (impl.onInit) impl.onInit.call(impl, S);
            pushData(true);
        },
        getControls: function () {
            return impl.controls.call(impl, S || freshState(modeKey), basic);
        },
        update: function (dt, t) {
            if (!S) return;
            if (!(dt > 0)) dt = 0;
            if (dt > 0.05) dt = 0.05;
            S.simT = t;
            if (impl.update) impl.update.call(impl, S, dt, t, S._W || 820, S._H || 480, basic);
            pushData(false);
        },
        render: function (ctx, W, H, t) {
            BG(ctx, W, H);
            if (!S) return;
            S._W = W; S._H = H;
            /* diffuse：尺寸敏感盒子 + 首帧播种 */
            if (modeKey === 'diffuse') {
                var box = { x0: 70, y0: 84, x1: W - 36, y1: H - 148, cx: (70 + W - 36) / 2 };
                S._boxLx0 = function () { return box.x0; };
                S._boxRx1 = function () { return box.x1; };
                S._box = box;
                if (S._pendingInit) { IMPL.diffuse.reseed(S); S._pendingInit = false; }
            }
            impl.draw.call(impl, ctx, S, W, H, t, basic);
        },
        reset: function () {
            S = freshState(modeKey);
            S.reseedRng();
            cacheStr = '';
            if (impl.onInit) impl.onInit.call(impl, S);
            if (modeKey === 'diffuse') S._pendingInit = true;
            if (LOADER) pushData(true);
        },
        onPointerDown: impl.ptDown ? function (x, y, ev) {
            if (S) {
                if (modeKey === 'atomicpair' && !S._geo && S._W) {
                    try { S._geo = IMPL.atomicpair.geom(S, S._W, S._H); } catch (e) {}
                }
                try { impl.ptDown.call(impl, S, x, y, ev); } catch (e) {}
            }
        } : undefined,
        onPointerMove: impl.ptMove ? function (x, y, ev) { if (S) try { impl.ptMove.call(impl, S, x, y, ev); } catch (e) {} } : undefined,
        onPointerUp: impl.ptUp ? function (x, y, ev) { if (S) try { impl.ptUp.call(impl, S, x, y, ev); } catch (e) {} } : undefined,
        hitTest: impl.hitTest ? function (x, y) { if (S) try { return !!impl.hitTest.call(impl, S, x, y); } catch (e) { return false; } return false; } : undefined,
        onResize: function (W, H) { S._W = W; S._H = H; }
    };
    /* 清理 undefined 方法（EngineRegistry 不检查，但保持整洁） */
    ['onPointerDown', 'onPointerMove', 'onPointerUp', 'hitTest'].forEach(function (k2) {
        if (inst[k2] === undefined) delete inst[k2];
    });
    return inst;
}

if (typeof window !== 'undefined' && window.EngineRegistry) {
    window.EngineRegistry.register('particles', { create: createParticles });
}

})();
