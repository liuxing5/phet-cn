/**
 * 图像与函数实验引擎（仿 PhET 中文平台 · 数学篇）
 * 注册名 'graphs'，按 cfg.mode 分支支持 7 种模式：
 *   calculus   微积分绘图器
 *   lines      直线绘图
 *   slopeint   斜率截距式
 *   quad       二次函数图像
 *   trig       三角函数之旅
 *   fitline    曲线拟合
 *   regression 最小二乘回归
 * 依赖（加载顺序保证）：window.Kit、window.EngineRegistry。
 * 本文件顶层只注册工厂；DOM 访问一律延迟到实例方法内。
 */
window.EngineRegistry.register('graphs', {
  create(cfg) {
    var K = window.Kit, COL = K.COLORS, PI = Math.PI;
    var TXT = '#f2f5fa', DIM = 'rgba(255,255,255,0.55)',
        GRIDC = 'rgba(255,255,255,0.07)', AXZC = 'rgba(255,255,255,0.35)', TCKC = 'rgba(255,255,255,0.5)';
    var LOADER = null;
    function toast(m) { if (LOADER && LOADER.showToast) LOADER.showToast(String(m)); }
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.fillStyle = '#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }

    /* ================= 数值助手 ================= */
    /* 中央差商近似导数：f′(x) ≈ [f(x+h) − f(x−h)] / (2h) */
    function dCenter(f, x, h) { h = h || 0.05; return (f(x + h) - f(x - h)) / (2 * h); }
    /* 复化梯形公式（保持符号方向）：∫[a,b] f ≈ Σ (f(xᵢ)+f(xᵢ₊₁))/2·dx */
    function trapz(f, a, b, n) {
      n = n || 120;
      var flip = false, t;
      if (b < a) { t = a; a = b; b = t; flip = true; }
      if (!(b > a)) return 0;
      var dx = (b - a) / n, s = 0, i;
      for (i = 0; i < n; i++) s += (f(a + i * dx) + f(a + (i + 1) * dx)) * dx / 2;
      return flip ? -s : s;
    }
    /* 带符号格式：正值显式加 '+'，用于方程拼接 */
    function sg(v, d) { return (v >= 0 ? '+' : '') + K.fmt(v, d == null ? 2 : d); }
    /* Box-Muller 标准正态采样（依赖调用方传入的确定性 rng） */
    function randn(r) {
      var u = Math.max(1e-9, r());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * r());
    }
    /* 普通最小二乘直线 y = a + b·x（解析解），返回 a/b/sse 等 */
    function lstsq(p) {
      var n = p.length, i, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (i = 0; i < n; i++) { sx += p[i].x; sy += p[i].y; }
      var mx = sx / n, my = sy / n;
      for (i = 0; i < n; i++) { var dx = p[i].x - mx, dy = p[i].y - my; sxx += dx * dx; sxy += dx * dy; }
      var b = sxx > 1e-12 ? sxy / sxx : 0, a = my - b * mx, sse = 0, syy = 0;
      for (i = 0; i < n; i++) {
        var e = p[i].y - (a + b * p[i].x);
        sse += e * e; syy += dy2(p[i].y, my);
      }
      function dy2(u, m) { return (u - m) * (u - m); }
      var r2 = syy > 1e-12 ? 1 - sse / syy : 0;
      return { a: a, b: b, sse: sse, r2: r2 };
    }
    function sseOf(p, a, b) { var s = 0, i; for (i = 0; i < p.length; i++) { var d = p[i].y - (a + b * p[i].x); s += d * d; } return s; }
    function sstot(p) { var n = p.length, m = 0, i, s = 0; for (i = 0; i < n; i++) m += p[i].y; m /= n; for (i = 0; i < n; i++) s += (p[i].y - m) * (p[i].y - m); return s; }

    /* ================= 补间（暂停态也能推进的动画） ================= */
    var TW = [];
    function easeIO(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function twStart(o, key, to, dur, done) {
      for (var i = TW.length - 1; i >= 0; i--) if (TW[i].o === o && TW[i].k === key) TW.splice(i, 1); // 同属性去重
      TW.push({ o: o, k: key, from: o[key], to: to, t0: performance.now(), dur: dur || 800, done: done });
      poke();
    }
    function twStep() {
      var now = performance.now(), alive = [];
      for (var i = 0; i < TW.length; i++) {
        var q = TW[i], u = Math.min(1, (now - q.t0) / q.dur);
        q.o[q.k] = q.from + (q.to - q.from) * easeIO(u);
        if (u < 1) alive.push(q); else if (q.done) { try { q.done(); } catch (err) { console.error(err); } }
      }
      TW = alive;
      return TW.length > 0;
    }
    /* 暂停态下用自身 rAF 链维持补间期间的连续重绘（不触碰 DOM） */
    var RT = { ctx: null, W: 0, H: 0, t: 0, busy: false }, SELF_DRAW = null;
    function poke() {
      if (!RT.busy && RT.ctx && TW.length > 0) {
        RT.busy = true;
        requestAnimationFrame(function () {
          RT.busy = false;
          if (TW.length > 0 && SELF_DRAW) { SELF_DRAW(); poke(); }
        });
      }
    }

    /* ================= 绘图通用助手 ================= */
    /* 局部矩形内的坐标映射 */
    function mku(rc, xr, yr) {
      var v = K.view({ x: xr, px: [rc.x + 4, rc.x + rc.w - 4], y: yr, py: [rc.y + 4, rc.y + rc.h - 4] });
      v.x = xr; v.y = yr; /* 世界范围随视图携带，供 axBox 读取零轴/刻度边界 */
      return v;
    }
    /* 局部剪裁后执行绘制 fn（自动恢复状态） */
    function withClip(ctx, rc, fn) {
      ctx.save(); ctx.beginPath(); ctx.rect(rc.x - 2, rc.y - 2, rc.w + 4, rc.h + 4); ctx.clip();
      try { fn(); } finally { ctx.restore(); }
    }
    /* 面板内网格 + 中轴 + 边缘刻度数字（比 Kit.axes 更适合局部矩形） */
    function axBox(ctx, rc, v, o) {
      o = o || {};
      var xt = o.xt == null ? 6 : o.xt, yt = o.yt == null ? 6 : o.yt, i, tx, ty;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = GRIDC;
      ctx.beginPath();
      tx = K.ticks(v.x[0], v.x[1], xt); ty = K.ticks(v.y[0], v.y[1], yt);
      for (i = 0; i < tx.length; i++) { var px = Math.round(v.X(tx[i])) + 0.5; ctx.moveTo(px, rc.y); ctx.lineTo(px, rc.y + rc.h); }
      for (i = 0; i < ty.length; i++) { var py = Math.round(v.Y(ty[i])) + 0.5; ctx.moveTo(rc.x, py); ctx.lineTo(rc.x + rc.w, py); }
      ctx.stroke();
      /* x/y 零轴加重 */
      ctx.strokeStyle = AXZC; ctx.lineWidth = 1.4;
      if (v.y[0] < 0 && v.y[1] > 0) { var zy = Math.round(v.Y(0)) + 0.5; ctx.beginPath(); ctx.moveTo(rc.x, zy); ctx.lineTo(rc.x + rc.w, zy); ctx.stroke(); }
      if (v.x[0] < 0 && v.x[1] > 0) { var zx = Math.round(v.X(0)) + 0.5; ctx.beginPath(); ctx.moveTo(zx, rc.y); ctx.lineTo(zx, rc.y + rc.h); ctx.stroke(); }
      /* 刻度数字 */
      K.label(ctx, '', 0, 0);
      ctx.font = '10.5px sans-serif';
      ctx.fillStyle = TCKC;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (i = 0; i < tx.length; i++) ctx.fillText(K.fmt(tx[i], 2), v.X(tx[i]), rc.y + rc.h + 4);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (i = 0; i < ty.length; i++) ctx.fillText(K.fmt(ty[i], 2), rc.x - 4, v.Y(ty[i]));
      /* 轴标题 */
      if (o.xl) { ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(o.xl, rc.x + rc.w, rc.y + rc.h + 16); }
      if (o.yl) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(o.yl, rc.x + 2, rc.y - 4); }
      ctx.restore();
    }
    /* 连续曲线绘制：数值突变（如 tan 渐近线/高次爆炸）处自动断开 */
    function plotBreaks(ctx, v, f, x0, x1, st) {
      st = st || {};
      var N = st.n || 240, col = st.col || COL.blue, wd = st.w == null ? 3 : st.w,
          jump = st.jump || 60, seg = [], li, lx = null, ly = null;
      function flush() { if (seg.length > 1) K.polyline(ctx, seg, { color: col, width: wd }); seg = []; }
      for (li = 0; li <= N; li++) {
        var wx = x0 + (x1 - x0) * li / N, wy = f(wx);
        if (!isFinite(wy)) { flush(); lx = ly = null; continue; }
        var p = { x: v.X(wx), y: K.clamp(v.Y(wy), -4000, 4000) };
        if (lx !== null && Math.abs(p.y - ly) > jump) flush();
        seg.push(p); lx = p.x; ly = p.y;
      }
      flush();
    }
    /* f 与 y=base 之间的填充带（积分阴影等） */
    function bandFill(ctx, v, f, x0, x1, col, baseY, n) {
      n = n || 160; var fw = [], i;
      for (i = 0; i <= n; i++) { var wx = x0 + (x1 - x0) * i / n; fw.push({ x: v.X(wx), y: v.Y(f(wx)) }); }
      var back = [];
      for (i = n; i >= 0; i--) { var wx2 = x0 + (x1 - x0) * i / n; back.push({ x: v.X(wx2), y: baseY }); }
      K.polyline(ctx, fw.concat(back), { closed: true, fill: col, alpha: 0.26, color: col, width: 1 });
    }
    /* 五角星路径（顶点标注） */
    function starAt(ctx, cx, cy, R, fill) {
      ctx.save();
      ctx.beginPath();
      for (var p = 0; p < 10; p++) {
        var rr = p % 2 ? R * 0.44 : R, ang = -PI / 2 + p * PI / 5;
        var x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        if (p) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fill || COL.yellow; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    /* 虚线箭头 */
    function dashArrow(ctx, x1, y1, x2, y2, col) {
      K.dashLine(ctx, x1, y1, x2, y2, { color: col, dash: [7, 5], width: 2 });
      var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      K.arrow(ctx, x1 + dx * 0.78, y1 + dy * 0.78, x2, y2, { color: col, width: 2, head: 9 });
    }
    /* 左上角小标题 */
    function capTag(ctx, txt, x, y, c) {
      K.chip(ctx, txt, x, y, { size: 13, color: c || TXT, bg: 'rgba(0,0,0,0.30)', pad: 7 });
    }

    /* ================================================================
     * 模式 1 calculus —— 微积分绘图器
     * 主图 f（蓝粗线+可拖样条控制点+切线小棍）；右列上 f′（中央差商 橙）、
     * 下 ∫₀ˣ（梯形累加 teal 阴影）；光标 x* 十字联动三图。
     * ============================================================== */
    function mdCalculus() {
      var st = {
        fam: 'spline', cur: -1.5, drag: -1, hover: null,
        ys: [-1.4, 0.9, 2.1, 1.3, -0.7, -2.2],
        XS: [-4.5, -2.7, -0.9, 0.9, 2.7, 4.5]
      };
      var DOMX = [-5, 5];
      /* 移动端按 particleScale 缩放各处采样点；桌面端原值不变 */
      var _rpc = function (n) { return window.Mobile ? window.Mobile.reduceParticleCount(n) : n; };
      function spl(x) { /* 三次样条：分段三次 Hermite + Catmull-Rom 内部切线 */
        var xs = st.XS, ys = st.ys, n = 6, i = 0;
        if (x <= xs[0]) return ys[0];
        if (x >= xs[n - 1]) return ys[n - 1];
        while (i < n - 2 && x > xs[i + 1]) i++;
        var x0 = xs[i], x1 = xs[i + 1], tt = (x - x0) / (x1 - x0);
        var y0 = ys[i], y1 = ys[i + 1];
        var xa = i > 0 ? xs[i - 1] : x0, ya = i > 0 ? ys[i - 1] : y0;
        var xb = i < n - 2 ? xs[i + 2] : x1, yb = i < n - 2 ? ys[i + 2] : y1;
        var m0 = (y1 - ya) / (x1 - xa), m1 = (yb - y0) / (xb - x0);
        var t2 = tt * tt, t3 = t2 * tt;
        return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + tt) * (x1 - x0) * m0 +
               (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * (x1 - x0) * m1;
      }
      function f(x) {
        if (st.fam === 'gauss') return 2.4 * Math.exp(-Math.pow(x + 1.8, 2) / 1.6) - 1.9 * Math.exp(-Math.pow(x - 1.7, 2) / 2.4); // 双高斯叠加
        if (st.fam === 'wave') return 1.6 * Math.sin(1.1 * x) + 0.22 * x; // 正弦 + 倾斜
        return spl(x);
      }
      function rects(W, H) {
        var ml = 56, mt = 30, mb = 44;
        var mw = Math.max(110, (W - ml - 46) * 0.55), mh = Math.max(120, H - mt - mb);
        var rx = ml + mw + 24, rw = Math.max(90, W - rx - 24);
        var sh = (mh - 18) / 2;
        return { main: { x: ml, y: mt, w: mw, h: mh }, dv: { x: rx, y: mt, w: rw, h: sh }, iv: { x: rx, y: mt + sh + 18, w: rw, h: sh } };
      }
      function ctl() {
        return [
          { id: 'gc_fam', type: 'select', label: '曲线族', value: st.fam,
            options: [{ value: 'spline', label: '三次样条（拖控制点）' }, { value: 'gauss', label: '叠加双高斯' }, { value: 'wave', label: '正弦 + 倾斜' }],
            onChange: function (v) { st.fam = String(v); st.drag = -1; } },
          { id: 'gc_cur', type: 'slider', label: '光标位置 x*', min: -4.5, max: 4.5, step: 0.05, value: st.cur,
            onChange: function (v) { st.cur = v; st.hover = null; } }
        ];
      }
      function draw(ctx, W, H, t) {
        var R = rects(W, H);
        var vm = mku(R.main, DOMX, [-3, 3]);
        var fd = [-3.6, 3.6], fi = [-7.5, 7.5];
        var vd = mku(R.dv, DOMX, fd), vi = mku(R.iv, DOMX, fi);
        var fx = f, cur = st.cur, hx = st.hover;
        axBox(ctx, R.main, vm, { xl: 'x', yl: 'f(x)' });
        axBox(ctx, R.dv, vd, { yl: "f′(x)", yt: 4 });
        axBox(ctx, R.iv, vi, { yl: '∫₀ˣ f', yt: 4 });
        capTag(ctx, '主图 f(x) · 蓝色粗线', R.main.x, R.main.y - 24, COL.blue);
        capTag(ctx, "导数 f′(x) · 中央差商 h=0.05", R.dv.x, R.dv.y - 24, COL.orange);
        capTag(ctx, '累计积分 ∫₀ˣ f·梯形法', R.iv.x, R.iv.y - 24, COL.teal);
        /* 主图曲线与导数切线小棍 */
        plotBreaks(ctx, vm, fx, DOMX[0], DOMX[1], { col: COL.blue, w: 3.5, n: _rpc(260), jump: 400 });
        /* 积分子图：曲线 + 相对 0 的阴影带 */
        bandFill(ctx, vi, function (x) { return trapz(fx, 0, x, _rpc(60)); }, DOMX[0], DOMX[1], COL.teal, vi.Y(0), _rpc(120));
        plotBreaks(ctx, vi, function (x) { return trapz(fx, 0, x, _rpc(60)); }, DOMX[0], DOMX[1], { col: COL.teal, w: 2.5, n: _rpc(130), jump: 200 });
        plotBreaks(ctx, vd, function (x) { return dCenter(fx, x, 0.05); }, DOMX[0], DOMX[1], { col: COL.orange, w: 2.5, n: _rpc(130), jump: 250 });
        /* 样条控制点 + 切线小棍 */
        if (st.fam === 'spline') {
          for (var i = 0; i < 6; i++) {
            var px = vm.X(st.XS[i]), py = vm.Y(st.ys[i]);
            var tg = dCenter(function (u) { return spl(u); }, st.XS[i], 0.06);
            var L = 22, nx = 1 / Math.sqrt(1 + tg * tg), nyv = tg * nx;
            K.polyline(ctx, [{ x: px - L * nx, y: py + L * nyv }, { x: px + L * nx, y: py - L * nyv }], { color: 'rgba(255,255,255,0.65)', width: 2 });
            K.circle(ctx, px, py, st.drag === i ? 8 : 6, { fill: COL.yellow, stroke: 'rgba(0,0,0,0.5)', lineWidth: 1.5 });
          }
        }
        if (st.fam === 'spline') hintDrag(ctx, '👆 拖动控制点', vm.X(st.XS[0]), vm.Y(st.ys[0]) - 30);
        /* 三图联动的光标十字（优先悬停读数，其次滑块 x*） */
        var cx0 = hx == null ? cur : K.clamp(hx, DOMX[0], DOMX[1]);
        [[vm, R.main, COL.blue], [vd, R.dv, COL.orange], [vi, R.iv, COL.teal]].forEach(function (it) {
          var v2 = it[0], rc2 = it[1];
          var xp = v2.X(cx0);
          if (xp >= rc2.x && xp <= rc2.x + rc2.w)
            K.dashLine(ctx, xp, rc2.y, xp, rc2.y + rc2.h, { color: 'rgba(255,255,255,0.45)', dash: [5, 4] });
        });
        /* 三图曲线上的联动读数圆点 */
        K.circle(ctx, vm.X(cx0), vm.Y(f(cx0)), 4.5, { fill: COL.blue, stroke: '#fff', lineWidth: 1.2 });
        K.circle(ctx, vd.X(cx0), vd.Y(dCenter(f, cx0, 0.05)), 4, { fill: COL.orange, stroke: '#fff', lineWidth: 1 });
        K.circle(ctx, vi.X(cx0), vi.Y(trapz(f, 0, cx0, _rpc(60))), 4, { fill: COL.teal, stroke: '#fff', lineWidth: 1 });
        /* 悬停读数胶囊（跟随鼠标 x；拖动控制点时显示 y 值） */
        var hy = vm.Y(f(cx0));
        if (st.drag >= 0) {
          K.label(ctx, '控制点 y=' + K.fmt(st.ys[st.drag], 2), vm.X(st.XS[st.drag]), vm.Y(st.ys[st.drag]) - 18,
            { align: 'center', size: 11.5, color: COL.yellow });
        } else {
          K.chip(ctx, 'x=' + K.fmt(cx0, 2) + '   f=' + K.fmt(f(cx0), 2),
            Math.min(R.main.x + R.main.w - 128, Math.max(R.main.x + 6, vm.X(cx0) + 10)),
            K.clamp(hy - 26, R.main.y + 4, R.main.y + R.main.h - 26),
            { size: 12, bg: 'rgba(0,0,0,0.55)', color: TXT, pad: 6 });
        }
      }
      return {
        ctl: ctl, tick: function () {}, draw: draw,
        rows: function () {
          return [
            { label: 'f(x*)', value: K.fmt(f(st.cur), 3), color: COL.blue },
            { label: "f′(x*) 中央差商", value: K.fmt(dCenter(f, st.cur, 0.05), 3), color: COL.orange },
            { label: '∫₀^{x*} 梯形累加', value: K.fmt(trapz(f, 0, st.cur, _rpc(200)), 3), color: COL.teal }
          ];
        },
        hitTest: function (x, y, W, H) {
          if (st.fam !== 'spline') return false;
          var rc = rects(W, H).main, vm = mku(rc, DOMX, [-3, 3]);
          for (var i = 0; i < 6; i++) {
            if (Math.hypot(x - vm.X(st.XS[i]), y - vm.Y(st.ys[i])) < 15) return true;
          }
          return false;
        },
        reset: function () {
          st.fam = 'spline'; st.cur = -1.5; st.hover = null; st.drag = -1;
          st.ys = [-1.4, 0.9, 2.1, 1.3, -0.7, -2.2];
        },
        down: function (x, y, W, H) {
          var rc = rects(W, H).main, vm = mku(rc, DOMX, [-3, 3]), i;
          for (i = 0; i < 6; i++) {
            if (Math.hypot(x - vm.X(st.XS[i]), y - vm.Y(st.ys[i])) < 15) { st.drag = i; return; }
          }
        },
        move: function (x, y, W, H) {
          var rc = rects(W, H).main, vm = mku(rc, DOMX, [-3, 3]);
          if (st.drag >= 0) { st.ys[st.drag] = K.clamp(vm.YI(y), -2.85, 2.85); st.hover = null; return; }
          if (x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h) st.hover = vm.XI(x);
          else st.hover = null;
        },
        up: function () { st.drag = -1; },
        presets: function () {
          return [
            { name: '样条山丘', apply: function () { st.fam = 'spline'; st.ys = [-2.2, -1.1, 1.2, 2.3, 0.3, -1.7]; } },
            { name: '正弦缓坡', apply: function () { st.fam = 'wave'; } },
            { name: '双高斯峰谷', apply: function () { st.fam = 'gauss'; } }
          ];
        }
      };
    }
    /* ================= 知识点 ================= */
    var KNOW = {
      calculus: '<p>导数 f′(x) 是曲线的<b>瞬时斜率</b>：中央差商 [f(x+h)−f(x−h)]/(2h) 用左右邻点平均变化率近似切线。积分 ∫₀ˣ f(t)dt 是曲线下的<b>有向面积</b>：梯形法把区间切小条、逐块累加。拖动黄色控制点改变 f，观察"f′ 的过零点 ↔ f 的极值 ↔ 积分的极值"三者的对应关系。</p>',
      lines: '<p>直线由<b>斜率 m</b> 与 <b>截距 b</b> 完全确定：y = m·x + b。m 表示 x 每增加 1 时 y 增加 m（横向平 run、纵向升 rise）；b 是直线与 y 轴交点的高度。拖动线上的粉色标记点，验证它的坐标总满足方程。</p>',
      slopeint: '<p><b>斜截式</b> y = m·x + b 直接读出斜率与截距；<b>两点式</b>先算 m = (y₂−y₁)/(x₂−x₁)，再代回 b = y₁ − m·x₁。绿色/黄色虚线箭头分别是"竖升 rise / 横平 run"，二者之比就是 m。</p>',
      quad: '<p>抛物线 y = a·x² + b·x + c（a≠0）：顶点在 (−b/2a, f(−b/2a))，对称轴 x = −b/2a；判别式 <b>Δ = b² − 4ac</b> 决定与 x 轴的交点——Δ&gt;0 两个实根、Δ=0 相切、Δ&lt;0 无实根（只有复数解）。</p>',
      trig: '<p>单位圆上逆时针旋转的点，其坐标是 (cosθ, sinθ)：纵投影是正弦、横投影是余弦。右侧滚动曲线把"角度 → 高度"随时间铺开，形成周期波形；tanθ = sinθ/cosθ 在 cosθ=0 处趋于渐近线（±∞）。</p>',
      fitline: '<p>手动调整拟合直线时，每个点到直线的<b>竖直残差</b>画成正方形，SSE = Σ残差² 衡量整体误差。<b>最小二乘法</b>给出使 SSE 最小的唯一解（正规方程解），R² 表示模型解释了数据变异的比例。</p>',
      regression: '<p><b>普通最小二乘(OLS)</b> 对散点即时求解 ŷ = a + b·x：b̂ = Σ(xᵢ−x̄)(yᵢ−ȳ)/Σ(xᵢ−x̄)²。R² 度量相关强度；斜率标准误 SE(b) ≈ √[ SSE/(n−2)/Sxx ] 反映估计的不确定性。左键加点、右键或双击删点，观察统计量如何实时响应。</p>'
    };

    /* ================================================================
     * 模式 2/3 lines & slopeint —— 直线绘图 / 斜率截距式
     * y = m·x + b；rise/run 阶梯虚线箭头；线上可拖 marker 吸附整点；
     * slopeint 强调截距脉冲点 + 中文横平/竖升标注 + 斜截式/两点式反解。
     * ============================================================== */
    function mkLin(kind) {
      var DOMN = [-10, 10];
      var st = {
        m: 1.25, b: -2, show: true, form: kind === 'si' ? 'si' : null,
        mkx: 4, p1: { x: -6, y: -3 }, p2: { x: 4, y: 4 }, drg: 0
      };
      function eff() { /* 两点式时由 P₁/P₂ 反解出当前生效的 m 与 b */
        if (st.form === 'pt') {
          var dx = st.p2.x - st.p1.x, dyv = st.p2.y - st.p1.y;
          var mm = Math.abs(dx) < 0.05 ? (dyv >= 0 ? 98 : -98) : dyv / dx; // 竖直退化保护
          return { m: mm, b: st.p1.y - mm * st.p1.x, dx: dx, dy: dyv };
        }
        return { m: st.m, b: st.b, dx: 1, dy: st.m };
      }
      function backToSI() { if (st.form === 'pt') st.form = 'si'; }
      function ctl() {
        var arr = [
          { id: 'gl_m_' + kind, type: 'slider', label: '斜率 m', min: -5, max: 5, step: 0.25, value: st.m,
            onChange: function (v) { st.m = v; backToSI(); } },
          { id: 'gl_b_' + kind, type: 'slider', label: '截距 b', min: -10, max: 10, step: 0.5, value: st.b,
            onChange: function (v) { st.b = v; backToSI(); } }
        ];
        if (kind === 'ln') arr.push({ id: 'gl_show', type: 'checkbox', label: '显示 rise/run 阶梯箭头', value: st.show,
          onChange: function (v) { st.show = !!v; } });
        else arr.unshift({ id: 'gl_form', type: 'select', label: '展示形式', value: st.form,
          options: [{ value: 'si', label: '斜截式' }, { value: 'pt', label: '两点式（拖动 P₁ / P₂）' }],
          onChange: function (v) { st.form = String(v); } });
        return arr;
      }
      function draw(ctx, W, H, t) {
        var rc = { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) };
        var v = mku(rc, DOMN, DOMN);
        axBox(ctx, rc, v, {});
        var e = eff();
        capTag(ctx, kind === 'si' ? '斜率截距式 y = m·x + b' : '直线绘图 y = m·x + b', rc.x, rc.y - 24, COL.blue);
        withClip(ctx, rc, function () {
          /* 直线本体 */
          K.polyline(ctx, [
            { x: v.X(DOMN[0]), y: v.Y(e.m * DOMN[0] + e.b) },
            { x: v.X(DOMN[1]), y: v.Y(e.m * DOMN[1] + e.b) }], { color: COL.blue, width: 3.5 });
          /* rise/run 阶梯：从 (0,b) 出发先横平 run 再竖升 rise */
          if (kind === 'si' || st.show) {
            var runW = Math.min(2, 8.6 / Math.max(1, Math.abs(e.m))), riseH = e.m * runW;
            var bx = v.X(0), by = v.Y(e.b), mxp = v.X(runW), myp = v.Y(e.b + riseH);
            dashArrow(ctx, bx, by, mxp, by, COL.yellow);
            dashArrow(ctx, mxp, by, mxp, myp, COL.green);
            if (kind === 'si') {
              K.label(ctx, '横平 run', (bx + mxp) / 2, by + (riseH >= 0 ? 15 : -15), { align: 'center', size: 11.5, color: COL.yellow });
              K.label(ctx, '竖升 rise', mxp + (runW >= 0 ? 36 : -36), (by + myp) / 2, { align: 'center', size: 11.5, color: COL.green });
            }
            /* 截距强调：b 点脉冲圆环 + 名词标注（仅斜率截距式） */
            if (Math.abs(e.b) <= 10.01) {
              K.circle(ctx, bx, by, 9 + 3 * Math.sin(t * 4), { stroke: COL.yellow, lineWidth: 2, alpha: 0.85 });
              K.circle(ctx, bx, by, 5, { fill: COL.yellow });
              K.chip(ctx, '截距 b = ' + K.fmt(e.b, 2), K.clamp(bx + 14, rc.x + 6, rc.x + rc.w - 120), by - 26,
                { size: 12, bg: 'rgba(0,0,0,0.45)', color: COL.yellow });
            }
          }
        });
        /* 两点式：可拖点 + 分数推导过程 */
        if (st.form === 'pt') {
          var sxx = rc.x + rc.w - 226, syy = rc.y + 8;
          [['m = (y₂ − y₁) ⁄ (x₂ − x₁)', DIM],
           ['  = (' + sg(st.p2.y - st.p1.y, 2) + ') ⁄ (' + sg(st.p2.x - st.p1.x, 2) + ') = ' + K.fmt(e.m, 2), TXT],
           ['b = y₁ − m·x₁ = ' + K.fmt(st.p1.y, 2) + ' − ' + K.fmt(e.m, 2) + '×' + K.fmt(st.p1.x, 2), DIM],
           ['  = ' + K.fmt(e.b, 2), COL.green]].forEach(function (row, ri) {
            K.label(ctx, row[0], sxx + 4, syy + ri * 19 + 11, { size: 12.5, color: row[1], weight: ri % 2 ? 'bold' : 'normal' });
          });
          [[st.p1, 'P₁', COL.orange], [st.p2, 'P₂', COL.teal]].forEach(function (pp, pi) {
            var px = v.X(pp[0].x), py = v.Y(pp[0].y), hot = st.drg === pi + 2;
            K.circle(ctx, px, py, hot ? 9 : 7, { fill: pp[2], stroke: '#fff', lineWidth: 1.4 });
            K.label(ctx, pp[1] + '(' + K.fmt(pp[0].x, 2) + ', ' + K.fmt(pp[0].y, 2) + ')',
              px, py - 16, { align: 'center', size: 11.5, color: pp[2] });
          });
        }
        /* 线上整点 marker：跟随拖动并吸附整数坐标标注 */
        var cyy = e.m * st.mkx + e.b;
        K.circle(ctx, v.X(st.mkx), v.Y(cyy), 6.5, { fill: COL.pink, stroke: '#fff', lineWidth: 1.6 });
        var nx = Math.round(st.mkx), ny = Math.round(e.m * nx + e.b);
        if (Math.abs(nx) > 10 || Math.abs(ny) > 10) ny = Math.round(cyy);
        K.chip(ctx, '整点 (' + nx + ', ' + ny + ') 在线上 ✓',
          K.clamp(v.X(st.mkx) - 46, rc.x + 6, rc.x + rc.w - 122),
          K.clamp(v.Y(cyy) + 14, rc.y + 6, rc.y + rc.h - 26),
          { size: 12, bg: 'rgba(0,0,0,0.5)', color: COL.pink });
        hintDrag(ctx, '👆 拖动整点', v.X(st.mkx), v.Y(cyy) - 26);
        if (st.form === 'pt') {
          hintDrag(ctx, '👆 拖动P₁', v.X(st.p1.x), v.Y(st.p1.y) - 28);
          hintDrag(ctx, '👆 拖动P₂', v.X(st.p2.x), v.Y(st.p2.y) - 28);
        }
      }
      function rectOf(W, H) { return { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) }; }
      function down(x, y, W, H) {
        var v = mku(rectOf(W, H), DOMN, DOMN);
        if (st.form === 'pt') {
          if (Math.hypot(x - v.X(st.p1.x), y - v.Y(st.p1.y)) < 16) { st.drg = 2; return; }
          if (Math.hypot(x - v.X(st.p2.x), y - v.Y(st.p2.y)) < 16) { st.drg = 3; return; }
        }
        if (Math.hypot(x - v.X(st.mkx), y - v.Y(eff().m * st.mkx + eff().b)) < 16) st.drg = 1;
      }
      function move(x, y, W, H) {
        if (!st.drg) return;
        var v = mku(rectOf(W, H), DOMN, DOMN);
        if (st.drg === 1) st.mkx = K.clamp(v.XI(x), -9.6, 9.6);
        else {
          var p = st.drg === 2 ? st.p1 : st.p2; /* 拖点吸附 0.5 半格 */
          p.x = K.clamp(Math.round(v.XI(x) * 2) / 2, -10, 10);
          p.y = K.clamp(Math.round(v.YI(y) * 2) / 2, -10, 10);
        }
      }
      function up() { st.drg = 0; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var e = eff(), eq = 'y = ' + K.fmt(e.m, 2) + ' x ' + sg(e.b), arr = [
            { label: '斜率 m', value: K.fmt(e.m, 2), color: COL.blue },
            { label: '截距 b', value: K.fmt(e.b, 2), color: COL.yellow },
            { label: kind === 'si' && st.form === 'pt' ? '反解方程' : '方程', value: eq }];
          if (kind === 'si') arr.push({ label: '展示形式', value: st.form === 'pt' ? '两点式' : '斜截式', color: COL.teal });
          return arr;
        },
        hitTest: function (x, y, W, H) {
          var v = mku(rectOf(W, H), DOMN, DOMN);
          if (st.form === 'pt') {
            if (Math.hypot(x - v.X(st.p1.x), y - v.Y(st.p1.y)) < 16) return true;
            if (Math.hypot(x - v.X(st.p2.x), y - v.Y(st.p2.y)) < 16) return true;
          }
          return Math.hypot(x - v.X(st.mkx), y - v.Y(eff().m * st.mkx + eff().b)) < 16;
        },
        reset: function () {
          st.m = 1.25; st.b = -2; st.show = true; st.mkx = 4; st.drg = 0;
          st.p1 = { x: -6, y: -3 }; st.p2 = { x: 4, y: 4 };
          if (kind === 'si') st.form = 'si';
        },
        presets: function () {
          return kind === 'ln'
            ? [{ name: '正比例 y = 2x', apply: function () { st.m = 2; st.b = 0; } },
               { name: '水平线 y = 3', apply: function () { st.m = 0; st.b = 3; } },
               { name: '缓降线', apply: function () { st.m = -0.75; st.b = 6; } }]
            : [{ name: '陡峭上升', apply: function () { st.form = 'si'; st.m = 3; st.b = -4; } },
               { name: '缓慢下降', apply: function () { st.form = 'si'; st.m = -0.75; st.b = 5; } },
               { name: '两点式示例', apply: function () { st.form = 'pt'; st.p1 = { x: -4, y: -2 }; st.p2 = { x: 5, y: 3 }; } }];
        }
      };
    }

    /* ================================================================
     * 模式 4 quad —— 二次函数图像
     * y = a·x²+b·x+c（|a|≥0.1 防 0）；顶点星标 + 对称轴虚线 +
     * 判别式 Δ=b²−4ac 定实根；Δ<0 灰色提示无实根。
     * ============================================================== */
    function mdQuad() {
      var DOMN = [-8, 8], DOMY = [-11, 11];
      var st = { a: 1, b: 0, c: -1, drag: false };
      function f(x) { return st.a * x * x + st.b * x + st.c; }
      function setA(v) { /* 防 0 钳制：|a| 最小 0.1，保持符号 */
        st.a = v;
        if (Math.abs(st.a) < 0.1) st.a = st.a < 0 ? -0.1 : 0.1;
      }
      function ctl() {
        return [
          { id: 'qd_a', type: 'slider', label: '系数 a', min: -3, max: 3, step: 0.1, value: K.clamp(st.a, -3, 3),
            onChange: function (v) { setA(v); } },
          { id: 'qd_b', type: 'slider', label: '系数 b', min: -5, max: 5, step: 0.1, value: st.b,
            onChange: function (v) { st.b = v; } },
          { id: 'qd_c', type: 'slider', label: '系数 c', min: -5, max: 5, step: 0.1, value: st.c,
            onChange: function (v) { st.c = v; } }
        ];
      }
      function draw(ctx, W, H, t) {
        var rc = { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) };
        var v = mku(rc, DOMN, DOMY);
        axBox(ctx, rc, v, {});
        capTag(ctx, '二次函数 y = a·x² + b·x + c', rc.x, rc.y - 24, COL.blue);
        K.chip(ctx, 'y = ' + K.fmt(st.a, 2) + 'x² ' + sg(st.b) + 'x ' + sg(st.c), rc.x + 200, rc.y - 24,
          { size: 13, bg: 'rgba(52,152,219,0.25)', color: TXT });
        var hv = -st.b / (2 * st.a);          // 对称轴 / 顶点横坐标 = −b/2a
        var kv = f(hv);
        var disc = st.b * st.b - 4 * st.a * st.c; // 判别式 Δ = b²−4ac
        withClip(ctx, rc, function () {
          plotBreaks(ctx, v, f, DOMN[0], DOMN[1], { col: COL.blue, w: 3.5, n: 300, jump: 90 });
          /* 对称轴虚线 */
          K.dashLine(ctx, v.X(hv), rc.y + 4, v.X(hv), rc.y + rc.h - 4, { color: 'rgba(255,255,255,0.4)', dash: [6, 5], width: 1.5 });
          K.label(ctx, '对称轴 x=' + K.fmt(hv, 2), v.X(hv) + 8, rc.y + 12, { size: 11.5, color: DIM });
          /* 实根圆点 或 无实根提示 */
          if (disc >= 0) {
            var sq = Math.sqrt(disc), r1 = (-st.b + sq) / (2 * st.a), r2 = (-st.b - sq) / (2 * st.a);
            [r1, r2].forEach(function (r0, i) {
              if (i === 1 && Math.abs(r0 - r1) < 1e-6) return;
              var px = v.X(r0);
              K.circle(ctx, px, v.Y(0), 5.5, { fill: COL.green, stroke: '#fff', lineWidth: 1.3 });
              K.label(ctx, 'x=' + K.fmt(r0, 2), px, v.Y(0) + (kv >= 0 ? 18 : -18), { align: 'center', size: 11.5, color: COL.green });
            });
          } else {
            K.chip(ctx, 'Δ < 0 ：无实根（复数解）', rc.x + rc.w / 2 - 74, rc.y + 40, { size: 13, bg: 'rgba(149,165,166,0.22)', color: COL.gray });
          }
          /* 顶点星标（视野内才画） */
          if (hv >= DOMN[0] && hv <= DOMN[1]) {
            if (st.drag) K.circle(ctx, v.X(hv), v.Y(kv), 14, { stroke: COL.yellow, lineWidth: 2.5 });
            starAt(ctx, v.X(hv), v.Y(kv), 9, COL.yellow);
            K.chip(ctx, '顶点 (' + K.fmt(hv, 2) + ', ' + K.fmt(kv, 2) + ')',
              K.clamp(v.X(hv) + 12, rc.x + 6, rc.x + rc.w - 130), K.clamp(v.Y(kv) - 14, rc.y + 26, rc.y + rc.h - 30),
              { size: 12, bg: 'rgba(0,0,0,0.5)', color: COL.yellow });
          }
        });
        if (hv >= DOMN[0] && hv <= DOMN[1]) hintDrag(ctx, '👆 拖动顶点', v.X(hv), v.Y(kv) - 34);
        K.chip(ctx, 'Δ = ' + K.fmt(disc, 2), rc.x + rc.w - 88, rc.y - 24,
          { size: 12.5, bg: disc >= 0 ? 'rgba(39,174,96,0.28)' : 'rgba(149,165,166,0.25)', color: disc >= 0 ? COL.green : COL.gray });
      }
      return {
        ctl: ctl, tick: function () {}, draw: draw,
        rows: function () {
          var disc = st.b * st.b - 4 * st.a * st.c, hv = -st.b / (2 * st.a), kv = f(hv), rt;
          if (disc < 0) rt = '无实根';
          else {
            var sq = Math.sqrt(disc), r1 = (-st.b + sq) / (2 * st.a), r2 = (-st.b - sq) / (2 * st.a);
            rt = Math.abs(r1 - r2) < 1e-6 ? 'x=' + K.fmt(r1, 2) : 'x₁=' + K.fmt(r1, 2) + ', x₂=' + K.fmt(r2, 2);
          }
          return [
            { label: 'a / b / c', value: K.fmt(st.a, 2) + ' / ' + K.fmt(st.b, 2) + ' / ' + K.fmt(st.c, 2), color: COL.blue },
            { label: '顶点', value: '(' + K.fmt(hv, 2) + ', ' + K.fmt(kv, 2) + ')', color: COL.yellow },
            { label: '判别式 Δ', value: K.fmt(disc, 2), color: disc >= 0 ? COL.green : COL.gray },
            { label: '实根', value: rt, color: COL.teal }
          ];
        },
        hitTest: function (x, y, W, H) {
          var rc = { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) };
          var v = mku(rc, DOMN, DOMY);
          var hv = -st.b / (2 * st.a), kv = f(hv);
          return hv >= DOMN[0] && hv <= DOMN[1] && Math.hypot(x - v.X(hv), y - v.Y(kv)) < 20;
        },
        reset: function () { st.a = 1; st.b = 0; st.c = -1; st.drag = false; },
        down: function (x, y, W, H) {
          var rc = { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) };
          var v = mku(rc, DOMN, DOMY);
          var hv = -st.b / (2 * st.a), kv = f(hv);
          if (hv >= DOMN[0] && hv <= DOMN[1] && Math.hypot(x - v.X(hv), y - v.Y(kv)) < 20) st.drag = true;
        },
        move: function (x, y, W, H) {
          if (!st.drag) return;
          var rc = { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) };
          var v = mku(rc, DOMN, DOMY);
          var h = K.clamp(v.XI(x), DOMN[0], DOMN[1]);
          var k = K.clamp(v.YI(y), DOMY[0], DOMY[1]);
          st.b = -2 * st.a * h;
          st.c = st.a * h * h + k;
        },
        up: function () { st.drag = false; },
        presets: function () {
          return [
            { name: '标准抛物线 y=x²−1', apply: function () { st.a = 1; st.b = 0; st.c = -1; } },
            { name: '开口向下双根', apply: function () { st.a = -0.6; st.b = 1; st.c = 3; } },
            { name: '悬空无实根', apply: function () { st.a = 0.35; st.b = -1; st.c = 2.6; } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 5 trig —— 三角函数之旅
     * 左单位圆（r=90px）θ 旋转点，sin/cos 虚线投影三角板，虚线连至
     * 右侧滚动曲线窗 [θ−4π, θ]：sin 红 cos 蓝 tan 紫(tan|y|≤4 截断)。
     * ============================================================== */
    function mdTrig() {
      var TAU = PI * 2;
      var st = { th: PI / 3, sp: 0.8, sin: true, cos: true, tan: false, drag: false };
      /* 移动端按 particleScale 缩放曲线采样点；桌面端原值不变 */
      var _rpc = function (n) { return window.Mobile ? window.Mobile.reduceParticleCount(n) : n; };
      function tick(dt) { /* 播放时角度匀速推进，越界取模保持连续 */
        st.th += st.sp * dt;
        if (Math.abs(st.th) > 1e4) st.th = ((st.th % TAU) + TAU) % TAU;
      }
      function ctl() {
        return [
          { id: 'tg_sp', type: 'slider', label: '角速度 ω (rad/s)', min: 0.2, max: 3, step: 0.1, value: st.sp,
            onChange: function (v) { st.sp = v; } },
          { id: 'tg_sin', type: 'checkbox', label: '显示 sin 曲线（红）', value: st.sin, onChange: function (v) { st.sin = !!v; } },
          { id: 'tg_cos', type: 'checkbox', label: '显示 cos 曲线（蓝）', value: st.cos, onChange: function (v) { st.cos = !!v; } },
          { id: 'tg_tan', type: 'checkbox', label: '显示 tan 曲线（紫）', value: st.tan, onChange: function (v) { st.tan = !!v; } }
        ];
      }
      function tanC(u) { var w = Math.tan(u); return Math.abs(w) <= 4 ? w : NaN; } // 渐近线截断
      function draw(ctx, W, H, t) {
        var cx = Math.max(150, W * 0.22), cy = H * 0.55;
        var r = Math.min(90, (H - 150) / 2, cx - 36);
        var pr = { x: cx + r + 62, y: H * 0.16, w: Math.max(120, W - (cx + r) - 86), h: Math.max(110, H * 0.46) };
        var vw = mku(pr, [st.th - 4 * PI, st.th], [-4.3, 4.3]);
        axBox(ctx, pr, vw, { xt: 8 });
        capTag(ctx, '单位圆 → 滚动波形', pr.x, pr.y - 24, COL.pink);
        /* 单位圆与坐标细十字 */
        K.circle(ctx, cx, cy, r, { stroke: 'rgba(255,255,255,0.30)', lineWidth: 2 });
        K.dashLine(ctx, cx - r - 14, cy, cx + r + 14, cy, { color: 'rgba(255,255,255,0.18)' });
        K.dashLine(ctx, cx, cy - r - 14, cx, cy + r + 14, { color: 'rgba(255,255,255,0.18)' });
        var pxs = cx + Math.cos(st.th) * r, pys = cy - Math.sin(st.th) * r;
        /* 半径杆 + 投影三角板（cos 蓝横、sin 红竖） */
        K.polyline(ctx, [{ x: cx, y: cy }, { x: pxs, y: pys }], { color: COL.pink, width: 2 });
        K.dashLine(ctx, cx, pys, pxs, pys, { color: COL.blue, dash: [5, 4], width: 1.8 });
        K.dashLine(ctx, pxs, cy, pxs, pys, { color: COL.red, dash: [5, 4], width: 1.8 });
        K.label(ctx, 'cos', (cx + pxs) / 2, pys - 10, { align: 'center', size: 11, color: COL.blue });
        K.label(ctx, 'sin', pxs + (Math.cos(st.th) >= 0 ? 20 : -20), (cy + pys) / 2, { align: 'center', size: 11, color: COL.red });
        if (st.drag) K.circle(ctx, pxs, pys, 13, { stroke: COL.yellow, lineWidth: 2.5 });
        K.circle(ctx, pxs, pys, 7, { fill: COL.pink, stroke: '#fff', lineWidth: 1.5 });
        hintDrag(ctx, '👆 拖动角度', cx, cy - r - 68);
        /* 连接虚线：圆上点 → 曲线右缘当前值 */
        var ex = pr.x + pr.w;
        if (st.sin) {
          K.dashLine(ctx, pxs, pys, ex, vw.Y(Math.sin(st.th)), { color: 'rgba(231,76,60,0.55)', dash: [6, 5] });
          K.circle(ctx, ex, vw.Y(Math.sin(st.th)), 4.5, { fill: COL.red });
        }
        if (st.cos) {
          K.dashLine(ctx, cx, pys, ex, vw.Y(Math.cos(st.th)), { color: 'rgba(52,152,219,0.45)', dash: [4, 6] });
          K.circle(ctx, ex, vw.Y(Math.cos(st.th)), 4.5, { fill: COL.blue });
        }
        /* 滚动曲线窗 [θ−4π, θ]，tan 在渐近线处断开 */
        withClip(ctx, pr, function () {
          if (st.sin) plotBreaks(ctx, vw, Math.sin, st.th - 4 * PI, st.th, { col: COL.red, w: 2.6, n: _rpc(300), jump: 40 });
          if (st.cos) plotBreaks(ctx, vw, Math.cos, st.th - 4 * PI, st.th, { col: COL.blue, w: 2.6, n: _rpc(300), jump: 40 });
          if (st.tan) plotBreaks(ctx, vw, tanC, st.th - 4 * PI, st.th, { col: COL.purple, w: 2.2, n: _rpc(420), jump: 30 });
          K.polyline(ctx, [{ x: ex - 1, y: pr.y }, { x: ex - 1, y: pr.y + pr.h }], { color: 'rgba(255,255,255,0.22)', width: 1.5 });
        });
        /* θ 大字读数：rad 与 deg 双显示 */
        var thm = ((st.th % TAU) + TAU) % TAU;
        K.label(ctx, 'θ = ' + K.fmt(thm, 2) + ' rad', cx, cy - r - 44, { align: 'center', size: 21, weight: 'bold', color: COL.yellow });
        K.label(ctx, '= ' + K.fmt(thm * 180 / PI, 1) + '°', cx, cy - r - 22, { align: 'center', size: 13.5, color: DIM });
        K.label(ctx, '点 (cosθ, sinθ) 在圆上转动', cx, cy + r + 22, { align: 'center', size: 11.5, color: DIM });
      }
      function down(x, y, W, H) { /* 点击圆周附近可直接拖定角度 */
        var cx = Math.max(150, W * 0.22), cy = H * 0.55;
        var rr = Math.min(90, (H - 150) / 2, cx - 36);
        if (Math.hypot(x - cx, y - cy) < rr * 1.25) {
          st.th = Math.atan2(cy - y, x - cx);
          st.drag = true;
        }
      }
      function move(x, y, W, H) {
        if (!st.drag) return;
        var cy = H * 0.55;
        st.th = Math.atan2(cy - y, x - Math.max(150, W * 0.22));
      }
      function up() { st.drag = false; }
      return {
        ctl: ctl, tick: tick, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var tv = Math.tan(st.th), tStr = Math.abs(tv) > 999 ? '∞ (渐近线)' : K.fmt(tv, 3);
          var thm = ((st.th % TAU) + TAU) % TAU;
          return [
            { label: 'sin θ', value: K.fmt(Math.sin(st.th), 3), color: COL.red },
            { label: 'cos θ', value: K.fmt(Math.cos(st.th), 3), color: COL.blue },
            { label: 'tan θ', value: tStr, color: COL.purple },
            { label: 'θ (rad)', value: K.fmt(thm, 2), color: COL.yellow }
          ];
        },
        hitTest: function (x, y, W, H) {
          var cx = Math.max(150, W * 0.22), cy = H * 0.55;
          var rr = Math.min(90, (H - 150) / 2, cx - 36);
          return Math.hypot(x - cx, y - cy) < rr * 1.25;
        },
        reset: function () { st.th = PI / 3; st.sp = 0.8; st.sin = true; st.cos = true; st.tan = false; st.drag = false; },
        presets: function () {
          return [
            { name: '慢速观察', apply: function () { st.sp = 0.25; } },
            { name: '快速旋转', apply: function () { st.sp = 2.6; } },
            { name: '只看正切', apply: function () { st.sin = false; st.cos = false; st.tan = true; } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 6 fitline —— 曲线拟合
     * 20 个固定种子数据点（真线 y=1.2x+3，σ=2）；拖动 a/b 手动拟合，
     * 残差方形可视化（边长=|dy|），SSE 大字 + 绿色进度 vs 预计算最优解；
     * 按钮 0.8s 缓动收敛到最小二乘解。
     * ============================================================== */
    function mdFitline() {
      var PTS = [];
      (function () { /* 固定 seed 生成：y = 1.2x + 3 + N(0, 2²) */
        var r = K.rng(7331), i;
        for (i = 0; i < 20; i++) {
          var x = -8.4 + i * (16.8 / 19) + (r() - 0.5) * 1.4;
          PTS.push({ x: x, y: 1.2 * x + 3 + randn(r) * 2 });
        }
      })();
      var OPT = lstsq(PTS);               // 预计算最优最小二乘解 {a,b,sse,r2}
      var SSTV = sstot(PTS);
      var st = { a: 0.2, b: 1.5, dragIdx: null };
      var DOMN = [-10.5, 10.5], DOMY = [-9, 21];
      function ctl() {
        return [
          { id: 'fl_a', type: 'slider', label: '拟合斜率 a', min: -5, max: 5, step: 0.05, value: st.a,
            onChange: function (v) { st.a = v; } },
          { id: 'fl_b', type: 'slider', label: '拟合截距 b', min: -10, max: 10, step: 0.1, value: st.b,
            onChange: function (v) { st.b = v; } },
          { id: 'fl_go', type: 'button', label: '最小二乘自动求解',
            action: function () { twStart(st, 'a', OPT.a, 900); twStart(st, 'b', OPT.b, 900, function () { toast('已收敛到最优拟合'); }); } }
        ];
      }
      function rectOf(W, H) { return { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) }; }
      function draw(ctx, W, H, t) {
        var rc = rectOf(W, H), v = mku(rc, DOMN, DOMY);
        axBox(ctx, rc, v, { xl: 'x', yl: 'y' });
        capTag(ctx, '曲线拟合：手动调整 y = a·x + b', rc.x, rc.y - 24, COL.green);
        var sse = sseOf(PTS, st.a, st.b);
        var r2 = SSTV > 1e-9 ? Math.max(0, 1 - sse / SSTV) : 0;
        withClip(ctx, rc, function () {
          /* 最优解参考虚线 */
          K.dashLine(ctx, v.X(DOMN[0]), v.Y(OPT.a * DOMN[0] + OPT.b), v.X(DOMN[1]), v.Y(OPT.a * DOMN[1] + OPT.b),
            { color: 'rgba(39,174,96,0.55)', dash: [7, 6], width: 1.5 });
          /* 当前拟合线 */
          K.polyline(ctx, [{ x: v.X(DOMN[0]), y: v.Y(st.a * DOMN[0] + st.b) }, { x: v.X(DOMN[1]), y: v.Y(st.a * DOMN[1] + st.b) }],
            { color: COL.orange, width: 3 });
          /* 残差方块：竖直方向贴在直线与数据点之间，边长 = |dy| */
          PTS.forEach(function (p) {
            var ly = st.a * p.x + st.b, dyv = p.y - ly;
            if (Math.abs(dyv) < 0.15) return;
            var side = Math.abs(v.Y(p.y) - v.Y(ly));
            var top = Math.min(v.Y(p.y), v.Y(ly));
            K.panel(ctx, v.X(p.x) - side / 2, top, side, side,
              { fill: 'rgba(231,76,60,0.15)', stroke: 'rgba(231,76,60,0.55)', lineWidth: 1, radius: 2 });
          });
          /* 数据点：深底白圈散点 */
          PTS.forEach(function (p, i) {
            if (st.dragIdx === i) K.circle(ctx, v.X(p.x), v.Y(p.y), 9, { stroke: COL.yellow, lineWidth: 2.5 });
            K.circle(ctx, v.X(p.x), v.Y(p.y), 4, { fill: '#ffffff', stroke: 'rgba(45,52,54,0.8)', lineWidth: 1.2 });
          });
        });
        hintDrag(ctx, '👆 拖动数据点', rc.x + 44, rc.y + 20);
        /* SSE 面板：大字 + 绿色进度（当前/最优） */
        var pw = 200, ph = 86, px0 = rc.x + rc.w - pw - 10, py0 = rc.y + 10;
        K.panel(ctx, px0, py0, pw, ph, { fill: 'rgba(0,0,0,0.38)', radius: 10 });
        K.label(ctx, '误差平方和 SSE', px0 + pw / 2, py0 + 17, { align: 'center', size: 12.5, color: DIM });
        K.label(ctx, K.fmt(sse, 1), px0 + pw / 2, py0 + 40, { align: 'center', size: 22, weight: 'bold', color: COL.yellow });
        var frac = sse > 1e-9 ? K.clamp(OPT.sse / sse, 0, 1) : 1;
        K.roundRect(ctx, px0 + 12, py0 + 58, pw - 24, 9, 4.5);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
        if (frac > 0.01) {
          K.roundRect(ctx, px0 + 12, py0 + 58, Math.max(9, (pw - 24) * frac), 9, 4.5);
          ctx.fillStyle = COL.green; ctx.fill();
        }
        K.label(ctx, '距最优还差 ' + K.fmt((1 - frac) * 100, 1) + '%　最优 SSE=' + K.fmt(OPT.sse, 1),
          px0 + pw / 2, py0 + 76, { align: 'center', size: 11, color: DIM });
      }
      function down(x, y, W, H) {
        var rc = rectOf(W, H), v = mku(rc, DOMN, DOMY);
        for (var i = 0; i < PTS.length; i++) {
          if (Math.hypot(x - v.X(PTS[i].x), y - v.Y(PTS[i].y)) < 18) { st.dragIdx = i; return; }
        }
      }
      function move(x, y, W, H) {
        if (st.dragIdx == null) return;
        var rc = rectOf(W, H), v = mku(rc, DOMN, DOMY);
        PTS[st.dragIdx].x = K.clamp(v.XI(x), DOMN[0], DOMN[1]);
        PTS[st.dragIdx].y = K.clamp(v.YI(y), DOMY[0], DOMY[1]);
      }
      function up() { st.dragIdx = null; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var sse = sseOf(PTS, st.a, st.b);
          return [
            { label: 'SSE 当前', value: K.fmt(sse, 1), color: COL.red },
            { label: 'SSE 最优（最小二乘）', value: K.fmt(OPT.sse, 1), color: COL.green },
            { label: 'R²', value: K.fmt(SSTV > 1e-9 ? Math.max(0, 1 - sse / SSTV) : 0, 3), color: COL.teal }
          ];
        },
        hitTest: function (x, y, W, H) {
          var rc = rectOf(W, H), v = mku(rc, DOMN, DOMY);
          for (var i = 0; i < PTS.length; i++) {
            if (Math.hypot(x - v.X(PTS[i].x), y - v.Y(PTS[i].y)) < 18) return true;
          }
          return false;
        },
        reset: function () { TW = []; st.a = 0.2; st.b = 1.5; st.dragIdx = null; },
        presets: function () {
          return [
            { name: '故意拉偏', apply: function () { TW = []; st.a = -0.8; st.b = 8; } },
            { name: '缓慢逼近', apply: function () { TW = []; st.a = 0.05; st.b = 0.2; } },
            { name: '立即最优', apply: function () { TW = []; st.a = OPT.a; st.b = OPT.b; } }
          ];
        }
      };
    }
    /* ================================================================
     * 模式 7 regression —— 最小二乘回归
     * 点击空白加点 / 右键·Alt·双击删最近点；OLS 即时解 ŷ=a+b·x，
     * R² 相关气泡 + 残差直方图小窗；SE(b)=√[SSE/(n−2)/Sxx]。
     * ============================================================== */
    function mdRegression() {
      var st = { pts: [], sd: 1177, dragIdx: null };
      function gen(sd, slope, icept, noise) { /* 确定性重采样 */
        var r = K.rng(sd), i, out = [];
        for (i = 0; i < 12; i++) {
          var x = 0.6 + 9 * r();
          out.push({ x: x, y: K.clamp(slope * x + icept + randn(r) * noise, 0.4, 13.6) });
        }
        return out;
      }
      st.pts = gen(st.sd, 1.1, 3, 2.6);
      var DOMN = [0, 10], DOMY = [0, 14];
      function ols() { /* OLS 解析解：b̂=Σ(x−x̄)(y−ȳ)/Σ(x−x̄)² */
        var p = st.pts, n = p.length, i, sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (i = 0; i < n; i++) { sx += p[i].x; sy += p[i].y; }
        var mx = sx / n, my = sy / n;
        for (i = 0; i < n; i++) { var dx = p[i].x - mx, dyv = p[i].y - my; sxx += dx * dx; sxy += dx * dyv; }
        var b = sxx > 1e-9 ? sxy / sxx : 0, a = my - b * mx, sse = 0, syy = 0;
        for (i = 0; i < n; i++) { var e2 = p[i].y - (a + b * p[i].x); sse += e2 * e2; syy += Math.pow(p[i].y - my, 2); }
        var r2 = syy > 1e-9 ? Math.max(0, 1 - sse / syy) : 0;
        var se = (n > 2 && sxx > 1e-9) ? Math.sqrt(Math.max(0, sse) / (n - 2) / sxx) : 0;
        return { a: a, b: b, sse: sse, r2: r2, se: se };
      }
      function ctl() {
        return [
          { id: 'rg_re', type: 'button', label: '重新生成样本（正相关）',
            action: function () { st.sd += 977; st.pts = gen(st.sd, 1.1, 3, 2.6); toast('已生成 ' + st.pts.length + ' 个样本'); } },
          { id: 'rg_re2', type: 'button', label: '重新生成样本（负相关）',
            action: function () { st.sd += 977; st.pts = gen(st.sd, -0.9, 11, 2.6); toast('已生成 ' + st.pts.length + ' 个样本'); } }
        ];
      }
      function rectOf(W, H) { return { x: 56, y: 34, w: Math.max(160, W - 92), h: Math.max(140, H - 84) }; }
      function down(x, y, W, H, ev) { /* 空白处加；右键/Alt/双击删最近；靠近已有点则拖拽 */
        var rc = rectOf(W, H);
        if (!(x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h)) return;
        var v = mku(rc, DOMN, DOMY), now = performance.now();
        var del = !!(ev && (ev.altKey || ev.button === 2 || ev.detail > 1)) ||
                  (REG.lt && now - REG.lt < 340 && REG.lx != null && Math.hypot(x - REG.lx, y - REG.ly) < 12);
        REG.lt = now; REG.lx = x; REG.ly = y;
        if (del) {
          if (ev && ev.preventDefault) ev.preventDefault();
          var bi = -1, bd = 26, i;
          for (i = 0; i < st.pts.length; i++) {
            var d0 = Math.hypot(x - v.X(st.pts[i].x), y - v.Y(st.pts[i].y));
            if (d0 < bd) { bd = d0; bi = i; }
          }
          if (bi >= 0 && st.pts.length > 3) { st.pts.splice(bi, 1); toast('已删除一个数据点'); }
          else if (bi >= 0) toast('至少保留 3 个数据点');
          return;
        }
        /* 优先拖拽已有数据点，而非新增 */
        var hi = -1, hd = 18, i2;
        for (i2 = 0; i2 < st.pts.length; i2++) {
          var d1 = Math.hypot(x - v.X(st.pts[i2].x), y - v.Y(st.pts[i2].y));
          if (d1 < hd) { hd = d1; hi = i2; }
        }
        if (hi >= 0) { st.dragIdx = hi; return; }
        if (st.pts.length >= 80) { toast('点数已达上限'); return; }
        st.pts.push({ x: K.clamp(v.XI(x), 0.2, 9.8), y: K.clamp(v.YI(y), 0.2, 13.8) });
      }
      function move(x, y, W, H) {
        if (st.dragIdx == null) return;
        var rc = rectOf(W, H), v = mku(rc, DOMN, DOMY);
        st.pts[st.dragIdx].x = K.clamp(v.XI(x), 0.2, 9.8);
        st.pts[st.dragIdx].y = K.clamp(v.YI(y), 0.2, 13.8);
      }
      function up() { st.dragIdx = null; }
      var REG = { lt: 0, lx: null, ly: null };
      function draw(ctx, W, H, t) {
        var rc = rectOf(W, H), v = mku(rc, DOMN, DOMY);
        axBox(ctx, rc, v, { xl: 'x', yl: 'y' });
        capTag(ctx, '最小二乘回归：左键加点 · 右键/双击删点', rc.x, rc.y - 24, COL.purple);
        var o = ols(), n = st.pts.length;
        withClip(ctx, rc, function () {
          if (n >= 2) { /* 回归线 ŷ = a + b·x */
            var f0 = function (u) { return o.a + o.b * u; };
            plotBreaks(ctx, v, f0, DOMN[0], DOMN[1], { col: COL.orange, w: 3, n: 60, jump: 500 });
          }
          st.pts.forEach(function (p, i) {
            if (st.dragIdx === i) K.circle(ctx, v.X(p.x), v.Y(p.y), 10, { stroke: COL.yellow, lineWidth: 2.5 });
            K.circle(ctx, v.X(p.x), v.Y(p.y), 5, { fill: COL.sky, stroke: 'rgba(255,255,255,0.85)', lineWidth: 1.4 });
          });
          hintDrag(ctx, '👆 拖动数据点', rc.x + 44, rc.y + 20);
          /* R² 相关气泡：半径∝|R²|，正蓝负红 */
          var br = 8 + Math.sqrt(o.r2) * 16;
          K.circle(ctx, rc.x + rc.w - 46, rc.y + 42, br,
            { fill: o.b >= 0 ? 'rgba(52,152,219,0.55)' : 'rgba(231,76,60,0.55)', stroke: '#fff', lineWidth: 1.6 });
          K.label(ctx, 'R²=' + K.fmt(o.r2, 2), rc.x + rc.w - 46, rc.y + 42 + br + 11, { align: 'center', size: 11.5, color: TXT });
          /* 残差直方图右下小窗：对称范围 max|r|，11 桶 */
          var hw = 158, hh = 96, hx = rc.x + rc.w - hw - 10, hy = rc.y + rc.h - hh - 10;
          K.panel(ctx, hx, hy, hw, hh, { fill: 'rgba(0,0,0,0.4)', radius: 8 });
          K.label(ctx, '残差分布 eᵢ = yᵢ − ŷᵢ', hx + hw / 2, hy + 13, { align: 'center', size: 11, color: DIM });
          var mr = 1e-6;
          st.pts.forEach(function (p) { mr = Math.max(mr, Math.abs(p.y - (o.a + o.b * p.x))); });
          var NB = 11, cnt = [], bi;
          for (bi = 0; bi < NB; bi++) cnt.push(0);
          st.pts.forEach(function (p) {
            var rb = ((p.y - (o.a + o.b * p.x)) / mr + 1) / 2;
            cnt[K.clamp(Math.floor(rb * NB), 0, NB - 1)]++;
          });
          var cm = Math.max.apply(null, cnt.concat([1]));
          for (bi = 0; bi < NB; bi++) {
            var bwid = (hw - 20) / NB, bh = cnt[bi] / cm * (hh - 34);
            if (bh > 0.5) K.panel(ctx, hx + 10 + bi * bwid + 1, hy + hh - 12 - bh, bwid - 2, bh,
              { fill: 'rgba(26,188,156,0.75)', radius: 2 });
          }
          K.dashLine(ctx, hx + hw / 2, hy + 22, hx + hw / 2, hy + hh - 12, { color: 'rgba(255,255,255,0.35)' });
        });
        /* 方程与标准误胶囊 */
        if (n >= 2) {
          K.chip(ctx, 'ŷ = ' + K.fmt(o.a, 2) + ' + ' + K.fmt(o.b, 2) + ' x', rc.x + 8, rc.y + 8,
            { size: 14, bg: 'rgba(243,156,18,0.28)', color: TXT });
          K.chip(ctx, 'n=' + n + '　斜率标准误 SE ≈ ' + (n > 2 ? K.fmt(o.se, 3) : '--'), rc.x + 8, rc.y + 38,
            { size: 12, bg: 'rgba(0,0,0,0.45)', color: DIM });
        } else {
          K.chip(ctx, '至少需要 2 个点才能回归', rc.x + rc.w / 2 - 92, rc.y + 30, { size: 13, bg: 'rgba(149,165,166,0.25)', color: COL.gray });
        }
      }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var o = ols(), n = st.pts.length;
          return [
            { label: '样本数 n', value: String(n), color: COL.teal },
            { label: '回归方程', value: 'ŷ = ' + K.fmt(o.a, 2) + ' + ' + K.fmt(o.b, 2) + ' x', color: COL.orange },
            { label: 'R²', value: K.fmt(o.r2, 3), color: o.b >= 0 ? COL.blue : COL.red },
            { label: '斜率标准误 SE(b)', value: n > 2 ? K.fmt(o.se, 3) : '--', color: DIM }
          ];
        },
        hitTest: function (x, y, W, H) {
          var rc = rectOf(W, H), v = mku(rc, DOMN, DOMY);
          for (var i = 0; i < st.pts.length; i++) {
            if (Math.hypot(x - v.X(st.pts[i].x), y - v.Y(st.pts[i].y)) < 18) return true;
          }
          return false;
        },
        reset: function () { st.sd = 1177; st.pts = gen(st.sd, 1.1, 3, 2.6); REG.lt = 0; st.dragIdx = null; },
        presets: function () {
          return [
            { name: '干净线性关系', apply: function () { st.sd += 131; st.pts = gen(st.sd, 1.0, 3, 0.8); } },
            { name: '噪声很强', apply: function () { st.sd += 233; st.pts = gen(st.sd, 0.8, 4, 4); } },
            { name: '负相关簇', apply: function () { st.sd += 307; st.pts = gen(st.sd, -0.9, 11, 1.6); } }
          ];
        }
      };
    }

    /* ================= 模式分派与实例 ================= */
    var MODES = {
      calculus: mdCalculus,
      lines: function () { return mkLin('ln'); },
      slopeint: function () { return mkLin('si'); },
      quad: mdQuad,
      trig: mdTrig,
      fitline: mdFitline,
      regression: mdRegression
    };
    var modeKey = cfg && (cfg.mode || cfg.id) ? String(cfg.mode || cfg.id) : 'calculus';
    if (!MODES[modeKey]) modeKey = 'calculus';
    var M = null, lastW = 820, lastH = 480, dataCacheStr = '';

    /* 数据卡缓存：仅在内容变化时刷新 DOM */
    function pushData(force) {
      if (!M || !LOADER || !LOADER.updateDataDisplay) return;
      try {
        var arr = M.rows ? M.rows() : [];
        var key = JSON.stringify(arr.map(function (r) { return [r.label, r.value]; }));
        if (force || key !== dataCacheStr) { dataCacheStr = key; LOADER.updateDataDisplay(arr); }
      } catch (e) { /* 数据行计算失败不阻塞主循环 */ }
    }

    var inst = {
      init: function (loader) {
        LOADER = loader;
        M = MODES[modeKey]();
        loader.setKnowledge(KNOW[modeKey] || '<p>探索函数图像的规律。</p>');
        loader.setPresets(M.presets ? M.presets() : []);
        pushData(true);
      },
      getControls: function () { /* 每次返回全新数组，携带当前值 */
        if (!M || !M.ctl) return [];
        try { return M.ctl(); } catch (e) { console.error('[graphs:' + modeKey + '] ctl 异常', e); return []; }
      },
      update: function (dt, t) {
        if (!M) return;
        if (!(dt > 0)) dt = 0;
        if (dt > 0.05) dt = 0.05;
        try { M.tick(dt, t); } catch (err) { console.error('[graphs:' + modeKey + '] tick 异常', err); }
        pushData(false);
      },
      render: function (ctx, W, H, t) {
        RT.ctx = ctx; RT.W = W; RT.H = H; RT.t = t;
        lastW = W; lastH = H;
        twStep();       // 补间推进（暂停态由 poke 链持续调用本帧）
        K.background(ctx, W, H);
        if (!M) return;
        try { M.draw(ctx, W, H, t); } catch (err) { console.error('[graphs:' + modeKey + '] draw 异常', err); }
      },
      reset: function () {
        TW = []; RT.busy = false; dataCacheStr = '';
        if (!M) return;
        try { M.reset(); } catch (err) { console.error('[graphs:' + modeKey + '] reset 异常', err); }
        pushData(true);
      }
    };
    SELF_DRAW = function () { if (RT.ctx) inst.render(RT.ctx, RT.W, RT.H, RT.t); };

    /* 指针转发：画布像素坐标（暂停态下拖拽也能即时重绘） */
    inst.onPointerDown = function (x, y, ev) {
      if (M && M.down) { try { M.down(x, y, lastW, lastH, ev); } catch (err) { console.error('[graphs:' + modeKey + '] down 异常', err); } }
    };
    inst.onPointerMove = function (x, y, ev) {
      if (M && M.move) { try { M.move(x, y, lastW, lastH, ev); } catch (err) { console.error('[graphs:' + modeKey + '] move 异常', err); } }
    };
    inst.onPointerUp = function (x, y, ev) {
      if (M && M.up) { try { M.up(x, y, lastW, lastH, ev); } catch (err) { console.error('[graphs:' + modeKey + '] up 异常', err); } }
    };
    inst.hitTest = function (x, y) {
      if (!M || typeof M.hitTest !== 'function') return false;
      try { return !!M.hitTest(x, y, lastW, lastH); } catch (err) { return false; }
    };
    inst.onResize = function () { /* 视图逐帧由 W/H 重算，无需处理 */ };

    return inst;
  }
});