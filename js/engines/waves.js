/**
 * 波动通用引擎（factory 名: 'waves'）
 * 覆盖实验ID：waves-intro / wave-on-string / wave-interference / fourier-making-waves
 *
 * 契约：顶层除 window.EngineRegistry.register 外不触碰 document；
 *       DOM 交互一律经 loader（setKnowledge/setPresets/updateDataDisplay/showToast）。
 */
(function () {
    'use strict';

    /* ============ 小工具（纯函数，无 DOM） ============ */
    function KT() { return window.Kit; }
    function nf(v, d) { return KT().fmt(v, d === undefined ? 2 : d); }
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var w=ctx.measureText(text).width+12; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-w/2, y-11, w, 22); ctx.fillStyle='#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }
    function row(lb, val, unit, color) { return { label: lb, value: val, unit: unit || '', color: color }; }
    /* 数据卡片缓存：字符串比较，变化才重建 innerHTML */
    function flushRows(st, rows) {
        if (!st.L || !st.L.updateDataDisplay) return;
        try {
            var key = JSON.stringify(rows);
            if (key === st._dcKey) return;
            st._dcKey = key;
            st.L.updateDataDisplay(rows);
        } catch (err) { /* 忽略 */ }
    }
    /* 双向箭头（两个反向箭头拼成） */
    function dblArrow(ctx, x1, y1, x2, y2, color) {
        KT().arrow(ctx, x1, y1, x2, y2, { color: color, width: 2, head: 9 });
        KT().arrow(ctx, x2, y2, x1, y1, { color: color, width: 2, head: 9 });
    }

    /* ============ 各模式默认状态（reset 亦从这里克隆） ============ */
    var MODES = {
        water: { freq: 0.6, amp: 36, marks: false, ph: 0 },                    // 频率Hz/振幅px/标注
        string: { speed: 200, damp: 0.015, ends: 'fixed', auto: true, ph: 0 }, // 波速px/s/阻尼/端点条件
        interference: { freq: 1.0, lambda: 96, fronts: true, gap: 150 },        // Hz/波长px/波前圈/源间距d px
        fourier: {                                                              // 目标0正弦1方波2三角 + 11根谐波幅值与开关
            target: 0,
            harm: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            on:   [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
    };
    function def(key) {
        var o = JSON.parse(JSON.stringify(MODES[key]));
        o.mode = key;
        return o;
    }

    /* ============================================================
       Mode 1  water —— 大面积水面横波 (waves-intro)
       波形：y(x)=A·sin(kx−ωt)+0.22A·sin(2kx+…)，v 固定采样 → λ=v/f
       ============================================================ */
    function buildWater() {
        var st = def('water');
        st._rip = []; st._trace = []; st._tt = 0;
        var V = 220; // 波速固定采样 v=220 px/s（可写注释：真实水波色散复杂，此处线性化）
        function surf(x, base, k, ph, A) {
            return base - A * Math.sin(k * x - ph) - A * 0.22 * Math.sin(2 * k * x + ph * 1.31 + 1.7);
        }
        function lam() { return V / Math.max(st.freq, 0.05); } // λ = v / f
        function kOf() { return 2 * Math.PI / lam(); }
        function drop() {
            var W = st.W || 800, H = st.H || 600, cx = duckX(W);
            st._rip.push({ x: cx, y: surf(cx, H * 0.45, kOf(), st.ph, st.amp), age: 0 });
            if (st.L && st.L.showToast) st.L.showToast('已滴入一滴水');
        }
        function duckX(W) { return W * 0.5; }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>机械波</strong>：振动在介质中的传播。水面上的水质点只在自己附近上下振动，波形却向前跑。</p>' +
                    '<div class="formula">v = λ · f　　T = 1 / f</div>' +
                    '<ul style="padding-left:20px"><li>频率 f 越大，波长 λ 越短（本模拟中波速 v 保持不变）</li>' +
                    '<li>振幅 A 只影响上下起伏的高度，与波长无关</li>' +
                    '<li>小鸭的姿态角≈该处水面的切线斜率，展示质点的实时相位</li></ul>'
                );
                L.setPresets([
                    { name: '平静微风', apply: function () { st.freq = 0.4; st.amp = 16; } },
                    { name: '常规海浪', apply: function () { st.freq = 0.8; st.amp = 40; } },
                    { name: '大风大浪', apply: function () { st.freq = 1.8; st.amp = 78; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'wav_freq', type: 'slider', label: '频率', min: 0.2, max: 2, step: 0.05, unit: ' Hz', value: st.freq,
                        onChange: function (v) { st.freq = v; } },
                    { id: 'wav_amp', type: 'slider', label: '振幅', min: 10, max: 80, step: 1, unit: ' px', value: st.amp,
                        onChange: function (v) { st.amp = v; } },
                    { id: 'wav_marks', type: 'checkbox', label: '显示波长 λ 与周期 T 标注', value: !!st.marks,
                        onChange: function (v) { st.marks = v; } },
                    { id: 'wav_drop', type: 'button', label: '滴一滴水（涟漪）', action: drop }
                ];
            },
            update: function (dt) {
                st.ph += 2 * Math.PI * st.freq * dt;     // ω = 2πf 相位推进
                st._tt += dt;
                for (var i = st._rip.length - 1; i >= 0; i--) { st._rip[i].age += dt; if (st._rip[i].age > 3) st._rip.splice(i, 1); }
                /* 记录小鸭处水面相对基线的偏移，供周期迹线面板回放 */
                var dxp = (st.W || 800) * 0.5;
                st._trace.push({ at: st._tt, e: surf(dxp, 0, kOf(), st.ph, st.amp) });
                while (st._trace.length && st._tt - st._trace[0].at > 4) st._trace.shift();
            },
            render: function (ctx, W, H, t) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS, base = H * 0.45, k = kOf(), ph = st.ph;
                // 水体：按表面采样构造闭合区域，双色渐变增强体积感
                ctx.save();
                var grad = ctx.createLinearGradient(0, base - st.amp, 0, H);
                grad.addColorStop(0, 'rgba(52,152,219,0.85)');
                grad.addColorStop(1, 'rgba(11,42,84,0.95)');
                ctx.beginPath(); ctx.moveTo(-4, H + 4); ctx.lineTo(-4, surf(0, base, k, ph, st.amp));
                for (var x = 0; x <= W + 8; x += 8) ctx.lineTo(x, surf(x, base, k, ph, st.amp));
                ctx.lineTo(W + 4, H + 4); ctx.closePath();
                ctx.fillStyle = grad; ctx.fill();
                ctx.beginPath();
                for (var x2 = 0; x2 <= W + 8; x2 += 8) { var yy = surf(x2, base, k, ph, st.amp); if (x2 === 0) ctx.moveTo(x2, yy); else ctx.lineTo(x2, yy); }
                ctx.strokeStyle = 'rgba(236,240,241,0.75)'; ctx.lineWidth = 2.5; ctx.stroke();
                ctx.restore();
                // 涟漪圆环：3 秒线性衰减，两圈同心
                for (var r = 0; r < st._rip.length; r++) {
                    var rp = st._rip[r], a = 1 - rp.age / 3, rr = rp.age * 140;
                    K.circle(ctx, rp.x, rp.y, rr, { stroke: K.rgba(C.white, 0.7 * a), lineWidth: 2.2 });
                    K.circle(ctx, rp.x, rp.y, rr * 0.62, { stroke: K.rgba(C.white, 0.4 * a), lineWidth: 1.5 });
                }
                // 漂浮小鸭：位置跟随波形，姿态角≈切线斜率 atan(dy/dx)
                var dxp = duckX(W), dy = surf(dxp, base, k, ph, st.amp);
                var slope = (surf(dxp + 5, base, k, ph, st.amp) - surf(dxp - 5, base, k, ph, st.amp)) / 10;
                ctx.save(); ctx.translate(dxp, dy - 9); ctx.rotate(Math.atan(slope));
                K.circle(ctx, 12, -14, 8, { fill: C.yellow });                       // 头
                ctx.fillStyle = C.orange; ctx.beginPath();                            // 喙
                ctx.moveTo(19, -14); ctx.lineTo(28, -12); ctx.lineTo(19, -10); ctx.closePath(); ctx.fill();
                ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(13, -16, 1.6, 0, 6.2832); ctx.fill(); // 眼
                ctx.fillStyle = C.yellow; ctx.beginPath();                            // 身体椭圆
                ctx.ellipse(0, 0, 17, 10, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
                // 标注：λ 双向箭头 + 右上角 T 时间轴游标迹线
                if (st.marks) {
                    var n = Math.round((ph + Math.PI / 2) / (2 * Math.PI)) + Math.floor(k * W * 0.5 / (2 * Math.PI));
                    var xc1 = (Math.PI / 2 + ph + 2 * Math.PI * (n - 1)) / k, xc2 = (Math.PI / 2 + ph + 2 * Math.PI * n) / k;
                    if (xc1 > -60 && xc2 < W + 60) {
                        var yAmp = base - st.amp - 20;
                        dblArrow(ctx, xc1, yAmp, xc2, yAmp, C.orange);
                        K.chip(ctx, 'λ = ' + nf(lam(), 0) + ' px', (xc1 + xc2) / 2 - 34, yAmp - 30, { size: 12, bg: K.rgba(C.dark, 0.65), color: C.orange });
                    }
                    // 游标迹线面板：横轴为时间（70px/s），一个周期宽度即 T
                    var px0 = W - 250, py0 = 46, pw = 218, phh = 74;
                    K.panel(ctx, px0, py0, pw, phh, { fill: 'rgba(255,255,255,0.08)', stroke: C.gray, radius: 8 });
                    K.label(ctx, '小鸭处水面高度（时间轴）', px0 + pw / 2, py0 + 12, { size: 12, align: 'center', color: C.light });
                    ctx.save(); ctx.beginPath(); ctx.rect(px0 + 2, py0 + 18, pw - 4, phh - 30); ctx.clip();
                    var pps = 70, ref = st.amp * 1.3 || 1, mid = py0 + (phh - 10) / 2, j;
                    ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.beginPath();
                    for (j = 0; j < st._trace.length; j++) {
                        var tx = px0 + pw - 8 - (st._tt - st._trace[j].at) * pps;
                        if (tx < px0 + 4) break;
                        var tyv = mid - st._trace[j].e / ref * ((phh - 34) / 2);
                        if (j === 0) ctx.moveTo(tx, tyv); else ctx.lineTo(tx, tyv);
                    }
                    ctx.stroke(); ctx.restore();
                    var tLen = Math.min((1 / st.freq) * pps, pw - 16);              // 一个周期在时间轴上的像素长
                    var ty2 = py0 + phh - 12;
                    dblArrow(ctx, px0 + pw - 10 - tLen, ty2, px0 + pw - 10, ty2, C.pink);
                    K.chip(ctx, 'T = ' + nf(1 / st.freq, 2) + ' s', px0 + pw / 2 - 26, ty2 + 8, { size: 12, bg: K.rgba(C.dark, 0.65), color: C.pink });
                }
                flushRows(st, [
                    row('波长 λ', nf(lam(), 0), 'px', C.blue),
                    row('周期 T', nf(1 / st.freq, 2), 's', C.pink),
                    row('波速 v（固定）', nf(V, 0), 'px/s', C.green),
                    row('涟漪数', String(st._rip.length), '', C.gray)
                ]);
            },
            reset: function () {
                Object.assign(st, def('water'));
                st._rip = []; st._trace = []; st._tt = 0;
            }
        };
    }

    /* ============================================================
       Mode 2  string —— 绳上波 (wave-on-string)
       离散波动方程 leapfrog：y'ᵢ=2yᵢ−y⁻ᵢ+C²(yᵢ₊₁−2yᵢ+yᵢ₋₁)，C=c·Δt/Δx≤1
       ============================================================ */
    function buildString() {
        var st = def('string');
        st.N = (window.Mobile ? window.Mobile.reduceParticleCount(100) : 100) + 1; st.SL = 700;  // 珠点数按设备能力缩放（桌面101/移动约61），逻辑长度 700px
        st.y = []; st.pp = []; st.buf = [];
        st.grabVal = 0; st.manual = false; st._fLog = []; st._lastSgn = 0;
        clearWave();
        function clearWave() {
            for (var i = 0; i < st.N; i++) { st.y[i] = 0; st.pp[i] = 0; st.buf[i] = 0; }
        }
        function fDrive() { return KT().clamp(st.speed / 260, 0.5, 1.6); } // 驱动频率随波速联动
        /* 单个子步 h 秒 */
        function subStep(h) {
            var c2 = Math.min(0.85, Math.pow(st.speed * h / (st.SL / (st.N - 1)), 2)); // 库朗数稳定性钳制
            var D = st.damp * h * 40, N = st.N, i;
            st.buf[0] = st.y[0];
            for (i = 1; i < N - 1; i++) {
                st.buf[i] = 2 * st.y[i] - st.pp[i] + c2 * (st.y[i + 1] - 2 * st.y[i] + st.y[i - 1]) - D * (st.y[i] - st.pp[i]);
            }
            if (st.ends === 'fixed') st.buf[N - 1] = 0;                      // 固定端：位移恒零→半波损失反射
            else if (st.ends === 'free') st.buf[N - 1] = st.buf[N - 2];      // 自由端：斜率为零→全反射无反相
            else st.buf[N - 1] = 2 * st.y[N - 2] - st.y[N - 3];              // 无反射：外推吸收边界
            var tmp = st.pp; st.pp = st.y; st.y = st.buf; st.buf = tmp;
        }
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>绳波</strong>：扰动沿绳传播的速度由介质张力决定——<span class="formula">v = √(T/μ)</span>。</p>' +
                    '<div class="formula">λ = v / f</div>' +
                    '<ul style="padding-left:20px"><li>固定端反射反相（半波损失），自由端反射同相</li>' +
                    '<li>无反射（吸收边界）：波能量全部传出画面，模拟无限长绳</li>' +
                    '<li>自动摇动 + 固定端 → 驻波；绳颜色按位移大小渐变着色</li>' +
                    '<li>也可以直接用鼠标在左端上下拖动手动驱动绳波</li></ul>'
                );
                L.setPresets([
                    { name: '驻波演示', apply: function () { st.ends = 'fixed'; st.auto = true; st.damp = 0.005; st.speed = 260; clearWave(); } },
                    { name: '单脉冲快波', apply: function () { st.ends = 'none'; st.auto = false; st.damp = 0; st.speed = 380; st.y[1] = 26; st.y[2] = 44; st.y[3] = 26; } },
                    { name: '高阻尼慢波', apply: function () { st.ends = 'free'; st.auto = true; st.damp = 0.04; st.speed = 90; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'str_ends', type: 'select', label: '右端点条件', value: st.ends,
                        options: [{ value: 'fixed', label: '固定端（反相反射）' }, { value: 'free', label: '自由端（同相反射）' }, { value: 'none', label: '无反射（行波）' }],
                        onChange: function (v) { st.ends = String(v); } },
                    { id: 'str_spd', type: 'slider', label: '张力（决定波速）', min: 50, max: 400, step: 5, unit: ' px/s', value: st.speed,
                        onChange: function (v) { st.speed = v; } },
                    { id: 'str_dmp', type: 'slider', label: '阻尼', min: 0, max: 0.05, step: 0.005, unit: '', value: st.damp,
                        onChange: function (v) { st.damp = v; } },
                    { id: 'str_auto', type: 'checkbox', label: '左端自动摇动', value: !!st.auto,
                        onChange: function (v) { st.auto = v; } },
                    { id: 'str_clr', type: 'button', label: '清除绳上波形', action: clearWave }
                ];
            },
            update: function (dt) {
                var sub = Math.ceil(st.speed * dt / ((st.SL / (st.N - 1)) * 0.8)), h = dt / Math.max(sub, 1), s;
                st.ph += 2 * Math.PI * fDrive() * dt;
                for (s = 0; s < sub; s++) {
                    if (st.auto) {                                                  // 自动摇动：y₀=A·sin(ωt)
                        var dv = 30 * Math.sin(st.ph);
                        st.y[0] = dv; st.pp[0] = dv;
                    } else if (!st.manual) { st.pp[0] = st.y[0]; }                  // 松手后自由演化（阻尼衰减）
                    if (st.manual) { st.pp[0] = st.y[0]; st.y[0] = st.grabVal; }    // 手动：直接写入位移序列
                    subStep(h);
                }
                /* 手动/自动都统计过零时刻以实测频率（滚动 2s 窗口，f= crossings/2/span） */
                var sgn = st.y[0] >= 0 ? 1 : -1;
                if (st._lastSgn !== 0 && sgn !== st._lastSgn) st._fLog.push(st._clock || 0);
                st._lastSgn = sgn;
                st._clock = (st._clock || 0) + dt;
                while (st._fLog.length && st._clock - st._fLog[0] > 2) st._fLog.shift();
                if (st._fLog.length >= 2) {
                    var span = st._fLog[st._fLog.length - 1] - st._fLog[0];
                    if (span > 0.4) st._fMeas = (st._fLog.length - 1) / 2 / span;
                } else st._fMeas = null;
            },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS, gy = H * 0.5, zoom = (W - 150) / st.SL, x0 = 55;
                K.panel(ctx, x0 - 20, gy - 120, (W - x0) + 60, 240, { fill: 'rgba(255,255,255,0.05)', stroke: C.gray, radius: 12 });
                /* 左端驱动器图标 */
                K.panel(ctx, x0 - 36, gy - 34, 32, 68, { fill: 'rgba(149,165,166,0.35)', stroke: C.gray, radius: 6 });
                K.arrow(ctx, x0 - 20, gy, x0 - 4, gy + st.y[0] * zoom * 0.4, { color: C.light, width: 2 });
                K.label(ctx, '驱动', x0 - 20, gy + 48, { size: 12, align: 'center', color: C.light });
                /* 彩绳：逐段按位移着色 hue = 210±位移*1.6（先粗发光层后细线层） */
                var i, xi, yi, hue, pass;
                for (pass = 0; pass < 2; pass++) {
                    for (i = 1; i < st.N; i++) {
                        yi = gy - st.y[i] * zoom; xi = gy - st.y[i - 1] * zoom;
                        hue = 210 + KT().clamp(st.y[i], -50, 50) * 1.6;
                        ctx.strokeStyle = 'hsl(' + hue.toFixed(0) + ',72%,' + (pass ? '58%)' : '70%)');
                        ctx.globalAlpha = pass ? 1 : 0.25;
                        ctx.lineWidth = pass ? 2.5 : 7;
                        ctx.beginPath(); ctx.moveTo(x0 + (i - 1) * (st.SL * zoom / (st.N - 1)), xi);
                        ctx.lineTo(x0 + i * (st.SL * zoom / (st.N - 1)), yi); ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1;
                /* 右端点条件图形 */
                var xe = x0 + st.SL * zoom + 14;
                if (st.ends === 'fixed') {
                    ctx.fillStyle = C.ground; ctx.fillRect(xe, gy - 110, 14, 220);
                    ctx.strokeStyle = K.rgba(C.dark, 0.8); ctx.lineWidth = 1.5; ctx.strokeRect(xe, gy - 110, 14, 220);
                } else if (st.ends === 'free') {
                    ctx.strokeStyle = C.gray; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xe + 8, gy - 100); ctx.lineTo(xe + 8, gy + 100); ctx.stroke();
                    K.circle(ctx, xe + 8, gy - st.y[st.N - 1] * zoom, 8, { fill: C.orange, stroke: C.dark, lineWidth: 1.5 });
                } else {
                    K.dashLine(ctx, xe, gy - 100, xe + 90, gy - 100, { color: K.rgba(C.teal, 0.6), dash: [4, 6], width: 1.5 });
                    K.dashLine(ctx, xe, gy, xe + 120, gy, { color: K.rgba(C.teal, 0.6), dash: [4, 6], width: 1.5 });
                    K.dashLine(ctx, xe, gy + 100, xe + 90, gy + 100, { color: K.rgba(C.teal, 0.6), dash: [4, 6], width: 1.5 });
                    K.label(ctx, '→ 无限延伸', xe + 30, gy + 122, { size: 12, color: C.teal });
                }
                K.label(ctx, st.manual ? '手动拖动中…' : (st.auto ? '自动摇动 ' + nf(fDrive(), 2) + ' Hz' : '已释放'),
                    x0 + 4, gy - 140, { size: 13, weight: 'bold', color: st.manual ? C.pink : C.light });
                hintDrag(ctx, '👆 上下拖动驱动', x0 - 20, gy - 84);
                flushRows(st, [
                    row('当前左端位移', nf(st.y[0], 1), 'px', C.yellow),
                    row('频率' + (st.auto ? '（驱动）' : '（实测）'), nf(st.auto ? fDrive() : (st._fMeas || 0), 2), 'Hz', C.blue),
                    row('波长估计（驻波理论 λ=v/f）', st.ends === 'fixed' && st.auto ? nf(st.speed / fDrive(), 0) : '--', 'px', C.green),
                    row('右端条件', st.ends === 'fixed' ? '固定端' : st.ends === 'free' ? '自由端' : '无反射', '', C.gray)
                ]);
            },
            hitTest: function (x) {
                return x < (st.W || 800) * 0.18;
            },
            onPointerDown: function (x, y) {
                if (x < (st.W || 800) * 0.18) { st.manual = true; st._gy = y; st.grabVal = 0; }
            },
            onPointerMove: function (x, y) {
                if (st.manual) st.grabVal = KT().clamp(-(y - st._gy), -80, 80);   // 直接写入左端位移序列
            },
            onPointerUp: function () { st.manual = false; },
            reset: function () {
                Object.assign(st, def('string'));
                st.manual = false; st._fLog = []; st._fMeas = null; st._lastSgn = 0; st._clock = 0; st.grabVal = 0;
                clearWave();
            }
        };
    }

    /* ============================================================
       Mode 3  interference —— 双缝干涉 (wave-interference)
       光程差 δ=r₂−r₁，I=cos²(πδ/λ)；相邻亮纹 Δx≈λL/d
       ============================================================ */
    function buildInterference() {
        var st = def('interference');
        st.drag = -1;
        st.scrStep = (window.Mobile && (window.Mobile.isMobile || window.Mobile.isLowEnd)) ? 4 : 2;  // 探测屏采样步长：移动端降采样（桌面2px/移动4px）
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>波的干涉</strong>：两列相干波（同频、恒定相位差）叠加，形成稳定的加强/减弱图样。</p>' +
                    '<div class="formula">光程差 δ = r₂ − r₁ ＝ mλ → 亮纹</div>' +
                    '<div class="formula">相邻亮纹间距 Δx ≈ λL / d　（d 越大条纹越密）</div>' +
                    '<ul style="padding-left:20px"><li>拖动 S₁/S₂ 改变间距 d</li>' +
                    '<li>探测屏灰度＝两列波在该点的叠加强度 |cos(πδ/λ)|²</li>' +
                    '<li>波前圈为等相位面，圈心距恰为一个波长 λ</li></ul>'
                );
                L.setPresets([
                    { name: '宽条纹', apply: function () { st.gap = 70; st.lambda = 130; } },
                    { name: '密条纹', apply: function () { st.gap = 320; st.lambda = 60; } },
                    { name: '标准观察', apply: function () { st.gap = 150; st.lambda = 96; } }
                ]);
            },
            getControls: function () {
                return [
                    { id: 'itf_f', type: 'slider', label: '频率', min: 0.5, max: 2, step: 0.05, unit: ' Hz', value: st.freq,
                        onChange: function (v) { st.freq = v; } },
                    { id: 'itf_lam', type: 'slider', label: '波长 λ', min: 40, max: 160, step: 2, unit: ' px', value: st.lambda,
                        onChange: function (v) { st.lambda = v; } },
                    { id: 'itf_fronts', type: 'checkbox', label: '显示波前圈（等相位线）', value: !!st.fronts,
                        onChange: function (v) { st.fronts = v; } }
                ];
            },
            update: function (dt) { st.ph += 2 * Math.PI * st.freq * dt; },
            render: function (ctx, W, H) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS, cx = W * 0.38, cy = H * 0.46;
                var sx1 = cx - st.gap / 2, sx2 = cx + st.gap / 2;
                var scrX = W - 86, Lscr = scrX - cx;                             // 屏距 L（源中点到屏）
                var vmax = st.lambda * st.freq;                                   // 波前扩展速度=λf 保证动画同步
                /* 波前圈：半径 = (t·v) mod λ + mλ */
                if (st.fronts) {
                    var fr = (st.ph / (2 * Math.PI)) * st.lambda % st.lambda, md = Math.hypot(W, H), m2;
                    for (m2 = 0; ; m2++) {
                        var r0 = fr + m2 * st.lambda; if (r0 > md) break;
                        K.circle(ctx, sx1, cy, r0, { stroke: K.rgba(C.red, 0.16), lineWidth: 1.4 });
                        K.circle(ctx, sx2, cy, r0, { stroke: K.rgba(C.blue, 0.16), lineWidth: 1.4 });
                    }
                }
                /* 探测屏：I(y)=|cos(π(r₂−r₁)/λ)|² 合成灰度窄条 */
                var sw = 14;
                ctx.save();
                for (var py = 10; py < H - 10; py += st.scrStep) {
                    var r1 = Math.hypot(scrX - sx1, py - cy), r2 = Math.hypot(scrX - sx2, py - cy);
                    var b = Math.pow(Math.abs(Math.cos(Math.PI * (r2 - r1) / st.lambda)), 2);  // I = cos²(πδ/λ)
                    ctx.fillStyle = 'rgb(' + Math.round(b * 255) + ',' + Math.round(b * 255) + ',' + Math.round(b * 255) + ')';
                    ctx.fillRect(scrX - 4, py, sw, st.scrStep);
                }
                ctx.restore();
                K.panel(ctx, scrX - 6, 8, sw + 4, H - 16, { stroke: K.rgba(C.white, 0.25), radius: 3 });
                K.label(ctx, '探测屏', scrX + sw / 2 - 6, 24, { size: 12, align: 'center', color: C.light });
                /* 亮纹计数：整数 m 满足 |m|·Δx ≤ 半屏高 → 可见极大数 */
                var dxBar = st.lambda * Lscr / Math.max(st.gap, 1);               // Δx = λL/d
                var nMax = 2 * Math.floor((H / 2 - 12) / Math.max(dxBar, 2)) + 1;
                for (var mi = -Math.floor(nMax / 2); mi <= Math.floor(nMax / 2); mi++) {
                    var my = cy - mi * dxBar;
                    if (my > 12 && my < H - 12) K.circle(ctx, scrX - 10, my, 3.2, { fill: C.orange });
                }
                /* 源标记与拖拽手柄 */
                drawSrc(ctx, K, C, sx1, cy, 'S₁', C.red, st.drag === 0);
                drawSrc(ctx, K, C, sx2, cy, 'S₂', C.blue, st.drag === 1);
                dblArrow(ctx, sx1, cy + 52, sx2, cy + 52, C.yellow);
                K.chip(ctx, 'd = ' + nf(st.gap, 0) + ' px', cx - 34, cy + 62, { size: 12, bg: K.rgba(C.dark, 0.7), color: C.yellow });
                hintDrag(ctx, '👆 拖动 S₁/S₂ 改间距', cx, cy - 44);
                K.chip(ctx, 'Δx = λL/d ≈ ' + nf(dxBar, 1) + ' px', 20, 22, { size: 13, bg: K.rgba(C.dark, 0.7), color: C.teal });
                K.chip(ctx, '亮纹数 N = ' + nMax, scrX - 128, 22, { size: 13, bg: K.rgba(C.dark, 0.7), color: C.orange });
                flushRows(st, [
                    row('源间距 d', nf(st.gap, 0), 'px', C.yellow),
                    row('波长 λ', nf(st.lambda, 0), 'px', C.blue),
                    row('相邻亮纹间距 Δx≈λL/d', nf(dxBar, 1), 'px', C.teal),
                    row('可见亮纹数 N', String(nMax), '', C.orange)
                ]);
            },
            hitTest: function (x, y) {
                var cx = (st.W || 800) * 0.38, cy = (st.H || 600) * 0.46;
                return Math.hypot(x - (cx - st.gap / 2), y - cy) < 20 || Math.hypot(x - (cx + st.gap / 2), y - cy) < 20;
            },
            onPointerDown: function (x, y) {
                var cx = (st.W || 800) * 0.38, cy = (st.H || 600) * 0.46;
                if (Math.hypot(x - (cx - st.gap / 2), y - cy) < 20) st.drag = 0;
                else if (Math.hypot(x - (cx + st.gap / 2), y - cy) < 20) st.drag = 1;
            },
            onPointerMove: function (x) {
                if (st.drag >= 0) {
                    var cx = (st.W || 800) * 0.38;                                 // 对称拖动：镜像保持几何公式成立
                    st.gap = KT().clamp(Math.abs(x - cx) * 2, 56, Math.min(480, (cx - 30) * 2));
                }
            },
            onPointerUp: function () { st.drag = -1; },
            reset: function () { Object.assign(st, def('interference')); st.drag = -1; }
        };
        function drawSrc(ctx, K, C, x, y, nm, col, hot) {
            K.circle(ctx, x, y, hot ? 14 : 11, { fill: col, alpha: hot ? 1 : 0.9 });
            K.circle(ctx, x, y, 4, { fill: C.white });
            K.label(ctx, nm, x, y - 22, { size: 14, align: 'center', weight: 'bold', color: col });
        }
    }

    /* ============================================================
       Mode 4  fourier —— 傅里叶：制造波 (fourier-making-waves)
       合成 Σ An·sin(nπx/L − nω₀t)；方波 only odd 4/(πn)，三角 8/(π²n²)(-1)^⌊n/2⌋
       ============================================================ */
    function buildFourier() {
        var st = def('fourier');
        st.barDrag = null;
        function targetName() { return ['正弦波', '方波', '三角波'][st.target]; }
        function loadTarget(kind) {
            st.target = kind; var n2;
            for (var i = 0; i < 11; i++) { st.on[i] = 0; st.harm[i] = 0; }
            if (kind === 0) { st.on[0] = 1; st.harm[0] = 1; }
            else if (kind === 1) { for (i = 1; i <= 11; i += 2) { n2 = (i - 1) / 2; st.on[n2] = 1; st.harm[n2] = 4 / (Math.PI * i); } }
            else { for (i = 1; i <= 11; i += 2) { n2 = (i - 1) / 2; st.on[n2] = 1; st.harm[n2] = 8 / (Math.PI * Math.PI * i * i) * (n2 % 2 ? -1 : 1); } }
        }
        loadTarget(0);
        st.curveSteps = window.Mobile ? window.Mobile.reduceParticleCount(240) : 240;  // 合成曲线采样点数：>200 时按设备能力降级（桌面240/移动约144）
        return {
            init: function (L) {
                st.L = L;
                L.setKnowledge(
                    '<p><strong>傅里叶合成</strong>：任何周期性波形都可以由一系列正弦谐波叠加而成。</p>' +
                    '<div class="formula">y(x,t) = Σₙ Aₙ · sin(nπx/L − nω₀t)</div>' +
                    '<ul style="padding-left:20px"><li>方波谱：Aₙ=4/(πn)（仅奇次）；三角波谱：Aₙ=8/(π²n²)（奇次交替符号）</li>' +
                    '<li>点击底部谐波柱 启用/禁用；按住上下拖动可修改幅度 0~1</li>' +
                    '<li>绿色曲线是实际合成结果，橙色是理想目标波形</li></ul>'
                );
                L.setPresets([
                    { name: '基频正弦', apply: function () { loadTarget(0); } },
                    { name: '方波前3项', apply: function () { loadTarget(1); trim(3); } },
                    { name: '三角波前3项', apply: function () { loadTarget(2); trim(3); } }
                ]);
                function trim(keep) { /* 仅保留前 keep 个启用项，直观展示部分和逼近 */
                    var seen = 0;
                    for (var i = 0; i < 11; i++) { if (st.on[i]) { seen++; if (seen > keep) { st.on[i] = 0; st.harm[i] = 0; } } }
                }
            },
            getControls: function () {
                return [
                    { id: 'fr_target', type: 'select', label: '目标波形', value: String(st.target),
                        options: [{ value: '0', label: '正弦波' }, { value: '1', label: '方波' }, { value: '2', label: '三角波' }],
                        onChange: function (v) { loadTarget(parseInt(v, 10) || 0); } },
                    { id: 'fr_clear', type: 'button', label: '清空全部谐波', action: function () {
                        for (var i = 0; i < 11; i++) { st.on[i] = 0; st.harm[i] = 0; }
                        if (st.L && st.L.showToast) st.L.showToast('已清空，绿色平线：试试自己堆出方波？');
                    } }
                ];
            },
            update: function (dt) {
                st.ph += 1.6 * dt;                                               // ω₀ 视觉滚动速度
                var pk = 0, steps = 120;                                         // 合成峰值（数据读出）
                for (var s = 0; s <= steps; s++) {
                    var xx = s / steps * Math.PI * 2, vv = 0;
                    for (var n = 0; n < 11; n++) if (st.on[n]) vv += st.harm[n] * Math.sin((n + 1) * xx - (n + 1) * st.ph);
                    pk = Math.max(pk, Math.abs(vv));
                }
                st._peak = pk;
            },
            render: function (ctx, W, H, t) {
                st.W = W; st.H = H;
                var K = KT(), C = K.COLORS, px = W * 0.05, pw = W * 0.9, midY = H * 0.36;
                K.grid(ctx, W, H, { step: 50 });
                /* 合成曲线（绿）vs 理想目标（橙虚线） */
                drawCurve(ctx, K, C, px, pw, midY, 96, st.ph, st.harm, st.on, C.green, 2.6);
                var tgtPts = [], q;
                for (q = 0; q <= 160; q++) tgtPts.push({ x: px + pw * q / 160, y: midY - idealY(q / 160 * 2, st.target) * 92 });
                K.polyline(ctx, tgtPts, { color: K.rgba(C.orange, 0.85), width: 2, dash: [7, 5] });
                K.chip(ctx, '实际合成', px + 4, midY - 132, { size: 12, bg: K.rgba(C.dark, 0.7), color: C.green });
                K.chip(ctx, '目标：' + targetName(), px + 100, midY - 132, { size: 12, bg: K.rgba(C.dark, 0.7), color: C.orange });
                /* 谐波柱区：点击切换启停 / 拖动改幅 */
                var bz = H - 148, bh = 112, bw = pw / 11, bi;
                K.panel(ctx, px - 6, bz - 8, pw + 12, bh + 26, { fill: 'rgba(255,255,255,0.06)', stroke: C.gray, radius: 10 });
                for (bi = 0; bi < 11; bi++) {
                    var bx = px + bw * bi + bw / 2, hv = st.harm[bi] * (bh - 16);
                    if (bi > 0) {
                        var tv = specVal(bi + 1, st.target);
                        if (tv !== 0) K.panel(ctx, bx - 7, bz + bh - 12 - Math.abs(tv) * (bh - 16), 14, Math.abs(tv) * (bh - 16), { fill: K.rgba(C.orange, 0.30), radius: 3 });
                    }
                    K.panel(ctx, bx - 9, bz + bh - 12 - Math.abs(hv), 18, Math.abs(hv) || 1, { fill: st.on[bi] ? K.rgba(harmCol(bi), 0.92) : 'rgba(149,165,166,0.30)', radius: 4 });
                    K.label(ctx, 'n=' + (bi + 1), bx, bz + bh + 4, { size: 10, align: 'center', color: st.on[bi] ? harmCol(bi) : C.gray });
                    K.label(ctx, nf(Math.abs(st.harm[bi]), 2), bx, bz + 4, { size: 10, align: 'center', color: st.on[bi] ? C.light : C.gray });
                }
                K.label(ctx, '点击柱子启用/禁用，按住拖动改幅度', px + 6, bz + bh + 18, { size: 11, color: C.gray });
                hintDrag(ctx, '👆 拖动谐波柱', px + pw / 2, bz - 20);
                flushRows(st, [
                    row('已启用谐波数', String(cnt()), '', C.teal),
                    row('当前合成峰值', nf(st._peak || 0, 3), '', C.green),
                    row('目标波形', targetName(), '', C.orange)
                ]);
            },
            onPointerDown: function (x, y) {
                var hit = hitBar(x, y, st);                                      // 命中柱区先记录索引，轻微位移视为拖动改幅
                if (hit >= 0) { st.barDrag = { i: hit, sy: y, moved: false }; toggle(st, hit); }
            },
            onPointerMove: function (x, y) {
                var bd = st.barDrag;
                if (bd) {
                    if (!bd.moved && Math.abs(y - bd.sy) > 6) { st.on[bd.i] = 1; bd.moved = true; }
                    if (bd.moved) {
                        var bz = (st.H || 600) - 148, bh = 112;
                        st.harm[bd.i] = signKeep(bd.i) * KT().clamp((bz + bh - 12 - y) / (bh - 16), 0, 1);
                    }
                }
            },
            hitTest: function (x, y) {
                return hitBar(x, y, st) >= 0;
            },
            onPointerUp: function () { st.barDrag = null; },
            reset: function () { Object.assign(st, def('fourier')); loadTarget(0); st.barDrag = null; st._peak = 0; }
        };
        function cnt() { var c = 0, i; for (i = 0; i < 11; i++) if (st.on[i]) c++; return c; }
        function toggle(s, i) { s.on[i] = s.on[i] ? 0 : 1; }
        function signKeep(i) { return st.harm[i] < 0 ? -1 : 1; }                 // 三角波负系数保留方向
        function harmCol(i) { return ['hsl(210,80%,62%)', 'hsl(280,70%,64%)', 'hsl(170,60%,50%)'][i % 3]; }
        function specVal(n, kind) {                                              // 目标谱参考高度
            if (kind === 1 && n % 2 === 1) return 4 / (Math.PI * n);
            if (kind === 2 && n % 2 === 1) return 8 / (Math.PI * Math.PI * n * n) * (((n - 1) / 2) % 2 ? -1 : 1);
            return n === 1 && kind === 0 ? 1 : 0;
        }
        function idealY(u, kind) {                                               // u∈[0,2)：理想目标波形形状
            if (kind === 0) return Math.sin(Math.PI * u * 2) * 0.98;
            if (kind === 1) return u % 1 < 0.5 ? 0.95 : -0.95;
            var p = u % 1; return p < 0.25 ? p * 4 : p < 0.75 ? (0.5 - p) * 4 : (p - 1) * 4;
        }
        function drawCurve(ctx, K, C, px, pw, midY, amp, ph, harm, on, col, lw) {
            ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round';
            ctx.shadowColor = K.rgba(col, 0.6); ctx.shadowBlur = 8;
            ctx.beginPath();
            var cSteps = st.curveSteps || 240;
            for (var s = 0; s <= cSteps; s++) {
                var u = s / cSteps * Math.PI * 2, v = 0, n;
                for (n = 0; n < 11; n++) if (on[n]) v += harm[n] * Math.sin((n + 1) * u - (n + 1) * ph);
                var X = px + pw * s / cSteps, Y = midY - KT().clamp(v, -1.4, 1.4) * amp;
                if (s === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
            }
            ctx.stroke(); ctx.shadowBlur = 0;
        }
        function hitBar(x, y, s) {
            var px = (s.W || 800) * 0.05, pw = (s.W || 800) * 0.9, bz = (s.H || 600) - 148, bh = 112;
            if (y < bz - 6 || y > bz + bh + 16) return -1;
            var i = Math.floor((x - px) / (pw / 11));
            return (i >= 0 && i < 11) ? i : -1;
        }
    }

    /* ============ 注册到引擎注册表 ============ */
    window.EngineRegistry.register('waves', {
        create: function (cfg) {
            cfg = cfg || {};
            switch (cfg.mode || '') {
                case 'water': return buildWater();
                case 'string': return buildString();
                case 'interference': return buildInterference();
                case 'fourier': return buildFourier();
                default: return buildWater();
            }
        }
    });
})();
