/**
 * 光学通用引擎（factory 名: 'optics'）
 * 覆盖实验ID：bending-light / geometric-optics / geometric-optics-basics / color-vision
 *
 * 契约：顶层除 window.EngineRegistry.register 外不触碰 document；
 *       DOM 交互一律经 loader（setKnowledge/setPresets/updateDataDisplay/showToast）。
 */
(function () {
    'use strict';

    /* ============ 小工具（纯函数，无 DOM） ============ */
    function KT() { return window.Kit; }
    function nf(v, d) { return KT().fmt(v, d === undefined ? 2 : d); }
    function deg(d) { return d * Math.PI / 180; }
    function row(lb, val, unit, color) { return { label: lb, value: val, unit: unit || '', color: color }; }
    function flushRows(st, rows) {
        if (!st.L || !st.L.updateDataDisplay) return;
        try {
            var key = JSON.stringify(rows);
            if (key === st._dcKey) return;
            st._dcKey = key;
            st.L.updateDataDisplay(rows);
        } catch (err) { /* 忽略 */ }
    }
    /* 加色混色：三通道 0~1 → '#rrggbb' */
    function mixRGB(r, g, b) {
        function hx(v) { v = Math.round(KT().clamp(v, 0, 255)); return (v < 16 ? '0' : '') + v.toString(16); }
        return '#' + hx(r * 255) + hx(g * 255) + hx(b * 255);
    }
    function namedColor(r, g, b) { // 最近邻命名（教学提示用）
        var table = [['白', 255, 255, 255], ['黄', 255, 255, 0], ['青', 0, 255, 255], ['品红', 255, 0, 255],
                     ['红', 255, 0, 0], ['绿', 0, 255, 0], ['蓝', 0, 60, 255], ['灰', 128, 128, 128], ['黑', 0, 0, 0]];
        var best = '', bd = 1e9, i;
        for (i = 0; i < table.length; i++) {
            var dd = Math.pow(r - table[i][1], 2) + Math.pow(g - table[i][2], 2) + Math.pow(b - table[i][3], 2);
            if (dd < bd) { bd = dd; best = table[i][0]; }
        }
        return best;
    }
    /* 水平中线分界的上下介质底色 */
    function mediaTint(n) {
        if (Math.abs(n - 1.33) < 0.01) return KT().rgba('#2980b9', 0.20);
        if (Math.abs(n - 1.50) < 0.01) return KT().rgba('#95a5a6', 0.26);
        return 'rgba(236,240,241,0.05)';
    }
    /* 可拖拽元素悬停提示标签（自包含，不依赖任何状态） */
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.fillStyle = '#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }

    /* ============ 各模式默认状态 ============ */
    var MODES = {
        bending: { n1: 1.00, n2: 1.50, thi: 40, norm: true },   // 上/下折射率、入射角(相对法线°)、显示法线
        lens: { f: 180, h: 90, u: 260, num: false },            // 焦距px(±)、物高、物距、显示光线编号
        lensBasics: { u: 220, f: 140 },                          // 物距、焦距
        vision: { ir: 0.6, ig: 0.6, ib: 0.6 }                    // R/G/B 强度 0~1
    };
    function def(key) {
        var o = JSON.parse(JSON.stringify(MODES[key]));
        o.mode = key;
        return o;
    }

    /* ============================================================
       Mode 1  bending —— 折射光线 (bending-light)
       Snell 定律 n₁·sinθᵢ = n₂·sinθₜ；sinθₜ>1 时全内反射
       ============================================================ */
    function buildBending() {
        var st = def('bending');
        st.dragSrc = false;
        var MED = [['空气', 1.00], ['水', 1.33], ['玻璃', 1.50]];
        function medName(n) { for (var i = 0; i < 3; i++) if (Math.abs(MED[i][1] - n) < 0.01) return MED[i][0]; return '?'; }
        /* 量角器：整圈刻度（0° 指向正上方，即法线方向），每 10° 一格，每 30° 标数 */
        function protractor(ctx, K, C, px, py, rIn, rOut) {
            ctx.save(); ctx.strokeStyle = K.rgba(C.white, 0.32); ctx.lineWidth = 1;
            [rIn, rOut].forEach(function (r) {
                ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
            });
            var a, rad;
            for (a = 0; a < 360; a += 10) {
                rad = deg(a);
                var dxs = Math.sin(rad), dys = -Math.cos(rad);
                ctx.beginPath();
                ctx.moveTo(px + dxs * rIn, py + dys * rIn);
                ctx.lineTo(px + dxs * rOut, py + dys * rOut);
                ctx.stroke();
            }
            /* 与法线夹角标签：对竖直法线的偏角（上半圆±30/45/60/90，下半圆同值镜像） */
            [-60, -45, -30, 30, 45, 60, -120, -135, -150, 120, 135, 150, -90, 90].forEach(function (av) {
                rad = deg(av);
                var nn = ((av % 360) + 360) % 360;
                var lb = String(nn <= 90 || nn >= 270 ? Math.min(nn, 360 - nn) : Math.round(Math.abs(nn - 180)));
                K.label(ctx, lb + '°', px + Math.sin(rad) * (rOut + 16), py - Math.cos(rad) * (rOut + 16),
                    { size: 10, align: 'center', color: K.rgba(C.white, 0.55) });
            });
            ctx.restore();
        }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>折射定律（Snell 定律）</strong>：光经过两种介质界面时传播方向偏折。</p>' +
                    '<div class="formula">n₁ · sinθᵢ = n₂ · sinθₜ</div>' +
                    '<div class="formula">反射定律：θ 反射 ＝ θ 入射</div>' +
                    '<ul style="padding-left:20px"><li>光从光密介质射向光疏介质（如玻璃→空气），入射角超过临界角时发生全内反射</li>' +
                    '<li>临界角 θc 满足 sinθc = n₂/n₁（仅当 n₁&gt;n₂ 存在）</li>' +
                    '<li>拖动光源手柄或滑动滑块改变入射角</li></ul>'
                );
                L.setPresets([
                    { name: '空气→玻璃 45°', apply: function () { st.n1 = 1.00; st.n2 = 1.50; st.thi = 45; } },
                    { name: '玻璃→空气 全反射', apply: function () { st.n1 = 1.50; st.n2 = 1.00; st.thi = 48; } },
                    { name: '水中看天 49°掠射', apply: function () { st.n1 = 1.33; st.n2 = 1.00; st.thi = 41; } }
                ]);
            },
            getControls: function () {
                function medOpts(cur) {
                    return MED.map(function (m) { return { value: String(m[1]), label: m[0] + ' n=' + m[1].toFixed(2) }; });
                }
                return [
                    { id: 'bd_n1', type: 'select', label: '上方介质', value: String(st.n1), options: medOpts(st.n1),
                        onChange: function (v) { st.n1 = parseFloat(v); } },
                    { id: 'bd_n2', type: 'select', label: '下方介质', value: String(st.n2), options: medOpts(st.n2),
                        onChange: function (v) { st.n2 = parseFloat(v); } },
                    { id: 'bd_thi', type: 'slider', label: '入射角 θᵢ', min: 10, max: 80, step: 1, unit: '°', value: st.thi,
                        onChange: function (v) { st.thi = v; } },
                    { id: 'bd_norm', type: 'checkbox', label: '显示法线', value: !!st.norm,
                        onChange: function (v) { st.norm = v; } }
                ];
            },
            update: function () { /* 静态几何光学，无时间演化 */ },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS, px = W * 0.46, py = H * 0.5;
                /* 上下介质着色 + 中线 */
                ctx.fillStyle = mediaTint(st.n1); ctx.fillRect(0, 0, W, py);
                ctx.fillStyle = mediaTint(st.n2); ctx.fillRect(0, py, W, H - py);
                K.dashLine(ctx, 0, py, W, py, { color: K.rgba(C.white, 0.6), dash: [8, 6], width: 1.6 });
                K.chip(ctx, '上方：' + medName(st.n1) + ' n=' + nf(st.n1, 2), 18, 16, { size: 13, bg: K.rgba(C.dark, 0.7), color: C.sky });
                K.chip(ctx, '下方：' + medName(st.n2) + ' n=' + nf(st.n2, 2), 18, py + 14, { size: 13, bg: K.rgba(C.dark, 0.7), color: C.orange });
                if (st.norm) K.dashLine(ctx, px, 40, px, H - 40, { color: K.rgba(C.yellow, 0.7), dash: [4, 6], width: 1.4 });
                protractor(ctx, K, C, px, py, 64, 84);
                /* 几何量 */
                var th = deg(st.thi), dLen = Math.min(W * 0.34, 250), sinT = st.n1 / st.n2 * Math.sin(th);
                var tir = sinT > 1;
                var srcX = px - Math.sin(th) * dLen, srcY = py - Math.cos(th) * dLen;
                /* 入射线（激光红）+ 光源手柄 */
                K.arrow(ctx, srcX, srcY, px, py, { color: C.red, width: 3, head: 12 });
                K.circle(ctx, srcX, srcY, st.dragSrc ? 11 : 9, { fill: C.light, stroke: C.dark, lineWidth: 2 });
                K.label(ctx, '光源', srcX - 2, srcY - 18, { size: 12, align: 'center', weight: 'bold', color: C.light });
                hintDrag(ctx, '👆 拖动光源', srcX, srcY - 40);
                /* 反射线 θr=θi */
                var refX = px + Math.sin(th) * dLen * 0.92, refY = py - Math.cos(th) * dLen * 0.92;
                K.arrow(ctx, px, py, refX, refY, { color: C.pink, width: 2.4, head: 10 });
                K.chip(ctx, 'θᵣ = ' + nf(st.thi, 0) + '°', refX - 40, refY - 26, { size: 12, bg: K.rgba(C.dark, 0.7), color: C.pink });
                /* 折射：全内反射时画红色虚线短杆提示；否则按 Snell 出射 */
                if (tir) {
                    var tx = px + Math.sin(th) * 58, ty = py + Math.cos(th) * 58;
                    K.dashLine(ctx, px, py, tx, ty, { color: C.red, dash: [5, 5], width: 2.6 });
                    K.chip(ctx, '全内反射！θt 不存在', px + 18, py + 26, { size: 13, bg: K.rgba(C.dark, 0.75), color: C.red });
                } else {
                    var tt = Math.asin(sinT);
                    var frX = px + Math.sin(tt) * (H - py - 46), frY = py + Math.cos(tt) * (H - py - 46);
                    K.arrow(ctx, px, py, frX, frY, { color: C.teal, width: 3, head: 12 });
                    K.chip(ctx, 'θt = ' + nf(tt / Math.PI * 180, 1) + '°', frX - 46, Math.min(frY - 20, H - 24), { size: 12, bg: K.rgba(C.dark, 0.7), color: C.teal });
                }
                /* sinθ 对比 mini 表 */
                K.panel(ctx, W - 178, H - 96, 160, 78, { fill: 'rgba(255,255,255,0.90)', stroke: C.gray, radius: 8 });
                K.label(ctx, 'Snell 验证表', W - 98, H - 82, { size: 12, align: 'center', weight: 'bold', color: C.dark });
                K.label(ctx, 'sinθ₁ = ' + nf(Math.sin(th), 3) + ' ×' + nf(st.n1, 2), W - 164, H - 62, { size: 12, color: C.blue });
                K.label(ctx, tir ? 'sinθ₂ > 1 → 全反射' : 'sinθ₂ = ' + nf(sinT, 3),
                    W - 164, H - 42, { size: 12, color: tir ? C.red : C.teal });
                flushRows(st, [
                    row('入射角 θᵢ', nf(st.thi, 0), '°', C.red),
                    row('反射角 θᵣ', nf(st.thi, 0), '°', C.pink),
                    row('折射角 θt', tir ? '全内反射' : nf(Math.asin(sinT) / Math.PI * 180, 1), tir ? '' : '°', tir ? C.red : C.teal),
                    row('n₁·sinθᵢ / n₂', nf(st.n1 * Math.sin(th), 3) + ' / ' + nf(st.n2, 2), '', C.gray)
                ]);
            },
            onPointerDown: function (x, y) {
                var th = deg(st.thi), dLen = Math.min((st.W || 800) * 0.34, 250);
                var px = (st.W || 800) * 0.46, py = (st.H || 600) * 0.5;
                if (Math.hypot(x - (px - Math.sin(th) * dLen), y - (py - Math.cos(th) * dLen)) < 18) st.dragSrc = true;
            },
            hitTest: function (x, y) {
                var th = deg(st.thi), dLen = Math.min((st.W || 800) * 0.34, 250);
                var px = (st.W || 800) * 0.46, py = (st.H || 600) * 0.5;
                return Math.hypot(x - (px - Math.sin(th) * dLen), y - (py - Math.cos(th) * dLen)) < 18;
            },
            onPointerMove: function (x, y) {                                 // 手柄约束在左上半圆：tanθ=|dx|/|dy|
                if (!st.dragSrc) return;
                var px = (st.W || 800) * 0.46, py = (st.H || 600) * 0.5;
                st.thi = KT().clamp(Math.round(deg(Math.atan2(px - x, Math.max(py - y, 6))) ), 10, 80);
            },
            onPointerUp: function () { st.dragSrc = false; },
            reset: function () { Object.assign(st, def('bending')); st.dragSrc = false; }
        };
    }

    /* ============================================================
       Mode 2  lens —— 几何光学 (geometric-optics)
       薄透镜旁轴光线转移方程：出射斜率 m′ = m − yL/f；v=uf/(u−f)，m=−v/u
       ============================================================ */
    function buildLens() {
        var st = def('lens');
        st.drag = '';
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>薄透镜成像公式</strong>：</p>' +
                    '<div class="formula">1/f = 1/u + 1/v　　放大率 m = −v/u</div>' +
                    '<ul style="padding-left:20px"><li>凸透镜 f&gt;0 会聚，凹透镜 f&lt;0 发散（图形随之变化）</li>' +
                    '<li>u&gt;f：实像倒立于另一侧；u&lt;f（凸）：同侧虚像正立放大</li>' +
                    '<li>三条特殊光线：①平行主轴→过焦点 ②过光心不偏折 ③过前焦点→平行射出</li>' +
                    '<li>虚线是折射光线的反向延长线，延长线交点即虚像位置</li></ul>'
                );
                L.setPresets([
                    { name: 'u>2f 实像缩小', apply: function () { st.f = 120; st.u = 300; st.h = 70; } },
                    { name: 'f<u<2f 实像放大', apply: function () { st.f = 200; st.u = 280; st.h = 60; } },
                    { name: 'u<f 放大镜', apply: function () { st.f = 240; st.u = 120; st.h = 70; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'ln_f', type: 'slider', label: '焦距 f（正凸/负凹）', min: -300, max: 300, step: 10, unit: ' px', value: st.f,
                        onChange: function (v) {                                       // |f| 限幅 ≥100 且 ≠0
                            if (Math.abs(v) < 100) v = v > 0 ? 100 : (v < 0 ? -100 : 100);
                            st.f = v;
                        } },
                    { id: 'ln_num', type: 'checkbox', label: '显示光线路径编号 ①②③', value: !!st.num,
                        onChange: function (v) { st.num = v; } }
                ];
            },
            update: function () { /* 静态成像 */ },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS, LX = Math.round(W * 0.44), axY = Math.round(H * 0.52);
                var u = st.u, f = st.f, h = st.h;
                var v = u * f / (u - f), m = -v / u;                               // 透镜公式与放大率（符号约定：v>0 在异侧）
                var fitMax = Math.max(h, Math.abs(m) * h, 130);
                var sc = KT().clamp(H * 0.32 / fitMax, 0.35, 1.25);                // 垂直自适应比例尺
                st._lx = LX; st._ay = axY; st._sc = sc;
                function SX(wx) { return LX + wx * sc; }
                function SY(wy) { return axY - wy * sc; }
                /* 主轴 + 焦点/2F 刻度 */
                K.dashLine(ctx, 20, axY, W - 20, axY, { color: K.rgba(C.white, 0.35), dash: [2, 5], width: 1.4 });
                function focalMark(wx, nm) {
                    var sxm = SX(wx);
                    if (sxm < 26 || sxm > W - 26) return;
                    K.label(ctx, nm, sxm, axY + 16, { size: 12, align: 'center', color: C.orange, weight: 'bold' });
                    K.arrow(ctx, sxm, axY + 6, sxm, axY + 1, { color: C.orange, width: 1.6, head: 5 });
                }
                focalMark(f, "F'"); focalMark(-f, 'F'); focalMark(2 * f, "2F'"); focalMark(-2 * f, '2F');
                /* 透镜形状：凸透镜双弧外鼓 / 凹透镜腰部收窄（厚度∝1/|f|） */
                var lw2 = KT().clamp(9000 / Math.abs(f), 12, 26), signF = f > 0 ? 1 : -1;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(LX, axY - h * sc * 1.15);
                ctx.quadraticCurveTo(LX + signF * lw2 * 2.4, axY, LX, axY + h * sc * 1.15);
                ctx.quadraticCurveTo(LX - signF * lw2 * 2.4, axY, LX, axY - h * sc * 1.15);
                ctx.closePath();
                ctx.fillStyle = K.rgba(C.teal, 0.28); ctx.fill();
                ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.stroke();
                ctx.restore();
                /* 物体箭头（蓝），尖端 tip=(−u,h) 世界坐标 */
                var tipX = SX(-u), tipY = SY(h);
                K.panel(ctx, tipX - 7, axY - 10, 14, 10, { fill: K.rgba(C.blue, 0.85), radius: 3 });   // 底座手柄
                K.arrow(ctx, tipX, axY - 2, tipX, tipY, { color: C.blue, width: 3.5, head: 11 });
                hintDrag(ctx, '👆 拖动物距', tipX, axY - 24);
                hintDrag(ctx, '👆 拖动物高', tipX, tipY - 14);
                /* 三条特殊光线：通用折射转移 mOut=mIn−yL/f */
                function castRay(mIn, yLw, no) {
                    var mOut = mIn - yLw / f;                                      // ★ 薄透镜转移方程
                    var xA = LX, yAp = SY(yLw);
                    K.arrow(ctx, SX(-u), SY(h), xA, yAp, { color: C.yellow, width: 2, head: 8 });  // 入射段
                    /* 出射段：沿斜率步进到画布边缘 */
                    var step = 8, cx2 = xA, cy2 = yAp, lim = 400;
                    ctx.save(); ctx.strokeStyle = C.yellow; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(xA, yAp);
                    for (var q = 0; q < lim; q++) {
                        cx2 += step; cy2 += mOut * step * sc;
                        if (cx2 > W - 10 || cy2 < 10 || cy2 > H - 10) break;
                        ctx.lineTo(cx2, cy2);
                    }
                    ctx.stroke(); ctx.restore();
                    /* 虚像时所有出射线的反向延长线（虚线）精确汇聚于像尖 */
                    if (isVirtual) K.dashLine(ctx, xA, yAp, SX(v), SY(m * h), { color: K.rgba(C.orange, 0.55), dash: [5, 5], width: 1.6 });
                    if (st.num) {
                        K.chip(ctx, ['①', '②', '③'][no], (LX + SX(-u)) / 2 - 8, (SY(h) + yAp) / 2 - 22, { size: 13, bg: K.rgba(C.dark, 0.75), color: C.yellow });
                    }
                }
                var isVirtual = v < 0;                                             // 同侧成虚像
                castRay(0, h, 0);                                                  // ① 平行主轴 → 过 F'
                castRay(-h / u, 0, 1);                                             // ② 过光心不偏折
                castRay(h / (f - u), h * f / (f - u), 2);                          // ③ 过前焦点 → 平行射出
                /* 像箭头（实像红实线 / 虚像紫虚线），v 超界用文字提示 */
                var imgSX = SX(v), imgSY = SY(m * h);
                if (imgSX > 24 && imgSX < W - 24) {
                    if (isVirtual) {
                        K.dashLine(ctx, imgSX, axY, imgSX, imgSY, { color: C.purple, dash: [6, 4], width: 3 });
                        ctx.save(); ctx.strokeStyle = C.purple; ctx.lineWidth = 2;
                        var hh2 = m * h >= 0 ? 1 : -1;
                        ctx.beginPath();
                        ctx.moveTo(imgSX - 6, imgSY + 8 * hh2); ctx.lineTo(imgSX, imgSY); ctx.lineTo(imgSX + 6, imgSY + 8 * hh2);
                        ctx.stroke(); ctx.restore();
                    } else {
                        K.arrow(ctx, imgSX, axY, imgSX, imgSY, { color: C.red, width: 3.5, head: 11 });
                    }
                    K.chip(ctx, (isVirtual ? '虚像 ' : '实像 ') + 'm=' + nf(m, 2), imgSX - 36, Math.min(imgSY - (m * h >= 0 ? 22 : -4), H - 26), { size: 12, bg: K.rgba(C.dark, 0.72), color: isVirtual ? C.purple : C.red });
                } else {
                    K.chip(ctx, '像在视野外 v=' + nf(v, 0) + ' px', W / 2 - 70, 44, { size: 13, bg: K.rgba(C.dark, 0.72), color: C.orange });
                }
                K.label(ctx, isVirtual ? '同侧（物侧）' : '异侧', (LX + Math.max(imgSX, LX + 40)) / 2, axY + H * 0.32, { size: 12, align: 'center', color: C.gray });
                natureChip(ctx, K, C, W, st, u, f, m);
                flushRows(st, [
                    row('物距 u', nf(u, 0), 'px', C.blue),
                    row('像距 v', nf(v, 0), 'px', C.red),
                    row('放大率 m=v/u', nf(m, 3), '', C.orange),
                    row('像的性质', natureText(u, f, m), '', C.purple)
                ]);
            },
            onPointerDown: function (x, y) {
                var SXo = st._lx - st.u * st._sc, baseD = Math.hypot(x - SXo, y - st._ay);
                var tipD = Math.hypot(x - SXo, y - (st._ay - st.h * st._sc));
                if (baseD < 16) st.drag = 'u';
                else if (tipD < 16) st.drag = 'h';
            },
            hitTest: function (x, y) {
                var SXo = st._lx - st.u * st._sc, baseD = Math.hypot(x - SXo, y - st._ay);
                var tipD = Math.hypot(x - SXo, y - (st._ay - st.h * st._sc));
                return baseD < 16 || tipD < 16;
            },
            onPointerMove: function (x, y) {
                if (st.drag === 'u') {                                             // 底座手柄横向拖动改物距
                    var nu = (st._lx - x) / st._sc;
                    nu = KT().clamp(nu, 60, Math.max(60, st._lx * 0.94));
                    if (Math.abs(nu - st.f) < 8) nu += (nu > st.f ? 8 : -8);       // 避开 u=f 发散奇点
                    st.u = Math.round(nu);
                } else if (st.drag === 'h') {
                    st.h = Math.round(KT().clamp((st._ay - y) / st._sc, 18, Math.min(170, st._ay - 40)));
                }
            },
            onPointerUp: function () { st.drag = ''; },
            reset: function () { Object.assign(st, def('lens')); st.drag = ''; }
        };
        function natureText(u, f, m) {
            if (f > 0) {
                if (Math.abs(u - f) < 1e-6) return '不成像（出射平行光）';
                if (u > f) return '实像 · 倒立' + (Math.abs(m) > 1.02 ? '放大' : Math.abs(m) < 0.98 ? '缩小' : '等大');
                return '虚像 · 正立放大';
            }
            return '虚像 · 正立缩小';
        }
        function natureChip(ctx, K, C, W, st, u, f, m) {
            var t = natureText(u, f, m), col = t.indexOf('实像') >= 0 ? C.red : t.indexOf('不成像') >= 0 ? C.gray : C.purple;
            K.chip(ctx, '像的性质：' + t, W / 2 - 74, 14, { size: 13, bg: K.rgba(C.dark, 0.75), color: col, pad: 8 });
        }
    }

    /* ============================================================
       Mode 3  lensBasics —— 几何光学基础 (geometric-optics-basics)
       简化版：蜡烛 emoji 替代箭头，两条主光线，无拖拽
       ============================================================ */
    function buildLensBasics() {
        var st = def('lensBasics');
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>成像规律速查（凸透镜 f&gt;0）</strong>：</p>' +
                    '<div class="formula">1/f = 1/u + 1/v　　m = −v/u</div>' +
                    '<ul style="padding-left:20px"><li>u&gt;2f：倒立缩小实像（照相机）</li>' +
                    '<li>f&lt;u&lt;2f：倒立放大实像（投影仪）</li>' +
                    '<li>u&lt;f：正立放大虚像（放大镜）；u=f 不成像</li></ul>'
                );
                L.setPresets([
                    { name: '照相机 u=2.5f', apply: function () { st.f = 120; st.u = 300; } },
                    { name: '投影仪 u=1.5f', apply: function () { st.f = 180; st.u = 270; } },
                    { name: '放大镜 u=0.5f', apply: function () { st.f = 240; st.u = 120; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'lb_u', type: 'slider', label: '物距 u', min: 80, max: 420, step: 5, unit: ' px', value: st.u,
                        onChange: function (v) { st.u = v; } },
                    { id: 'lb_f', type: 'slider', label: '焦距 f（正凸/负凹）', min: -280, max: 280, step: 10, unit: ' px', value: st.f,
                        onChange: function (v) {
                            if (Math.abs(v) < 100) v = v > 0 ? 100 : (v < 0 ? -100 : 100);
                            st.f = v;
                        } }
                ];
            },
            update: function () { /* 静态 */ },
            render: function (ctx, W, H, t) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS, LX = Math.round(W * 0.52), axY = Math.round(H * 0.56);
                var u = st.u, f = st.f, hC = 56;                                   // 蜡烛逻辑高度
                var v = u * f / (u - f), m = -v / u;
                var sc = KT().clamp(H * 0.3 / Math.max(hC, Math.abs(m) * hC, 120), 0.4, 1.3);
                function SX(wx) { return LX + wx * sc; }
                function SY(wy) { return axY - wy * sc; }
                K.grid(ctx, W, H, { step: 50 });
                K.dashLine(ctx, 20, axY, W - 20, axY, { color: K.rgba(C.white, 0.3), dash: [2, 5], width: 1.4 });
                [["F'", f], ['F', -f]].forEach(function (mk) {
                    var xm = SX(mk[1]);
                    if (xm > 24 && xm < W - 24) K.label(ctx, mk[0], xm, axY + 16, { size: 13, align: 'center', color: C.orange, weight: 'bold' });
                });
                drawLensShape(ctx, K, C, LX, axY, f, hC, sc);
                drawCandle(ctx, K, C, SX(-u), SY(0), hC * sc, t);
                /* 两条简化主光线：① 平行→折向 F'（凸）/ 背离 F'（凹） ② 过光心直线 */
                var isV = v < 0, imgSX = SX(v), imgSY = SY(m * hC);
                var yTopW = hC * 0.86, yT = SY(yTopW);
                K.arrow(ctx, SX(-u), yT, LX, yT, { color: C.yellow, width: 2.2, head: 8 });            // 光线①入射
                var txw = Math.abs(f), baseSlope = (axY - yT) / Math.max(SX(txw) - LX, 1);
                outRay(K, ctx, LX, yT, f > 0 ? baseSlope : -baseSlope, W, H, C.yellow);                 // 光线①出射
                K.arrow(ctx, SX(-u), yT, LX, axY, { color: C.green, width: 2.2, head: 8 });             // 光线②过光心
                outRay(K, ctx, LX, axY, (axY - yT) / Math.max(LX - SX(-u), 1), W, H, C.green);          // 光线②直线延伸
                if (isV) {                                                                             // 虚像：反向延长虚线交于像尖
                    K.dashLine(ctx, LX, yT, imgSX, imgSY, { color: K.rgba(C.yellow, 0.6), dash: [5, 5], width: 1.5 });
                    K.dashLine(ctx, LX, axY, imgSX, imgSY, { color: K.rgba(C.green, 0.6), dash: [5, 5], width: 1.5 });
                }
                /* 像：蜡烛轮廓（实=暖红实线 / 虚=紫虚线） */
                if (imgSX > 24 && imgSX < W - 24) drawCandleGhost(ctx, K, isV ? C.purple : C.red, imgSX, SY(0), hC * sc * Math.abs(m), isV, m >= 0);
                var nat = basicNature(u, f, m);
                var col = nat.indexOf('实像') >= 0 ? C.red : C.purple;
                K.chip(ctx, '成像性质：' + nat, W / 2 - 66, 20, { size: 15, bg: K.rgba(C.dark, 0.78), color: col, pad: 12 });
                flushRows(st, [
                    row('物距 u', nf(u, 0), 'px', C.blue),
                    row('像距 v', nf(v, 0), 'px', C.red),
                    row('放大率 m', nf(m, 2), '', C.orange),
                    row('性质', nat, '', col)
                ]);
            },
            reset: function () { Object.assign(st, def('lensBasics')); }
        };
        function basicNature(u, f, m) {
            if (f < 0) return '凹透镜 · 虚像正立缩小';
            if (Math.abs(u - f) < 1e-6) return 'u=f 不成像';
            if (u < f) return '虚像 · 正立放大';
            return '实像 · 倒立' + (Math.abs(m) > 1.02 ? '放大' : Math.abs(m) < 0.98 ? '缩小' : '等大');
        }
        /* 出射光线：从透镜面上 (x0,y0) 以屏幕斜率 slope 向右延伸到画布边缘并带箭头 */
        function outRay(K, ctx, x0, y0, slope, W, H, color) {
            var step = 8, cx = x0, cy = y0;
            for (var q = 0; q < 400; q++) {
                cx += step; cy += slope * step;
                if (cx > W - 10 || cy < 10 || cy > H - 10) break;
            }
            K.arrow(ctx, x0, y0, Math.min(cx, W - 10), cy, { color: color, width: 2.2, head: 8 });
        }
        function drawLensShape(ctx, K, C, LX, axY, f, hC, sc) {
            var top = axY - hC * sc * 1.05, bot = axY + hC * sc * 1.05;
            var bulge = KT().clamp(8000 / Math.abs(f), 10, 24), sg = f > 0 ? 1 : -1;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(LX, top);
            ctx.quadraticCurveTo(LX + sg * bulge * 2.2, axY, LX, bot);
            ctx.quadraticCurveTo(LX - sg * bulge * 2.2, axY, LX, top);
            ctx.closePath();
            ctx.fillStyle = K.rgba(C.teal, 0.28); ctx.fill();
            ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
        }
        /* 蜡烛主体：emoji + 底部火苗光晕微闪 */
        function drawCandle(ctx, K, C, x, baseY, hpix, t) {
            var flick = 1 + 0.06 * Math.sin(t * 7);
            K.circle(ctx, x, baseY - hpix - 8, 9 * flick, { fill: K.rgba(C.orange, 0.22) });
            K.label(ctx, '🕯️', x, baseY - hpix * 0.55, { size: Math.max(30, hpix * 0.9), align: 'center', baseline: 'middle' });
            K.label(ctx, '物体（蜡烛）', x, baseY + 16, { size: 11, align: 'center', color: C.light });
        }
        /* 像侧蜡烛轮廓：线框烛身 + 端点火苗圆点（倒立像火苗在下端） */
        function drawCandleGhost(ctx, K, col, x, baseY, hpix, dashed, upright) {
            var tipY = baseY + (upright ? -hpix : hpix);
            ctx.save();
            ctx.globalAlpha = dashed ? 0.7 : 0.9;
            ctx.strokeStyle = col; ctx.lineWidth = dashed ? 2 : 2.5;
            if (dashed) ctx.setLineDash([5, 4]);
            ctx.strokeRect(x - 7, Math.min(baseY, tipY), 14, Math.abs(tipY - baseY));
            ctx.setLineDash([]);
            ctx.fillStyle = K.rgba(C.orange, 0.85);
            ctx.beginPath(); ctx.arc(x, tipY + (upright ? -6 : 6), 5, 0, Math.PI * 2); ctx.fill();
            K.label(ctx, upright ? '实像（倒立）' : '虚像（正立）', x, baseY + 16, { size: 11, align: 'center', color: col });
            ctx.restore();
        }
    }

    /* ============================================================
       Mode 4  vision —— 色彩视觉 (color-vision)
       加色混合 RGB：通道叠加 lighter 合成；视锥响应近似线性加权
       ============================================================ */
    function buildVision() {
        var st = def('vision');
        /* 视锥灵敏度矩阵（近似线性）：L≈红主导 M≈绿主导 S≈蓝主导 */
        var CONE = [
            { nm: 'L 视锥（红敏）', w: [0.92, 0.22, 0.04], col: '#e74c3c' },
            { nm: 'M 视锥（绿敏）', w: [0.16, 0.88, 0.08], col: '#27ae60' },
            { nm: 'S 视锥（蓝敏）', w: [0.03, 0.07, 0.95], col: '#3498db' }
        ];
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>加色法三原色</strong>：红(R)+绿(G)+蓝(B)——屏幕显色的基本原理。</p>' +
                    '<div class="formula">R + G = 黄　G + B = 青　B + R = 品红　R+G+B = 白</div>' +
                    '<ul style="padding-left:20px"><li>人眼视网膜三类视锥细胞（L/M/S）对不同波长的敏感度不同</li>' +
                    '<li>大脑综合三种视锥的响应比例形成颜色感觉</li>' +
                    '<li>三束光重叠区域使用加色合成（globalCompositeOperation=lighter）</li></ul>'
                );
                L.setPresets([
                    { name: '红+绿=黄', apply: function () { st.ir = 1; st.ig = 1; st.ib = 0; } },
                    { name: '蓝+绿=青', apply: function () { st.ir = 0; st.ig = 1; st.ib = 1; } },
                    { name: '全开=白', apply: function () { st.ir = 1; st.ig = 1; st.ib = 1; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'vs_r', type: 'slider', label: '红光强度 R', min: 0, max: 100, step: 5, unit: ' %', value: Math.round(st.ir * 100),
                        onChange: function (v) { st.ir = v / 100; } },
                    { id: 'vs_g', type: 'slider', label: '绿光强度 G', min: 0, max: 100, step: 5, unit: ' %', value: Math.round(st.ig * 100),
                        onChange: function (v) { st.ig = v / 100; } },
                    { id: 'vs_b', type: 'slider', label: '蓝光强度 B', min: 0, max: 100, step: 5, unit: ' %', value: Math.round(st.ib * 100),
                        onChange: function (v) { st.ib = v / 100; } },
                    { id: 'vs_py', type: 'button', label: '预设：红+绿=黄', action: function () { st.ir = 1; st.ig = 1; st.ib = 0; } },
                    { id: 'vs_pc', type: 'button', label: '预设：蓝+绿=青', action: function () { st.ir = 0; st.ig = 1; st.ib = 1; } },
                    { id: 'vs_pw', type: 'button', label: '预设：全开=白', action: function () { st.ir = 1; st.ig = 1; st.ib = 1; } }
                ];
            },
            update: function () { /* 无时间项 */ },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS;
                var sx = Math.round(W * 0.38), sy = 24, sw = W - sx - 24, sh = H - sy - 24;
                if (sw <= 0 || sh <= 0) return;   // 画布尚未布局完成时跳过
                /* 黑色屏幕面板 */
                K.panel(ctx, sx, sy, sw, sh, { fill: '#000000', stroke: C.gray, radius: 12 });
                K.label(ctx, '屏幕', sx + sw - 26, sy + sh - 14, { size: 11, color: 'rgba(255,255,255,0.35)' });
                /* 三圆布置：倒三角交叠于屏心 */
                var ccx = sx + sw * 0.5, ccy = sy + sh * 0.5, rr = Math.min(sw, sh) * 0.26;
                var P = [[ccx - rr * 0.62, ccy - rr * 0.28], [ccx + rr * 0.62, ccy - rr * 0.28], [ccx, ccy + rr * 0.55]];
                var SRC = [[sx * 0.42, sy + sh * 0.30], [sx * 0.42, sy + sh * 0.52], [sx * 0.42, sy + sh * 0.74]];
                var CHAN = [[255, 60, 60, st.ir], [60, 255, 60, st.ig], [80, 110, 255, st.ib]];
                var NAMES = ['R', 'G', 'B'], i;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';                        // ★ 加色混合核心
                for (i = 0; i < 3; i++) {
                    var ch = CHAN[i];
                    if (ch[3] <= 0.001) continue;
                    var gx = ctx.createRadialGradient(P[i][0], P[i][1], rr * 0.1, P[i][0], P[i][1], rr);
                    gx.addColorStop(0, 'rgba(' + ch[0] + ',' + ch[1] + ',' + ch[2] + ',' + ch[3] * 0.85 + ')');
                    gx.addColorStop(1, 'rgba(' + ch[0] + ',' + ch[1] + ',' + ch[2] + ',0)');
                    ctx.fillStyle = gx;
                    ctx.beginPath(); ctx.arc(P[i][0], P[i][1], rr, 0, 6.2832); ctx.fill();
                    beam(ctx, SRC[i][0], SRC[i][1], P[i][0], P[i][1], rr * 0.9, ch, ch[3]);
                }
                ctx.restore();
                for (i = 0; i < 3; i++) flashlight(ctx, K, C, SRC[i][0], SRC[i][1], NAMES[i], CHAN[i]);
                conePanel(ctx, K, C, 26, H - 218, CONE, st);
                colorReadout(ctx, K, C, sx + 14, sy + 14, st);
                flushRows(st, visionRows(st));
            },
            reset: function () { Object.assign(st, def('vision')); }
        };
        /* 光束三角形：从手电口到目标圆，宽度≈圆半径 */
        function beam(ctx, x1, y1, x2, y2, halfW, ch, inten) {
            var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
            var ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
            ctx.fillStyle = 'rgba(' + ch[0] + ',' + ch[1] + ',' + ch[2] + ',' + inten * 0.30 + ')';
            ctx.beginPath();
            ctx.moveTo(x1 + nx * 7, y1 + ny * 7);
            ctx.lineTo(x2 + nx * halfW, y2 + ny * halfW);
            ctx.lineTo(x2 - nx * halfW, y2 - ny * halfW);
            ctx.lineTo(x1 - nx * 7, y1 - ny * 7);
            ctx.closePath(); ctx.fill();
        }
        function flashlight(ctx, K, C, x, y, nm, ch) {
            K.panel(ctx, x - 12, y - 15, 30, 30, { fill: 'rgba(45,52,54,0.95)', stroke: C.gray, radius: 6 });
            K.panel(ctx, x + 17, y - 9, 8, 18, { fill: K.rgba(ch[0] === 255 && ch[1] === 60 ? C.red : ch[1] === 255 ? C.green : C.blue, 0.9), radius: 2 });
            K.label(ctx, nm, x + 3, y + 27, { size: 12, align: 'center', weight: 'bold',
                color: ch[3] > 0 ? (nm === 'R' ? C.red : nm === 'G' ? C.green : C.blue) : C.gray });
        }
        /* 视锥响应柱面板：response ≈ Σ(强度×灵敏度)，线性归一 */
        function conePanel(ctx, K, C, x, y, CONE, st) {
            var I = [st.ir, st.ig, st.ib];
            K.panel(ctx, x - 8, y - 30, 218, 208, { fill: 'rgba(255,255,255,0.07)', stroke: C.gray, radius: 10 });
            K.label(ctx, '视锥细胞响应', x + 101, y - 14, { size: 13, align: 'center', weight: 'bold', color: C.light });
            for (var ci = 0; ci < 3; ci++) {
                var resp = KT().clamp(I[0] * CONE[ci].w[0] + I[1] * CONE[ci].w[1] + I[2] * CONE[ci].w[2], 0, 1);
                var bx = x + 44 * ci + 14, bh = resp * 118;
                K.panel(ctx, bx, y + 136 - bh, 26, bh || 1, { fill: K.rgba(CONE[ci].col, 0.9), radius: 3 });
                K.label(ctx, nf(resp * 100, 0) + '%', bx + 13, y + 126 - bh, { size: 11, align: 'center', color: C.light });
                K.label(ctx, 'LMS'[ci], bx + 13, y + 150, { size: 13, align: 'center', weight: 'bold', color: CONE[ci].col });
            }
        }
        function colorReadout(ctx, K, C, x, y, st) {
            var hex = mixRGB(st.ir, st.ig, st.ib);
            var r8 = st.ir * 255, g8 = st.ig * 255, b8 = st.ib * 255;
            K.chip(ctx, '混合色：' + namedColor(r8, g8, b8) + '  ' + hex.toUpperCase(), x, y,
                { size: 13, bg: hex, color: (r8 + g8 + b8) / 3 > 120 ? C.dark : C.white, pad: 9 });
        }
        function visionRows(st) {
            var K = KT(), C = K.COLORS;
            var I = [st.ir, st.ig, st.ib];
            return [
                row('混合色', namedColor(st.ir * 255, st.ig * 255, st.ib * 255) + ' ' + mixRGB(st.ir, st.ig, st.ib).toUpperCase(), '', C.yellow),
                row('L 视锥响应', nf(KT().clamp(I[0] * 0.92 + I[1] * 0.22 + I[2] * 0.04, 0, 1) * 100, 0), '%', C.red),
                row('M 视锥响应', nf(KT().clamp(I[0] * 0.16 + I[1] * 0.88 + I[2] * 0.08, 0, 1) * 100, 0), '%', C.green),
                row('S 视锥响应', nf(KT().clamp(I[0] * 0.03 + I[1] * 0.07 + I[2] * 0.95, 0, 1) * 100, 0), '%', C.blue)
            ];
        }
    }

    /* ============ 注册到引擎注册表 ============ */
    window.EngineRegistry.register('optics', {
        create: function (cfg) {
            cfg = cfg || {};
            switch (cfg.mode || '') {
                case 'bending': return buildBending();
                case 'lens': return buildLens();
                case 'lensBasics': return buildLensBasics();
                case 'vision': return buildVision();
                default: return buildBending();
            }
        }
    });
})();
