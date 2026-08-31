/**
 * 统计与概率实验引擎（仿 PhET 中文平台 · 数学篇）
 * 注册名 'stats'，按 cfg.mode 分支支持 4 种模式：
 *   plinko    Plinko 概率（Galton 板）
 *   sampling  抽样分布（样本均值 dot plot 与 CLT 钟形线）
 *   center    中心与变异性（均值 / 中位数 / MAD / SD）
 *   meanshare 均值：分享与平衡（总数守恒的公平分配动画）
 * 依赖（加载顺序保证）：window.Kit、window.EngineRegistry。
 * 本文件顶层只注册工厂；DOM 访问一律延迟到实例方法内。
 */
window.EngineRegistry.register('stats', {
  create(cfg) {
    var K = window.Kit, COL = K.COLORS, PI = Math.PI;
    var TXT = '#f2f5fa', DIM = 'rgba(255,255,255,0.55)', GRIDC = 'rgba(255,255,255,0.08)';
    var LOADER = null;
    function toast(m) { if (LOADER && LOADER.showToast) LOADER.showToast(String(m)); }
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.fillStyle = '#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }

    /* ================= 统计助手 ================= */
    /* 描述统计集：均值 / 中位数 / 总体SD / MAD(平均绝对偏差) / 总体方差 */
    function computeStats(a) {
      var n = a.length, i, s = 0;
      for (i = 0; i < n; i++) s += a[i];
      var mean = n ? s / n : 0;
      var sor = a.slice().sort(function (x, y) { return x - y; });
      var med = n ? (n % 2 ? sor[(n - 1) / 2] : (sor[n / 2 - 1] + sor[n / 2]) / 2) : 0;
      var vsum = 0, asum = 0;
      for (i = 0; i < n; i++) {
        vsum += (a[i] - mean) * (a[i] - mean);
        asum += Math.abs(a[i] - mean);
      }
      return {
        n: n, mean: mean, median: med,
        sd: n ? Math.sqrt(vsum / n) : 0,       // 总体标准差 σ = √[Σ(x−μ)²/N]
        mad: n ? asum / n : 0,                 // MAD = Σ|x−μ|/N
        pvar: n ? vsum / n : 0                 // 总体方差 σ²
      };
    }
    /* 组合数 C(n,k)：对称化后连乘，n≤20 内全程双精度精确 */
    function binomC(n, k) {
      if (k < 0 || k > n) return 0;
      k = Math.min(k, n - k);
      var num = 1, den = 1, i;
      for (i = 1; i <= k; i++) { num *= n - i + 1; den *= i; }
      return num / den;
    }
    /* 二项分布 PMF：P(X=i) = C(n,i)·pⁱ·q^(n−i)，q=1−p */
    function pmfBinom(n, i, p) { var q = 1 - p; return binomC(n, i) * Math.pow(p, i) * Math.pow(q, n - i); }
    /* 标准正态密度 φ(u) = exp(−u²/2)/√(2π) */
    function normPdf(u) { return Math.exp(-u * u / 2) / Math.sqrt(2 * PI); }
    /* Box-Muller 标准正态采样（配合确定性 rng） */
    function randn(r) {
      var u = Math.max(1e-9, r());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * r());
    }
    /* 一维线性映射（水平数轴用） */
    function hmap(v, d0, d1, p0, p1) { return p0 + (v - d0) / (d1 - d0 || 1) * (p1 - p0); }
    /* 左上角小标题胶囊 */
    function capTag(ctx, txt, x, y, c) {
      K.chip(ctx, txt, x, y, { size: 13, color: c || TXT, bg: 'rgba(0,0,0,0.30)', pad: 7 });
    }
    /* 数轴 + 主刻度数字（水平），返回世界→像素映射函数 */
    function hAxis(ctx, rc, d0, d1, ticksArr) {
      ctx.save();
      ctx.strokeStyle = AXZC(); ctx.lineWidth = 1.5;
      var yb = rc.y + rc.h;
      ctx.beginPath(); ctx.moveTo(rc.x - 10, yb); ctx.lineTo(rc.x + rc.w + 10, yb); ctx.stroke();
      ctx.fillStyle = TCKC(); ctx.font = '11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (var i = 0; i < ticksArr.length; i++) {
        var px = hmap(ticksArr[i], d0, d1, rc.x, rc.x + rc.w);
        ctx.beginPath(); ctx.strokeStyle = AXZC();
        ctx.moveTo(px, yb); ctx.lineTo(px, yb + 5); ctx.stroke();
        ctx.fillText(K.fmt(ticksArr[i], 2), px, yb + 8);
      }
      ctx.restore();
      return function (v) { return hmap(v, d0, d1, rc.x, rc.x + rc.w); };
    }
    var _azc = null, _tck = null; // 惰性颜色常量（函数形式避免初始化顺序问题）
    function AXZC() { if (!_azc) _azc = 'rgba(255,255,255,0.42)'; return _azc; }
    function TCKC() { if (!_tck) _tck = 'rgba(255,255,255,0.55)'; return _tck; }

    /* ================= 补间（暂停态也能推进） ================= */
    var TW = [];
    function easeIO(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function twStart(o, key, to, dur, done) {
      for (var i = TW.length - 1; i >= 0; i--) if (TW[i].o === o && TW[i].k === key) TW.splice(i, 1);
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

    /* ================= 通用绘制 ================= */
    /* 点堆列：从基线向上摞圆点；超出上限画 "+" 提示 */
    function stackDots(ctx, cx, baseY, count, r, col, maxN) {
      r = r || 4.5;
      var step = r * 2 + 1.5, mx = maxN || 44, i;
      var shown = Math.min(count, mx);
      for (i = 0; i < shown; i++) {
        K.circle(ctx, cx, baseY - r - i * step, r, { fill: col, stroke: 'rgba(0,0,0,0.35)', lineWidth: 0.8 });
      }
      if (count > mx) K.label(ctx, '+' + (count - mx), cx, baseY - r - mx * step - 6, { align: 'center', size: 10, color: DIM });
    }
    /* 右上信息面板（深底圆角） */
    function infoPanel(ctx, x, y, w, h, rows) {
      K.panel(ctx, x, y, w, h, { fill: 'rgba(0,0,0,0.38)', radius: 10 });
      rows.forEach(function (row, ri) {
        K.label(ctx, row[0], x + 14, y + 20 + ri * (h - 24) / Math.max(rows.length, 1), { size: 12.5, color: row[2] || DIM });
        K.label(ctx, row[1], x + w - 14, y + 20 + ri * (h - 24) / Math.max(rows.length, 1), { align: 'right', size: 13.5, weight: 'bold', color: row[3] || TXT });
      });
    }
    /* ================= 知识点 ================= */
    var KNOW = {
      plinko: '<p>小球逐层随机碰撞：每层以概率 <b>p</b> 向右、(1−p) 向左，走完 n 层落入格子 i 的次数服从<b>二项分布</b> P(X=i) = C(n,i)·pⁱ·qⁿ⁻ⁱ。大量投放后经验柱状图逐渐逼近白色理论曲线；均值 ≈ n·p（大数定律）。调偏 p 或加深板层数观察曲线平移与展宽。</p>',
      sampling: '<p><b>抽样分布 Sampling Distribution</b>：每次发射 n 个抛体，取其落点距离的平均值作为 1 个样本。6 个神秘发射器各自具有不同的初速度、发射角分布，产生形态各异的“距离”母体分布。</p>' +
        '<p><b>中心极限定理 CLT</b>：无论母体分布是什么形状，样本均值的标准差都会按 σ/√n 缩小——n 越大，样本均值堆叠越集中、越逼近钟形线。</p>' +
        '<div class="formula">σ(x̄) = σ / √n</div>' +
        '<p>操作：选择发射器与样本大小 n，点击红色 LAUNCH 发射一组，或切换 Continuous 连续采集；观察下方直方图逐渐逼近理论钟形线。</p>',
      center: '<p><b>均值</b>μ 是重心（各点到它的距离平方和最小），<b>中位数</b>是位置居中的数（离群点免疫）。变异性两种标尺：<b>MAD</b>=Σ|x−μ|/N 平均绝对偏差，稳健直观；<b>SD</b>=√[Σ(x−μ)²/N] 标准差，放大极端偏离。拖动数据点或调整散布滑块对比两者。</p>',
      meanshare: '<p>公平分配前<b>总糖果数守恒</b>：先总和 S，再每人 S/6。柱高从参差不齐动画收敛到同一水平线"平均值 μ"；此时方差 σ²=Σ(xᵢ−μ)²/6 变为 0。<b>均值</b>是唯一让"填坑削峰"后人人相等的那个数。</p>'
    };

    /* ================================================================
     * 模式 1 plinko —— Plinko 概率（Galton 板）
     * rows 层 6..14；每层 rng()<p 向右；上层钉阵+碰跳抖动，
     * 下层 bins 经验柱 + 二项 PMF 白点曲线归一化对照。
     * ============================================================== */
    function mdPlinko() {
      var st = { rows: 9, p: 0.5, rate: 8, counts: [], balls: [], acc: 0, jit: {}, seed: 9137 };
      var R = K.rng(st.seed); // 全模式共用确定性随机流
      var rateMax = Math.round(20 * (window.Mobile ? window.Mobile.particleScale : 1));   // 投珠速率上限：移动端按 particleScale 缩放（桌面20）
      var rowsMax = (window.Mobile && (window.Mobile.isMobile || window.Mobile.isLowEnd)) ? 10 : 14;  // Galton 板层数上限：移动端降为 10
      if (st.rate > rateMax) st.rate = rateMax;   // 移动端默认值钳制到上限内
      if (st.rows > rowsMax) st.rows = rowsMax;
      function clearAll() { st.counts = []; st.balls = []; st.jit = {}; }
      function resetCount() { clearAll(); for (var i = 0; i <= st.rows; i++) st.counts.push(0); }
      resetCount();
      function geo(W, H) {
        var boardH = H * 0.46;
        var sx = Math.min(46, (W * 0.44) / Math.max(st.rows + 1, 4));
        return {
          cx: W / 2, top: 86, sy: boardH / Math.max(st.rows, 1), sx: sx,
          binTop: H * 0.56, baseY: H - 46,
          binX: function (i) { return W / 2 + (2 * i - st.rows) * sx / 2; },
          pegY: function (j) { return 86 + boardH * ((j + 0.5) / st.rows); } // 第 j 层钉行
        };
      }
      function spawn() { /* 出生即决定整条路径：rows 次 Bernoulli(p)（±1 向右/左） */
        var dirs = [], j;
        for (j = 0; j < st.rows; j++) dirs.push(R() < st.p ? 1 : -1);
        if (st.balls.length < 60) st.balls.push({ dirs: dirs, j: 0, frac: 0, kr: 0, ox: 0, kOff: 0 });
      }
      function landed(b) { /* 落入格：累计经验频数（含点击投放的横向偏移 kOff） */
        var idx = K.clamp(Math.round(b.kr + (b.kOff || 0)), 0, st.rows);
        st.counts[idx] = (st.counts[idx] || 0) + 1;
      }
      function ballStep(b, dt) { /* 匀速穿层；穿钉瞬间触发抖动与方向推进 */
        b.frac += dt * 3.6;
        while (b.frac >= 1 && b.j < st.rows) {
          b.frac -= 1;
          st.jit[b.j] = 1;
          b.kr += b.dirs[b.j];
          b.j++;
          if (b.j >= st.rows) { landed(b); return true; }
        }
        return false;
      }
      function tick(dt) {
        st.acc += dt * st.rate;
        while (st.acc >= 1) { spawn(); st.acc -= 1; }
        for (var key in st.jit) { /* 钉阵抖动衰减（视觉专用） */
          var jv = st.jit[key] - dt * 3.4;
          st.jit[key] = jv > 0 ? jv : 0;
        }
        for (var bi = st.balls.length - 1; bi >= 0; bi--) {
          if (ballStep(st.balls[bi], dt)) st.balls.splice(bi, 1);
        }
      }
      function geo(W, H) { /* 板区几何：钉阵单位 d=kr−j/2 → 像素 */
        var top = 96, bot = H * 0.52;
        var sx = Math.min(48, (W * 0.86) / (st.rows + 1));
        return {
          cx: W / 2, top: top, bot: bot, sx: sx,
          px: function (d) { return W / 2 + d * sx; },
          py: function (j) { return top + (bot - top) * (j / st.rows); },
          binTop: H * 0.58, baseY: H - 44
        };
      }
      function ctl() {
        return [
          { id: 'pl_rows', type: 'slider', label: '层数 n', min: 6, max: rowsMax, step: 1, value: Math.min(st.rows, rowsMax),
            onChange: function (v) { st.rows = Math.round(v); resetCount(); toast('板面已重置'); } },
          { id: 'pl_p', type: 'slider', label: '向右概率 p', min: 0, max: 1, step: 0.02, value: st.p,
            onChange: function (v) { st.p = v; resetCount(); toast('经验数据已清零'); } },
          { id: 'pl_rate', type: 'slider', label: '投珠速率 (球/秒)', min: 1, max: rateMax, step: 1, value: Math.min(st.rate, rateMax),
            onChange: function (v) { st.rate = v; } }
        ];
      }
      function draw(ctx, W, H, t) {
        var g = geo(W, H);
        capTag(ctx, 'Galton 板 · 每层以 p 向右', g.cx - 96, g.top - 58, COL.teal);
        /* 漏斗与背板 */
        K.polyline(ctx, [{ x: g.cx - 46, y: g.top - 34 }, { x: g.cx - 8, y: g.top - 4 }], { color: 'rgba(255,255,255,0.30)', width: 3 });
        K.polyline(ctx, [{ x: g.cx + 46, y: g.top - 34 }, { x: g.cx + 8, y: g.top - 4 }], { color: 'rgba(255,255,255,0.30)', width: 3 });
        /* 钉阵：第 j 层 j+1 颗，列坐标 d=k−j/2（含碰撞抖动小跳） */
        var rr = Math.max(2.4, g.sx * 0.11), j, k;
        for (j = 0; j < st.rows; j++) {
          var jitv = st.jit[j] || 0;
          var rowY = (g.py(j) + g.py(j + 1)) / 2 - jitv * 3.5;
          for (k = 0; k <= j; k++) {
            var pxx = g.px(k - j / 2);
            K.circle(ctx, pxx, rowY, rr + jitv * 1.3, { fill: 'rgba(236,240,241,0.75)', stroke: 'rgba(116,185,255,0.35)', lineWidth: 1 });
            if (jitv > 0.05) {
              K.circle(ctx, pxx, rowY - 3, rr * (1.7 + jitv), { stroke: 'rgba(241,196,15,' + (jitv * 0.5).toFixed(2) + ')', lineWidth: 1.2 });
            }
          }
        }
        /* 下落中的小球：横向插值 d₀ → d₀±0.5，纵向穿层并叠加正弦小跳 */
        st.balls.forEach(function (b) {
          var f = K.clamp(b.frac, 0, 1);
          if (b.j >= st.rows) return;
          var step = b.dirs[Math.min(b.j, st.rows - 1)];
          var d0 = b.kr - b.j / 2;
          var dcur = d0 + (step > 0 ? 0.5 : -0.5) * f;
          var yy = K.lerp(g.py(b.j), g.py(Math.min(b.j + 1, st.rows)), f) - Math.sin(PI * f) * 6;
          K.circle(ctx, g.px(dcur) + (b.ox || 0), yy, 5.2, { fill: COL.yellow, stroke: '#7a5c00', lineWidth: 1 });
        });
        /* bins：经验柱 + 理论 PMF 白点曲线（同尺度归一化） */
        var nEmp = 0, i, empProb = [];
        for (i = 0; i <= st.rows; i++) { empProb.push(st.counts[i] || 0); nEmp += st.counts[i] || 0; }
        for (i = 0; i <= st.rows; i++) empProb[i] /= (nEmp || 1);
        var pmf = [], ymax = 1e-9;
        for (i = 0; i <= st.rows; i++) { pmf.push(pmfBinom(st.rows, i, st.p)); ymax = Math.max(ymax, pmf[i], empProb[i]); }
        var plotH = (g.baseY - g.binTop) * 0.92;
        for (i = 0; i <= st.rows; i++) {
          var bx0 = g.px(i - st.rows / 2), bw = g.sx * 0.66;
          var bh = empProb[i] / ymax * plotH;
          if (bh > 0.5) K.panel(ctx, bx0 - bw / 2, g.baseY - bh, bw, bh, { fill: 'rgba(26,188,156,0.78)', radius: 3 });
          K.label(ctx, String(i), bx0, g.baseY + 12, { align: 'center', size: 10.5, color: DIM });
        }
        var theoPts = [];
        for (i = 0; i <= st.rows; i++) theoPts.push({ x: g.px(i - st.rows / 2), y: g.baseY - pmf[i] / ymax * plotH });
        K.polyline(ctx, theoPts, { color: 'rgba(255,255,255,0.85)', width: 2 });
        theoPts.forEach(function (p) { K.circle(ctx, p.x, p.y, 3.2, { fill: COL.white }); });
        K.chip(ctx, '白点连线 = 二项理论 P(X=i)', W * 0.60, g.binTop - 30, { size: 11.5, bg: 'rgba(255,255,255,0.14)' });
        K.label(ctx, '点击板面任意位置可投放一颗球到该 x', g.cx - 110, g.top - 30, { size: 11.5, color: DIM });
      }
      /* 点击投放：在指针 x 处投下一颗球（带横向偏移 ox/kOff，落格按偏移修正） */
      function down(x, y, W, H) {
        var g = geo(W, H), half = st.rows * g.sx / 2;
        if (y < g.top - 46 || y > g.baseY + 12) return;
        if (x < g.cx - half - 24 || x > g.cx + half + 24) return;
        spawn();
        var b = st.balls[st.balls.length - 1];
        if (!b) return;
        b.ox = K.clamp(x - g.cx, -half, half);
        b.kOff = Math.round(b.ox / g.sx);
      }
      return {
        ctl: ctl, tick: tick, draw: draw, down: down,
        rows: function () {
          var total = 0, mi = 0, wsum = 0, i;
          for (i = 0; i <= st.rows; i++) { var c = st.counts[i] || 0; total += c; wsum += c * i; if ((st.counts[mi] || 0) < c) mi = i; }
          return [
            { label: '总球数', value: String(total), color: COL.teal },
            { label: '众数格 (球最多)', value: total ? '第 ' + mi + ' 格' : '--', color: COL.yellow },
            { label: '经验均值 / 理论 n·p', value: K.fmt(total ? wsum / total : NaN, 2) + ' ≈ ' + K.fmt(st.rows * st.p, 2), color: COL.green }
          ];
        },
        reset: function () { R = K.rng(st.seed); st.acc = 0; if (st.rate > rateMax) st.rate = rateMax; if (st.rows > rowsMax) st.rows = rowsMax; resetCount(); },
        presets: function () {
          return [
            { name: '对称公平 p=0.5', apply: function () { st.p = 0.5; resetCount(); } },
            { name: '右偏漏斗 p=0.72', apply: function () { st.p = 0.72; resetCount(); } },
            { name: '深板细察 n=14', apply: function () { st.rows = 14; resetCount(); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 2 sampling —— 抽样分布
     * 每次抽 n 个均匀骰子求均值，堆入 [1..6] dot plot；
     * CLT 理论钟形线 μ=3.5、σ=√[(35/12)/n] 归一化叠加（可开关）。
     * ============================================================== */
    function mdSampling() {
      var G = 9.8, DIST_MAX = 110;
      var LAUNCHERS = [
        { c: '#4caf50', v: [16, 0.4],  th: [38, 0.8] },
        { c: '#2196f3', v: [21, 2.5],  th: [45, 3.0] },
        { c: '#ff9800', v: [27, 6.0],  th: [45, 7.0] },
        { c: '#9c27b0', v: [14, 0.15], th: [30, 0.5] },
        { c: '#f44336', v: [24, 1.5],  th: [28, 9.0] },
        { c: '#00bcd4', v: [30, 4.0],  th: [60, 12.0] }
      ];
      var N_OPTS = [2, 5, 15, 40], BIN_OPTS = [0.5, 1, 2, 5];
      var st = { li: 0, n: 5, cont: false, fast: false, binW: 1, showBell: true,
        samples: [], batch: [], proj: [], lands: [], k: 0, acc: 0, parentMu: 0, parentSig: 0 };
      var RD = K.rng(7301);

      /* 采样一个落点距离（该发射器的 v、θ 正态分布 → 抛体射程） */
      function sampleDist(r) {
        var L = LAUNCHERS[st.li];
        var v = Math.max(1, L.v[0] + L.v[1] * randn(r));
        var th = Math.max(0.01, Math.min(PI / 2 - 0.01, (L.th[0] + L.th[1] * randn(r)) * PI / 180));
        return v * v * Math.sin(2 * th) / G;
      }
      function clampDist(d) { return Math.max(0.5, Math.min(DIST_MAX - 0.5, d)); }
      /* 数值估计父分布（距离）的 μ、σ，供 CLT 理论曲线使用 */
      function refreshParent() {
        var r = K.rng(9999), arr = [], i;
        for (i = 0; i < 9000; i++) { var d = sampleDist(r); if (d > 0 && d < DIST_MAX) arr.push(d); }
        var s = computeStats(arr); st.parentMu = s.mean; st.parentSig = s.sd;
      }
      refreshParent();

      function launchOne() {
        var L = LAUNCHERS[st.li];
        var v = Math.max(1, L.v[0] + L.v[1] * randn(RD));
        var th = Math.max(0.02, Math.min(PI / 2 - 0.02, (L.th[0] + L.th[1] * randn(RD)) * PI / 180));
        var R = clampDist(v * v * Math.sin(2 * th) / G);
        var T = Math.max(0.5, Math.min(2.4, 2 * v * Math.sin(th) / G));
        st.proj.push({ v: v, th: th, R: R, t: 0, T: T });
      }
      function landOne(p) {
        st.lands.push({ R: p.R });
        if (st.lands.length > 500) st.lands.shift();
        st.batch.push(p.R);
        if (st.batch.length >= st.n) {
          var s = computeStats(st.batch);
          st.samples.push(s.mean); st.k++;
          if (st.samples.length > 200) st.samples.shift();
          st.batch = [];
        }
      }
      function beginSample() { if (st.batch.length === 0) { for (var i = 0; i < st.n; i++) launchOne(); } }
      function clearAll() { st.samples = []; st.batch = []; st.proj = []; st.lands = []; st.k = 0; st.acc = 0; }

      function tick(dt, t) {
        var mult = st.fast ? 2.4 : 1, i, p;
        for (i = st.proj.length - 1; i >= 0; i--) {
          p = st.proj[i]; p.t += dt * mult;
          if (p.t >= p.T) { landOne(p); st.proj.splice(i, 1); }
        }
        if (st.cont) {
          st.acc += dt * (st.fast ? 3 : 1.4);
          while (st.acc >= 1) { st.acc -= 1; if (st.proj.length < 30) launchOne(); }
        }
      }

      /* ---------- 布局（按 W/H 自适应） ---------- */
      function lay(W, H) {
        var fieldBottom = Math.round(H * 0.46);
        var mapX = function (d) { return hmap(d, 0, DIST_MAX, 92, W - 16); };
        var bw = Math.min(70, (W - 150) / 6), i;
        var lb = [], nb = [];
        for (i = 0; i < 6; i++) lb.push({ x: 92 + i * (bw + 8), y: 24, w: bw, h: 26 });
        var nw = 42, nx0 = W - 14 - 4 * nw - 3 * 8;
        for (i = 0; i < 4; i++) nb.push({ x: nx0 + i * (nw + 8), y: 24, w: nw, h: 26 });
        var cy = Math.round(H * 0.52);
        var rc = { x: 40, y: Math.round(H * 0.60), w: W - 80, h: H - Math.round(H * 0.60) - 30 };
        var binBtns = [];
        var bx0 = rc.x + 96;
        for (i = 0; i < BIN_OPTS.length; i++) binBtns.push({ x: bx0 + i * (36 + 6), y: rc.y - 40, w: 36, h: 20 });
        return {
          fieldTop: 62, fieldBottom: fieldBottom, mapX: mapX, lb: lb, nb: nb, cy: cy, rc: rc, binBtns: binBtns,
          singleB: { x: W / 2 - 180, y: cy, w: 110, h: 30 },
          contB: { x: W / 2 - 62, y: cy, w: 110, h: 30 },
          launchB: { x: W / 2 + 58, y: cy - 8, w: 132, h: 46 }
        };
      }
      function inB(b, x, y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
      function btn(ctx, b, label, active, fill) {
        K.panel(ctx, b.x, b.y, b.w, b.h, { fill: active ? fill : 'rgba(255,255,255,0.08)', stroke: active ? '#ffffff' : 'rgba(255,255,255,0.35)', radius: 8, lw: active ? 2 : 1 });
        K.label(ctx, label, b.x + b.w / 2, b.y + b.h / 2, { align: 'center', size: 12.5, weight: 'bold', color: '#fff', baseline: 'middle' });
      }

      function draw(ctx, W, H, t) {
        var L = lay(W, H), i, p, lc = LAUNCHERS[st.li].c;

        /* 顶部控件 */
        K.label(ctx, '神秘发射器 Mystery Launcher', 92, 13, { size: 11, color: DIM });
        for (i = 0; i < 6; i++) btn(ctx, L.lb[i], '' + (i + 1), st.li === i, LAUNCHERS[i].c);
        K.label(ctx, '样本大小 Sample Size (n)', L.nb[0].x, 13, { size: 11, color: DIM });
        for (i = 0; i < 4; i++) btn(ctx, L.nb[i], '' + N_OPTS[i], st.n === N_OPTS[i], '#1a73e8');

        /* 发射区 */
        K.panel(ctx, 20, L.fieldTop, W - 40, L.fieldBottom - L.fieldTop, { fill: 'rgba(255,255,255,0.03)', stroke: 'rgba(255,255,255,0.08)', radius: 10 });
        /* 地面 + 距离刻度 */
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(20, L.fieldBottom); ctx.lineTo(W - 20, L.fieldBottom); ctx.stroke();
        ctx.fillStyle = TCKC(); ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        var ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        for (i = 0; i < ticks.length; i++) {
          var px = L.mapX(ticks[i]);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath(); ctx.moveTo(px, L.fieldBottom); ctx.lineTo(px, L.fieldBottom + 6); ctx.stroke();
          ctx.fillText('' + ticks[i], px, L.fieldBottom + 8);
        }
        ctx.fillText('落点距离 Distance (m)', (20 + W - 20) / 2, L.fieldBottom + 22);
        ctx.restore();

        /* 发射器（炮） */
        var lx = 92, ly = L.fieldBottom;
        ctx.save();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
        ctx.fillStyle = lc; ctx.beginPath(); ctx.arc(lx, ly - 16, 12, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#37474f'; ctx.fillRect(lx - 18, ly - 8, 36, 10);
        ctx.beginPath(); ctx.moveTo(lx - 4, ly - 12); ctx.lineTo(lx + 28, ly - 22); ctx.lineTo(lx + 28, ly - 8); ctx.lineTo(lx + 4, ly - 4); ctx.closePath();
        ctx.fillStyle = lc; ctx.fill(); ctx.stroke();
        ctx.restore();

        /* 已落地点 */
        for (i = 0; i < st.lands.length; i++) {
          K.circle(ctx, L.mapX(st.lands[i].R), L.fieldBottom - 3, 3.5, { fill: lc, stroke: 'rgba(0,0,0,0.4)', lineWidth: 0.8 });
        }
        /* 飞行中的抛体（抛物线） */
        for (i = 0; i < st.proj.length; i++) {
          p = st.proj[i]; var u = p.t / p.T;
          var sx = lx + (L.mapX(p.R) - lx) * u;
          var peak = (L.fieldBottom - L.fieldTop) * (0.35 + 0.5 * p.R / DIST_MAX);
          var sy = L.fieldBottom - 6 - peak * 4 * u * (1 - u);
          K.circle(ctx, sx, sy, 5, { fill: lc, stroke: '#000', lineWidth: 1 });
        }

        /* 发射控制 */
        btn(ctx, L.singleB, '单发 Single', !st.cont, st.cont ? 'rgba(255,255,255,0.08)' : '#1a73e8');
        btn(ctx, L.contB, '连续 Continuous', st.cont, st.cont ? '#1a73e8' : 'rgba(255,255,255,0.08)');
        K.panel(ctx, L.launchB.x, L.launchB.y, L.launchB.w, L.launchB.h, { fill: '#e53935', stroke: '#fff', radius: 12, lw: 2 });
        K.label(ctx, '发射 LAUNCH', L.launchB.x + L.launchB.w / 2, L.launchB.y + L.launchB.h / 2, { align: 'center', size: 13, weight: 'bold', color: '#fff', baseline: 'middle' });
        K.label(ctx, '无空气阻力 No air resistance', L.launchB.x + L.launchB.w + 14, L.cy + 16, { size: 10.5, color: DIM });

        /* 字段标志 */
        K.chip(ctx, '发射器 Launcher ' + (st.li + 1) + ' · 样本大小 n = ' + st.n + ' · 样本数 Samples = ' + st.k, 92, L.fieldTop + 14,
          { size: 12, bg: 'rgba(0,0,0,0.4)', color: lc });

        /* 直方图 */
        drawHist(ctx, W, H, L, lc);
      }

      function drawHist(ctx, W, H, L, lc) {
        var rc = L.rc, NB = Math.round(DIST_MAX / st.binW), i;
        var bins = new Array(NB); for (i = 0; i < NB; i++) bins[i] = 0;
        for (i = 0; i < st.samples.length; i++) {
          var bi = Math.floor(st.samples[i] / st.binW); if (bi < 0) bi = 0; if (bi >= NB) bi = NB - 1; bins[bi]++;
        }
        var mx = 1; for (i = 0; i < NB; i++) mx = Math.max(mx, bins[i]);

        K.label(ctx, '样本均值的抽样分布 Sampling Distribution of Means', rc.x + rc.w / 2, rc.y - 6, { align: 'center', size: 12.5, weight: 'bold', color: COL.teal });
        /* 轴 */
        ctx.save();
        ctx.strokeStyle = AXZC(); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(rc.x - 8, rc.y + rc.h); ctx.lineTo(rc.x + rc.w + 8, rc.y + rc.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rc.x, rc.y); ctx.lineTo(rc.x, rc.y + rc.h); ctx.stroke();
        ctx.fillStyle = TCKC(); ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('0', rc.x - 6, rc.y + rc.h + 4);
        ctx.fillText('' + mx, rc.x - 8, rc.y + 4);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('数量 Count', rc.x + 6, rc.y + 8);
        ctx.restore();
        /* 柱 */
        var bwpx = rc.w / NB;
        for (i = 0; i < NB; i++) {
          if (!bins[i]) continue;
          var hpx = (bins[i] / mx) * (rc.h - 16);
          K.panel(ctx, rc.x + i * bwpx + 1, rc.y + rc.h - hpx, Math.max(1, bwpx - 2), hpx, { fill: lc, radius: 1 });
        }
        /* 理论 CLT 曲线 */
        if (st.showBell && st.k > 0) {
          var sig = st.parentSig / Math.sqrt(st.n);
          var pts = [], b0;
          for (b0 = 0; b0 <= 160; b0++) {
            var cv = DIST_MAX * b0 / 160;
            var expCnt = st.k * st.binW * normPdf((cv - st.parentMu) / sig) / sig;
            if (expCnt > mx * 1.2) { if (pts.length > 1) K.polyline(ctx, pts, { color: COL.sky, width: 2 }); pts = []; continue; }
            pts.push({ x: hmap(cv, 0, DIST_MAX, rc.x, rc.x + rc.w), y: rc.y + rc.h - expCnt * (rc.h - 16) / mx });
          }
          if (pts.length > 1) K.polyline(ctx, pts, { color: COL.sky, width: 2 });
          K.chip(ctx, '理论 CLT：N(μ=' + K.fmt(st.parentMu, 1) + ', σ/√n=' + K.fmt(sig, 2) + ')', rc.x + 10, rc.y + 10, { size: 11, bg: 'rgba(116,185,255,0.22)', color: COL.sky });
        }
        /* x 轴标签 + bin width 按钮 */
        K.label(ctx, '平均距离 Mean Distance (m)', rc.x + rc.w / 2, rc.y + rc.h + 14, { align: 'center', size: 11, color: DIM });
        K.label(ctx, '桶宽 Bin Width:', rc.x, rc.y - 30, { size: 11, color: DIM });
        for (i = 0; i < BIN_OPTS.length; i++) {
          btn(ctx, L.binBtns[i], BIN_OPTS[i] + 'm', st.binW === BIN_OPTS[i], st.binW === BIN_OPTS[i] ? '#1a73e8' : 'rgba(255,255,255,0.08)');
        }
      }

      function down(x, y, W, H, ev) {
        var L = lay(W, H), i;
        for (i = 0; i < 6; i++) if (inB(L.lb[i], x, y)) { st.li = i; refreshParent(); clearAll(); return; }
        for (i = 0; i < 4; i++) if (inB(L.nb[i], x, y)) { st.n = N_OPTS[i]; clearAll(); return; }
        if (inB(L.singleB, x, y)) { st.cont = false; return; }
        if (inB(L.contB, x, y)) { st.cont = true; return; }
        if (inB(L.launchB, x, y)) { if (!st.cont) beginSample(); return; }
        for (i = 0; i < BIN_OPTS.length; i++) if (inB(L.binBtns[i], x, y)) { st.binW = BIN_OPTS[i]; return; }
      }
      function hitTest(x, y, W, H) {
        var L = lay(W, H), i;
        for (i = 0; i < 6; i++) if (inB(L.lb[i], x, y)) return true;
        for (i = 0; i < 4; i++) if (inB(L.nb[i], x, y)) return true;
        if (inB(L.singleB, x, y) || inB(L.contB, x, y) || inB(L.launchB, x, y)) return true;
        for (i = 0; i < BIN_OPTS.length; i++) if (inB(L.binBtns[i], x, y)) return true;
        return false;
      }

      function ctl() {
        return [
          { id: 'ps_li', type: 'select', label: '发射器 Launcher', value: String(st.li),
            options: LAUNCHERS.map(function (l, i) { return { value: String(i), label: 'Launcher ' + (i + 1) + ' 发射器' + (i + 1) }; }),
            onChange: function (v) { st.li = parseInt(v, 10) || 0; refreshParent(); clearAll(); } },
          { id: 'ps_n', type: 'select', label: '样本大小 Sample Size (n)', value: String(st.n),
            options: N_OPTS.map(function (v) { return { value: String(v), label: 'n = ' + v }; }),
            onChange: function (v) { st.n = parseInt(v, 10) || 5; clearAll(); } },
          { id: 'ps_speed', type: 'select', label: '速度 Speed', value: st.fast ? 'fast' : 'normal',
            options: [{ value: 'normal', label: '正常 Normal' }, { value: 'fast', label: '快速 Fast' }],
            onChange: function (v) { st.fast = v === 'fast'; } },
          { id: 'ps_bin', type: 'select', label: '桶宽 Bin Width', value: String(st.binW),
            options: BIN_OPTS.map(function (v) { return { value: String(v), label: v + ' m' }; }),
            onChange: function (v) { st.binW = parseFloat(v) || 1; } },
          { id: 'ps_bell', type: 'checkbox', label: '显示 CLT 理论曲线 CLT curve', value: st.showBell,
            onChange: function (v) { st.showBell = !!v; } },
          { id: 'ps_clr', type: 'button', label: '清空数据 Clear',
            action: function () { clearAll(); toast('已清空全部样本 Cleared'); } }
        ];
      }

      return {
        ctl: ctl, tick: tick, draw: draw, down: down, hitTest: hitTest,
        rows: function () {
          return [
            { label: '样本数 Samples', value: String(st.k), color: LAUNCHERS[st.li].c },
            { label: '父分布均值 μ(parent)', value: K.fmt(st.parentMu, 1) + ' m', color: COL.teal },
            { label: '父分布 σ(parent)', value: K.fmt(st.parentSig, 2) + ' m', color: COL.sky },
            { label: '理论 σ(x̄)=σ/√n', value: K.fmt(st.parentSig / Math.sqrt(st.n), 2) + ' m', color: COL.purple }
          ];
        },
        reset: function () { RD = K.rng(7301); st.li = 0; st.n = 5; st.cont = false; st.fast = false; st.binW = 1; st.showBell = true; refreshParent(); clearAll(); },
        presets: function () {
          return [
            { name: '样本量 n=2（较分散）', apply: function () { st.n = 2; clearAll(); } },
            { name: '样本量 n=15', apply: function () { st.n = 15; clearAll(); } },
            { name: '样本量 n=40（接近正态）', apply: function () { st.n = 40; clearAll(); } },
            { name: '换成发射器3（高可变）', apply: function () { st.li = 2; refreshParent(); clearAll(); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 3 center —— 中心与变异性
     * 15 个可拖动点在 [0,10] 数轴；实时统计线：均值(紫) 中位数(青)；
     * MAD 与 SD 括弧标尺可选显示；散布 η 按"秩归一化×η 重排"确定性重建。
     * ============================================================== */
    function mdCenter() {
      var INIT = null, st = { vals: [], jit: 0.45, metric: 'both', drag: -1 };
      (function () {
        var r = K.rng(4242), v = [], i;
        for (i = 0; i < 15; i++) {
          var grp = i % 3;
          var mu = grp === 0 ? 2.4 : (grp === 1 ? 6.4 : 4.2);
          v.push(K.clamp(mu + randn(r) * (grp === 2 ? 1.7 : 1.0), 0.2, 9.8));
        }
        INIT = v.slice();
        st.vals = v.slice();
      })();
      function ctl() {
        return [
          { id: 'ct_metric', type: 'select', label: '变异标尺', value: st.metric,
            options: [{ value: 'both', label: 'MAD 与 SD 全部显示' }, { value: 'mad', label: '仅 MAD（平均绝对偏差）' }, { value: 'sd', label: '仅 SD（标准差）' }],
            onChange: function (v) { st.metric = String(v); } },
          { id: 'ct_jit', type: 'slider', label: '统一散布 η（保序重排）', min: 0, max: 1, step: 0.01, value: st.jit,
            onChange: function (v) { setJitter(v); } },
          { id: 'ct_rst', type: 'button', label: '恢复初始数据集',
            action: function () { st.vals = INIT.slice(); toast('已恢复初始 15 个数据点'); } }
        ];
      }
      /* 散布重建（确定性）：按当前大小的秩 uᵢ=(rank+.5)/N 归一化，
         再以原均值 μ 为锚对称铺开：newVal = μ + (2u−1)·5.5·η —— 保序、可复现 */
      function setJitter(eta) {
        var order = st.vals.map(function (vv, ii) { return ii; })
          .sort(function (a, b) { return st.vals[a] - st.vals[b]; });
        var mu = computeStats(st.vals).mean;
        order.forEach(function (origI, rank) {
          var u = (rank + 0.5) / st.vals.length;
          st.vals[origI] = K.clamp(mu + (u * 2 - 1) * 5.5 * eta, 0, 10);
        });
        st.jit = eta;
      }
      function axRC(W, H) { return { x: 64, y: H * 0.36, w: Math.max(230, W - 128), h: 0 }; }
      /* 半宽为 hw 的括弧标尺：横杆 + 两端上翘 + 中位下探 + 居中文字 */
      function bracket(ctx, cxm, hw, yy, txt, col) {
        K.polyline(ctx, [
          { x: cxm - hw, y: yy - 7 }, { x: cxm - hw, y: yy },
          { x: cxm + hw, y: yy }, { x: cxm + hw, y: yy - 7 }], { color: col, width: 2 });
        K.polyline(ctx, [{ x: cxm, y: yy }, { x: cxm, y: yy + 6 }], { color: col, width: 2 });
        K.label(ctx, txt, cxm, yy + 18, { align: 'center', size: 12.5, color: col });
      }
      function draw(ctx, W, H, t) {
        var rc = axRC(W, H);
        var s = computeStats(st.vals);
        var xw = hAxis(ctx, { x: rc.x, y: rc.y, w: rc.w, h: rc.h }, 0, 10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        capTag(ctx, '中心与变异性 · 点可左右拖动实时重算', rc.x - 6, rc.y - 96, COL.purple);
        K.label(ctx, '数据轴 [0,10]', rc.x, rc.y - 22, { size: 11, color: DIM });
        var baseY = rc.y;
        /* 统计竖线：均值紫实线，中位数青虚线 */
        var top1 = baseY - 86;
        K.polyline(ctx, [{ x: xw(s.mean), y: baseY + 6 }, { x: xw(s.mean), y: top1 }], { color: COL.purple, width: 2.5 });
        K.chip(ctx, '均值 μ = ' + K.fmt(s.mean, 2), K.clamp(xw(s.mean) + 8, rc.x - 30, rc.x + rc.w - 130), top1 - 26,
          { size: 12, bg: 'rgba(155,89,182,0.30)' });
        if (s.median !== s.mean) {
          K.dashLine(ctx, xw(s.median), baseY + 6, xw(s.median), top1 + 22, { color: COL.teal, dash: [5, 4], width: 2 });
          K.chip(ctx, '中位数 = ' + K.fmt(s.median, 2), K.clamp(xw(s.median) + 8, rc.x - 30, rc.x + rc.w - 140), top1 + 8,
            { size: 12, bg: 'rgba(26,188,156,0.28)' });
        }
        /* 数据点行（位于基线上方一档，便于拖拽命中） */
        st.vals.forEach(function (vv, ii) {
          var pxx = xw(vv);
          K.circle(ctx, pxx, baseY - 14, st.drag === ii ? 8 : 6,
            { fill: COL.sky, stroke: 'rgba(255,255,255,0.85)', lineWidth: 1.4 });
        });
        hintDrag(ctx, '👆 拖动数据点', rc.x + 40, baseY - 34);
        /* MAD / SD 双括弧（按选择绘制） */
        var yb = baseY + 42;
        if (st.metric === 'both' || st.metric === 'mad') {
          bracket(ctx, xw(s.mean), Math.max(24, s.mad * rc.w / 10), yb, 'MAD 平均绝对偏差 = ' + K.fmt(s.mad, 2), COL.green);
        }
        if (st.metric === 'both' || st.metric === 'sd') {
          bracket(ctx, xw(s.mean), Math.max(24, s.sd * rc.w / 10), yb + (st.metric === 'both' ? 52 : 0),
            'SD 标准差 σ = ' + K.fmt(s.sd, 2), COL.blue);
        }
        K.label(ctx, '拖动任意点观察 μ（重心）与中位数谁更抗离群；SD 比 MAD 更放大极端值。', rc.x - 4, H - 26, { size: 12, color: DIM });
      }
      function down(x, y, W, H) {
        var rc = axRC(W, H);
        var best = -1, bd = 18, i;
        for (i = 0; i < st.vals.length; i++) {
          var px = rc.x + st.vals[i] / 10 * rc.w;
          var d0 = Math.abs(x - px);
          if (d0 < bd && y > rc.y - 40 && y < rc.y + 26) { bd = d0; best = i; }
        }
        st.drag = best >= 0 ? best : -1;
      }
      function move(x, y, W, H) {
        if (st.drag < 0) return;
        var rc = axRC(W, H);
        st.vals[st.drag] = K.clamp((x - rc.x) / rc.w * 10, 0, 10);
      }
      function up() { st.drag = -1; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var s = computeStats(st.vals);
          return [
            { label: '均值 μ', value: K.fmt(s.mean, 3), color: COL.purple },
            { label: '中位数', value: K.fmt(s.median, 3), color: COL.teal },
            { label: '标准差 SD', value: K.fmt(s.sd, 3), color: COL.blue },
            { label: '平均绝对偏差 MAD', value: K.fmt(s.mad, 3), color: COL.green }
          ];
        },
        hitTest: function (x, y, W, H) {
          var rc = axRC(W, H);
          for (var i = 0; i < st.vals.length; i++) {
            var px = rc.x + st.vals[i] / 10 * rc.w;
            if (Math.abs(x - px) < 18 && y > rc.y - 40 && y < rc.y + 26) return true;
          }
          return false;
        },
        reset: function () { st.vals = INIT.slice(); st.drag = -1; },
        presets: function () {
          return [
            { name: '大幅散开 η≈1', apply: function () { setJitter(0.98); } },
            { name: '紧凑成簇 η≈0.1', apply: function () { setJitter(0.1); } },
            { name: '恢复初始', apply: function () { st.vals = INIT.slice(); } }
          ];
        }
      };
    }
    /* ================================================================
     * 模式 4 meanshare —— 均值：分享与平衡
     * 6 人糖果柱（各 0..12 块滑块）；"公平分配!" 0.85s 缓动全员收敛到
     * 平均值（逐帧总和守恒）；均值虚线随动画滑动；守恒绿徽章与故事胶囊。
     * ============================================================== */
    function mdMeanshare() {
      var st = { h: [2, 7, 4, 10, 1, 6], drag: -1, _sy: 0, _sv: 0 };
      var PALETTE = [COL.red, COL.orange, COL.yellow, COL.green, COL.teal, COL.blue, COL.purple, COL.pink, COL.sky];
      function sliderFor(i) {
        return {
          id: 'ms_p' + i, type: 'slider', label: '第 ' + (i + 1) + ' 人的糖（块）',
          min: 0, max: 12, step: 1, value: Math.round(st.h[i]),
          onChange: function (v) { TW = []; st.h[i] = Math.round(v); } // 手动调整即打断动画
        };
      }
      function ctl() {
        var arr = [], i;
        for (i = 0; i < 6; i++) arr.push(sliderFor(i));
        arr.push({ id: 'ms_go', type: 'button', label: '公平分配！',
          action: function () { /* 目标=总数/6；同一缓动曲线 ⇒ 每帧 Σ 守恒 */
            var tot = 0, j;
            for (j = 0; j < 6; j++) tot += st.h[j];
            var avg = tot / 6;
            for (j = 0; j < 6; j++) {
              twStart(st.h, String(j), avg, 850,
                j === 5 ? function () { toast('已平均：每人 ' + K.fmt(avg, 2) + ' 块'); } : null);
            }
          } });
        return arr;
      }
      function geo(W, H) {
        var baseY = H - 92, topY = 118;
        var unitH = Math.max(9, (baseY - topY) / 13);
        var bw = Math.min(84, (W - 150) / 6 - 22);
        var x0 = (W - (bw * 6 + 22 * 5)) / 2;
        return { baseY: baseY, topY: topY, unitH: unitH, bw: bw, x0: x0 };
      }
      /* 拖动每个人物柱顶部把手上下滑动改变其糖果块数（整数，0..12） */
      function down(x, y, W, H) {
        st.drag = -1; var g = geo(W, H);
        for (var i = 0; i < 6; i++) {
          var cx0 = g.x0 + i * (g.bw + 22), topY = g.baseY - Math.max(0, st.h[i]) * g.unitH;
          if (x > cx0 - 6 && x < cx0 + g.bw + 6 && y > g.topY - 16 && y < g.baseY + 6) {
            st.drag = i; st._sy = y; st._sv = st.h[i]; TW = [];
            return;
          }
        }
      }
      function move(x, y, W, H) {
        if (st.drag < 0) return; var g = geo(W, H);
        st.h[st.drag] = K.clamp(Math.round(st._sv + (st._sy - y) / g.unitH), 0, 12);
      }
      function up() { st.drag = -1; }
      function draw(ctx, W, H, t) {
        var tot = 0, i;
        for (i = 0; i < 6; i++) tot += st.h[i];
        var avg = tot / 6;
        var baseY = H - 92, topY = 118;
        var unitH = Math.max(9, (baseY - topY) / 13);
        var bw = Math.min(84, (W - 150) / 6 - 22);
        var x0 = (W - (bw * 6 + 22 * 5)) / 2;
        capTag(ctx, '均值：分享与平衡（总分不变，人人一样多）', W / 2 - 168, 16, COL.pink);
        /* 虚线均值线 */
        var ym = baseY - avg * unitH;
        K.dashLine(ctx, x0 - 26, ym, x0 + bw * 6 + 22 * 5 + 26, ym, { color: COL.pink, dash: [8, 6], width: 2 });
        K.chip(ctx, '平均值 = ' + K.fmt(avg, 2), x0 + bw * 6 + 44, ym - 14, { size: 13, bg: 'rgba(253,121,168,0.28)', color: TXT });
        /* 六个头像柱：堆叠糖果块 + 圆脸头像 + 名字 */
        for (i = 0; i < 6; i++) {
          var cx0 = x0 + i * (bw + 22), hv = Math.max(0, st.h[i]);
          var nb = Math.ceil(hv - 1e-9), cyCur = baseY, b2;
          for (b2 = 0; b2 < nb; b2++) { /* 逐块堆叠：顶块按小数部分收缩 */
            var hh = (b2 === nb - 1) ? (hv - b2) * unitH - 1.5 : unitH - 3;
            if (hh <= 0.6) break;
            cyCur -= hh;
            K.roundRect(ctx, cx0, cyCur, bw, Math.max(2.4, hh - 1), 3);
            ctx.fillStyle = PALETTE[(i * 3 + b2) % PALETTE.length]; ctx.fill();
          }
          /* 头像：肤色圆 + 五官 */
          var hy = cyCur - 26;
          K.circle(ctx, cx0 + bw / 2, hy, 15, { fill: '#ffd9b0', stroke: '#a9744f', lineWidth: 1.5 });
          K.circle(ctx, cx0 + bw / 2 - 5, hy - 3, 1.8, { fill: '#333' });
          K.circle(ctx, cx0 + bw / 2 + 5, hy - 3, 1.8, { fill: '#333' });
          ctx.save(); ctx.strokeStyle = '#a9744f'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(cx0 + bw / 2, hy + 3, 5, 0.25, PI - 0.25); ctx.stroke(); ctx.restore();
          K.label(ctx, '第 ' + (i + 1) + ' 人 · ' + K.fmt(hv, 1) + ' 块', cx0 + bw / 2, baseY + 16, { align: 'center', size: 11.5, color: DIM });
          if (st.drag === i) K.circle(ctx, cx0 + bw / 2, cyCur, 8, { fill: COL.pink, stroke: '#fff', lineWidth: 2 });
        }
        hintDrag(ctx, '👆 拖动调整', x0 + bw * 3, topY - 20);
        /* 总和芯片 + 守恒徽章（动画期间高亮绿） */
        var isMorph = TW.length > 0 && TW[0].o === st.h;
        var wch = K.chip(ctx, '总和 S = ' + K.fmt(tot, 0), W / 2 - 60, 48, { size: 14, bg: 'rgba(241,196,15,0.25)', color: COL.yellow });
        if (isMorph) {
          var pulseA = 0.55 + 0.45 * Math.sin(t * 6);
          K.chip(ctx, '总数守恒 ✓', W / 2 + 46, 48, { size: 13.5, bg: 'rgba(39,174,96,' + pulseA.toFixed(2) + ')', color: '#dffbe9' });
        }
        K.label(ctx, '先把散在各处的糖果全部收拢（总和 S）……', W / 2 - 178, H - 52, { size: 12, color: DIM });
        K.label(ctx, '……再平均分回给 6 个人：每人恰好得到平均值 S/6。', W / 2 + 34, H - 52, { size: 12, color: DIM });
        K.label(ctx, '填坑削峰后方差归零——这就是“均值”的平衡含义。', W / 2, H - 30, { align: 'center', size: 12, color: COL.pink });
      }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var s = computeStats(st.h.slice());
          return [
            { label: '糖果总和 S', value: K.fmt(s.mean * 6, 0), color: COL.yellow },
            { label: '平均值 μ = S/6', value: K.fmt(s.mean, 2), color: COL.pink },
            { label: '总体方差 σ²', value: K.fmt(s.pvar, 2), color: COL.green }
          ];
        },
        hitTest: function (x, y, W, H) {
          var g = geo(W, H);
          for (var i = 0; i < 6; i++) {
            var cx0 = g.x0 + i * (g.bw + 22);
            if (x > cx0 - 6 && x < cx0 + g.bw + 6 && y > g.topY - 16 && y < g.baseY + 6) return true;
          }
          return false;
        },
        reset: function () { TW = []; st.h = [2, 7, 4, 10, 1, 6]; },
        presets: function () {
          return [
            { name: '金字塔分配', apply: function () { TW = []; st.h = [1, 3, 5, 7, 9, 11]; } },
            { name: '两极分化', apply: function () { TW = []; st.h = [12, 12, 0, 0, 0, 0]; } },
            { name: '已是公平态', apply: function () { TW = []; st.h = [5, 5, 5, 5, 5, 5]; } }
          ];
        }
      };
    }

    /* ================= 模式分派与实例 ================= */
    var MODES = { plinko: mdPlinko, sampling: mdSampling, center: mdCenter, meanshare: mdMeanshare };
    var modeKey = cfg && (cfg.mode || cfg.id) ? String(cfg.mode || cfg.id) : 'plinko';
    if (!MODES[modeKey]) modeKey = 'plinko';
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
        loader.setKnowledge(KNOW[modeKey] || '<p>探索统计与概率的规律。</p>');
        loader.setPresets(M.presets ? M.presets() : []);
        pushData(true);
      },
      getControls: function () { /* 每次返回全新数组，携带当前值 */
        if (!M || !M.ctl) return [];
        try { return M.ctl(); } catch (e) { console.error('[stats:' + modeKey + '] ctl 异常', e); return []; }
      },
      update: function (dt, t) {
        if (!M) return;
        if (!(dt > 0)) dt = 0;
        if (dt > 0.05) dt = 0.05;
        try { M.tick(dt, t); } catch (err) { console.error('[stats:' + modeKey + '] tick 异常', err); }
        pushData(false);
      },
      render: function (ctx, W, H, t) {
        RT.ctx = ctx; RT.W = W; RT.H = H; RT.t = t;
        lastW = W; lastH = H;
        twStep();       // 补间推进（暂停态由 poke 链维持连续重绘）
        K.background(ctx, W, H);
        if (!M) return;
        try { M.draw(ctx, W, H, t); } catch (err) { console.error('[stats:' + modeKey + '] draw 异常', err); }
      },
      reset: function () {
        TW = []; RT.busy = false; dataCacheStr = '';
        if (!M) return;
        try { M.reset(); } catch (err) { console.error('[stats:' + modeKey + '] reset 异常', err); }
        pushData(true);
      }
    };
    SELF_DRAW = function () { if (RT.ctx) inst.render(RT.ctx, RT.W, RT.H, RT.t); };

    /* 指针转发：画布像素坐标 */
    inst.onPointerDown = function (x, y, ev) {
      if (M && M.down) { try { M.down(x, y, lastW, lastH, ev); } catch (err) { console.error('[stats:' + modeKey + '] down 异常', err); } }
    };
    inst.onPointerMove = function (x, y, ev) {
      if (M && M.move) { try { M.move(x, y, lastW, lastH, ev); } catch (err) { console.error('[stats:' + modeKey + '] move 异常', err); } }
    };
    inst.onPointerUp = function (x, y, ev) {
      if (M && M.up) { try { M.up(x, y, lastW, lastH, ev); } catch (err) { console.error('[stats:' + modeKey + '] up 异常', err); } }
    };
    inst.hitTest = function (x, y) {
      if (!M || typeof M.hitTest !== 'function') return false;
      try { return !!M.hitTest(x, y, lastW, lastH); } catch (err) { return false; }
    };
    inst.onResize = function () { /* 视图逐帧由 W/H 重算 */ };

    return inst;
  }
});