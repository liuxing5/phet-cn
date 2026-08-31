/**
 * 力学通用引擎（factory 名: 'mechanics'）
 * 覆盖实验ID：
 *   collision-lab / energy-skate-park(-basics) / masses-springs(-basics) /
 *   hookes-law / friction / forces-motion-basics / balancing-act / density /
 *   under-pressure / energy-forms-changes / projectile-data-lab
 *
 * 契约：顶层除 window.EngineRegistry.register 外不触碰 document；
 *       DOM 交互一律经 loader（setKnowledge/setPresets/updateDataDisplay/showToast）。
 */
(function () {
    'use strict';

    var G = 9.8;

    /* 拖拽提示标签：只读绘制，不改变任何状态 */
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var w=ctx.measureText(text).width+12; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-w/2, y-11, w, 22); ctx.fillStyle='#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }

    /* ============ 小工具（纯函数，无 DOM） ============ */
    function KT() { return window.Kit; }
    function nf(v, d) {
        if (!isFinite(v)) v = 0;
        var kit = KT();
        return (kit && kit.fmt) ? kit.fmt(v, d === undefined ? 2 : d) : v.toFixed(d === undefined ? 2 : d);
    }
    function txt(ctx, s, x, y, o) {
        o = o || {};
        KT().label(ctx, s, x, y, {
            size: o.size || 13,
            color: o.color || KT().COLORS.dark,
            align: o.align || 'left',
            baseline: o.baseline || 'alphabetic',
            weight: o.weight || 'normal',
            alpha: o.alpha
        });
    }
    function pn(ctx, x, y, w, h, o) { KT().panel(ctx, x, y, w, h, o || {}); }
    function arw(ctx, x1, y1, x2, y2, color, width, head) {
        KT().arrow(ctx, x1, y1, x2, y2, { color: color, width: width || 3, head: head !== false });
    }
    function pline(ctx, pts, o) {
        o = o || {};
        KT().polyline(ctx, pts, {
            color: o.color || KT().COLORS.dark,
            width: o.width === undefined ? 2 : o.width,
            dash: o.dash, closed: o.closed, fill: o.fill, alpha: o.alpha
        });
    }
    function dst(ctx, x1, y1, x2, y2, color, width, seg) {
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = width || 1.4;
        ctx.setLineDash(seg || [5, 4]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
    }
    function disk(ctx, x, y, r, fill, stroke, lw, alpha) {
        ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0.4), 0, 6.2832);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
        ctx.restore();
    }
    function rc(ctx, x, y, w, h, fill, stroke, lw, alpha) {
        ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.strokeRect(x, y, w, h); }
        ctx.restore();
    }
    /* drawArrowDict：一组带标签的力矢量 [{fx,fy,color,label,w}] */
    function forceFan(ctx, cx, cy, pxPerN, list) {
        for (var i = 0; i < list.length; i++) {
            var f = list[i]; if (!f) continue;
            var dx = f.fx * pxPerN, dy = -f.fy * pxPerN;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len < 2) continue;
            arw(ctx, cx, cy, cx + dx, cy + dy, f.color, f.w || 3.5);
            txt(ctx, f.label || '', cx + dx + (dx >= 0 ? 6 : -6), cy + dy + (dy >= 0 ? 13 : -7),
                { size: 12, color: f.color, align: dx >= 0 ? 'left' : 'right', weight: 'bold' });
        }
    }
    /* 堆叠能量柱（竖直）：parts=[[颜色,数值,label],...] */
    function stackBar(ctx, x, y, w, h, parts, vmax, title) {
        var C = KT().COLORS;
        pn(ctx, x - 10, y - 30, w + 20, h + 62, { radius: 10, fill: 'rgba(255,255,255,0.9)', stroke: C.gray });
        txt(ctx, title, x + w / 2, y - 12, { size: 12, align: 'center', weight: 'bold' });
        rc(ctx, x, y, w, h, '#eef1f5', C.gray, 1);
        var acc = 0, tot = 0, i;
        for (i = 0; i < parts.length; i++) tot += Math.max(parts[i][1], 0);
        if (tot <= 0) tot = 1;
        acc = 0;
        for (i = 0; i < parts.length; i++) {
            var vh = h * Math.max(parts[i][1], 0) / (vmax || 1);
            if (vh > 0) rc(ctx, x, y + h - acc - vh, w, vh, parts[i][0]);
            acc += vh;
        }
        for (var j = 0; j < parts.length; j++) {
            rc(ctx, x + w + 8, y + 6 + j * 16, 10, 10, parts[j][0]);
            txt(ctx, parts[j][2] || '', x + w + 24, y + 16 + j * 16, { size: 11 });
        }
    }

    /* 匀速圆盘表 */
    function gauge(ctx, cx, cy, r, val, vmax, unit, title, col) {
        var C = KT().COLORS, frac = KT().clamp(val / (vmax || 1), 0, 1);
        var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        pn(ctx, cx - r - 14, cy - r - 28, r * 2 + 28, r * 2 + 52, { radius: 10, fill: 'rgba(255,255,255,0.88)', stroke: C.gray });
        txt(ctx, title, cx, cy - r - 11, { size: 12, align: 'center', weight: 'bold' });
        ctx.save();
        ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
        ctx.strokeStyle = col || C.green;
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * frac); ctx.stroke();
        ctx.restore();
        var ang = a0 + (a1 - a0) * frac;
        arw(ctx, cx, cy, cx + Math.cos(ang) * (r - 3), cy + Math.sin(ang) * (r - 3), C.dark, 3);
        txt(ctx, nf(val, 1) + ' ' + unit, cx, cy + 18, { size: 14, align: 'center', weight: 'bold' });
    }
    /* 数据卡片缓存：字符串比较，变化才重建 innerHTML */
    function flushRows(st, rows) {
        if (!st.L || !st.L.updateDataDisplay) return;
        try {
            var key = JSON.stringify(rows);
            if (key === st._dcKey) return;
            st._dcKey = key;
            st.L.updateDataDisplay(rows);
        } catch (err) { /* 忽略序列化异常 */ }
    }
    function row(lb, val, unit, color) { return { label: lb, value: val, unit: unit, color: color }; }

    /* ============================================================
       Mode 1  collision —— 一维碰撞实验室 (collision-lab)
       ============================================================ */
    function buildCollision() {
        var st = {
            W: 800, H: 600, m1: 1, m2: 1, v1: 2, v2: -2, e: '1',
            x1: -2.5, x2: 2.5, lostJ: 0, E0: 0, contactDir: 0, drag: ''
        };
        function recalcE0() { st.E0 = 0.5 * st.m1 * st.v1 * st.v1 + 0.5 * st.m2 * st.v2 * st.v2; st.lostJ = 0; }
        recalcE0();
        function geo() { return { ppm: st.W / 16, gy: st.H * 0.78, halfM: 7.6 }; }
        function sumR() { return (Math.sqrt(st.m1) + Math.sqrt(st.m2)) * 0.26; }
        function doCollide() {
            var e = parseFloat(st.e), m1 = st.m1, m2 = st.m2, v1 = st.v1, v2 = st.v2;
            var ke0 = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
            st.v1 = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
            st.v2 = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2);
            var ke1 = 0.5 * m1 * st.v1 * st.v1 + 0.5 * m2 * st.v2 * st.v2;
            st.lostJ += Math.max(ke0 - ke1, 0);
            if (parseFloat(st.e) === 0) st.contactDir = (st.x2 > st.x1) ? 1 : -1;
        }
        function slider(id, label, min, max, step, unit, get, set) {
            return {
                id: id, type: 'slider', label: label, min: min, max: max, step: step, unit: unit, value: get(),
                onChange: function (v) { set(v); recalcE0(); st.contactDir = 0; }
            };
        }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>动量守恒定律</strong>：系统不受外力（或外力矢量和为零）时，碰撞前后总动量保持不变。</p>' +
                    '<div class="formula">m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′</div>' +
                    '<h4 style="color:#2980b9;margin-top:12px">🔄 恢复系数</h4>' +
                    '<div class="formula">e = |v₂′ − v₁′| / |v₁ − v₂|</div>' +
                    '<ul style="padding-left:20px">' +
                    '<li>e = 1 完全弹性碰撞：动能无损失</li>' +
                    '<li>0 &lt; e &lt; 1 一般碰撞：部分动能转化为内能</li>' +
                    '<li>e = 0 完全非弹性碰撞：两物体粘合共同运动，动能损失最大</li></ul>'
                );
                L.setPresets([
                    { name: '相向而撞', apply: function () { st.m1 = 1; st.m2 = 1; st.v1 = 4; st.v2 = -4; st.e = '1'; st.contactDir = 0; recalcE0(); } },
                    { name: '追尾', apply: function () { st.m1 = 2; st.m2 = 1; st.v1 = 5; st.v2 = 1; st.e = '0.5'; st.contactDir = 0; recalcE0(); } },
                    { name: '大碰小', apply: function () { st.m1 = 5; st.m2 = 0.5; st.v1 = 2.5; st.v2 = 0; st.e = '0'; st.contactDir = 0; recalcE0(); } }
                ]);
            },
            getControls: function () {
                return [
                    slider('col_m1', '球A质量', 0.5, 5, 0.1, ' kg', function () { return st.m1; }, function (v) { st.m1 = v; }),
                    slider('col_v1', '球A速度', -5, 5, 0.1, ' m/s', function () { return st.v1; }, function (v) { st.v1 = v; }),
                    slider('col_m2', '球B质量', 0.5, 5, 0.1, ' kg', function () { return st.m2; }, function (v) { st.m2 = v; }),
                    slider('col_v2', '球B速度', -5, 5, 0.1, ' m/s', function () { return st.v2; }, function (v) { st.v2 = v; }),
                    {
                        id: 'col_e', type: 'select', label: '恢复系数', value: st.e,
                        options: [
                            { value: '1', label: '完全弹性 e=1' },
                            { value: '0.5', label: '部分弹性 e=0.5' },
                            { value: '0', label: '完全非弹性 e=0（粘合）' }
                        ],
                        onChange: function (v) { st.e = String(v); st.contactDir = 0; }
                    },
                    { id: 'col_home', type: 'button', label: '复位两球位置', action: function () { st.x1 = -2.5; st.x2 = 2.5; st.contactDir = 0; } }
                ];
            },
            update: function (dt) {
                var g = geo();
                if (!st.drag) {
                    st.x1 += st.v1 * dt; st.x2 += st.v2 * dt;
                    if (st.x1 < -g.halfM) st.x1 = g.halfM; else if (st.x1 > g.halfM) st.x1 = -g.halfM;
                    if (st.x2 < -g.halfM) st.x2 = g.halfM; else if (st.x2 > g.halfM) st.x2 = -g.halfM;
                }
                var sr = sumR(), gap = st.x2 - st.x1;
                if (st.contactDir !== 0) {
                    if (parseFloat(st.e) !== 0) { st.contactDir = 0; }
                    else {
                        st.x2 = st.x1 + sr * st.contactDir;
                        if (st.v1 !== st.v2) { var vc = (st.m1 * st.v1 + st.m2 * st.v2) / (st.m1 + st.m2); st.v1 = vc; st.v2 = vc; }
                    }
                }
                if (st.contactDir === 0 && Math.abs(gap) <= sr) {
                    var approach = (gap > 0 && st.v1 > st.v2) || (gap < 0 && st.v2 > st.v1);
                    if (approach) doCollide();
                    var pen = sr - Math.abs(gap);
                    if (pen > 0 && st.contactDir === 0) {
                        var tot = st.m1 + st.m2;
                        if (gap > 0) { st.x1 -= pen * st.m2 / tot; st.x2 += pen * st.m1 / tot; }
                        else { st.x1 += pen * st.m2 / tot; st.x2 -= pen * st.m1 / tot; }
                    }
                }
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS, g = geo();
                KT().background(ctx, W, H);
                pline(ctx, [[0, g.gy], [W, g.gy]], { color: C.dark, width: 3 });
                var i;
                for (i = -8; i <= 8; i++) {
                    var xp = W / 2 + i * g.ppm;
                    dst(ctx, xp, g.gy, xp, g.gy + (i % 2 === 0 ? 13 : 7), C.gray, 1);
                    if (i % 2 === 0) txt(ctx, i + ' m', xp, g.gy + 28, { size: 11, align: 'center', color: C.gray });
                }
                var r1 = Math.sqrt(st.m1) * 0.26 * g.ppm, r2 = Math.sqrt(st.m2) * 0.26 * g.ppm;
                var bx1 = W / 2 + st.x1 * g.ppm, bx2 = W / 2 + st.x2 * g.ppm;
                var by = g.gy - Math.max(r1, r2);
                if (st.contactDir !== 0) pline(ctx, [[bx1, by], [bx2, by]], { color: C.purple, width: 5 });
                disk(ctx, bx1, by, r1, C.red, '#993333', 2);
                disk(ctx, bx2, by, r2, C.blue, '#336699', 2);
                txt(ctx, 'A', bx1, by + 5, { size: 15, align: 'center', color: C.white, weight: 'bold' });
                txt(ctx, 'B', bx2, by + 5, { size: 15, align: 'center', color: C.white, weight: 'bold' });
                hintDrag(ctx, '👆 拖动球A', bx1, by - r1 - 24);
                hintDrag(ctx, '👆 拖动球B', bx2, by - r2 - 24);
                if (Math.abs(st.v1) > 0.03) arw(ctx, bx1, by - r1 - 10, bx1 + st.v1 * 0.45 * g.ppm, by - r1 - 10, C.red, 3);
                if (Math.abs(st.v2) > 0.03) arw(ctx, bx2, by - r2 - 10, bx2 + st.v2 * 0.45 * g.ppm, by - r2 - 10, C.blue, 3);
                pn(ctx, 16, 14, 250, 64, { radius: 8, fill: 'rgba(255,255,255,0.92)', stroke: C.gray });
                txt(ctx, '动能损失（相对初始总动能）', 28, 32, { size: 12, weight: 'bold' });
                var fr = st.E0 > 0.0001 ? KT().clamp(st.lostJ / st.E0, 0, 1) : 0;
                pn(ctx, 28, 42, 190, 16, { radius: 8, fill: '#ececec', stroke: C.gray, lineWidth: 1 });
                if (fr > 0) pn(ctx, 28, 42, Math.max(190 * fr, 10), 16, { radius: 8, fill: C.red });
                txt(ctx, nf(st.lostJ, 1) + ' J', 256, 55, { size: 12, align: 'right', color: C.red, weight: 'bold' });
                flushRows(st, [
                    row('总动量 p总', nf(st.m1 * st.v1 + st.m2 * st.v2, 2), 'kg·m/s', C.purple),
                    row('球A动量 mv', nf(st.m1 * st.v1, 2), 'kg·m/s', C.red),
                    row('球B动量 mv', nf(st.m2 * st.v2, 2), 'kg·m/s', C.blue),
                    row('总动能 Ek', nf(0.5 * st.m1 * st.v1 * st.v1 + 0.5 * st.m2 * st.v2 * st.v2, 1), 'J', C.green)
                ]);
            },
            reset: function () {
                st.m1 = 1; st.m2 = 1; st.v1 = 2; st.v2 = -2; st.e = '1';
                st.x1 = -2.5; st.x2 = 2.5; st.contactDir = 0; st.drag = ''; recalcE0();
            },
            hitTest: function (x, y) {
                var g = geo(), by = g.gy - Math.max(Math.sqrt(st.m1), Math.sqrt(st.m2)) * 0.26 * g.ppm;
                var b1x = st.W / 2 + st.x1 * g.ppm, b2x = st.W / 2 + st.x2 * g.ppm;
                var rr1 = Math.sqrt(st.m1) * 0.26 * g.ppm + 14, rr2 = Math.sqrt(st.m2) * 0.26 * g.ppm + 14;
                return (x - b1x) * (x - b1x) + (y - by) * (y - by) < rr1 * rr1 ||
                    (x - b2x) * (x - b2x) + (y - by) * (y - by) < rr2 * rr2;
            },
            onPointerDown: function (x, y) {
                var g = geo(), by = g.gy - Math.max(Math.sqrt(st.m1), Math.sqrt(st.m2)) * 0.26 * g.ppm;
                var b1x = st.W / 2 + st.x1 * g.ppm, b2x = st.W / 2 + st.x2 * g.ppm;
                var rr1 = Math.sqrt(st.m1) * 0.26 * g.ppm + 14, rr2 = Math.sqrt(st.m2) * 0.26 * g.ppm + 14;
                if ((x - b1x) * (x - b1x) + (y - by) * (y - by) < rr1 * rr1) st.drag = 'A';
                else if ((x - b2x) * (x - b2x) + (y - by) * (y - by) < rr2 * rr2) st.drag = 'B';
            },
            onPointerMove: function (x, y) {
                if (!st.drag) return;
                var g = geo();
                var xm = KT().clamp((x - st.W / 2) / g.ppm, -g.halfM, g.halfM);
                if (st.drag === 'A') st.x1 = xm; else st.x2 = xm;
            },
            onPointerUp: function () { st.drag = ''; }
        };
    }

    /* ============================================================
       Mode 2  skate —— 能量滑板公园 (energy-skate-park / basics)
       ============================================================ */
    function buildSkate(basic) {
        var st = {
            W: 800, H: 600, m: 70, mu: 0, fx: false,
            x: -3.4, vs: 0, heat: 0, Eref: 0, drag: false, trail: []
        };
        var A = 0.18, HALF = 6.4;
        function yAt(xw) { return A * xw * xw; }
        function slopeAt(xw) { return 2 * A * xw; }
        function geo() {
            var s = Math.min(st.W / 15, st.H / 11);
            return { s: s, ox: st.W * 0.42, oy: st.H * 0.87 };
        }
        function PX(wx) { var g = geo(); return g.ox + wx * g.s; }
        function PY(wy) { var g = geo(); return g.oy - wy * g.s; }
        function recalcRef() { st.Eref = 0.5 * st.m * st.vs * st.vs + st.m * G * yAt(st.x); st.heat = 0; }
        recalcRef();

        function physics(h) {
            var yp = slopeAt(st.x), den = Math.sqrt(1 + yp * yp);
            var sinT = yp / den, cosT = 1 / den;
            var aT = -G * sinT;
            if (st.mu > 0 && Math.abs(st.vs) > 0.02) aT -= st.mu * G * cosT * (st.vs > 0 ? 1 : -1);
            st.vs += aT * h;
            st.x += cosT * st.vs * h;
            if (Math.abs(st.vs) > 0.02) st.heat += st.mu * G * cosT * Math.abs(st.vs) * h * st.m;
            if (st.x > HALF) { st.x = HALF; st.vs = -Math.abs(st.vs) * 0.5; }
            if (st.x < -HALF) { st.x = -HALF; st.vs = Math.abs(st.vs) * 0.5; }
            if (Math.abs(st.vs) < 0.06 && Math.abs(sinT) <= st.mu * cosT + 1e-4) st.vs = 0;
        }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>滑板者在光滑碗形赛道上滑行时，<strong>机械能守恒</strong>；存在摩擦时机械能逐渐转化为<strong>热能</strong>。</p>' +
                    '<div class="formula">Ek = ½mv²　Ep = mgh　Ef = μmg·s（摩擦生热）</div>' +
                    '<ul style="padding-left:20px"><li>下滑：势能 → 动能，速度越来越快</li>' +
                    '<li>上冲：动能 → 势能，速度减慢直至最高点</li>' +
                    '<li>摩擦系数越大，滑得越"累"，红色热能柱越高</li></ul>' +
                    '<p style="color:#888">提示：暂停后可直接拖动小人到轨道任意位置释放。</p>'
                );
                L.setPresets([
                    { name: '半坡出发', apply: function () { st.x = -3.4; st.vs = 0; recalcRef(); } },
                    { name: '碗顶挑战', apply: function () { st.x = -6.1; st.vs = 0; recalcRef(); } },
                    { name: '低速巡航', apply: function () { st.x = -4.8; st.vs = 2.2; recalcRef(); } }
                ]);
            },
            getControls: function () {
                var cs = [{
                    id: 'sk_m', type: 'slider', label: '质量', min: 50, max: 100, step: 1, unit: ' kg',
                    value: st.m, onChange: function (v) { st.m = v; recalcRef(); }
                }];
                if (!basic) cs.push({
                    id: 'sk_mu', type: 'slider', label: '摩擦系数 μ', min: 0, max: 0.3, step: 0.01, unit: '',
                    value: st.mu, onChange: function (v) { st.mu = v; recalcRef(); }
                }); else st.mu = 0;
                cs.push({
                    id: 'sk_fx', type: 'checkbox', label: '显示力矢量', value: st.fx,
                    onChange: function (v) { st.fx = !!v; }
                });
                return cs;
            },
            update: function (dt) {
                if (st.drag) return;
                var n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n, i;
                n = Math.min(n, 200); h = dt / n;
                for (i = 0; i < n; i++) physics(h);
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS;
                KT().background(ctx, W, H);
                var pts = [], i, n = 110;
                for (i = 0; i <= n; i++) {
                    var wx = -HALF + 2 * HALF * i / n;
                    pts.push([PX(wx), PY(yAt(wx))]);
                }
                pline(ctx, pts, { color: C.dark, width: 5 });
                pline(ctx, [[pts[0][0], st.H * 0.97], [pts[n][0], st.H * 0.97]], { color: C.ground, width: 6 });
                var qx = PX(st.x), qy = PY(yAt(st.x));
                dst(ctx, qx, qy, qx, PY(0), C.gray, 1.5);
                txt(ctx, nf(yAt(st.x), 2) + ' m', qx + 6, (qy + PY(0)) / 2, { size: 11, color: C.gray });
                var yp = slopeAt(st.x), den = Math.sqrt(1 + yp * yp), cosT = 1 / den, sinT = yp / den;
                if (st.fx) {
                    var N = st.m * G * cosT, Mg = st.m * G;
                    var fric = (Math.abs(st.vs) > 0.02 && st.mu > 0) ? -st.mu * N * (st.vs > 0 ? 1 : -1) : 0;
                    var tang = { x: cosT, y: sinT }, nrml = { x: -sinT, y: cosT };
                    forceFan(ctx, qx, qy, geo().s * 0.0022, [
                        { fx: 0, fy: -Mg, color: C.dark, label: '重力 ' + nf(Mg, 0) + ' N', w: 4 },
                        { fx: nrml.x * N, fy: nrml.y * N, color: C.teal, label: '支持力 ' + nf(N, 0) + ' N', w: 4 },
                        { fx: tang.x * fric, fy: tang.y * fric, color: C.red, label: '摩擦', w: 3 }
                    ]);
                }
                disk(ctx, qx, qy, 13 + st.m * 0.04, C.orange, '#a35b00', 2);
                ctx.save();
                ctx.strokeStyle = C.white; ctx.lineWidth = 2.4;
                ctx.beginPath(); ctx.moveTo(qx - 9, qy + 1); ctx.lineTo(qx + 9, qy + 1); ctx.stroke();
                ctx.beginPath(); ctx.arc(qx, qy - 9, 4.5, 0, 6.2832); ctx.stroke();
                hintDrag(ctx, '👆 拖动滑板者', qx, qy - 40);
                ctx.restore();
                var ke = 0.5 * st.m * st.vs * st.vs, pe = st.m * G * yAt(st.x), tot = ke + pe + st.heat;
                var vmax = Math.max(st.Eref, tot, 100);
                stackBar(ctx, W - 96, H * 0.30, 34, H * 0.44, [
                    [C.green, ke, '动能'],
                    [C.blue, pe, '势能'],
                    [C.red, st.heat, '热能']
                ], vmax, '能量柱状图');
                gauge(ctx, W - 180, H * 0.36, 34, Math.abs(st.vs), 13, 'm/s', '速率表', C.orange);
                flushRows(st, [
                    row('动能 Ek', nf(ke, 0), 'J', C.green),
                    row('重力势能 Ep', nf(pe, 0), 'J', C.blue),
                    row('摩擦生热 Ef', nf(st.heat, 0), 'J', C.red),
                    row('总能量 Ek+Ep+Ef', nf(tot, 0), 'J', C.purple)
                ]);
            },
            reset: function () {
                st.m = 70; st.mu = basic ? 0 : 0; st.fx = false;
                st.x = -3.4; st.vs = 0; st.heat = 0; st.drag = false; recalcRef();
            },
            hitTest: function (x, y) {
                var bd = 1e9;
                for (var i = 0; i <= 110; i++) {
                    var wx = -HALF + 2 * HALF * i / 110;
                    var d = (x - PX(wx)) * (x - PX(wx)) + (y - PY(yAt(wx))) * (y - PY(yAt(wx)));
                    if (d < bd) bd = d;
                }
                return bd < 34 * 34;
            },
            onPointerDown: function (x, y) {
                var g = geo(), best = -1, bd = 1e9;
                for (var i = 0; i <= 110; i++) {
                    var wx = -HALF + 2 * HALF * i / 110;
                    var d = (x - PX(wx)) * (x - PX(wx)) + (y - PY(yAt(wx))) * (y - PY(yAt(wx)));
                    if (d < bd) { bd = d; best = wx; }
                }
                if (bd < 34 * 34) { st.drag = true; st.x = best; st.vs = 0; recalcRef(); }
            },
            onPointerMove: function (x, y) {
                if (!st.drag) return;
                var best = st.x, bd = 1e9;
                for (var i = 0; i <= 110; i++) {
                    var wx = -HALF + 2 * HALF * i / 110;
                    var d = (x - PX(wx)) * (x - PX(wx)) + (y - PY(yAt(wx))) * (y - PY(yAt(wx)));
                    if (d < bd) { bd = d; best = wx; }
                }
                st.x = KT().clamp(best, -HALF, HALF); st.vs = 0;
            },
            onPointerUp: function () { if (st.drag) { st.drag = false; recalcRef(); } }
        };
    }

    /* ============================================================
       Mode 3  springs —— 质量与弹簧 (masses-springs / basics)
       ============================================================ */
    function buildSprings(basic) {
        var st = {
            W: 800, H: 600, k: basic ? 20 : 80, on: [true, true, false],
            m: 0.2, cSel: '0', mult: '1',
            u: 0, v: 0, simT: 0, crossTimes: [], Tmeas: 0, prevSide: 1,
            dragPool: 0, dragGhost: null, dragBob: false
        };
        st.u = st.m * G / (Math.max(1, activeCount()) * st.k);
        function activeCount() { return basic ? 1 : Math.max(1, (st.on[0] ? 1 : 0) + (st.on[1] ? 1 : 0) + (st.on[2] ? 1 : 0)); }
        function kt() { return activeCount() * st.k; }
        function ueq() { return st.m * G / kt(); }
        function gramColor(g) { return g <= 50 ? '#7fb3d5' : g <= 100 ? '#58d68d' : g <= 200 ? '#f5b041' : '#ec7063'; }
        function snapEq() { st.u = ueq(); st.v = 0; }
        snapEq();

        function geo() {
            var cx = st.W * 0.55, beamY = st.H * 0.10, visM = st.H * 0.30;
            return { cx: cx, beamY: beamY, L0: st.H * 0.10, visM: visM, bobR: 10 + Math.sqrt(st.m * 1000) * 2.2 };
        }
        function bobY() { var g = geo(); return g.beamY + g.L0 + st.u * g.visM; }
        function hookPt() { var g = geo(); return [g.cx, g.beamY + g.L0]; }

        function step(h) {
            var m = st.m, kk = kt(), cc = parseFloat(st.cSel);
            if (st.dragBob) return;
            var a = (m * G - kk * st.u - cc * st.v) / m;
            st.v += a * h; st.u += st.v * h;
            if (st.u < -0.05) { st.u = -0.05; st.v = 0; }
            var side = st.u - ueq() >= 0 ? 1 : -1;
            if (st.prevSide < 0 && side > 0) {
                st.crossTimes.push(st.simT);
                if (st.crossTimes.length > 8) st.crossTimes.shift();
                if (st.crossTimes.length >= 2) st.Tmeas = st.crossTimes[st.crossTimes.length - 1] - st.crossTimes[st.crossTimes.length - 2];
            }
            st.prevSide = side;
        }
        var GRAMS = [50, 100, 200, 500];
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>竖直悬挂的弹簧振子做<strong>简谐运动</strong>（或阻尼振动）。弹簧根数并联时等效劲度相加：</p>' +
                    '<div class="formula">k总 = k₁+k₂+k₃　　x″ = (mg − k总·x − cv) / m</div>' +
                    '<div class="formula">理论周期　T = 2π√(m / k总)</div>' +
                    '<ul style="padding-left:20px"><li>阻尼越大，振幅衰减越快，但周期几乎不变</li>' +
                    '<li>点击「标记过零点」附近经过平衡位置时会自动计时，对比实测与理论周期</li>' +
                    '<li>时间倍率可放慢动作观察相位变化</li></ul>'
                );
                L.setPresets([
                    { name: '标准振荡', apply: function () { st.cSel = '0'; st.mult = '1'; snapEq(); st.v = 0.6; } },
                    { name: '液体阻尼', apply: function () { st.cSel = '0.4'; snapEq(); } }
                ]);
            },
            getControls: function () {
                var cs = [];
                if (basic) {
                    cs.push({
                        id: 'sp_mb', type: 'select', label: '砝码质量', value: String(Math.round(st.m * 1000)),
                        options: [
                            { value: '50', label: '50 g' }, { value: '100', label: '100 g' },
                            { value: '200', label: '200 g' }, { value: '500', label: '500 g' }
                        ],
                        onChange: function (v) { st.m = parseFloat(v) / 1000; snapEq(); st.Tmeas = 0; st.crossTimes = []; }
                    });
                } else {
                    cs.push({
                        id: 'sp_k', type: 'slider', label: '劲度 k（单根）', min: 40, max: 200, step: 5, unit: ' N/m',
                        value: st.k, onChange: function (v) { st.k = v; snapEq(); st.Tmeas = 0; st.crossTimes = []; }
                    });
                    for (var i = 0; i < 3; i++) (function (idx) {
                        cs.push({
                            id: 'sp_on' + (idx + 1), type: 'checkbox', label: '启用弹簧 ' + (idx + 1),
                            value: st.on[idx],
                            onChange: function (v) { st.on[idx] = !!v; snapEq(); st.Tmeas = 0; st.crossTimes = []; }
                        });
                    })(i);
                    cs.push({
                        id: 'sp_draghint', type: 'button', label: '从左侧砝码池拖拽挂载砝码',
                        action: function () { if (st.L && st.L.showToast) st.L.showToast('暂停状态下按住左侧砝码拖到挂钩处即可更换'); }
                    });
                }
                cs.push({
                    id: 'sp_damp', type: 'select', label: '阻尼', value: st.cSel,
                    options: [
                        { value: '0', label: '无阻尼' },
                        { value: '0.05', label: '空气阻尼 (c=0.05)' },
                        { value: '0.4', label: '液体阻尼 (c=0.4)' }
                    ],
                    onChange: function (v) { st.cSel = String(v); }
                });
                cs.push({
                    id: 'sp_mult', type: 'select', label: '时间倍率', value: st.mult,
                    options: [
                        { value: '1', label: '1× 正常' },
                        { value: '0.2', label: '0.2× 慢放' },
                        { value: '0.05', label: '0.05× 极慢' }
                    ],
                    onChange: function (v) { st.mult = String(v); }
                });
                cs.push({
                    id: 'sp_mark', type: 'button', label: '标记过零点',
                    action: function () {
                        st.crossTimes.push(st.simT);
                        if (st.crossTimes.length > 2) st.crossTimes.shift();
                        if (st.crossTimes.length === 2) st.Tmeas = st.crossTimes[1] - st.crossTimes[0];
                        if (st.L && st.L.showToast) st.L.showToast('已标记过零点（第 ' + st.crossTimes.length + '/2 次）');
                    }
                });
                return cs;
            },
            update: function (dt) {
                var dts = dt * parseFloat(st.mult);
                var n = Math.min(220, Math.max(1, Math.ceil(dts / 0.002))), h = dts / n, i;
                for (i = 0; i < n; i++) { step(h); }
                st.simT += dts;
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS, g = geo(), na = activeCount(), hp = hookPt();
                KT().background(ctx, W, H);
                pline(ctx, [[g.cx - 170, g.beamY], [g.cx + 170, g.beamY]], { color: C.dark, width: 7 });
                for (var hv = -160; hv <= 160; hv += 20) pline(ctx, [[g.cx + hv, g.beamY], [g.cx + hv - 8, g.beamY - 9]], { color: C.gray, width: 1 });
                var spread = 26, i, off;
                for (i = 0; i < na; i++) {
                    off = (i - (na - 1) / 2) * spread;
                    var topY = g.beamY, botY = bobY() - 16, coils = 9;
                    var zx = g.cx + off, pts = [];
                    pts.push([zx, topY]);
                    for (var sgm = 1; sgm < coils * 2; sgm++) {
                        var yy = topY + (botY - topY) * sgm / (coils * 2);
                        var xx = zx + (sgm % 2 === 0 ? -spread * 0.62 : spread * 0.62) * (na > 1 ? 0.72 : 1.05);
                        pts.push([xx, yy]);
                    }
                    pts.push([zx, botY]);
                    pline(ctx, pts, { color: C.purple, width: 3 });
                }
                if (na > 1) pline(ctx, [[g.cx - (na - 1) / 2 * spread, bobY() - 16], [g.cx + (na - 1) / 2 * spread, bobY() - 16]], { color: C.purple, width: 4 });
                pline(ctx, [[g.cx, bobY() - 16], [g.cx, bobY()]], { color: C.dark, width: 3 });
                var dEq = bobY() - (g.beamY + g.L0 + ueq() * g.visM);
                dst(ctx, g.cx - 90, g.beamY + g.L0 + ueq() * g.visM, g.cx + 90, g.beamY + g.L0 + ueq() * g.visM, C.gray, 1.4);
                txt(ctx, '平衡位置', g.cx + 96, g.beamY + g.L0 + ueq() * g.visM + 4, { size: 11, color: C.gray });
                var bcol = gramColor(Math.round(st.m * 1000));
                disk(ctx, g.cx, bobY(), g.bobR, bcol, 'rgba(0,0,0,0.35)', 2);
                txt(ctx, Math.round(st.m * 1000) + 'g', g.cx, bobY() + 4, { size: Math.min(14, g.bobR), align: 'center', color: '#222', weight: 'bold' });
                pn(ctx, g.cx - 74, bobY() - g.bobR - 30, 148, 22, { radius: 6, fill: 'rgba(255,255,255,0.85)', stroke: C.gray, lineWidth: 1 });
                txt(ctx, '位移 d=' + nf((st.u - ueq()) * 100, 1) + ' cm', g.cx, bobY() - g.bobR - 14, { size: 12, align: 'center' });
                hintDrag(ctx, '👆 拖动振子', g.cx, bobY() - g.bobR - 46);
                if (!basic) {
                    var shX = st.W * 0.115, shY = st.H * 0.30;
                    pline(ctx, [[shX - 54, shY], [shX + 54, shY]], { color: C.dark, width: 6 });
                    txt(ctx, '砝码池', shX, shY - 10, { size: 12, align: 'center', weight: 'bold' });
                    hintDrag(ctx, '👆 拖动砝码', shX, shY - 34);
                    var taken = st.dragGhost ? st.dragGhost.g : 0;
                    for (i = 0; i < GRAMS.length; i++) {
                        var gg = GRAMS[i];
                        if (gg === taken) continue;
                        var dxp = shX - 39 + (i % 2) * 78, dyp = shY + 34 + Math.floor(i / 2) * 62;
                        disk(ctx, dxp, dyp, 10 + Math.sqrt(gg) * 0.9, gramColor(gg), 'rgba(0,0,0,0.3)', 2);
                        txt(ctx, gg + 'g', dxp, dyp + 4, { size: 11, align: 'center' });
                    }
                    if (st.dragGhost) {
                        disk(ctx, st.dragGhost.x, st.dragGhost.y, 10 + Math.sqrt(st.dragGhost.g) * 0.9, gramColor(st.dragGhost.g), 'rgba(0,0,0,0.3)', 2, 0.85);
                        dst(ctx, st.dragGhost.x, st.dragGhost.y, hp[0], hp[1], C.gray, 1.4);
                    }
                }
                gaugePeriod(ctx, W - 150, H * 0.30, kt());
                function gaugePeriod(c2, gx, gy, kTot) {
                    var Ttheo = 2 * Math.PI * Math.sqrt(st.m / kTot);
                    pn(c2, gx - 108, gy - 30, 216, 104, { radius: 10, fill: 'rgba(255,255,255,0.9)', stroke: C.gray });
                    txt(c2, '周期对比', gx, gy - 10, { size: 13, align: 'center', weight: 'bold' });
                    txt(c2, '理论 T = ' + nf(Ttheo, 3) + ' s', gx, gy + 18, { size: 13, align: 'center', color: C.blue });
                    txt(c2, '实测 T = ' + (st.Tmeas > 0 ? nf(st.Tmeas, 3) + ' s' : '——'), gx, gy + 46, { size: 13, align: 'center', color: C.red });
                    txt(c2, '模拟时间 t=' + nf(st.simT, 1) + ' s', gx, gy + 66, { size: 11, align: 'center', color: C.gray });
                }
                flushRows(st, [
                    row('位移（平衡点起）', nf((st.u - ueq()) * 100, 1), 'cm', C.purple),
                    row('速度', nf(st.v, 2), 'm/s', C.dark),
                    row('理论周期 2π√(m/k)', nf(2 * Math.PI * Math.sqrt(st.m / kt()), 3), 's', C.blue),
                    row('实测周期', st.Tmeas > 0 ? nf(st.Tmeas, 3) : '——', 's', C.red)
                ]);
            },
            reset: function () {
                st.k = basic ? 20 : 80; st.on = [true, true, false]; st.m = 0.2;
                st.cSel = '0'; st.mult = '1'; st.dragPool = 0; st.dragGhost = null; st.dragBob = false;
                st.simT = 0; st.crossTimes = []; st.Tmeas = 0; st.prevSide = 1;
                st.u = st.m * G / kt(); st.v = 0;
            },
            hitTest: function (x, y) {
                if (!basic) {
                    var shX = st.W * 0.115, shY = st.H * 0.30, i;
                    for (i = 0; i < GRAMS.length; i++) {
                        var gg = GRAMS[i];
                        var dxp = shX - 39 + (i % 2) * 78, dyp = shY + 34 + Math.floor(i / 2) * 62;
                        var rr = 12 + Math.sqrt(gg) * 0.9;
                        if ((x - dxp) * (x - dxp) + (y - dyp) * (y - dyp) < rr * rr) return true;
                    }
                }
                var bxp = st.W * 0.55, byp = bobY(), br = geo().bobR + 10;
                return (x - bxp) * (x - bxp) + (y - byp) * (y - byp) < br * br;
            },
            onPointerDown: function (x, y) {
                if (!basic) {
                    var shX = st.W * 0.115, shY = st.H * 0.30, i;
                    for (i = 0; i < GRAMS.length; i++) {
                        var gg = GRAMS[i];
                        var dxp = shX - 39 + (i % 2) * 78, dyp = shY + 34 + Math.floor(i / 2) * 62;
                        var rr = 12 + Math.sqrt(gg) * 0.9;
                        if ((x - dxp) * (x - dxp) + (y - dyp) * (y - dyp) < rr * rr) {
                            st.dragPool = gg; st.dragGhost = { g: gg, x: x, y: y }; return;
                        }
                    }
                }
                var bxp = st.W * 0.55, byp = bobY(), br = geo().bobR + 10;
                if ((x - bxp) * (x - bxp) + (y - byp) * (y - byp) < br * br) st.dragBob = true;
            },
            onPointerMove: function (x, y) {
                if (st.dragGhost) { st.dragGhost.x = x; st.dragGhost.y = y; return; }
                if (st.dragBob) {
                    var g = geo();
                    st.u = KT().clamp((y - g.beamY - g.L0) / g.visM, 0, 2.2); st.v = 0;
                }
            },
            onPointerUp: function (x, y) {
                if (st.dragGhost) {
                    var hp = hookPt();
                    if ((x - hp[0]) * (x - hp[0]) + (y - hp[1]) * (y - hp[1]) < 70 * 70) {
                        st.m = st.dragPool / 1000; snapEq(); st.Tmeas = 0; st.crossTimes = [];
                    }
                    st.dragGhost = null; st.dragPool = 0;
                }
                st.dragBob = false;
            }
        };
    }

    /* ============================================================
       Mode 4  hooke —— 胡克定律 (hookes-law)
       ============================================================ */
    function buildHooke() {
        var st = { W: 800, H: 600, m: 150, k: 60, x: 0, v: 0, fx: true, drag: false };
        st.x = st.m / 1000 * G / st.k;
        function eq() { return st.m / 1000 * G / st.k; }
        function geo() {
            var cx = st.W * 0.5, topY = st.H * 0.09, pNM = st.H * 0.52;
            return { cx: cx, topY: topY, pNM: pNM, L0px: st.H * 0.16, blockW: 76, blockH: 34 };
        }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>在弹性限度内，弹簧的弹力与形变量成正比：</p><div class="formula">F = k · Δx</div>' +
                    '<ul style="padding-left:20px"><li>k 为劲度系数（N/m），描述弹簧"软硬"</li>' +
                    '<li>悬挂重物静止时：F弹 = mg，此时箭头等长对顶</li>' +
                    '<li>Δx 为相对原长的伸长量，读尺可得</li></ul>' +
                    '<p style="color:#888">试着增大质量或减小 k，观察伸长量如何变化。</p>'
                );
                L.setPresets([
                    { name: '轻物软簧', apply: function () { st.m = 60; st.k = 30; snapSet(); } },
                    { name: '重物硬簧', apply: function () { st.m = 280; st.k = 110; snapSet(); } }
                ]);
                function snapSet() { st.x = eq(); st.v = 0; }
            },
            getControls: function () {
                return [
                    { id: 'hk_m', type: 'slider', label: '质量', min: 50, max: 300, step: 5, unit: ' g', value: st.m, onChange: function (v) { st.m = v; st.x = eq(); st.v = 0; } },
                    { id: 'hk_k', type: 'slider', label: '劲度系数', min: 20, max: 120, step: 1, unit: ' N/m', value: st.k, onChange: function (v) { st.k = v; st.x = eq(); st.v = 0; } },
                    { id: 'hk_f', type: 'checkbox', label: '显示力矢量（mg 与 F=kx 对顶）', value: st.fx, onChange: function (v) { st.fx = !!v; } }
                ];
            },
            update: function (dt) {
                if (st.drag) return;
                var mm = st.m / 1000, cd = 1.8 * Math.sqrt(st.k * mm);
                var n = Math.min(260, Math.max(1, Math.ceil(dt / 0.002))), h = dt / n, i;
                for (i = 0; i < n; i++) {
                    var a = (mm * G - st.k * st.x - cd * st.v) / mm;
                    st.v += a * h; st.x += st.v * h;
                    if (st.x < -0.02) { st.x = -0.02; st.v = 0; }
                }
                if (Math.abs(st.v) < 1e-4 && Math.abs(mm * G - st.k * st.x) < 0.02) { st.v = 0; st.x = eq(); }
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS, g = geo();
                KT().background(ctx, W, H);
                pline(ctx, [[g.cx - 120, g.topY], [g.cx + 120, g.topY]], { color: C.dark, width: 7 });
                var freelenY = g.topY + g.L0px, curY = g.topY + g.L0px + st.x * g.pNM;
                var i;
                for (i = 0; i <= 120; i += 10) {
                    var yy = g.topY + i / 100 * g.pNM;
                    dst(ctx, g.cx - 118, yy, g.cx - 106, yy, C.gray, i % 50 === 0 ? 2 : 1);
                    if (i % 50 === 0) txt(ctx, i + ' cm', g.cx - 124, yy + 4, { size: 10, align: 'right', color: C.gray });
                }
                dst(ctx, g.cx - 100, freelenY, g.cx + 100, freelenY, C.gray, 1.5);
                txt(ctx, '自由长度（原长）', g.cx + 104, freelenY + 4, { size: 11, color: C.gray });
                var pts = [[g.cx, g.topY]], coils = 9;
                for (var sgm = 1; sgm < coils * 2; sgm++) {
                    var tY = g.topY + (curY - g.topY) * sgm / (coils * 2);
                    var tX = g.cx + (sgm % 2 === 0 ? -26 : 26);
                    pts.push([tX, tY]);
                }
                pts.push([g.cx, curY]);
                pline(ctx, pts, { color: C.purple, width: 3.4 });
                pn(ctx, g.cx - g.blockW / 2, curY, g.blockW, g.blockH, { radius: 6, fill: '#95a5a6', stroke: '#6d8087', lineWidth: 2 });
                txt(ctx, Math.round(st.m) + ' g', g.cx, curY + g.blockH / 2 + 5, { size: 13, align: 'center', color: '#222', weight: 'bold' });
                hintDrag(ctx, '👆 拖动重物', g.cx, curY - 26);
                dst(ctx, g.cx - g.blockW / 2 - 30, freelenY, g.cx + g.blockW / 2 + 30, curY, C.red, 1.4);
                var dxPix = curY - freelenY;
                pn(ctx, g.cx + g.blockW / 2 + 14, (freelenY + curY) / 2 - 12, 96, 24, { radius: 6, fill: 'rgba(255,235,235,0.95)', stroke: C.red, lineWidth: 1 });
                txt(ctx, 'Δx = ' + nf(st.x * 100, 1) + ' cm', g.cx + g.blockW / 2 + 62, (freelenY + curY) / 2 + 5, { size: 12, align: 'center', color: C.red, weight: 'bold' });
                if (st.fx) {
                    var mm2 = st.m / 1000, mg = mm2 * G, fk = st.k * Math.abs(st.x);
                    var pxN = 44;
                    forceFan(ctx, g.cx, curY + g.blockH / 2, pxN, [
                        { fx: 0, fy: -fk, color: C.orange, label: 'F=kx ' + nf(fk, 2) + ' N' },
                        { fx: 0, fy: -mg, color: C.blue, label: 'G=mg ' + nf(mg, 2) + ' N' }
                    ]);
                    ctx.save(); ctx.globalAlpha = 0.85;
                    pn(ctx, 18, st.H - 64, 210, 48, { radius: 8, fill: 'rgba(255,255,255,0.92)', stroke: C.gray });
                    txt(ctx, '平衡条件：F弹 = mg', 28, st.H - 44, { size: 13, weight: 'bold' });
                    txt(ctx, 'k = ' + st.k + ' N/m，m = ' + Math.round(st.m) + ' g', 28, st.H - 24, { size: 12, color: C.gray });
                    ctx.restore();
                }
                flushRows(st, [
                    row('弹力 F=kΔx', nf(st.k * Math.abs(st.x), 2), 'N', C.orange),
                    row('伸长量 Δx', nf(st.x * 100, 1), 'cm', C.red),
                    row('劲度系数 k', nf(st.k, 0), 'N/m', C.purple)
                ]);
            },
            reset: function () { st.m = 150; st.k = 60; st.fx = true; st.drag = false; st.x = eq(); st.v = 0; },
            hitTest: function (x, y) {
                var g = geo(), curY = g.topY + g.L0px + st.x * g.pNM;
                return Math.abs(x - g.cx) < g.blockW / 2 + 18 && Math.abs(y - (curY + g.blockH / 2)) < g.blockH / 2 + 18;
            },
            onPointerDown: function (x, y) {
                var g = geo(), curY = g.topY + g.L0px + st.x * g.pNM;
                if (Math.abs(x - g.cx) < g.blockW / 2 + 18 && Math.abs(y - (curY + g.blockH / 2)) < g.blockH / 2 + 18) st.drag = true;
            },
            onPointerMove: function (x, y) {
                if (!st.drag) return;
                var g = geo();
                st.x = KT().clamp((y - g.topY - g.L0px) / g.pNM, 0, 1.05); st.v = 0;
            },
            onPointerUp: function () { st.drag = false; }
        };
    }

    /* ============================================================
       Mode 5  frictionbox —— 摩擦力实验 (friction)
       ============================================================ */
    function buildFrictionBox() {
        var st = { W: 800, H: 600, F: 0, m: 100, us: 0.5, net: false, v: 0, xnet: 0, wrapped: 0 };
        function uk() { return 0.7 * st.us; }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>摩擦力阻碍物体间<strong>相对滑动趋势</strong>。最大静摩擦与滑动摩擦分别为：</p>' +
                    '<div class="formula">f静 ≤ μs·mg（最大值）　　f动 = μk·mg = 0.7μs·mg</div>' +
                    '<ul style="padding-left:20px"><li>|F推| ≤ μs·mg 时箱子保持静止，静摩擦恰好抵消推力</li>' +
                    '<li>一旦推动，改受较小的动摩擦，加速度 a = (F − μk·mg·方向)/m</li>' +
                    '<li>位移循环回绕便于持续观察加速过程</li></ul>'
                );
                L.setPresets([
                    { name: '推而不动', apply: function () { st.m = 200; st.us = 0.8; st.F = 120; st.v = 0; st.xnet = 0; } },
                    { name: '滑动加速', apply: function () { st.us = 0.3; st.m = 80; st.F = 90; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'fb_F', type: 'slider', label: '水平推力 F', min: -150, max: 150, step: 5, unit: ' N', value: st.F, onChange: function (v) { st.F = v; } },
                    { id: 'fb_m', type: 'slider', label: '箱子质量', min: 50, max: 300, step: 5, unit: ' kg', value: st.m, onChange: function (v) { st.m = v; } },
                    { id: 'fb_us', type: 'slider', label: '静摩擦系数 μs', min: 0, max: 1, step: 0.05, unit: '', value: st.us, onChange: function (v) { st.us = v; } },
                    { id: 'fb_net', type: 'checkbox', label: '显示 F−f 合力箭头', value: st.net, onChange: function (v) { st.net = !!v; } }
                ];
            },
            update: function (dt) {
                var mg = st.m * G, f = 0, a = 0;
                if (Math.abs(st.v) < 0.02) {
                    if (Math.abs(st.F) <= st.us * mg) { st.v = 0; f = -st.F; a = 0; }
                    else { f = -Math.sign(st.F) * uk() * mg; a = (st.F + f) / st.m; st.v += a * dt; if (Math.abs(st.v) < 0.01) st.v = Math.sign(st.F) * 0.02; }
                } else {
                    f = -Math.sign(st.v) * uk() * mg;
                    a = (st.F + f) / st.m;
                    var nv = st.v + a * dt;
                    if (st.v !== 0 && nv * st.v < 0 && Math.abs(st.F) <= st.us * mg) { nv = 0; }
                    st.v = nv;
                }
                st.xnet += st.v * dt;
                st.a = a; st.f = f;
                var WINDOW = 12, hw = WINDOW / 2;
                st.xwrapped = ((st.xnet + hw) % WINDOW + WINDOW) % WINDOW - hw;
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS;
                KT().background(ctx, W, H);
                var gy = H * 0.74, ppm = W / 16, cx = W / 2;
                pline(ctx, [[0, gy], [W, gy]], { color: C.dark, width: 4 });
                for (var i = -8; i <= 8; i++) {
                    var xp = cx + i * ppm;
                    dst(ctx, xp, gy, xp - 10, gy + 12, C.gray, 1);
                    txt(ctx, i + 'm', xp, gy + 27, { size: 10, align: 'center', color: C.gray });
                }
                var bs = 36 + Math.cbrt(st.m) * 9;
                var bxp = cx + st.xwrapped * ppm, byp = gy - bs / 2;
                pn(ctx, bxp - bs / 2, byp - bs / 2, bs, bs, { radius: 4, fill: '#b07d4d', stroke: '#7c5433', lineWidth: 2.5 });
                ctx.save(); ctx.strokeStyle = 'rgba(90,55,20,0.55)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(bxp - bs / 2 + 5, byp - bs / 2 + 8); ctx.lineTo(bxp + bs / 2 - 5, byp - bs / 2 + 8);
                ctx.moveTo(bxp - bs / 2 + 5, byp); ctx.lineTo(bxp + bs / 2 - 5, byp); ctx.stroke();
                ctx.restore();
                txt(ctx, st.m + ' kg', bxp, byp + 5, { size: 12, align: 'center', weight: 'bold', color: '#fff' });
                var mgv = st.m * G, fnow = st.f || 0, anow = st.a || 0;
                var pxN = Math.min(1.1, (W * 0.22) / 320);
                forceFan(ctx, bxp, byp, pxN, [
                    { fx: st.F, fy: 0, color: C.orange, label: '推力 F ' + nf(st.F, 0) + ' N', w: 5 },
                    { fx: fnow, fy: 0, color: C.gray, label: '摩擦 f ' + nf(fnow, 0) + ' N', w: 4 },
                    { fx: 0, fy: mgv, color: C.teal, label: 'N=' + nf(mgv, 0) + ' N', w: 3.4 },
                    { fx: 0, fy: -mgv, color: C.dark, label: 'G=' + nf(mgv, 0) + ' N', w: 3.4 }
                ]);
                if (st.net) {
                    var netF = st.F + fnow;
                    if (Math.abs(netF) > 1) arw(ctx, bxp, byp + bs / 2 + 26, bxp + netF * pxN * 0.9, byp + bs / 2 + 26, C.red, 5);
                    txt(ctx, '合力 ' + nf(netF, 1) + ' N', bxp + netF * pxN * 0.9 + (netF >= 0 ? 6 : -6), byp + bs / 2 + 22, { size: 12, color: C.red, align: netF >= 0 ? 'left' : 'right', weight: 'bold' });
                }
                var holding = Math.abs(st.F) <= st.us * mgv && Math.abs(st.v) < 0.02;
                pn(ctx, W - 218, 14, 204, 40, { radius: 8, fill: holding ? 'rgba(88,214,141,0.15)' : 'rgba(231,76,60,0.12)', stroke: holding ? C.green : C.red });
                txt(ctx, holding ? '状态：静止（静摩擦平衡）' : '状态：滑动中（动摩擦）', W - 116, 39, { size: 12.5, align: 'center', weight: 'bold', color: holding ? C.green : C.red });
                flushRows(st, [
                    row('摩擦力 f', nf(fnow, 1), 'N', C.gray),
                    row('加速度 a', nf(anow, 2), 'm/s²', C.orange),
                    row('速度 v', nf(st.v, 2), 'm/s', C.blue),
                    row('位移（累计）', nf(st.xnet, 1), 'm', C.green)
                ]);
            },
            reset: function () { st.F = 0; st.m = 100; st.us = 0.5; st.net = false; st.v = 0; st.xnet = 0; st.a = 0; st.f = 0; }
        };
    }

    /* ============================================================
       Mode 6  pushcart —— 力与运动基础 (forces-motion-basics)
       ============================================================ */
    function buildPushCart() {
        var st = { W: 800, H: 600, F: 0, load: 2, fri: false, v: 0, x: 0, a: 0 };
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>牛顿第二定律</strong>：物体加速度与合外力成正比、与质量成反比。</p>' +
                    '<div class="formula">F合 = m·a　→　a = F合 / m</div>' +
                    '<ul style="padding-left:20px"><li>同一推力下，载货越多（m 大），a 越小，提速越慢</li>' +
                    '<li>打开「摩擦」后会叠加 20 N 恒定阻力，先要克服阻力才能前进</li>' +
                    '<li>反方向推车可以刹车甚至倒退</li></ul>'
                );
                L.setPresets([
                    { name: '满载冲刺', apply: function () { st.load = 5; st.F = 100; st.fri = false; } },
                    { name: '空载轻推', apply: function () { st.load = 0; st.F = 30; st.fri = true; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'pc_F', type: 'slider', label: '推力 F', min: -100, max: 100, step: 5, unit: ' N', value: st.F, onChange: function (v) { st.F = v; } },
                    { id: 'pc_load', type: 'slider', label: '货箱数量', min: 0, max: 5, step: 1, unit: ' 个', value: st.load, onChange: function (v) { st.load = Math.round(v); } },
                    { id: 'pc_fri', type: 'checkbox', label: '开启摩擦（附加 20 N 阻力）', value: st.fri, onChange: function (v) { st.fri = !!v; } }
                ];
            },
            update: function (dt) {
                var m = 100 + 50 * st.load, res = st.fri ? 20 : 0, a = 0;
                if (Math.abs(st.v) > 0.02) a = (st.F - Math.sign(st.v) * res) / m;
                else {
                    if (Math.abs(st.F) > res) a = (st.F - Math.sign(st.F) * res) / m;
                    else { a = 0; st.v = 0; }
                }
                st.a = a; st.v += a * dt; st.x += st.v * dt;
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS;
                KT().background(ctx, W, H);
                var gy = H * 0.72, ppm = W / 44;
                pline(ctx, [[0, gy], [W, gy]], { color: C.dark, width: 4 });
                var startIdx = Math.floor((st.x - 21) / 10) * 10;
                for (var mk = startIdx; mk <= st.x + 21; mk += 10) {
                    var fxp = W / 2 + (mk - st.x) * ppm;
                    if (fxp < 6 || fxp > W - 6) continue;
                    pline(ctx, [[fxp, gy], [fxp, gy - 40]], { color: C.green, width: 2.5 });
                    pline(ctx, [[fxp, gy - 40], [fxp + 20, gy - 33], [fxp, gy - 26]], { color: C.green, width: 2, fill: C.green });
                    txt(ctx, mk + ' m', fxp, gy + 22, { size: 10.5, align: 'center', color: C.green, weight: 'bold' });
                }
                var cartX = W / 2, cartY = gy;
                var cw = 110, ch = 40;
                pn(ctx, cartX - cw / 2, cartY - ch, cw, ch, { radius: 6, fill: C.sky, stroke: st.drag ? C.orange : C.dark, lineWidth: st.drag ? 4 : 2.5 });
                disk(ctx, cartX - cw / 2 + 20, cartY, 11, C.dark, C.gray, 2);
                disk(ctx, cartX + cw / 2 - 20, cartY, 11, C.dark, C.gray, 2);
                hintDrag(ctx, '👆 拖动小车', cartX, cartY - ch - 60);
                for (var ci = 0; ci < st.load; ci++) {
                    var lay = Math.floor(ci / 3), col = ci % 3;
                    var wig = Math.sin(st.x * 4 + ci) * 0.014 * KT().clamp(st.a / 2, -2, 2);
                    ctx.save();
                    ctx.translate(cartX - 33 + col * 34, cartY - ch - 4 - lay * 30);
                    ctx.rotate(wig);
                    pn(ctx, -15, -26, 30, 26, { radius: 3, fill: '#c9a86a', stroke: '#8a6d3b', lineWidth: 2 });
                    txt(ctx, '50', 0, -9, { size: 10, align: 'center', color: '#5b4720' });
                    ctx.restore();
                }
                var pxN = Math.min(0.55, (W * 0.17) / 130);
                forceFan(ctx, cartX - cw / 2 - 6, cartY - ch * 0.6, pxN, [
                    { fx: st.F, fy: 0, color: C.orange, label: 'F ' + nf(st.F, 0) + ' N', w: 5 },
                    st.fri ? { fx: Math.abs(st.v) > 0.02 ? -Math.sign(st.v) * 20 : 0, fy: 0, color: C.gray, label: '阻力 20 N', w: 3.4 } : null
                ]);
                gauge(ctx, W - 128, H * 0.34, 38, Math.abs(st.v), 25, 'm/s', '模拟速度', C.teal);
                pn(ctx, 16, 14, 178, 40, { radius: 8, fill: 'rgba(255,255,255,0.9)', stroke: C.gray });
                txt(ctx, '总质量 ' + (100 + 50 * st.load) + ' kg', 105, 40, { size: 13.5, align: 'center', weight: 'bold' });
                flushRows(st, [
                    row('加速度 a', nf(st.a, 2), 'm/s²', C.orange),
                    row('速度 v', nf(st.v, 2), 'm/s', C.blue),
                    row('位移 x', nf(st.x, 1), 'm', C.green)
                ]);
            },
            hitTest: function (x, y) {
                var W = st.W || 800, H = st.H || 600, gy = H * 0.72;
                return Math.abs(x - W / 2) < 70 && Math.abs(y - (gy - 20)) < 36;
            },
            onPointerDown: function (x, y) {
                var W = st.W || 800, H = st.H || 600, gy = H * 0.72;
                if (Math.abs(x - W / 2) < 70 && Math.abs(y - (gy - 20)) < 36) {
                    st.drag = true; st._lx = x; st.v = 0;
                }
            },
            onPointerMove: function (x, y) {
                if (!st.drag) return;
                var W = st.W || 800, ppm = W / 44;
                st.x += (x - st._lx) / ppm;
                st._lx = x; st.v = 0;
            },
            onPointerUp: function () { st.drag = false; },
            reset: function () { st.F = 0; st.load = 2; st.fri = false; st.v = 0; st.x = 0; st.a = 0; st.drag = false; }
        };
    }

    /* ============================================================
       Mode 7  seesaw —— 平衡行为 (balancing-act)
       ============================================================ */
    function buildSeesaw() {
        var ARMS = [1, 3, 5, 7];
        var st = { W: 800, H: 600, left: [0, 0, 0, 0], right: [0, 0, 0, 0], chal: false, btns: [] };
        function torque(sideArr, sign) {
            var t = 0;
            for (var i = 0; i < 4; i++) t += sideArr[i] * 20 * G * ARMS[i] * sign;
            return t;
        }
        function netT() { return torque(st.right, 1) + torque(st.left, -1); }
        function place(l, r) { st.left = l; st.right = r; }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>跷跷板绕支点的转动效果由<strong>力矩</strong>决定：</p>' +
                    '<div class="formula">τ = m·g·L（力臂 L 为支点到作用线的距离）</div>' +
                    '<p>左侧 τ左 = Σ mᵢgLᵢ，右侧 τ右 同理。当 <strong>τ左 = τ右</strong> 时杠杆平衡，倾角为零。</p>' +
                    '<p style="color:#2980b9">💡 因此大力臂的小重量可以平衡小力臂的大重量 —— 这就是天平的原理。</p>' +
                    '<p style="color:#888">点击每列砖块塔上方的 ＋／－ 按钮增减砖块（每块 20 kg）。</p>'
                );
                L.setPresets([
                    { name: '天然平衡', apply: function () { place([2, 0, 0, 0], [0, 0, 0, 0]); st.chal = false; setTimeoutFree(); } },
                    { name: '清空台面', apply: function () { place([0, 0, 0, 0], [0, 0, 0, 0]); st.chal = false; } }
                ]);
                function setTimeoutFree() {}
            },
            getControls: function () {
                return [
                    { id: 'ss_ch', type: 'checkbox', label: '挑战：力臂不同也能平衡（示范）', value: st.chal, onChange: function (v) { st.chal = !!v; if (v) { place([0, 0, 1, 0], [5, 0, 0, 0]); if (st.L && st.L.showToast) st.L.showToast('左侧 1 块在 5 m 处 ↔ 右侧 5 块在 1 m 处'); } } },
                    { id: 'ss_cl', type: 'button', label: '清空全部砖块', action: function () { place([0, 0, 0, 0], [0, 0, 0, 0]); } }
                ];
            },
            update: function () {},
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS;
                KT().background(ctx, W, H);
                var piv = { x: W / 2, y: H * 0.60 }, wpM = (W * 0.46) / 9, thDeg = KT().clamp(netT() * 12 / 5000, -12, 12), th = thDeg * Math.PI / 180;
                var boardHalf = 8.4 * wpM;
                pline(ctx, [[piv.x - boardHalf, piv.y + 6], [piv.x + boardHalf, piv.y + 6]], { color: C.ground, width: 5 });
                pline(ctx, [[piv.x - boardHalf, piv.y + 6], [piv.x + boardHalf, piv.y + 6]], { color: C.ground, width: 5 });
                pline(ctx, [[piv.x - boardHalf * 1.02, piv.y + 5], [piv.x + boardHalf * 1.02, piv.y + 5]], { color: '#00000022', width: 14 });
                pline(ctx, [[piv.x, piv.y + 6], [piv.x - 26, piv.y + H * 0.26], [piv.x + 26, piv.y + H * 0.26]], { color: C.dark, width: 2.5, closed: true, fill: C.gray });
                ctx.save();
                ctx.translate(piv.x, piv.y); ctx.rotate(th);
                pn(ctx, -boardHalf, -13, boardHalf * 2, 15, { radius: 5, fill: C.orange, stroke: '#a35b00', lineWidth: 2.5 });
                var i, j;
                for (j = 0; j < 2; j++) {
                    var arr = j === 0 ? st.left : st.right, sg = j === 0 ? -1 : 1;
                    for (i = 0; i < 4; i++) {
                        if (arr[i] <= 0) continue;
                        var lx = sg * ARMS[i] * wpM, bw = Math.min(40, wpM * 0.9), bh = 14;
                        for (var bI = 0; bI < arr[i]; bI++) {
                            pn(ctx, lx - bw / 2, -13 - (bI + 1) * (bh + 2), bw, bh, { radius: 3, fill: C.blue, stroke: '#336699', lineWidth: 1.5 });
                            txt(ctx, '20', lx, -13 - (bI + 1) * (bh + 2) + bh / 2 + 4, { size: 9.5, align: 'center', color: '#fff' });
                        }
                    }
                }
                for (j = 0; j < 2; j++) {
                    var arrP = j === 0 ? st.left : st.right, sgP = j === 0 ? -1 : 1;
                    var highest = 0, hx = sgP * 7.4 * wpM;
                    for (i = 0; i < 4; i++) { var hi = arrP[i]; if (hi > highest) { highest = hi; hx = sgP * ARMS[i] * wpM; } }
                    var feetY = -13 - highest * 16;
                    var pX = hx;
                    ctx.save();
                    ctx.translate(pX, feetY);
                    disk(ctx, 0, -26, 7, C.pink, '#a33b5e', 2);
                    pline(ctx, [[0, -19], [0, -2]], { color: C.dark, width: 3 });
                    pline(ctx, [[-9, -14], [9, -14]], { color: C.dark, width: 3 });
                    pline(ctx, [[0, -2], [-6, 0]], { color: C.dark, width: 3 });
                    pline(ctx, [[0, -2], [6, 0]], { color: C.dark, width: 3 });
                    ctx.restore();
                }
                ctx.restore();
                st.btns = [];
                for (j = 0; j < 2; j++) {
                    var arrB = j === 0 ? st.left : st.right, sgB = j === 0 ? -1 : 1;
                    for (i = 0; i < 4; i++) {
                        var lxw = sgB * ARMS[i] * wpM, hy = -13 - arrB[i] * 16 - 34;
                        var rx = piv.x + Math.cos(th) * lxw - Math.sin(th) * hy;
                        var ry = piv.y + Math.sin(th) * lxw + Math.cos(th) * hy;
                        pn(ctx, rx - 26, ry - 12, 52, 24, { radius: 6, fill: 'rgba(255,255,255,0.94)', stroke: C.gray, lineWidth: 1 });
                        txt(ctx, '＋', rx - 13, ry + 5, { size: 15, align: 'center', color: C.green, weight: 'bold' });
                        txt(ctx, '－', rx + 13, ry + 5, { size: 15, align: 'center', color: C.red, weight: 'bold' });
                        st.btns.push({ x: rx - 13, y: ry, add: true, side: j, idx: i });
                        st.btns.push({ x: rx + 13, y: ry, add: false, side: j, idx: i });
                        if (thDeg !== 0) {
                            var tx = piv.x + Math.cos(th) * lxw - Math.sin(th) * 24;
                            var ty2 = piv.y + Math.sin(th) * lxw + Math.cos(th) * 24;
                            txt(ctx, ARMS[i] + 'm', tx, ty2 + 18, { size: 10, align: 'center', color: C.gray });
                        } else {
                            txt(ctx, ARMS[i] + 'm', piv.x + lxw, piv.y + 30, { size: 10, align: 'center', color: C.gray });
                        }
                    }
                }
                var tl = torque(st.left, 1), tr = torque(st.right, 1), net = tr - tl;
                var balanced = Math.abs(netT()) < 98;
                if (balanced) {
                    pn(ctx, W / 2 - 82, 16, 164, 38, { radius: 10, fill: 'rgba(88,214,141,0.2)', stroke: C.green, lineWidth: 2 });
                    txt(ctx, '⚖ 平衡！', W / 2, 41, { size: 17, align: 'center', color: C.green, weight: 'bold' });
                }
                txt(ctx, '净力矩 ' + nf(net, 0) + ' N·m', 16, H - 16, { size: 12.5, color: balanced ? C.green : C.dark, weight: 'bold' });
                flushRows(st, [
                    row('左力矩 Σmgl', nf(tl, 0), 'N·m', C.red),
                    row('右力矩 Σmgr', nf(tr, 0), 'N·m', C.blue),
                    row('倾角 θ', nf(thDeg, 1), '°', balanced ? C.green : C.orange)
                ]);
            },
            reset: function () { st.left = [0, 0, 0, 0]; st.right = [0, 0, 0, 0]; st.chal = false; },
            onPointerDown: function (x, y) {
                for (var i = 0; i < st.btns.length; i++) {
                    var bt = st.btns[i];
                    if ((x - bt.x) * (x - bt.x) + (y - bt.y) * (y - bt.y) < 15 * 15) {
                        var arr = bt.side === 0 ? st.left : st.right;
                        if (bt.add) { if (arr[bt.idx] < 6) arr[bt.idx]++; }
                        else { if (arr[bt.idx] > 0) arr[bt.idx]--; }
                        return;
                    }
                }
            }
        };
    }

    /* ============================================================
       Mode 8  densityBlock —— 密度与浮沉 (density)
       ============================================================ */
    function buildDensityBlock() {
        var MAT = [
            { v: '0.6', name: '木头', col: '#b07d4d' },
            { v: '0.92', name: '冰', col: '#cdeefb' },
            { v: '1.0', name: '水', col: '#7fc4e8' },
            { v: '2.7', name: '铝', col: '#cfd4da' },
            { v: '7.8', name: '铁', col: '#aab2bd' }
        ];
        function matByVal(v) { for (var i = 0; i < MAT.length; i++) if (MAT[i].v === String(v)) return MAT[i]; return MAT[0]; }
        var V = 2;
        var st = {
            W: 800, H: 600, drag: null,
            blocks: [
                { mat: '0.6', id: 'A' },
                { mat: '7.8', id: 'B' }
            ]
        };
        function tankGeo() {
            return { x0: st.W * 0.52, x1: st.W * 0.96, surf: st.H * 0.26, bot: st.H * 0.90, side: Math.min(st.H * 0.18, st.W * 0.085) };
        }
        function rhoOf(b) { return parseFloat(matByVal(b.mat).v); }
        function placeEq(b) {
            var tg = tankGeo(), S = tg.side, rho = rhoOf(b);
            if (rho < 1) { var f = rho; b.y = tg.surf - S + f * S; b.sinkF = f; }
            else { b.y = tg.bot - S; b.sinkF = 1; }
        }
        function ensurePlaced() {
            var tg = tankGeo(), S = tg.side;
            for (var i = 0; i < st.blocks.length; i++) {
                var b = st.blocks[i];
                if (b.x === undefined) {
                    b.x = tg.x0 + S * 0.5 + i * (S * 2.4);
                    placeEq(b);
                }
            }
        }
        function buoyForce(b) {
            var rho = rhoOf(b), mg = rho * V * G;
            return rho < 1 ? mg : 1.0 * V * G;
        }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>浸没的物体排开等体积液体，所受浮力满足<strong>阿基米德原理</strong>：</p>' +
                    '<div class="formula">F浮 = ρ液 · g · V排　　ρ物 = m / V</div>' +
                    '<ul style="padding-left:20px"><li>ρ物 &lt; ρ水：漂浮，浸没比例 = ρ物 / ρ水</li>' +
                    '<li>ρ物 = ρ水：悬浮不动</li>' +
                    '<li>ρ物 &gt; ρ水：下沉至底，浮力恒为 ρ水gV</li></ul>' +
                    '<p style="color:#888">暂停时可将方块拖入水中任意位置，松手自动回到浮沉平衡态。水下部分会变暗。</p>'
                );
                L.setPresets([
                    { name: '木 vs 铁', apply: function () { st.blocks[0].mat = '0.6'; st.blocks[1].mat = '7.8'; rePlace(); } },
                    { name: '冰 vs 水', apply: function () { st.blocks[0].mat = '0.92'; st.blocks[1].mat = '1.0'; rePlace(); } },
                    { name: '全铁对对碰', apply: function () { st.blocks[0].mat = '7.8'; st.blocks[1].mat = '7.8'; rePlace(); } }
                ]);
                function rePlace() { for (var i = 0; i < st.blocks.length; i++) { st.blocks[i].x = undefined; } }
            },
            getControls: function () {
                function opts() {
                    var os = [];
                    for (var i = 0; i < MAT.length; i++) os.push({ value: MAT[i].v, label: MAT[i].name + ' ' + MAT[i].v + ' kg/L' });
                    return os;
                }
                return [
                    { id: 'db_mA', type: 'select', label: '方块A 材质', value: st.blocks[0].mat, options: opts(), onChange: function (v) { st.blocks[0].mat = String(v); st.blocks[0].x = undefined; } },
                    { id: 'db_mB', type: 'select', label: '方块B 材质', value: st.blocks[1].mat, options: opts(), onChange: function (v) { st.blocks[1].mat = String(v); st.blocks[1].x = undefined; } }
                ];
            },
            update: function () { ensurePlaced(); },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS, tg = tankGeo(), S = tg.side;
                KT().background(ctx, W, H);
                ensurePlaced();
                pn(ctx, tg.x0 - 6, tg.surf - 40, tg.x1 - tg.x0 + 12, tg.bot - tg.surf + 46, { radius: 8, fill: 'rgba(127,196,232,0.30)', stroke: '#7fa8c4', lineWidth: 2 });
                pn(ctx, tg.x0, tg.surf, tg.x1 - tg.x0, tg.bot - tg.surf, { radius: 0, fill: 'rgba(102,170,215,0.42)' });
                var wl = [];
                for (var wi = 0; wi <= 24; wi++) {
                    var wx = tg.x0 + (tg.x1 - tg.x0) * wi / 24;
                    wl.push([wx, tg.surf + Math.sin(wi * 0.8 + H * 0.01) * 2.5]);
                }
                pline(ctx, wl, { color: '#ffffffcc', width: 2 });
                pline(ctx, [[tg.x0, tg.bot], [tg.x1, tg.bot]], { color: '#8d6e63', width: 10 });
                txt(ctx, '水池 ρ液 = 1.0 kg/L', tg.x0 + 10, tg.surf - 12, { size: 12.5, color: '#1565c0', weight: 'bold' });
                txt(ctx, '体积 V = 2 L（相同）', tg.x0 + 10, tg.surf + 8, { size: 11.5, color: '#1565c0' });
                var i, b;
                for (i = 0; i < st.blocks.length; i++) {
                    b = st.blocks[i]; ensurePlaced();
                    var mat = matByVal(b.mat), rho = rhoOf(b);
                    var bob = (rho < 1 && !(st.drag === i)) ? Math.sin(H * 0.02 + i * 2.4) * 3 : 0;
                    var bx = b.x, by = b.y + bob;
                    var immerseY = Math.min(Math.max(tg.surf, by + S), tg.bot);
                    pn(ctx, bx - S / 2, by, S, S, { radius: 4, fill: mat.col, stroke: 'rgba(0,0,0,0.4)', lineWidth: 2 });
                    if (immerseY < by + S) {
                        ctx.save(); ctx.globalAlpha = 0.24; ctx.fillStyle = '#083b63';
                        ctx.fillRect(bx - S / 2, immerseY, S, by + S - immerseY); ctx.restore();
                    }
                    txt(ctx, b.id, bx, by + S / 2 + 5, { size: 16, align: 'center', color: '#1a1a1a', weight: 'bold' });
                    if (!(st.drag === i)) {
                        var fb = buoyForce(b), fg = rho * V * G;
                        var pxN = Math.min(S / 60, 1.4);
                        arw(ctx, bx, by + S / 2, bx, by + S / 2 - fb * pxN, C.teal, 3.4);
                        txt(ctx, 'F浮 ' + nf(fb, 1) + ' N', bx + 8, by + S / 2 - fb * pxN + 4, { size: 11, color: C.teal });
                        arw(ctx, bx, by + S / 2, bx, by + S / 2 + fg * pxN, C.dark, 3.4);
                        txt(ctx, 'G ' + nf(fg, 1) + ' N', bx + 8, by + S / 2 + fg * pxN + 4, { size: 11, color: C.dark });
                    }
                    txt(ctx, mat.name, bx, by - 8, { size: 11.5, align: 'center', color: mat.col === '#cdeefb' ? '#3498db' : mat.col, weight: 'bold' });
                    hintDrag(ctx, '👆 拖动方块' + b.id, bx, by - 30);
                }
                pn(ctx, 16, 16, st.W * 0.30, 208, { radius: 10, fill: 'rgba(255,255,255,0.92)', stroke: C.gray });
                txt(ctx, '材质对照表', 28, 38, { size: 13.5, weight: 'bold' });
                for (i = 0; i < MAT.length; i++) {
                    rc(ctx, 30, 52 + i * 30, 16, 16, MAT[i].col, 'rgba(0,0,0,0.25)', 1);
                    txt(ctx, MAT[i].name + '　ρ = ' + MAT[i].v + ' kg/L', 54, 66 + i * 30, { size: 12.5 });
                }
                flushRows(st, [
                    row('A质量 m=ρV', nf(rhoOf(st.blocks[0]) * V, 2), 'kg', C.red),
                    row('A体积', nf(V, 1), 'L', C.gray),
                    row('A密度', nf(rhoOf(st.blocks[0]), 2), 'kg/L', C.red),
                    row('A浮力', nf(buoyForce(st.blocks[0]), 1), 'N', C.teal),
                    row('B质量 m=ρV', nf(rhoOf(st.blocks[1]) * V, 2), 'kg', C.blue),
                    row('B体积', nf(V, 1), 'L', C.gray),
                    row('B密度', nf(rhoOf(st.blocks[1]), 2), 'kg/L', C.blue),
                    row('B浮力', nf(buoyForce(st.blocks[1]), 1), 'N', C.teal)
                ]);
            },
            reset: function () {
                st.blocks[0].mat = '0.6'; st.blocks[1].mat = '7.8';
                st.blocks[0].x = undefined; st.blocks[1].x = undefined; st.drag = null;
            },
            hitTest: function (x, y) {
                var tg = tankGeo(), S = tg.side;
                for (var i = 0; i < st.blocks.length; i++) {
                    var b = st.blocks[i];
                    if (b.x === undefined) continue;
                    if (Math.abs(x - b.x) < S / 2 + 12 && Math.abs(y - (b.y + S / 2)) < S / 2 + 12) return true;
                }
                return false;
            },
            onPointerDown: function (x, y) {
                var tg = tankGeo(), S = tg.side;
                for (var i = 0; i < st.blocks.length; i++) {
                    var b = st.blocks[i]; ensurePlaced();
                    if (Math.abs(x - b.x) < S / 2 + 12 && Math.abs(y - (b.y + S / 2)) < S / 2 + 12) { st.drag = i; return; }
                }
            },
            onPointerMove: function (x, y) {
                if (st.drag === null || st.drag === undefined) return;
                var tg = tankGeo(), S = tg.side, b = st.blocks[st.drag];
                b.x = KT().clamp(x, tg.x0 + S / 2, tg.x1 - S / 2);
                b.y = KT().clamp(y - S / 2, tg.surf - S - 30, tg.bot - S);
            },
            onPointerUp: function () {
                if (st.drag !== null && st.drag !== undefined) { placeEq(st.blocks[st.drag]); }
                st.drag = null;
            }
        };
    }

    /* ============================================================
       Mode 9  pressurePool —— 液体压强 (under-pressure)
       ============================================================ */
    function buildPressurePool() {
        var FLUIDS = [
            { v: '1000', name: '清水', col: '#7fc4e8' },
            { v: '1025', name: '海水', col: '#5aa8c9' },
            { v: '900', name: '食用油', col: '#d9b840' },
            { v: '1400', name: '蜂蜜', col: '#dd9524' }
        ];
        function flByVal(v) { for (var i = 0; i < FLUIDS.length; i++) if (FLUIDS[i].v === String(v)) return FLUIDS[i]; return FLUIDS[0]; }
        var st = { W: 800, H: 600, h: 3, fl: '1000', marks: false, probe: null, py: 0 };
        var P0 = 101.325;
        function geo() {
            return { x0: st.W * 0.10, x1: st.W * 0.90, top: st.H * 0.13, base: st.H * 0.86, ppd: (st.H * 0.86 - st.H * 0.13) / 6 };
        }
        function wt() { return geo().base - st.h * geo().ppd; }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>静止液体内部压强随深度线性增大（与容器形状无关）：</p>' +
                    '<div class="formula">p = p₀ + ρgh　　p₀ = 101.325 kPa（大气压）</div>' +
                    '<ul style="padding-left:20px"><li>同深度处各方向压强相等 —— 侧壁箭头同行等粗</li>' +
                    '<li>深度翻倍，水压翻倍；换用蜂蜜（ρ大）同一深度压强更大</li>' +
                    '<li>底部还叠加大气传递的压强</li></ul>' +
                    '<p style="color:#888">上下拖动探测小球查看不同深度处的压强读数。</p>'
                );
                L.setPresets([
                    { name: '深海探测', apply: function () { st.h = 6; st.fl = '1025'; } },
                    { name: '蜂蜜桶底', apply: function () { st.h = 2; st.fl = '1400'; } }
                ]);
            },
            getControls: function () {
                var opts = [];
                for (var i = 0; i < FLUIDS.length; i++) opts.push({ value: FLUIDS[i].v, label: FLUIDS[i].name + ' ' + FLUIDS[i].v + ' kg/m³' });
                return [
                    { id: 'pp_h', type: 'slider', label: '水深 h', min: 1, max: 6, step: 0.5, unit: ' m', value: st.h, onChange: function (v) { st.h = v; } },
                    { id: 'pp_fl', type: 'select', label: '流体种类', value: st.fl, options: opts, onChange: function (v) { st.fl = String(v); } },
                    { id: 'pp_mk', type: 'checkbox', label: '沿深度每米标注压强', value: st.marks, onChange: function (v) { st.marks = !!v; } }
                ];
            },
            update: function () {
                var g = geo();
                st.py = KT().clamp(st.py || g.base - 20, wt() + 10, g.base - 10);
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS, g = geo(), fl = flByVal(st.fl), wtop = wt(), rho = parseFloat(fl.v);
                KT().background(ctx, W, H);
                pn(ctx, g.x0 - 8, g.top - 8, g.x1 - g.x0 + 16, g.base - g.top + 20, { radius: 4, fill: 'rgba(255,255,255,0.10)', stroke: C.gray, lineWidth: 2 });
                pn(ctx, g.x0, wtop, g.x1 - g.x0, g.base - wtop, { radius: 0, fill: 'rgba(180,180,180,0.16)' });
                pn(ctx, g.x0, wtop, g.x1 - g.x0, g.base - wtop, { radius: 0, fill: fl.col, alpha: 0.5 });
                pline(ctx, [[g.x0, wtop], [g.x1, wtop]], { color: '#ffffffbb', width: 2 });
                rc(ctx, g.x0, g.base, g.x1 - g.x0, 12, '#8d6e63');
                pn(ctx, g.x0 - 12, wtop, 12, g.base - wtop, { fill: '#7b8794' });
                pn(ctx, g.x1, wtop, 12, g.base - wtop, { fill: '#7b8794' });
                pn(ctx, g.x0 - 12, g.base, g.x1 - g.x0 + 24, 12, { fill: '#7b8794' });
                var i;
                for (i = 1; i * g.ppd < g.base - wtop - 6; i++) {
                    var dw = i, pd = g.base - i * g.ppd;
                    var tk = 1.2 + 7 * (rho * G * dw) / (1400 * G * 6);
                    arw(ctx, g.x0 - 2, pd, g.x0 - 2 + tk * 4 + 8, pd, C.purple, tk);
                    arw(ctx, g.x1 + 2, pd, g.x1 + 2 - tk * 4 - 8, pd, C.purple, tk);
                }
                var btk = 2 + 8 * (P0 + rho * G * st.h / 1000) / (P0 + 1400 * G * 6 / 1000);
                var nb = Math.max(3, Math.floor((g.x1 - g.x0) / 70));
                for (i = 0; i < nb; i++) {
                    var ax = g.x0 + 30 + (g.x1 - g.x0 - 60) * i / (nb - 1);
                    arw(ctx, ax, g.base - 2, ax, g.base - 14 - btk * 3.4, C.orange, btk);
                }
                arw(ctx, g.x0 + 24, g.top - 14, g.x0 + 24, g.top - 2, C.sky, 2.4);
                arw(ctx, g.x1 - 24, g.top - 14, g.x1 - 24, g.top - 2, C.sky, 2.4);
                txt(ctx, '上方大气 p₀ = ' + nf(P0, 1) + ' kPa 向各面施加', (g.x0 + g.x1) / 2, g.top - 22, { size: 11.5, align: 'center', color: C.gray });
                for (i = 0; i <= st.h; i++) {
                    var ly = g.base - i * g.ppd;
                    if (ly < wtop - 1) break;
                    if (st.marks && i > 0) dst(ctx, g.x0, ly, g.x1, ly, '#ffffff88', 1);
                    txt(ctx, i + ' m', g.x0 - 18, ly + 4, { size: 10.5, align: 'right', color: C.gray });
                    if (st.marks && i > 0) {
                        txt(ctx, nf(P0 + rho * G * i / 1000, 1) + ' kPa', g.x1 + 20, ly + 4, { size: 10.5, color: C.purple });
                    }
                }
                if (!st.py) st.py = g.base - 20;
                var pr = 11, probeY = KT().clamp(st.py, wtop + pr + 2, g.base - pr - 6);
                var depth = (g.base - probeY) / g.ppd;
                var Phyd = rho * G * depth / 1000, Pt = P0 + Phyd;
                dst(ctx, (g.x0 + g.x1) / 2, probeY, g.x1 + 14, probeY, C.gray, 1.2);
                disk(ctx, (g.x0 + g.x1) / 2, probeY, pr, C.yellow, '#b7950b', 2);
                hintDrag(ctx, '👆 拖动探针', (g.x0 + g.x1) / 2, probeY - 30);
                pn(ctx, g.x1 + 20, probeY - 34, 128, 66, { radius: 8, fill: 'rgba(255,255,255,0.94)', stroke: C.gray });
                txt(ctx, '压力计', g.x1 + 84, probeY - 16, { size: 11, align: 'center', weight: 'bold', color: C.gray });
                txt(ctx, nf(Pt, 2) + ' kPa', g.x1 + 84, probeY + 8, { size: 14, align: 'center', weight: 'bold', color: C.purple });
                txt(ctx, '深度 ' + nf(depth, 2) + ' m', g.x1 + 84, probeY + 26, { size: 11, align: 'center', color: C.dark });
                pn(ctx, 16, 16, st.W * 0.10, 74, { radius: 8, fill: 'rgba(255,255,255,0.9)', stroke: C.gray });
                txt(ctx, fl.name, 16 + st.W * 0.05, 44, { size: 13, align: 'center', weight: 'bold' });
                txt(ctx, 'ρ = ' + fl.v, 16 + st.W * 0.05, 68, { size: 12, align: 'center', color: C.gray });
                flushRows(st, [
                    row('探针深度 h探', nf(depth, 2), 'm', C.dark),
                    row('液体压强 ρgh', nf(Phyd, 2), 'kPa', C.teal),
                    row('总压强 p₀+ρgh', nf(Pt, 2), 'kPa', C.purple)
                ]);
            },
            reset: function () {
                st.h = 3; st.fl = '1000'; st.marks = false;
                var g = geo(); st.py = g.base - 20;
            },
            hitTest: function (x, y) {
                var g = geo(), cxp = (g.x0 + g.x1) / 2;
                return (x - cxp) * (x - cxp) + (y - st.py) * (y - st.py) < 30 * 30;
            },
            onPointerDown: function (x, y) {
                var g = geo(), cxp = (g.x0 + g.x1) / 2;
                if ((x - cxp) * (x - cxp) + (y - st.py) * (y - st.py) < 30 * 30) st.probeDrag = true;
            },
            onPointerMove: function (x, y) {
                if (!st.probeDrag) return;
                var g = geo();
                st.py = KT().clamp(y, wt() + 12, g.base - 14);
            },
            onPointerUp: function () { st.probeDrag = false; }
        };
    }

    /* ============================================================
       Mode 10  energyforms —— 能量形式与转化 (energy-forms-changes)
       ============================================================ */
    function buildEnergyForms() {
        var SCENES = {
            bike: { name: '自行车发电烧水', eff: 70, rate: 1.2,
                tgt: { chem: 1.0, kin: 0.8, ele: 0.5, lum: 0, heat: 0.35 },
                note: '化学能(人体) → 动能(蹬车) → 电能(发电机) → 热能(烧水)' },
            solar: { name: '太阳能路灯', eff: 55, rate: 0.9,
                tgt: { chem: 0, kin: 0.15, ele: 0.6, lum: 1.0, heat: 0.25 },
                note: '光能(太阳) → 电能(光伏板) → 光能(路灯) + 热能（守恒）' },
            wind: { name: '风力磨坊', eff: 42, rate: 1.0,
                tgt: { chem: 0, kin: 0.9, ele: 0.7, lum: 0, heat: 0.2 },
                note: '动能(风) → 电能/机械能(磨盘) + 热能（总量不变）' }
        };
        var BARDEF = [
            ['chem', '化学能', '#e67e22'], ['kin', '动能', '#27ae60'],
            ['ele', '电能', '#2980b9'], ['lum', '光能', '#f1c40f'],
            ['heat', '热能', '#c0392b']
        ];
        var rngFn = KT().rng ? KT().rng(20240501) : Math.random;
        var phases = [];
        for (var pi = 0; pi < 5; pi++) phases.push(rngFn() * 6.28);
        var st = {
            W: 800, H: 600, scene: 'bike', power: 1, note: true,
            disp: { chem: 0, kin: 0, ele: 0, lum: 0, heat: 0 },
            wheelAng: 0, sunPh: 0, producedKJ: 0, steamN: 0
        };
        function scn() { return SCENES[st.scene] || SCENES.bike; }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>能量守恒定律</strong>：能量不会凭空产生或消失，只会从一种形式转化为另一种形式，总量保持不变。</p>' +
                    '<ul style="padding-left:20px">' +
                    '<li><strong>自行车发电</strong>：人体化学能 → 车轮动能 → 发电机电能 → 水壶热能</li>' +
                    '<li><strong>太阳能路灯</strong>：太阳光能 → 光伏电能 → 路灯光能 + 少量热能</li>' +
                    '<li><strong>风力磨坊</strong>：空气动能 → 风轮转动 → 磨盘碾磨 + 热能损耗</li></ul>' +
                    '<div class="formula">E总输入 = E各形式输出之和（效率 = 有效输出 / 总输入）</div>' +
                    '<p style="color:#888">右侧条形图实时展示各形式能量的占比；播放时数值会有微小扰动以模拟波动。</p>'
                );
                L.setPresets([
                    { name: '自行车发电', apply: function () { st.scene = 'bike'; } },
                    { name: '太阳能路灯', apply: function () { st.scene = 'solar'; } },
                    { name: '风力磨坊', apply: function () { st.scene = 'wind'; } }
                ]);
            },
            getControls: function () {
                var os = [];
                os.push({ value: 'bike', label: '🚲 自行车发电烧水' });
                os.push({ value: 'solar', label: '💡 太阳能路灯' });
                os.push({ value: 'wind', label: '🌬️ 风力磨坊' });
                return [
                    { id: 'ef_scene', type: 'select', label: '场景选择', value: st.scene, options: os, onChange: function (v) { st.scene = String(v); st.producedKJ = 0; } },
                    { id: 'ef_pw', type: 'slider', label: '功率强度', min: 0.2, max: 1, step: 0.05, unit: ' ×', value: st.power, onChange: function (v) { st.power = v; } },
                    { id: 'ef_note', type: 'checkbox', label: '显示能量守恒说明', value: st.note, onChange: function (v) { st.note = !!v; } }
                ];
            },
            update: function (dt, t) {
                var tg = scn().tgt, kSm = 1 - Math.exp(-dt * 2.2), i;
                for (i = 0; i < BARDEF.length; i++) {
                    var key = BARDEF[i][0];
                    var targ = tg[key] * st.power * (1 + 0.05 * Math.sin(t * 1.7 + phases[i]));
                    st.disp[key] += (targ - st.disp[key]) * kSm;
                }
                st.wheelAng += dt * st.power * (tg.kin * 4);
                st.sunPh += dt * 0.7 * st.power;
                st.steamN += dt * st.disp.heat * 2;
                st.producedKJ += scn().rate * st.power * dt;
            },
            render: function (ctx, W, H, t) {
                st.W = W; st.H = H;
                var C = KT().COLORS, s = scn(), i;
                KT().background(ctx, W, H);
                pn(ctx, W * 0.04, H * 0.08, W * 0.52, H * 0.74, { radius: 12, fill: 'rgba(255,255,255,0.85)', stroke: C.gray, lineWidth: 1.5 });
                txt(ctx, s.name, W * 0.30, H * 0.13, { size: 17, align: 'center', weight: 'bold', color: C.dark });
                var gx = W * 0.18, gy = H * 0.52;
                if (st.scene === 'bike') {
                    disk(ctx, gx, gy, 52, null, C.dark, 4);
                    disk(ctx, gx + 168, gy, 52, null, C.dark, 4);
                    ctx.save(); ctx.strokeStyle = C.blue; ctx.lineWidth = 3;
                    for (var sp = 0; sp < 4; sp++) {
                        var aa = st.wheelAng + sp * Math.PI / 4;
                        dst(ctx, gx, gy, gx + Math.cos(aa) * 48, gy + Math.sin(aa) * 48, C.blue, 2);
                        dst(ctx, gx + 168, gy, gx + 168 + Math.cos(aa) * 48, gy + Math.sin(aa) * 48, C.blue, 2);
                    }
                    ctx.restore();
                    pline(ctx, [[gx, gy], [gx + 168, gy]], { color: C.dark, width: 3 });
                    pline(ctx, [[gx + 150, gy - 58], [gx + 186, gy - 26], [gx + 152, gy + 8]], { color: C.gray, width: 3 });
                    disk(ctx, gx + 152, gy + 12, 7, C.orange, '#a35b00', 2);
                    arw(ctx, gx + 170, gy, gx + 210, gy, C.teal, 2.4);
                    txt(ctx, '传动 → 发电机', gx + 200, gy - 8, { size: 11, color: C.teal });
                    pn(ctx, gx + 216, gy - 34, 56, 64, { radius: 6, fill: '#dfe6ee', stroke: C.gray, lineWidth: 2 });
                    rc(ctx, gx + 216, gy - 24, 56, 46, 'rgba(192,57,43,' + Math.min(st.disp.heat, 0.65) + ')');
                    for (var sk = 0; sk < 3; sk++) {
                        var phz = (st.steamN * 0.9 + sk * 0.5) % 1.6;
                        disk(ctx, gx + 238 + Math.sin(phz * 5 + sk) * 9, gy - 44 - phz * 42, 5 + phz * 6, 'rgba(180,180,190,' + (0.5 - phz * 0.3) + ')');
                    }
                    txt(ctx, '水壶', gx + 244, gy + 44, { size: 11.5, align: 'center' });
                    var legA = Math.sin(t * 5 * st.power) * 14;
                    pline(ctx, [[gx - 76, gy - 44], [gx - 92 + legA * 0.3, gy - 22], [gx - 82 + legA, gy]], { color: C.dark, width: 3.4 });
                    pline(ctx, [[gx - 72, gy - 44], [gx - 88, gy - 22], [gx - 96 + legA * 0.4, gy]], { color: C.dark, width: 3.4 });
                    disk(ctx, gx - 84, gy - 62, 11, C.pink, '#a33b5e', 2);
                    arw(ctx, gx - 84, gy - 74, gx - 84, gy - 96, C.orange, 3);
                    txt(ctx, '人体输出功率 ' + nf(st.disp.chem * 400, 0) + ' W', gx - 108, gy - 104, { size: 11.5, color: C.orange });
                } else if (st.scene === 'solar') {
                    var sx = gx + 20, sy = gy - 130;
                    disk(ctx, sx, sy, 26, C.yellow, '#b7950b', 2);
                    ctx.save(); ctx.strokeStyle = C.yellow; ctx.lineWidth = 2.4;
                    for (var ry = 0; ry < 8; ry++) {
                        var ra = st.sunPh * 0.6 + ry * Math.PI / 4;
                        pline(ctx, [[sx + Math.cos(ra) * 32, sy + Math.sin(ra) * 32], [sx + Math.cos(ra) * 44, sy + Math.sin(ra) * 44]], { color: C.yellow, width: 2.4 });
                    }
                    var sweepA = Math.sin(st.sunPh) * 0.35;
                    ctx.globalAlpha = 0.25; ctx.fillStyle = C.yellow;
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, 130, sweepA - 0.25, sweepA + 0.25); ctx.closePath(); ctx.fill();
                    ctx.restore();
                    var px2 = gx + 120, py2 = gy + 8;
                    pline(ctx, [[px2, py2], [px2 + 90, py2 - 36], [px2 + 110, py2 + 6], [px2 + 20, py2 + 42]], { color: C.dark, width: 2.5, closed: true, fill: 'rgba(41,128,185,0.75)' });
                    for (var cellI = 1; cellI < 4; cellI++) {
                        dst(ctx, px2 + cellI * 22, py2 - 8 - cellI * 9, px2 + cellI * 22 + 8, py2 + 38 - cellI * 9, 'rgba(255,255,255,0.45)', 1.4);
                    }
                    txt(ctx, '光伏板', px2 + 62, py2 + 60, { size: 11.5, align: 'center' });
                    dst(ctx, px2 + 112, py2 - 12, px2 + 172, py2 - 12, C.teal, 3);
                    var lpX = px2 + 178;
                    pline(ctx, [[lpX, py2 + 40], [lpX, py2 - 70]], { color: C.dark, width: 5 });
                    var glow = Math.min(st.disp.lum, 1);
                    disk(ctx, lpX, py2 - 80, 13 + glow * 10, 'rgba(241,196,15,' + (0.35 + glow * 0.6) + ')');
                    disk(ctx, lpX, py2 - 80, 9, C.white, C.yellow, 2);
                    ctx.save(); ctx.globalAlpha = 0.22 + glow * 0.2; ctx.fillStyle = C.yellow;
                    ctx.beginPath(); ctx.moveTo(lpX, py2 - 78); ctx.lineTo(lpX - 44, py2 + 42); ctx.lineTo(lpX + 44, py2 + 42); ctx.closePath(); ctx.fill();
                    ctx.restore();
                    txt(ctx, '光照强度驱动灯光亮度', lpX, py2 + 62, { size: 11.5, color: C.gray });
                    txt(ctx, '太阳辐照 ' + nf(st.disp.lum * 900, 0) + ' W/m²', sx - 86, sy - 44, { size: 11.5, color: C.orange });
                } else {
                    var wx = gx + 40, wy = gy - 40;
                    pline(ctx, [[wx, wy + 70], [wx, wy + 118]], { color: C.ground, width: 9 });
                    var bl = 62, nB = 3;
                    ctx.save(); ctx.translate(wx, wy); ctx.rotate(st.wheelAng);
                    for (i = 0; i < nB; i++) {
                        ctx.save(); ctx.rotate(i * 2 * Math.PI / nB);
                        pline(ctx, [[0, 0], [bl, 0]], { color: C.teal, width: 4 });
                        pline(ctx, [[bl, 0], [bl - 6, -16], [bl - 22, -14]], { color: C.teal, width: 3, closed: true, fill: C.sky });
                        ctx.restore();
                    }
                    disk(ctx, 0, 0, 8, C.dark);
                    ctx.restore();
                    var wdir = W * 0.06;
                    for (var wf = 0; wf < 3; wf++) {
                        var wph = ((st.wheelAng * 0.5 + wf * 0.7) % 1.4) - 0.2;
                        arw(ctx, wx - 118 + wph * 36, wy - 44 + wf * 30, wx - 94 + wph * 36, wy - 44 + wf * 30, '#9ab5cc', 3);
                    }
                    dst(ctx, wx + 6, wy + 100, wx + 96, wy + 100, C.teal, 3);
                    pn(ctx, wx + 98, wy + 74, 46, 52, { radius: 5, fill: '#cbb692', stroke: '#8a6d3b', lineWidth: 2 });
                    disk(ctx, wx + 121, wy + 100, 15, '#efe3c8', '#a58e63', 2);
                    disk(ctx, wx + 121 + Math.cos(st.wheelAng * 2.4) * 12, wy + 100 + Math.sin(st.wheelAng * 2.4) * 12, 4, C.gray);
                    txt(ctx, '石磨盘', wx + 121, wy + 142, { size: 11.5, align: 'center' });
                    txt(ctx, '风速驱动风轮', wx - 130, wy - 66, { size: 11.5, color: C.gray });
                }
                if (st.note) {
                    pn(ctx, W * 0.055, H * 0.71, W * 0.49, 34, { radius: 8, fill: 'rgba(236,240,241,0.95)', stroke: C.green, lineWidth: 1.4 });
                    txt(ctx, s.note, W * 0.30, H * 0.71 + 22, { size: 12.5, align: 'center', weight: 'bold', color: '#14532d' });
                }
                var bx = W * 0.63, bw = W * 0.31, bhRow = Math.max(26, H * 0.075);
                txt(ctx, '能量流动（宽度∝占比）', bx + bw / 2, H * 0.115, { size: 14, align: 'center', weight: 'bold' });
                for (i = 0; i < BARDEF.length; i++) {
                    var bk = BARDEF[i][0], lbl = BARDEF[i][1], col = BARDEF[i][2];
                    var val = Math.max(st.disp[bk], 0), yTop = H * 0.155 + i * (bhRow + 12);
                    pn(ctx, bx - 70, yTop, 68, bhRow * 0.62, { radius: 6, fill: col });
                    txt(ctx, lbl, bx - 36, yTop + bhRow * 0.45, { size: 12, align: 'center', weight: 'bold' });
                    pn(ctx, bx, yTop, bw, bhRow * 0.62, { radius: 6, fill: '#edf0f3', stroke: C.gray, lineWidth: 1 });
                    var fracW = KT().clamp(val / Math.max(1.0, 1.0), 0, 1);
                    if (val > 0.005) pn(ctx, bx + 2, yTop + 2, Math.max((bw - 4) * fracW, 6), bhRow * 0.62 - 4, { radius: 4, fill: col });
                    txt(ctx, Math.round(val * 100) + '%', bx + bw + 8, yTop + bhRow * 0.42, { size: 12.5, weight: 'bold', color: col });
                }
                pn(ctx, bx - 70, H * 0.83, bw + 90, 56, { radius: 10, fill: 'rgba(255,255,255,0.92)', stroke: C.gray });
                txt(ctx, '主转化效率：' + s.eff + '%', bx - 56, H * 0.83 + 22, { size: 13, weight: 'bold', color: C.blue });
                txt(ctx, '累计产能：' + nf(st.producedKJ, 1) + ' kJ', bx - 56, H * 0.83 + 44, { size: 13, weight: 'bold', color: C.green });
                flushRows(st, [
                    row('当前主转化效率', String(s.eff), '%', C.blue),
                    row('累计产能', nf(st.producedKJ, 1), 'kJ', C.green),
                    row('热耗散占比', Math.round(Math.max(st.disp.heat, 0) * 100) + '', '%', C.red)
                ]);
            },
            reset: function () {
                st.scene = 'bike'; st.power = 1; st.note = true;
                st.disp = { chem: 0, kin: 0, ele: 0, lum: 0, heat: 0 };
                st.wheelAng = 0; st.sunPh = 0; st.producedKJ = 0; st.steamN = 0;
            }
        };
    }

    /* ============================================================
       Mode 11  projdata —— 抛体运动数据实验室 (projectile-data-lab)
       ============================================================ */
    function buildProjData() {
        var SWEEP_LIST = [15, 30, 45, 60, 75];
        var st = {
            W: 800, H: 600, v0: 45, ang: 45,
            balls: [], records: [], sweep: null, last: null,
            maxView: 90, maxR: 60
        };
        function rad(a) { return a * Math.PI / 180; }
        function theory(aDeg) {
            var r = rad(aDeg), v = st.v0;
            return { R: v * v * Math.sin(2 * r) / G, Hm: v * v * Math.sin(r) * Math.sin(r) / (2 * G), T: 2 * v * Math.sin(r) / G };
        }
        function geo() {
            var s = Math.min((st.W * 0.86) / st.maxView, (st.H * 0.40) / Math.max(35, st.maxView * 0.52));
            return { ox: st.W * 0.08, gy: st.H * 0.50, s: s };
        }
        function launch(aDeg) {
            var th = rad(aDeg);
            st.balls.push({
                x: 1.4, y: 0.4,
                vx: st.v0 * Math.cos(th), vy: st.v0 * Math.sin(th),
                trail: [[1.4, 0.4]], tt: 0, a: aDeg
            });
            st.last = theory(aDeg);
        }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p>忽略空气阻力时，抛体运动是水平匀速 + 竖直上抛的合运动：</p>' +
                    '<div class="formula">射程 R = v₀²·sin(2θ) / g　　最大高度 H = v₀²sin²θ / (2g)　　飞行时间 T = 2v₀sinθ / g</div>' +
                    '<ul style="padding-left:20px">' +
                    '<li><strong>发射</strong>：按当前角度与初速单次发射，落点自动记旗</li>' +
                    '<li><strong>自动扫掠</strong>：依次以 15°→75° 每隔 600ms 发射一次（需处于播放状态），逐次把射程写入右上表格并绘制散点连线</li>' +
                    '<li>当 g 固定时 <strong>θ = 45° 时射程最远</strong>；θ 与 90°−θ 射程相同</li></ul>'
                );
                L.setPresets([
                    { name: '最佳角 45°', apply: function () { st.ang = 45; } },
                    { name: '高吊球 70°', apply: function () { st.ang = 70; } },
                    { name: '平射 15°', apply: function () { st.ang = 15; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'pj_v', type: 'slider', label: '初速度', min: 20, max: 80, step: 1, unit: ' m/s', value: st.v0, onChange: function (v) { st.v0 = v; } },
                    { id: 'pj_a', type: 'slider', label: '发射角度', min: 15, max: 75, step: 1, unit: ' °', value: st.ang, onChange: function (v) { st.ang = Math.round(v); } },
                    { id: 'pj_fire', type: 'button', label: '🚀 发射', action: function () { launch(st.ang); } },
                    {
                        id: 'pj_auto', type: 'button', label: '🎯 自动扫掠 15°–75°',
                        action: function () {
                            st.sweep = { idx: 0, timer: 0 };
                            if (st.L && st.L.showToast) st.L.showToast('已启动扫掠：请点击播放按钮开始执行');
                        }
                    },
                    { id: 'pj_clear', type: 'button', label: '清空记录与轨迹', action: function () { st.balls = []; st.records = []; st.sweep = null; st.maxView = 90; st.maxR = 60; } }
                ];
            },
            update: function (dt) {
                var i, j;
                if (st.sweep) {
                    st.sweep.timer -= dt;
                    while (st.sweep && st.sweep.timer <= 0) {
                        launch(SWEEP_LIST[st.sweep.idx]);
                        st.sweep.idx++;
                        if (st.sweep.idx >= SWEEP_LIST.length) {
                            st.sweep = null;
                            if (st.L && st.L.showToast) st.L.showToast('自动扫掠完成：曲线峰值在 45° 附近');
                        } else {
                            st.sweep.timer += 0.6;
                        }
                    }
                }
                for (i = st.balls.length - 1; i >= 0; i--) {
                    var b = st.balls[i];
                    var n = Math.min(120, Math.max(1, Math.ceil(dt / 0.004))), h = dt / n;
                    for (j = 0; j < n; j++) {
                        b.vy -= G * h; b.x += b.vx * h; b.y += b.vy * h;
                    }
                    b.tt += dt;
                    if (b.tt > 0.03) { b.trail.push([b.x, b.y]); if (b.trail.length > (window.Mobile ? window.Mobile.reduceParticleCount(500) : 500)) b.trail.shift(); b.tt = 0; }
                    if (b.y <= 0 && b.vy < 0) {
                        st.records.push({ a: b.a, R: b.x });
                        if (st.records.length > 10) st.records.shift();
                        st.maxR = Math.max(st.maxR, b.x);
                        st.maxView = Math.max(st.maxView, b.x * 1.12);
                        st.balls.splice(i, 1);
                    }
                }
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var C = KT().COLORS, g = geo(), thRad = rad(st.ang), i;
                KT().background(ctx, W, H);
                pline(ctx, [[0, g.gy], [W, g.gy]], { color: C.ground, width: 5 });
                for (var tvi = 0; tvi <= st.maxView; tvi += 50) {
                    var txp = g.ox + tvi * g.s;
                    if (txp > W - 8 || txp < g.ox - 4) continue;
                    dst(ctx, txp, g.gy, txp, g.gy + 9, C.gray, 1);
                    txt(ctx, tvi + '', txp, g.gy + 22, { size: 10, align: 'center', color: C.gray });
                }
                var cxp = g.ox, cyp = g.gy;
                pn(ctx, cxp - 24, cyp - 16, 46, 18, { radius: 3, fill: C.dark });
                arw(ctx, cxp + 14, cyp - 12, cxp + 14 + Math.cos(thRad) * 44, cyp - 12 - Math.sin(thRad) * 44, st.drag ? C.orange : C.dark, st.drag ? 9 : 7);
                txt(ctx, nf(st.v0, 0) + ' m/s @' + st.ang + '°', cxp - 4, cyp + 22, { size: 11, align: 'center', color: C.dark, weight: 'bold' });
                hintDrag(ctx, '👆 拖动发射角', cxp + 14 + Math.cos(thRad) * 44, cyp - 12 - Math.sin(thRad) * 44 - 30);
                var pv = [], pvT, k;
                for (k = 0; k <= 42; k++) {
                    pvT = st.last ? ((st.last.T * k) / 42) : (2 * st.v0 * Math.sin(thRad) / G) * (k / 42);
                    var pxx = st.v0 * Math.cos(thRad) * pvT, pyy = st.v0 * Math.sin(thRad) * pvT - 0.5 * G * pvT * pvT;
                    if (pyy < 0) break;
                    pv.push([g.ox + (1.4 + pxx) * g.s, g.gy - pyy * g.s]);
                }
                if (pv.length > 1) pline(ctx, pv, { color: C.gray, width: 1.6, dash: [6, 5] });
                for (i = 0; i < st.balls.length; i++) {
                    var bl = st.balls[i];
                    if (bl.trail.length > 1) pline(ctx, bl.trail.map(function (pt) { return [g.ox + pt[0] * g.s, g.gy - pt[1] * g.s]; }), { color: C.blue, width: 2 });
                    disk(ctx, g.ox + bl.x * g.s, g.gy - bl.y * g.s, 7, C.red, '#993333', 1.6);
                }
                for (i = 0; i < st.records.length; i++) {
                    var recP = g.ox + st.records[i].R * g.s;
                    if (recP > W - 4) continue;
                    pline(ctx, [[recP, g.gy], [recP, g.gy - 18]], { color: C.orange, width: 2 });
                    pline(ctx, [[recP, g.gy - 18], [recP + 12, g.gy - 14], [recP, g.gy - 10]], { color: C.orange, width: 1.5, fill: C.orange });
                }
                pn(ctx, W - 168, 12, 156, Math.min(10, st.records.length) * 20 + 34, { radius: 8, fill: 'rgba(255,255,255,0.94)', stroke: C.gray });
                txt(ctx, '最近发射记录', W - 90, 28, { size: 12, align: 'center', weight: 'bold' });
                txt(ctx, '角度', W - 140, 44, { size: 10.5, color: C.gray });
                txt(ctx, '射程(m)', W - 76, 44, { size: 10.5, color: C.gray });
                for (i = 0; i < st.records.length; i++) {
                    var rr = st.records[i], ryTop = 48 + i * 20;
                    if (i === st.records.length - 1) rc(ctx, W - 164, ryTop - 13, 148, 19, '#ffe9a8');
                    txt(ctx, rr.a.toFixed(0) + '°', W - 140, ryTop, { size: 11 });
                    txt(ctx, nf(rr.R, 1), W - 66, ryTop, { size: 11, weight: 'bold' });
                }
                var bx0 = W * 0.07, by0 = H * 0.585, bw2 = W * 0.80, bh2 = H * 0.36;
                var xv = 90, yv = Math.max(60, st.maxR * 1.18);
                pn(ctx, bx0, by0 - bh2, bw2, bh2, { radius: 8, fill: 'rgba(255,255,255,0.85)', stroke: C.gray });
                txt(ctx, '射程—角度 关系（峰值 ≈ 45°）', bx0 + bw2 / 2, by0 - bh2 + 18, { size: 13, align: 'center', weight: 'bold' });
                dst(ctx, bx0 + 42, by0 - 26, bx0 + bw2 - 16, by0 - 26, C.dark, 2);
                dst(ctx, bx0 + 42, by0 - 26, bx0 + 42, by0 - bh2 + 30, C.dark, 2);
                var tkA = KT().ticks(0, xv, 6), tkY = KT().ticks(0, yv, 4), ti;
                function pxX(av) { return bx0 + 42 + (bw2 - 58) * av / xv; }
                function pxY(rv) { return by0 - 26 - (bh2 - 56) * rv / yv; }
                for (ti = 0; ti < tkA.length; ti++) {
                    dst(ctx, pxX(tkA[ti]), by0 - 26, pxX(tkA[ti]), by0 - 21, C.gray, 1);
                    txt(ctx, tkA[ti] + '°', pxX(tkA[ti]), by0 - 8, { size: 10, align: 'center', color: C.gray });
                }
                for (ti = 0; ti < tkY.length; ti++) {
                    dst(ctx, bx0 + 37, pxY(tkY[ti]), bx0 + 42, pxY(tkY[ti]), C.gray, 1);
                    txt(ctx, nf(tkY[ti], 0), bx0 + 33, pxY(tkY[ti]) + 4, { size: 10, align: 'right', color: C.gray });
                }
                if (st.records.length >= 2) {
                    var sortedPts = st.records.slice().sort(function (a, b) { return a.a - b.a; }).map(function (r2) { return [pxX(r2.a), pxY(r2.R)]; });
                    pline(ctx, sortedPts, { color: C.gold || '#f39c12', width: 2.2 });
                }
                var bestIdx = 0;
                for (i = 1; i < st.records.length; i++) if (st.records[i].R > st.records[bestIdx].R) bestIdx = i;
                if (st.records.length > 0) {
                    for (i = 0; i < st.records.length; i++) disk(ctx, pxX(st.records[i].a), pxY(st.records[i].R), 4.5, C.blue, C.white, 1.4);
                    var bp = st.records[bestIdx];
                    disk(ctx, pxX(bp.a), pxY(bp.R), 6, C.gold || '#f1c40f', '#fff', 1.6);
                    txt(ctx, '★ 最佳≈45° ( ' + bp.a.toFixed(0) + '° → ' + nf(bp.R, 0) + 'm )', Math.min(pxX(bp.a) + 12, bx0 + bw2 - 130), Math.max(pxY(bp.R) - 12, by0 - bh2 + 34), { size: 12, weight: 'bold', color: '#b7791f' });
                } else {
                    txt(ctx, '尚无记录：点击【自动扫掠】后按 ▶ 播放，即可收集 15°~75° 数据点', bx0 + bw2 / 2, by0 - bh2 / 2, { size: 12.5, align: 'center', color: C.gray });
                }
                flushRows(st, [
                    row('本次射程 R', nf(st.last ? st.last.R : theory(st.ang).R, 1), 'm', C.red),
                    row('最大高度 H', nf(st.last ? st.last.Hm : theory(st.ang).Hm, 1), 'm', C.teal),
                    row('飞行时间 T', nf(st.last ? st.last.T : theory(st.ang).T, 2), 's', C.blue)
                ]);
            },
            hitTest: function (x, y) {
                var g = geo(), thRad = rad(st.ang);
                var pivX = g.ox + 14, pivY = g.gy - 12;
                var tipX = pivX + Math.cos(thRad) * 44, tipY = pivY - Math.sin(thRad) * 44;
                return Math.hypot(x - tipX, y - tipY) < 24;
            },
            onPointerDown: function (x, y) {
                var g = geo(), thRad = rad(st.ang);
                var pivX = g.ox + 14, pivY = g.gy - 12;
                var tipX = pivX + Math.cos(thRad) * 44, tipY = pivY - Math.sin(thRad) * 44;
                if (Math.hypot(x - tipX, y - tipY) < 24) st.drag = true;
            },
            onPointerMove: function (x, y) {
                if (!st.drag) return;
                var g = geo(), pivX = g.ox + 14, pivY = g.gy - 12;
                var a = Math.atan2(-(y - pivY), x - pivX) * 180 / Math.PI;
                st.ang = KT().clamp(Math.round(a), 15, 75);
            },
            onPointerUp: function () { st.drag = false; },
            reset: function () {
                st.balls = []; st.records = []; st.sweep = null; st.last = null;
                st.v0 = 45; st.ang = 45; st.maxView = 90; st.maxR = 60; st.drag = false;
            }
        };
    }

    /* ============ 注册到引擎注册表 ============ */
    window.EngineRegistry.register('mechanics', {
        create: function (cfg) {
            cfg = cfg || {};
            var mode = cfg.mode || MODE_BY_ID[cfg.id] || 'collision';
            var basic = !!cfg.basic || /basics/i.test(String(cfg.id || ''));
            switch (mode) {
                case 'collision': return buildCollision();
                case 'skate': return buildSkate(basic);
                case 'springs': return buildSprings(basic);
                case 'hooke': return buildHooke();
                case 'frictionbox': return buildFrictionBox();
                case 'pushcart': return buildPushCart();
                case 'seesaw': return buildSeesaw();
                case 'densityBlock': return buildDensityBlock();
                case 'pressurePool': return buildPressurePool();
                case 'energyforms': return buildEnergyForms();
                case 'projdata': return buildProjData();
                default: return buildCollision();
            }
        }
    });
})();