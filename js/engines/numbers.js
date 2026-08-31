/**
 * 数感 / 分数 / 几何 实验引擎（仿 PhET 中文平台 · 数学篇）
 * 注册名 'numbers'，按 cfg.mode 分支支持 18 种模式：
 *   arithmetic, make-ten, numcompare, numplay, numpairs, nlint, nldist,
 *   nlops, ratioxy, unitrate, proppl, fracintro, fraceq, fracmixed,
 *   fracmatch, buildfrac, quadshape, areabuild
 * 依赖（加载顺序保证）：window.Kit、window.EngineRegistry。
 * 本文件顶层只注册工厂；DOM 访问一律延迟到实例方法内。
 */
window.EngineRegistry.register('numbers', {
  create(cfg) {
    var K = window.Kit;
    var COL = K.COLORS;
    var TXT = '#f2f5fa';
    var DIM = 'rgba(255,255,255,0.55)';
    var MINR = 14; // 指针命中半径下限

    /* ---------------- 基础助手 ---------------- */
    function dist2(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
    function hitC(x, y, cx, cy, r) { return dist2(x, y, cx, cy) <= Math.max(MINR, r); }
    function hitR(x, y, rx, ry, w, h, pad) {
      pad = pad == null ? 4 : pad;
      return x >= rx - pad && x <= rx + w + pad && y >= ry - pad && y <= ry + h + pad;
    }
    function shuffle(arr, R) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(R() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    function gcd(a, b) {
      a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
      while (b) { var t = a % b; a = b; b = t; }
      return a || 1;
    }
    function clampI(v, lo, hi) { v = Math.round(v); return v < lo ? lo : (v > hi ? hi : v); }
    function fRed(n, d) { d = d || 1; var g = gcd(n, d); return { n: n / g, d: d / g }; }
    function fAdd(f1, f2) { return fRed(f1.n * f2.d + f2.n * f1.d, f1.d * f2.d); }
    function fSame(f1, f2) { return f1.n * f2.d === f2.n * f1.d; }
    function fStr(f) { return f.n + '/' + f.d; }
    /* 基于 level/qn 等计数器混合出稳定种子 */
    function seedMix(base) {
      var s = (base >>> 0) ^ 0x9e3779b9;
      for (var i = 1; i < arguments.length; i++) {
        s = (Math.imul(s ^ (arguments[i] >>> 0), 2654435761) >>> 13) >>> 0;
      }
      return (s % 2000000011) || 7;
    }
    /* 分数值集合能否由 pieces 组合表达（辅助 buildfrac 目标池筛选） */
    var LOADER = null;
    function toast(msg) { if (LOADER && LOADER.showToast) LOADER.showToast(String(msg)); }
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.fillStyle = '#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }
    function popAnim(obj, key, dt, rate) {
      if (obj[key] > 0) { obj[key] -= dt * rate; if (obj[key] < 0) obj[key] = 0; }
    }
    /* ---------------- 画布 UI 框架 ---------------- */
    var UI = { hits: [] }; // 每帧重建的命中表
    function pushHit(x, y, r, fn) { UI.hits.push({ x: x, y: y, r: Math.max(MINR, r), fn: fn }); }
    function uiBtn(ctx, x, y, w, h, text, fn, style) {
      style = style || {};
      var o = { fill: style.bg || 'rgba(255,255,255,0.10)', radius: style.radius == null ? 8 : style.radius };
      if (style.alpha != null) o.alpha = style.alpha;
      if (style.stroke) { o.stroke = style.stroke; o.lineWidth = style.lw || 2; }
      K.panel(ctx, x, y, w, h, o);
      K.label(ctx, text, x + w / 2, y + h / 2, {
        align: 'center', baseline: 'middle', size: style.size || 14,
        color: style.color || TXT, weight: style.weight || 'bold'
      });
      if (fn) pushHit(x + w / 2, y + h / 2, Math.max(h / 2 + 8, MINR), fn);
      return w;
    }
    function uiChip(ctx, x, y, text, onT, opt) {
      opt = opt || {};
      var s = opt.size || 13;
      var w = K.chip(ctx, text, x, y, {
        size: s, color: opt.color || TXT,
        bg: opt.bg || 'rgba(255,255,255,0.12)', pad: opt.pad || 6
      });
      if (onT) pushHit(x, y, Math.max(w / 2 + 10, s, MINR), onT);
      return w;
    }
    function tapScan(x, y) {
      for (var i = UI.hits.length - 1; i >= 0; i--) {
        var h = UI.hits[i];
        if (hitC(x, y, h.x, h.y, h.r)) {
          try { h.fn(); } catch (err) { console.error('点击处理出错', err); }
          return true;
        }
      }
      return false;
    }
    function starRow(ctx, x, y, got, total, sz) {
      total = total || 3; sz = sz || 12;
      for (var i = 0; i < total; i++) {
        var sx = x + i * sz * 1.6;
        ctx.beginPath();
        for (var p = 0; p < 10; p++) {
          var rr = p % 2 ? sz * 0.44 : sz;
          var ang = -Math.PI / 2 + p * Math.PI / 5;
          var px = sx + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
          if (p) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = i < got ? COL.yellow : 'rgba(255,255,255,0.16)';
        ctx.fill();
      }
    }
    function meter(ctx, x, y, w, h, frac, colFill) {
      frac = K.clamp(frac || 0, 0, 1);
      K.panel(ctx, x, y, w, h, { fill: 'rgba(0,0,0,0.35)', radius: h / 2 });
      if (frac > 0.004) {
        K.roundRect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * frac), h - 4, (h - 4) / 2);
        ctx.fillStyle = colFill || COL.teal; ctx.fill();
      }
    }
    function headTitle(ctx, W, title, sub) {
      K.label(ctx, title, W / 2, 26, { align: 'center', size: 19, weight: 'bold', color: TXT });
      if (sub) K.label(ctx, sub, W / 2, 47, { align: 'center', size: 12.5, color: DIM });
    }
    function dotsCluster(ctx, cx, cy, n, maxCols, rDot, color) {
      n = Math.max(0, Math.floor(n)); rDot = rDot || 9;
      var cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      if (cols > (maxCols || 6)) { cols = maxCols || 6; rows = Math.ceil(n / cols); }
      if (!cols) return;
      var gx = rDot * 2.3, gy = rDot * 2.2;
      var ox = cx - (cols - 1) * gx / 2, oy = cy - (rows - 1) * gy / 2;
      for (var i = 0; i < n; i++) {
        K.circle(ctx, ox + (i % cols) * gx, oy + Math.floor(i / cols) * gy, rDot,
          { fill: color || COL.blue, alpha: 0.92 });
      }
    }
    /* 数值↔像素 线性映射 */
    function linMap(lo, hi, a0, a1) {
      var span = (hi - lo) || 1;
      return {
        X: function (v) { return a0 + (v - lo) / span * (a1 - a0); },
        XI: function (p) { return lo + (p - a0) / ((a1 - a0) || 1) * span; }
      };
    }
    function drawNumLine(ctx, lo, hi, x0, x1, y, stepLbl, markerV, markerCol) {
      var M = linMap(lo, hi, x0, x1);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      ctx.moveTo(x1 - 9, y - 5); ctx.lineTo(x1, y); ctx.lineTo(x1 - 9, y + 5);
      ctx.stroke();
      for (var v = Math.ceil(lo); v <= Math.floor(hi); v++) {
        var major = v % stepLbl === 0;
        ctx.strokeStyle = major ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(M.X(v), y - (major ? 7 : 4));
        ctx.lineTo(M.X(v), y + (major ? 7 : 4));
        ctx.stroke();
        if (major && hi - lo <= 44) K.label(ctx, String(v), M.X(v), y + 19, { align: 'center', size: 11, color: DIM });
      }
      if (markerV != null) K.circle(ctx, M.X(markerV), y, 7, { fill: markerCol || COL.orange, stroke: '#fff', lineWidth: 2 });
      return M;
    }
    function maskOf(n, d) { var a = new Array(d); for (var i = 0; i < d; i++) a[i] = i < n; return a; }
    function fullMask(d) { return maskOf(d, d); }
    function partMask(n, d) { return maskOf(Math.min(n, d), d); }
    function pieChart(ctx, x, y, r, d, eatenArr, pairCol) {
      d = Math.max(1, d);
      for (var i = 0; i < d; i++) {
        var a0 = -Math.PI / 2 + i * 2 * Math.PI / d, a1 = a0 + 2 * Math.PI / d;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a0, a1); ctx.closePath();
        ctx.fillStyle = eatenArr[i] ? (pairCol ? pairCol[0] : COL.orange) : 'rgba(125,125,150,0.32)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(18,18,30,0.65)'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    }
    function barFrac(ctx, x, y, w, h, d, eatenArr, fillColor) {
      d = Math.max(1, d);
      var cw = w / d;
      for (var i = 0; i < d; i++) {
        ctx.fillStyle = eatenArr[i] ? (fillColor || COL.orange) : 'rgba(125,125,150,0.32)';
        K.roundRect(ctx, x + i * cw + 1.5, y + 1.5, cw - 3, h - 3, 4);
        ctx.fill();
      }
      K.roundRect(ctx, x, y, w, h, 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    }
    /* 卡片网格布局（numpairs/fracmatch 复用） */
    function cardLayout(cols, rows, x0, y0, gw, gh, pad) {
      pad = pad == null ? 8 : pad;
      var out = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          out.push({
            x: x0 + c * gw / cols + pad, y: y0 + r * gh / rows + pad,
            w: gw / cols - pad * 2, h: gh / rows - pad * 2
          });
        }
      }
      return out;
    }
    /* ---------------- 中文知识卡 ---------------- */
    var KNOW = {
      'arithmetic': '<h4>表内乘法</h4><p>乘法是<strong>相同加数连加</strong>的简写：3×4 就是 4 个 3 相加。</p><div class="formula">a × b ＝ b 个 a 相加</div><p>反过来想：积 ÷ 一个因数 = 另一个因数，这就是"找因数"训练。</p>',
      'make-ten': '<h4>凑十法</h4><div class="formula">a + b = 10　→　b = 10 − a</div><p>十格阵有 2 行 5 列共 10 格。先摆满 a 个绿格，剩下的空格数就是要凑的数。凑十是进位加法的地基！</p>',
      'numcompare': '<h4>比大小</h4><p>数一数圆点、读一读数字牌；带分数可先化成假分数再比较。</p><div class="formula">a 又 b/c ＝ (a×c+b)/c</div><p>注意时间条会不断消耗，答错还要倒扣哦。</p>',
      'numplay': '<h4>数的分解</h4><p>同一个总数能拆成多组"加法对"：</p><div class="formula">10 ＝ 1+9 ＝ 2+8 ＝ … ＝ 9+1</div><p>移动筹码穷举所有分解，体会"和不变、加数互补"。</p>',
      'numpairs': '<h4>配对记忆</h4><p>翻开两张牌，若两数之和等于目标即可消除。关键口诀：<strong>x 与 目标−x 是一对</strong>。翻错的牌越少、星级越高。</p>',
      'nlint': '<h4>数轴与温度</h4><p>温度计就是竖直的数轴：0℃ 以上为正、以下为负。用滑块设定期望温度后发射小火箭，也可以直接拖动指针感受位置。</p>',
      'nldist': '<h4>数轴距离</h4><div class="formula">A、B 距离 ＝ |a − b|</div><p>方向词：B 在 A 右侧几步（往右走），在左侧则往左。拖动小船或点选候选数字完成谜题。</p>',
      'nlops': '<h4>数轴上的运算</h4><p>加正数向右跳、减正数向左跳；乘法＝同长跳跃重复若干次：<strong>3 × (−2)</strong> 就是从 0 出发每次向左跳 2，跳 3 次。</p><div class="formula">落点 ＝ 运算结果</div>',
      'ratioxy': '<h4>比与比例</h4><p>红蓝颜料份数决定混合色，<strong>比值相同颜色就相同</strong>——调色调出比例感。</p><div class="formula">r₁:b₁ ＝ r₂:b₂ ⇔ r₁×b₂ ＝ r₂×b₁</div>'
    };
    KNOW['unitrate'] = '<h4>单价比较</h4><div class="formula">单价 ＝ 价格 ÷ 克数</div><p>总价大不一定贵！先算出每一克多少钱，才能公平比较谁更划算。</p>';
    KNOW['proppl'] = '<h4>传动比</h4><div class="formula">转速比 ＝ 前齿轮齿数 : 后齿轮齿数</div><p>链条传动的线速度相同，后轮转数与前齿数成正比。改变踏频观察双数字线的等比移动。</p>';
    KNOW['fracintro'] = '<h4>分数三视图</h4><div class="formula">1/2 ＝ 0.5 ＝ 50%</div><p>点击披萨切片或巧克力块把它吃掉，同步观察分数条、数轴和百分数三种表示的一致性。</p>';
    KNOW['fraceq'] = '<h4>分数基本性质</h4><div class="formula">分子分母同乘或同除一个非零数，分数大小不变</div><p>对右侧披萨整体 ×2、÷3，下方等值表会高亮对应行，检验对齐条是否指向同一刻度。</p>';
    KNOW['fracmixed'] = '<h4>带分数 ↔ 假分数</h4><div class="formula">w 又 n/d ＝ (w×d+n)/d</div><p>"又几又几分之几"强调整的部分，假分数强调总份数，两种写法数值完全相同。</p>';
    KNOW['fracmatch'] = '<h4>等值分数配对</h4><p>图面分数与数字分数可能外形不同但大小相等，如 1/2 ＝ 2/4。凭观察匹配它们，翻错越少星级越高。</p>';
    KNOW['buildfrac'] = '<h4>拼出分数</h4><p>半圆=1/2、三分块=1/3、四分块=1/4。把零件累加进托盘，凑出与目标严格相等的分数。</p><div class="formula">累计 ＝ n₁/d₁ + n₂/d₂</div>';
    KNOW['quadshape'] = '<h4>四边形分类</h4><p>两组对边平行→平行四边形；再加四个直角→矩形；四边相等→菱形；全部满足→正方形；只有一组对边平行的是梯形。判定容差约 1px。</p>';
    KNOW['areabuild'] = '<h4>面积与周长</h4><div class="formula">面积 S ＝ 长×宽　周长 C ＝ 2×(长+宽)</div><p>面积一定时，长宽越接近正方形周长越小。挑战中试着用最紧凑的长方形完成任务。</p>';

    /* ================= 模式注册表 ================= */
    var MODES = Object.create(null);
    /* ---------- 1. arithmetic 算术乘法练习 ---------- */
    MODES['arithmetic'] = function () {
      var a = 3, bHid = 0, opts = [], okIdx = -1, qn = 0, winN = 0, loseN = 0;
      var streak = 0, best = 0, rev = false, lock = 0, flashTxt = '';
      function gen() {
        var R = K.rng(seedMix(20207, qn, a, rev ? 911 : 0));
        bHid = 1 + Math.floor(R() * 12);
        var target = rev ? bHid : a * bHid;
        var vals = [target], seen = {};
        seen[target] = true;
        var OFF = [-4, -3, -3, -2, -2, -1, -1, 1, 1, 2, 2, 3, 4];
        var guard = 0;
        while (vals.length < 4 && guard++ < 90) {
          var d = target + OFF[Math.floor(R() * OFF.length)];
          if (!rev) { if (d < 1) continue; }
          else { d = bHid + OFF[Math.floor(R() * OFF.length)]; if (d < 1 || d > 12) continue; }
          if (seen[d]) continue;
          seen[d] = true; vals.push(d);
        }
        shuffle(vals, R);
        opts = vals; okIdx = vals.indexOf(target);
        if (okIdx < 0) { opts[3] = target; okIdx = 3; }
        lock = 0; flashTxt = ''; qn++;
      }
      function pick(i) {
        if (lock > 0 || i < 0 || i >= opts.length) return;
        if (i === okIdx) {
          winN++; streak++; best = Math.max(best, streak); flashTxt = '✓';
          toast('🎉 回答正确！连击 ' + streak);
        } else {
          loseN++; streak = 0; flashTxt = '✗';
          toast('正确答案是 ' + (rev ? bHid : a * bHid));
        }
        lock = 0.85;
      }
      return {
        reset: function () { qn = 0; winN = 0; loseN = 0; streak = 0; best = 0; gen(); },
        tick: function (dt) { if (lock > 0) { lock -= dt; if (lock <= 0) gen(); } },
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          var tot = winN + loseN;
          return [
            { label: '答题数', value: String(tot), color: '#7fb2ff' },
            { label: '答对', value: String(winN), color: '#63e2a5' },
            { label: '连击', value: streak + '（最佳' + best + '）', color: COL.orange },
            { label: '正确率', value: tot ? Math.round(winN * 100 / tot) + '%' : '—', color: '#ffb6d9' }
          ];
        },
        presets: function () {
          return [
            { name: '专练 7 的口诀', apply: function () { a = 7; gen(); } },
            { name: '专练 12 的口诀', apply: function () { a = 12; gen(); } }
          ];
        },
        controls: function () {
          return [
            { type: 'select', id: 'arith_dir', label: '练习方向', value: rev ? 'factor' : 'mult',
              options: [{ value: 'mult', label: '乘法口诀（求积）' }, { value: 'factor', label: '因子训练（求因数）' }],
              onChange: function (v) { rev = v === 'factor'; gen(); } },
            { type: 'button', id: 'arith_newq', label: '出一道新题',
              action: function () { gen(); toast('新题目来啦'); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W,
            rev ? ('因子训练：' + (a * bHid) + ' ＝ ' + a + ' × ？') : ('乘法口诀：' + a + ' × ？'),
            '点击顶部被乘数切换 · 从选项方块中作答');
          var tabW = Math.min(42, (W - 40) / 12), gap = 4;
          var total = 12 * tabW + 11 * gap, ox = (W - total) / 2;
          for (var i = 1; i <= 12; i++) {
            (function (val) {
              var xx = ox + (val - 1) * (tabW + gap);
              var sel = val === a;
              K.panel(ctx, xx, 60, tabW, 30, { fill: sel ? 'rgba(56,132,255,0.45)' : 'rgba(255,255,255,0.08)', radius: 7 });
              K.label(ctx, String(val), xx + tabW / 2, 75, { align: 'center', baseline: 'middle', size: 13, weight: 'bold', color: sel ? '#fff' : DIM });
              pushHit(xx + tabW / 2, 75, Math.max(tabW / 2 + 6, MINR), function () { a = val; gen(); });
            })(i);
          }
          var qy = H * 0.38;
          var flashOff = (flashTxt && lock > 0) ? -34 : 0;
          K.label(ctx, rev ? ((a * bHid) + ' ＝ ' + a + ' × ?') : (a + ' × ? ＝ ?'), W / 2 + flashOff / 2, qy, { align: 'center', size: 44, weight: 'bold', color: TXT });
          if (flashTxt && lock > 0) {
            K.label(ctx, flashTxt, W / 2 + 150, qy, { align: 'center', size: 36, weight: 'bold', color: flashTxt === '✓' ? '#6fe29a' : '#ff7b7b' });
          }
          if (streak >= 2) K.label(ctx, '🔥 连击 ×' + streak, W / 2, qy + 36, { align: 'center', size: 15, color: COL.orange });
          var bw = Math.min(170, (W - 80) / 2), bh = Math.min(64, H * 0.13);
          var bx0 = W / 2 - bw - 10, by0 = H * 0.52;
          for (var k2 = 0; k2 < opts.length; k2++) {
            (function (idx) {
              var gx = bx0 + (idx % 2) * (bw + 20), gy = by0 + Math.floor(idx / 2) * (bh + 16);
              var dimmed = lock > 0 && idx !== okIdx;
              uiBtn(ctx, gx, gy, bw, bh, String(opts[idx]), function () { pick(idx); },
                { bg: dimmed ? 'rgba(255,255,255,0.04)' : 'rgba(56,132,255,0.16)', stroke: dimmed ? undefined : '#4f86e8', color: dimmed ? DIM : TXT, size: 22 });
            })(k2);
          }
          K.label(ctx, lock > 0 ? '马上进入下一题…' : '选择你认为正确的答案', W / 2, by0 + bh * 2 + 44, { align: 'center', size: 13, color: DIM });
        }
      };
    };
    /* ---------- 2. make-ten 凑十法 ---------- */
    MODES['make-ten'] = function () {
      var a = 8, lvl = 1, qn = 0, upStreak = 0, solved = 0, axisOn = true;
      var FX = { shake: 0 };
      var bubbles = []; // {v,ph}
      function gen() {
        var R = K.rng(seedMix(711, lvl, qn));
        a = 2 + Math.floor(R() * 8);
        var need = 10 - a, dis = [], seen = {}; seen[need] = true;
        var g2 = 0;
        while (dis.length < 3 && g2++ < 60) {
          var v = 1 + Math.floor(R() * 9);
          if (!seen[v]) { seen[v] = true; dis.push(v); }
        }
        var all = shuffle([need].concat(dis), R);
        bubbles = all.map(function (vv) { return { v: vv, ph: R() * 6.28 }; });
      }
      function pick(v) {
        if (solved > 0) return;
        if (v === 10 - a) {
          qn++; upStreak++; solved = 1;
          toast('🎉 太棒了！' + a + ' + ' + v + ' ＝ 10');
        } else {
          upStreak = 0; FX.shake = 1;
          toast('再想想：' + a + ' + ? ＝ 10');
        }
      }
      return {
        reset: function () { lvl = 1; qn = 0; upStreak = 0; gen(); },
        tick: function (dt, t) {
          void t;
          popAnim(FX, 'shake', dt, 3);
          if (solved > 0) {
            solved -= dt * 1.5;
            if (solved <= 0) {
              solved = 0;
              if (upStreak > 0 && upStreak % 3 === 0) { lvl++; toast('⬆️ 连续答对，关卡提升至 ' + lvl + '！'); }
              gen();
            }
          }
        },
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          return [
            { label: '关卡', value: String(lvl), color: COL.purple },
            { label: '连续答对', value: String(upStreak), color: COL.teal },
            { label: '累计作答', value: String(qn), color: '#7fb2ff' }
          ];
        },
        presets: function () {
          return [
            { name: '从 9 开始', apply: function () { this.setA(9); }.bind(this) },
            { name: '从 3 开始', apply: function () { this.setA(3); }.bind(this) }
          ];
        },
        setA: function (v) { a = clampI(v, 2, 9); gen(); },
        controls: function () {
          return [
            { type: 'checkbox', id: 'mkten_axis', label: '显示数轴辅助线', value: axisOn, onChange: function (v) { axisOn = !!v; } },
            { type: 'button', id: 'mkten_new', label: '新的凑十题', action: function () { gen(); } },
            { type: 'button', id: 'mkten_rst', label: '重置进度', action: function () { lvl = 1; upStreak = 0; gen(); toast('已重置进度'); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          headTitle(ctx, W, a + ' + ? ＝ 10', '在下方气泡中选出能凑成 10 的数');
          var cell = Math.min(44, (W - 140) / 6), fw = cell * 5.45;
          var fx = W / 2 - fw / 2, fy = H * 0.26;
          var need = 10 - a;
          for (var i = 0; i < 10; i++) {
            var row = i < 5 ? 0 : 1;
            var cxx = fx + (i % 5) * cell * 1.09, cyy = fy + row * cell * 1.09;
            var fill = 'rgba(255,255,255,0.08)';
            if (i < a) fill = COL.green;
            else if (solved > 0 && i >= 10 - need) fill = K.rgba(COL.orange, Math.min(1, solved + 0.35));
            K.roundRect(ctx, cxx, cyy, cell, cell, 7);
            ctx.fillStyle = fill; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.4; ctx.stroke();
            if (i < a) K.label(ctx, String(a), cxx + cell / 2, cyy + cell / 2, { align: 'center', baseline: 'middle', size: 14, weight: 'bold', color: '#10321c' });
          }
          K.label(ctx, '绿格摆了 ' + a + ' 个，还差 ' + need + ' 个凑满十格', W / 2, fy + cell * 2.42, { align: 'center', size: 13, color: DIM });
          if (axisOn) {
            var ly = fy + cell * 2.85;
            var M = drawNumLine(ctx, 0, 10, W * 0.28, W * 0.72, ly, 5, null);
            if (K.arrow) K.arrow(ctx, M.X(a), ly - 24, M.X(10), ly - 24, { color: COL.orange });
            ctx.strokeStyle = DIM; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(M.X(a), ly - 22); ctx.lineTo(M.X(a), ly - 3); ctx.moveTo(M.X(10), ly - 22); ctx.lineTo(M.X(10), ly - 3); ctx.stroke();
            ctx.setLineDash([]);
          }
          var by = H * 0.78, span = Math.min(W - 130, bubbles.length * 92);
          var shX = FX.shake > 0 ? Math.sin(t * 40) * 6 : 0;
          for (var k = 0; k < bubbles.length; k++) {
            (function (bb, idx) {
              var bx = W / 2 - span / 2 + span / (bubbles.length - 1 || 1) * idx;
              var wob = Math.sin(t * 2.4 + bb.ph) * 4;
              var right = solved > 0 && bb.v === need;
              var rg = right ? 30 : 25;
              K.circle(ctx, bx + shX, by + wob, rg, { fill: right ? COL.orange : 'rgba(64,110,220,0.75)', stroke: '#fff', lineWidth: 2 });
              K.label(ctx, String(bb.v), bx + shX, by + wob, { align: 'center', baseline: 'middle', size: 19, weight: 'bold' });
              pushHit(bx + shX, by + wob, rg + 6, function () { pick(bb.v); });
            })(bubbles[k], k);
          }
          starRow(ctx, W - 84, 28, upStreak % 3, 3, 11);
        }
      };
    };
    /* ---------- 3. numcompare 比大小 ---------- */
    MODES['numcompare'] = function () {
      var round = 0, wins = 0, loss = 0, wide = 10;
      var FULL = 10, timeLeft = FULL, wrongFlash = 0, settling = false, settleT = 0;
      var L = {}, Rr = {};
      function mixed(R) {
        var den = 2 + Math.floor(R() * 7), num = 1 + Math.floor(R() * (den - 1)), wh = 1 + Math.floor(R() * 3);
        return { w: wh, num: num, den: den, f: fRed(wh * den + num, den) };
      }
      function reWrap(f, R) {
        var k = 2 + Math.floor(R() * 2);
        var n2 = f.n * k, d2 = f.d * k;
        var w2 = Math.floor(n2 / d2), num2 = n2 % d2;
        if (num2 === 0) num2 = 1;
        return { w: w2, num: num2, den: d2, f: fRed(w2 * d2 + num2, d2) };
      }
      function gen() {
        var stage = round >= 12 ? 2 : (round >= 6 ? 1 : 0);
        var R = K.rng(seedMix(3300, round, wide));
        if (stage === 2) {
          L = mixed(R); Rr = (R() < 0.22) ? reWrap(L.f, R) : mixed(R);
        } else {
          var nl = 1 + Math.floor(R() * wide), nr;
          if (R() < 0.25) nr = nl;
          else nr = clampI(nl + (R() < 0.5 ? -1 : 1) * (1 + Math.floor(R() * 4)), 1, wide);
          L = { int: nl }; Rr = { int: nr };
        }
        L.stage = stage; Rr.stage = stage;
        timeLeft = FULL; settling = false; round++;
      }
      function valueOf(o) { return o.int != null ? o.int : o.w * o.den + o.num; }
      function signOf() {
        var vl = valueOf(L), vr = valueOf(Rr);
        return vl === vr ? '=' : (vl < vr ? '<' : '>');
      }
      function judge(g) {
        if (settling) return;
        if (g === signOf()) {
          wins++; toast('✅ 判断正确！'); gen();
        } else {
          loss++; timeLeft = Math.max(0.01, timeLeft - 3); wrongFlash = 1;
          toast('❌ 再数数两边');
        }
      }
      return {
        reset: function () { round = 0; wins = 0; loss = 0; gen(); },
        tick: function (dt) {
          if (wrongFlash > 0) wrongFlash = Math.max(0, wrongFlash - dt * 3);
          if (!settling) {
            timeLeft -= dt;
            if (timeLeft <= 0) { loss++; settling = true; toast('⏰ 时间耗尽，换新题'); }
          } else {
            settleT += dt;
            if (settleT >= 1.1) { settleT = 0; gen(); }
          }
        },
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          return [
            { label: '回合', value: String(round), color: '#7fb2ff' },
            { label: '得分', value: String(wins), color: '#63e2a5' },
            { label: '失误', value: String(loss), color: '#ff8f8f' },
            { label: '剩余时间', value: Math.max(0, timeLeft).toFixed(1) + 's', color: COL.orange }
          ];
        },
        presets: function () {
          return [{ name: '数量上限提到 20', apply: function () { this.setWide(20); }.bind(this) }];
        },
        setWide: function (v) { wide = v; gen(); },
        controls: function () {
          return [
            { type: 'select', id: 'ncmp_range', label: '数量上限', value: String(wide),
              options: [{ value: '10', label: '10 以内' }, { value: '20', label: '20 以内' }],
              onChange: function (v) { wide = parseInt(v, 10) || 10; gen(); } },
            { type: 'button', id: 'ncmp_skip', label: '跳过本题', action: function () { gen(); toast('换一题'); } },
            { type: 'button', id: 'ncmp_rst', label: '重置成绩', action: function () { wins = 0; loss = 0; round = 0; gen(); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '左右两边，谁更大？', L.stage === 2 ? '带分数比较：先化成假分数再判断' : '点击中间符号判定');
          meter(ctx, W * 0.26, 56, W * 0.48, 10, timeLeft / FULL, timeLeft / FULL < 0.3 ? '#ff7676' : COL.teal);
          sidePanel(ctx, W * 0.17, H * 0.42, Math.min(200, W * 0.3), L, '左');
          sidePanel(ctx, W * 0.83, H * 0.42, Math.min(200, W * 0.3), Rr, '右');
          var bw = 62, bh = 52, by = H * 0.42 + 8;
          var defs = [['<', COL.red], ['=', COL.teal], ['>', COL.green]];
          for (var i = 0; i < 3; i++) {
            (function (sg, sx, tone) {
              uiBtn(ctx, sx - bw / 2, by, bw, bh, sg, function () { judge(sg); },
                { bg: 'rgba(255,255,255,0.10)', stroke: tone, size: 26, radius: 10 });
            })(defs[i][0], W / 2 + (i - 1) * (bw + 12), defs[i][1]);
          }
          if (wrongFlash > 0) {
            ctx.save(); ctx.globalAlpha = wrongFlash * 0.30;
            ctx.fillStyle = '#ff5252';
            ctx.fillRect(W * 0.06, H * 0.42 - 96, W * 0.88, 210);
            ctx.restore();
          }
          K.label(ctx, '第 ' + round + ' 回合 · 得分 ' + wins, W / 2, H - 16, { align: 'center', size: 13, color: DIM });
        }
      };
      function sidePanel(ctx, cx, cy, pw, dat, tag) {
        K.panel(ctx, cx - pw / 2, cy - 92, pw, 184, { fill: 'rgba(255,255,255,0.07)', radius: 12 });
        K.label(ctx, tag, cx, cy - 70, { align: 'center', size: 13, color: DIM });
        if (dat.stage === 2) {
          K.label(ctx, dat.w + ' 又 ' + dat.num + '/' + dat.den, cx, cy + 2, { align: 'center', size: 25, weight: 'bold', color: TXT });
          K.label(ctx, '＝ ' + dat.f.n + '/' + dat.f.d, cx, cy + 42, { align: 'center', size: 16, color: COL.teal });
        } else if (dat.stage === 1) {
          K.label(ctx, String(dat.int), cx, cy + 4, { align: 'center', size: 46, weight: 'bold', color: TXT });
        } else {
          dotsCluster(ctx, cx, cy + 4, dat.int, 6, 8, tag === '左' ? COL.blue : COL.orange);
        }
      }
    };
    /* ---------- 4. numplay 数字拆分 ---------- */
    MODES['numplay'] = function () {
      var N = 10, l = 5, found = {}, tries = 0;
      function keyOf(x) { return String(Math.min(x, N - x)) + '_' + Math.max(x, N - x); }
      function totalFound() { var c = 0; for (var kk in found) if (found[kk]) c++; return c; }
      function move(dl) {
        var nl = l + dl;
        if (nl < 0 || nl > N) { toast('筹码不能越过边界哦'); return; }
        l = nl; tries++;
        var r = N - l;
        if (l >= 1 && l <= N - 1) {
          var kk = keyOf(l);
          if (!found[kk]) {
            found[kk] = true;
            var cnt = totalFound();
            toast('🆕 发现分解：' + Math.min(l, r) + ' + ' + Math.max(l, r) + ' ＝ ' + N + '（' + cnt + '/' + (N - 1) + '）');
            if (cnt === N - 1) toast('🎊 全部找齐！你穷举了所有分解！');
          }
        }
      }
      function setN(v) {
        N = clampI(v, 4, 14); l = Math.floor(N / 2);
        found = {}; tries = 0;
        toast('目标改为 ' + N + '，共 ' + (N - 1) + ' 种分解');
      }
      return {
        reset: function () { N = 10; l = 5; found = {}; tries = 0; },
        tick: function () {},
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          return [
            { label: '目标 N', value: String(N), color: COL.purple },
            { label: '当前分解', value: l + ' + ' + (N - l), color: COL.teal },
            { label: '已发现', value: totalFound() + '/' + (N - 1), color: COL.orange },
            { label: '操作次数', value: String(tries), color: '#7fb2ff' }
          ];
        },
        presets: function () {
          return [
            { name: '目标 6', apply: function () { setN(6); } },
            { name: '目标 12', apply: function () { setN(12); } }
          ];
        },
        controls: function () {
          return [
            { type: 'select', id: 'np_target', label: '目标数 N', value: String(N),
              options: [{ value: '6', label: '6' }, { value: '8', label: '8' }, { value: '10', label: '10' }, { value: '12', label: '12' }],
              onChange: function (v) { setN(parseInt(v, 10)); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '把 ' + N + ' 分装到两个壶里', '点 ＋／－ 移动筹码，集齐全部 ' + (N - 1) + ' 种分解');
          var jarTop = H * 0.30, jarH = Math.min(170, H * 0.34), jarW = Math.min(130, W * 0.17);
          drawJar(ctx, W * 0.27, jarTop, jarW, jarH, l, COL.blue, '左壶 ' + l);
          drawJar(ctx, W * 0.73, jarTop, jarW, jarH, N - l, COL.orange, '右壶 ' + (N - l));
          K.label(ctx, '＋', W / 2, jarTop + jarH * 0.42, { align: 'center', size: 30, weight: 'bold', color: DIM });
          K.label(ctx, '＝ ' + N, W / 2, jarTop + jarH * 0.62, { align: 'center', size: 22, weight: 'bold', color: TXT });
          meter(ctx, W * 0.3, H * 0.74, W * 0.4, 12, totalFound() / Math.max(1, N - 1), COL.green);
          K.label(ctx, '完备性进度 ' + totalFound() + '/' + (N - 1), W / 2, H * 0.79, { align: 'center', size: 13, color: DIM });
          /* 分解清单 */
          var listX = W - Math.min(128, W * 0.19), iy0 = 76;
          K.label(ctx, '分解清单', listX, 60, { align: 'center', size: 13, color: DIM });
          var dy2 = Math.min(24, Math.max(14, (H - 150) / Math.max(1, N - 1)));
          for (var i = 1; i <= N - 1; i++) {
            var yy = iy0 + (i - 1) * dy2;
            if (yy > H - 36) break;
            var has = !!found[String(i) + '_' + (N - i)];
            K.chip(ctx, (has ? '✓ ' : '　 ') + i + ' + ' + (N - i), listX, yy,
              { size: 12, color: has ? '#8ef0b6' : DIM, bg: has ? 'rgba(50,200,120,0.15)' : 'rgba(255,255,255,0.05)', pad: 3 });
          }
          var bs = 44, yB = H * 0.905;
          uiBtn(ctx, W * 0.27 - bs - 4, yB - bs / 2, bs, bs, '＋', function () { move(1); }, { stroke: COL.blue, size: 20 });
          uiBtn(ctx, W * 0.27 + 4, yB - bs / 2, bs, bs, '－', function () { move(-1); }, { stroke: COL.blue, size: 20 });
          uiBtn(ctx, W * 0.73 - bs - 4, yB - bs / 2, bs, bs, '＋', function () { move(-1); }, { stroke: COL.orange, size: 20 });
          uiBtn(ctx, W * 0.73 + 4, yB - bs / 2, bs, bs, '－', function () { move(1); }, { stroke: COL.orange, size: 20 });
          if (totalFound() === N - 1) starRow(ctx, W / 2 - 20, H * 0.86, 3, 3, 14);
        }
      };
      function drawJar(ctx, cx, top, w, h, chips, tone, tag) {
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, top + 8); ctx.lineTo(cx - w / 2 + 7, top + h);
        ctx.lineTo(cx + w / 2 - 7, top + h); ctx.lineTo(cx + w / 2, top + 8);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        var nShow = Math.min(chips, 40), drawn = 0;
        var cs = Math.max(8, Math.min(13, w / 9)), cols2 = Math.floor((w - 16) / cs);
        outer:
        for (var row = 0; row < 24; row++) {
          for (var col = 0; col < cols2; col++) {
            if (drawn >= nShow) break outer;
            var px = cx - w / 2 + 9 + col * cs + cs / 2;
            var py = top + h - 9 - row * cs;
            if (py < top + 12) break outer;
            K.circle(ctx, px, py, cs / 2.4, { fill: tone, alpha: 0.92 });
            drawn++;
          }
        }
        K.label(ctx, tag, cx, top + h + 20, { align: 'center', size: 14, weight: 'bold', color: TXT });
      }
    };
    /* ---------- 5. numpairs 数字配对 ---------- */
    MODES['numpairs'] = function () {
      var PAIRMAP = {
        '13': [[1, 12], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]],
        '15': [[2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]],
        '19': [[3, 16], [4, 15], [5, 14], [6, 13], [7, 12], [8, 11]]
      };
      var target = 15, cards = [], first = -1, busy = 0, badPair = [];
      var moves = 0, errs = 0, pairsGot = 0, dealNo = 0;
      function deal() {
        var prs = PAIRMAP[String(target)] || PAIRMAP['15'];
        var flat = [];
        prs.forEach(function (pp) { flat.push(pp[0], pp[1]); });
        var R = K.rng(seedMix(50001, dealNo, target));
        shuffle(flat, R);
        cards = flat.map(function (v) { return { v: v, open: false, done: false }; });
        first = -1; busy = 0; badPair = []; moves = 0; errs = 0; pairsGot = 0; dealNo++;
      }
      function flip(i) {
        if (busy > 0 || i < 0 || i >= cards.length || !cards[i] || cards[i].open || cards[i].done) return;
        cards[i].open = true; moves++;
        if (first < 0) { first = i; return; }
        var j = first; first = -1;
        if (cards[j].v + cards[i].v === target) {
          cards[j].done = true; cards[i].done = true; pairsGot++;
          toast('✅ ' + cards[j].v + ' + ' + cards[i].v + ' ＝ ' + target);
          if (pairsGot === 6) toast('🎊 全部配对完成！用了 ' + turns() + ' 次尝试');
        } else {
          busy = 0.85; badPair = [j, i]; errs++;
          toast('两张之和不是 ' + target + '，记住位置再试');
        }
      }
      function turns() { return Math.floor(moves / 2); }
      function starsOf() { return turns() <= 8 ? 3 : (turns() <= 11 ? 2 : 1); }
      return {
        reset: function () { dealNo = 0; deal(); },
        tick: function (dt) {
          if (busy > 0) {
            busy -= dt;
            if (busy <= 0) {
              for (var i = 0; i < badPair.length; i++) if (cards[badPair[i]]) cards[badPair[i]].open = false;
              badPair = [];
            }
          }
        },
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          return [
            { label: '翻开次数', value: String(moves), color: '#7fb2ff' },
            { label: '失误', value: String(errs), color: '#ff8f8f' },
            { label: '已完成配对', value: pairsGot + '/6', color: '#63e2a5' },
            { label: '效率星级', value: pairsGot === 6 ? starsOf() + ' ★' : '进行中', color: COL.yellow }
          ];
        },
        presets: function () {
          return [
            { name: '目标和 13', apply: function () { this.setTarget(13); }.bind(this) },
            { name: '目标和 19', apply: function () { this.setTarget(19); }.bind(this) }
          ];
        },
        setTarget: function (v) { target = v; deal(); },
        controls: function () {
          return [
            { type: 'select', id: 'pairs_t', label: '配对和', value: String(target),
              options: [{ value: '13', label: '13' }, { value: '15', label: '15' }, { value: '19', label: '19' }],
              onChange: function (v) { target = parseInt(v, 10); deal(); } },
            { type: 'button', id: 'pairs_deal', label: '重新发牌', action: function () { deal(); toast('新一局开始！'); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          headTitle(ctx, W, '数字配对：两张之和 ＝ ' + target, '翻牌记忆 · 步数越少星级越高');
          var gx0 = W * 0.07, gy0 = H * 0.20, gw = W * 0.60, gh = H * 0.70;
          var lay = cardLayout(4, 3, gx0, gy0, gw, gh);
          for (var i = 0; i < lay.length && i < cards.length; i++) {
            (function (idx) {
              var rc = lay[idx], cd = cards[idx];
              var shX = (busy > 0 && badPair.indexOf(idx) >= 0) ? Math.sin(t * 42) * 5 : 0;
              var faceUp = cd.open || cd.done;
              K.panel(ctx, rc.x + shX, rc.y, rc.w, rc.h,
                { fill: faceUp ? (cd.done ? 'rgba(70,200,130,0.18)' : 'rgba(255,255,255,0.14)') : 'rgba(30,52,96,0.85)', stroke: cd.done ? '#57c98a' : 'rgba(255,255,255,0.25)', lw: 1.5, radius: 9 });
              K.label(ctx, faceUp ? String(cd.v) : '?', rc.x + shX + rc.w / 2, rc.y + rc.h / 2,
                { align: 'center', baseline: 'middle', size: Math.min(30, rc.h * 0.5), weight: 'bold', color: cd.done ? '#8ef0b6' : (faceUp ? TXT : 'rgba(255,255,255,0.45)') });
              pushHit(rc.x + shX + rc.w / 2, rc.y + rc.h / 2, Math.max(rc.w, rc.h) / 2, function () { flip(idx); });
            })(i);
          }
          var sx = W * 0.775;
          K.label(ctx, '进度', sx, gy0 + 4, { align: 'center', size: 14, color: DIM });
          starRow(ctx, sx - 20, gy0 + 32, starsOf(), 3, 12);
          meter(ctx, sx - 52, gy0 + 54, 104, 10, pairsGot / 6, COL.green);
          K.label(ctx, pairsGot + '/6 配对', sx, gy0 + 82, { align: 'center', size: 12.5, color: DIM });
          K.label(ctx, '翻开 ' + moves + ' 次（约 ' + turns() + ' 轮）', sx, gy0 + 108, { align: 'center', size: 12.5, color: DIM });
          K.label(ctx, '失误 ' + errs, sx, gy0 + 130, { align: 'center', size: 12.5, color: errs ? '#ff9f9f' : DIM });
          if (pairsGot === 6) {
            K.label(ctx, '🎉 完成！', sx, gy0 + 162, { align: 'center', size: 17, weight: 'bold', color: COL.yellow });
          } else {
            K.label(ctx, '目标：和为 ' + target, sx, gy0 + 162, { align: 'center', size: 12, color: DIM });
          }
        }
      };
    };
    /* ---------- 6. nlint 数轴整数（温度计电梯） ---------- */
    MODES['nlint'] = function () {
      var marker = 0, target = 3, dest = 3;
      var flight = null, cool = 0, ring = 0;
      var reached = 0, missN = 0, goalNo = 0, dragging = false;
      var G = null; // 最近一帧的几何缓存，供指针换算
      function geo(W, H) {
        return { cx: W * 0.16, y0: H * 0.18, y1: H * 0.72, map: linMap(10, -10, H * 0.18, H * 0.72) };
      }
      function newGoal(silent) {
        var R = K.rng(seedMix(8000, goalNo));
        var tv = -10 + Math.floor(R() * 21);
        if (Math.abs(tv - marker) < 2) tv = tv > 0 ? tv - 4 : tv + 4;
        target = clampI(tv, -10, 10);
        goalNo++; flight = null; cool = 0;
        if (!silent) toast('🎯 新目标：调到 ' + target + ' °C');
      }
      function judge(to) {
        if (to === target) {
          reached++; ring = 1; toast('🚀 完美抵达 ' + to + ' °C！'); cool = 1.4;
        } else {
          missN++;
          toast('当前 ' + to + ' °C，目标是 ' + target + ' °C');
        }
      }
      function fly(to) {
        to = clampI(Math.round(to), -10, 10);
        if (flight || cool > 0) return;
        flight = { from: clampI(Math.round(marker), -10, 10), to: to, p: 0 };
      }
      function setMarker(v) {
        marker = clampI(Math.round(v), -10, 10);
        if (!flight && cool <= 0 && marker === target && Math.abs(marker - target) === 0) {
          reached++; ring = 1; toast('👏 拖到位了！' + target + ' °C 达成'); cool = 1.4;
        }
      }
      return {
        reset: function () { marker = 0; dest = 0; reached = 0; missN = 0; goalNo = 0; newGoal(true); toast('目标温度：' + target + ' °C'); },
        tick: function (dt, t) {
          void t;
          if (ring > 0) ring = Math.max(0, ring - dt * 1.2);
          if (cool > 0) { cool -= dt; if (cool <= 0) newGoal(false); return; }
          if (flight) {
            flight.p += dt / 0.9;
            var ee = flight.p < 0.5 ? 2 * flight.p * flight.p : 1 - Math.pow(-2 * flight.p + 2, 2) / 2;
            if (flight.p >= 1) {
              marker = flight.to;
              var landTo = flight.to; flight = null;
              judge(landTo);
            } else {
              marker = K.lerp(flight.from, flight.to, ee);
            }
          }
        },
        down: function (x, y) { if (!tapScan(x, y)) {} },
        ptMove: function (x, y) {
          if (!dragging || !G) return;
          setMarker(G.map.XI(y));
        },
        ptUp: function () { dragging = false; },
        hitTest: function (x, y) { if (!G) return false; return Math.hypot(x - G.cx, y - G.map.X(marker)) <= 26; },
        rows: function () {
          return [
            { label: '当前温度', value: K.fmt(marker, 0) + ' °C', color: marker > 0 ? '#ff9f76' : (marker < 0 ? '#7fc4ff' : DIM) },
            { label: '目标温度', value: target + ' °C', color: COL.purple },
            { label: '成功抵达', value: String(reached), color: '#63e2a5' },
            { label: '偏离次数', value: String(missN), color: '#ff8f8f' }
          ];
        },
        presets: function () {
          return [
            { name: '冲向 −7°C 冰柜', apply: function () { this.forceT(-7); }.bind(this) },
            { name: '冲向 9°C 温泉', apply: function () { this.forceT(9); }.bind(this) }
          ];
        },
        forceT: function (v) { target = clampI(v, -10, 10); flight = null; cool = 0; toast('目标改为 ' + target + ' °C'); },
        controls: function () {
          return [
            { type: 'slider', id: 'nlint_dest', label: '期望温度', value: dest, min: -10, max: 10, step: 1, unit: '°C',
              onChange: function (v) { dest = Math.round(v); } },
            { type: 'button', id: 'nlint_go', label: '🚀 发射火箭',
              action: function () { fly(dest); } },
            { type: 'button', id: 'nlint_goal', label: '换个目标',
              action: function () { newGoal(false); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          headTitle(ctx, W, '数轴电梯 · 温度任务', '拖动火箭指针或发射火箭，精确抵达目标刻度');
          G = geo(W, H);
          var cx = G.cx, map = G.map;
          var grad = ctx.createLinearGradient(0, G.y0, 0, G.y1);
          grad.addColorStop(0, '#e2604f'); grad.addColorStop(0.5, '#eceef2'); grad.addColorStop(1, '#3f74d8');
          K.roundRect(ctx, cx - 17, G.y0, 34, G.y1 - G.y0, 16);
          ctx.fillStyle = grad; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
          K.circle(ctx, cx, G.y1 + 36, 27, { fill: grad, stroke: 'rgba(255,255,255,0.4)', lineWidth: 2 });
          [-10, -5, 0, 5, 10].forEach(function (tv) {
            var yy = map.X(tv);
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath(); ctx.moveTo(cx + 17, yy); ctx.lineTo(cx + 27, yy); ctx.stroke();
            K.label(ctx, String(tv), cx + 32, yy, { size: 11, color: DIM, baseline: 'middle' });
          });
          var ty = map.X(target);
          if (K.arrow) K.arrow(ctx, cx + 118, ty, cx + 66, ty, { color: COL.purple });
          K.label(ctx, '目标 ' + target + '°C', cx + 122, ty - 2, { size: 13, color: '#cf9bff', baseline: 'middle' });
          var dy2 = map.X(dest);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(cx - 46, dy2); ctx.lineTo(cx - 17, dy2); ctx.stroke(); ctx.setLineDash([]);
          K.label(ctx, '期望 ' + dest, cx - 50, dy2 - 2, { size: 11, color: DIM, align: 'right', baseline: 'middle' });
          var my = map.X(marker);
          if (flight) {
            K.dashLine(ctx, cx, my, cx, map.X(flight.from), { color: K.rgba(COL.orange, 0.55) });
          }
          if (dragging) K.circle(ctx, cx, my, 30, { stroke: COL.yellow, lineWidth: 2.5 });
          K.polyline(ctx, [[cx, my - 15], [cx - 8, my], [cx, my + 15], [cx + 8, my]], { color: '#ffd166', closed: true, fill: '#ffd166' });
          if (flight) {
            var fl = 6 + Math.sin(t * 30) * 3;
            K.polyline(ctx, [[cx - 4, my + 15], [cx, my + 15 + fl], [cx + 4, my + 15]], { color: COL.orange, closed: true, fill: COL.orange });
          }
          K.label(ctx, K.fmt(marker, 0) + '°C', cx, my - 25, { align: 'center', size: 14, weight: 'bold', color: TXT });
          hintDrag(ctx, '👆 拖动指针', cx, my - 46);
          pushHit(cx, my, 26, function () { dragging = true; });
          if (ring > 0) {
            ctx.save(); ctx.globalAlpha = ring;
            ctx.beginPath(); ctx.arc(cx, my, 28 + (1 - ring) * 34, 0, 6.2832);
            ctx.strokeStyle = COL.yellow; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
          }
          K.label(ctx, '提示：指针必须精确落在目标整数上才算成功', W / 2, H - 16, { align: 'center', size: 12, color: DIM });
        }
      };
    };
    /* ---------- 7. nldist 数轴距离 ---------- */
    MODES['nldist'] = function () {
      var lo = -10, hi = 10, pa = -4, pb = 6;
      var dragA = false, dragB = false, puzzle = null, solvedN = 0, cands = [], activeBoat = 'B';
      var G = null; // 几何缓存
      function geo(W, H) {
        return { map: linMap(lo, hi, W * 0.09, W * 0.91), y: H * 0.52 };
      }
      function newPuzzle() {
        var R = K.rng(seedMix(6100, solvedN));
        var dMax = Math.min(14, hi - lo - 4);
        var d = 3 + Math.floor(R() * dMax);
        var aa = lo + 1 + Math.floor(R() * (hi - lo - 2));
        var sg = R() < 0.5 ? 1 : -1, bb = aa + sg * d;
        if (bb < lo || bb > hi) { sg = -sg; bb = aa + sg * d; }
        if (bb < lo || bb > hi) bb = clampI(bb, lo, hi);
        pa = aa; pb = bb;
        puzzle = { d: d }; activeBoat = 'B';
        /* 候选数字：端点、±d、随机干扰 */
        var set = {};
        set[aa] = set[bb] = set[d] = set[-d] = true;
        set[clampI(bb + sg * 2, lo, hi)] = true;
        var g2 = 0;
        while (Object.keys(set).length < 8 && g2++ < 40) {
          set[lo + 1 + Math.floor(R() * (hi - lo - 1))] = true;
        }
        cands = shuffle(Object.keys(set).map(Number).slice(0, 8), R);
        toast('谜题：让两船相距恰好 ' + d + ' 步');
      }
      function checkPuzzle() {
        if (!puzzle) { toast('先点【出谜题】开始挑战'); return; }
        var realD = Math.abs(pa - pb);
        if (realD === puzzle.d) {
          solvedN++;
          toast('✅ 距离正好 ' + realD + ' 步，第 ' + solvedN + ' 题答对！');
          newPuzzle();
        } else {
          toast('现在相距 ' + realD + ' 步，目标是 ' + puzzle.d + ' 步');
        }
      }
      return {
        reset: function () { lo = -10; hi = 10; pa = -4; pb = 6; puzzle = null; solvedN = 0; cands = []; },
        tick: function () {},
        down: function (x, y) {
          if (tapScan(x, y)) return;
          if (G) {
            var ax = G.map.X(pa), bx = G.map.X(pb);
            if (Math.abs(x - bx) < 30 && Math.abs(y - G.y) < 48) { dragB = true; activeBoat = 'B'; return; }
            if (Math.abs(x - ax) < 30 && Math.abs(y - G.y) < 48) { dragA = true; activeBoat = 'A'; return; }
          }
        },
        ptMove: function (x) {
          if (!G) return;
          var v = clampI(Math.round(G.map.XI(x)), lo, hi);
          if (dragB) pb = v; else if (dragA) pa = v;
        },
        ptUp: function () { dragA = dragB = false; },
        hitTest: function (x, y) { if (!G) return false; var ax = G.map.X(pa), bx = G.map.X(pb); return (Math.abs(x - bx) < 30 && Math.abs(y - G.y) < 48) || (Math.abs(x - ax) < 30 && Math.abs(y - G.y) < 48); },
        rows: function () {
          return [
            { label: 'A 点', value: String(pa), color: '#7fb2ff' },
            { label: 'B 点', value: String(pb), color: COL.orange },
            { label: '|a−b| 距离', value: String(Math.abs(pa - pb)), color: '#63e2a5' },
            { label: '解谜题数', value: String(solvedN), color: COL.purple }
          ];
        },
        presets: function () {
          return [{ name: '量程扩到 ±20', apply: function () { this.setRange(20); }.bind(this) }];
        },
        setRange: function (v) { hi = v; lo = -v; pa = clampI(pa, lo, hi); pb = clampI(pb, lo, hi); puzzle = null; },
        controls: function () {
          return [
            { type: 'select', id: 'nldist_rng', label: '量程', value: String(hi),
              options: [{ value: '10', label: '−10 ~ 10' }, { value: '20', label: '−20 ~ 20' }],
              onChange: function (v) { this.setRange(parseInt(v, 10) || 10); }.bind(this) },
            { type: 'button', id: 'nldist_pz', label: '出谜题', action: function () { newPuzzle(); } },
            { type: 'button', id: 'nldist_ck', label: '校验答案', action: function () { checkPuzzle(); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '小船之间的距离 |a − b|', '拖动小船到整数刻度，或用候选数字填充');
          G = geo(W, H);
          drawNumLine(ctx, lo, hi, W * 0.09, W * 0.91, G.y, 5, null);
          var ax = G.map.X(pa), bx = G.map.X(pb);
          var lift = Math.min(110, Math.abs(bx - ax) * 0.35 + 44);
          var mid = (ax + bx) / 2;
          ctx.strokeStyle = 'rgba(255,209,102,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.moveTo(ax, G.y - 28);
          ctx.quadraticCurveTo(mid, G.y - 28 - lift * 2, bx, G.y - 28);
          ctx.stroke(); ctx.setLineDash([]);
          K.label(ctx, '|' + pa + ' − (' + pb + ')| ＝ ' + Math.abs(pa - pb) + ' 步',
            mid, Math.max(70, G.y - 28 - lift * 1.45), { align: 'center', size: 15, weight: 'bold', color: '#ffd166' });
          if (dragA) K.circle(ctx, ax, G.y, 33, { stroke: COL.yellow, lineWidth: 2.5 });
          drawBoat(ctx, ax, G.y, COL.blue, 'A');
          if (dragB) K.circle(ctx, bx, G.y, 33, { stroke: COL.yellow, lineWidth: 2.5 });
          drawBoat(ctx, bx, G.y, COL.orange, 'B');
          hintDrag(ctx, '👆 拖动', ax, G.y - 46);
          hintDrag(ctx, '👆 拖动', bx, G.y - 46);
          var dirTxt = pb > pa ? ('B 在 A 右侧 ' + (pb - pa) + ' 步（往右）')
            : pb < pa ? ('B 在 A 左侧 ' + (pa - pb) + ' 步（往左）') : '两点重合啦';
          K.label(ctx, dirTxt, W / 2, G.y + 56, { align: 'center', size: 14, color: DIM });
          if (puzzle) {
            uiChip(ctx, W / 2, H * 0.16, '🧩 任务：相距 ' + puzzle.d + ' 步 · 当前选中 ' + activeBoat + ' 船', null,
              { size: 14, bg: 'rgba(155,89,182,0.25)' });
            var seg = Math.min(74, (W - 90) / Math.max(1, cands.length));
            for (var i = 0; i < cands.length; i++) {
              (function (cv) {
                var xx = W / 2 + (i - (cands.length - 1) / 2) * seg;
                uiChip(ctx, xx, H * 0.88, String(cv), function () {
                  if (activeBoat === 'B') pb = clampI(cv, lo, hi); else pa = clampI(cv, lo, hi);
                }, { size: 15 });
              })(cands[i]);
            }
            K.label(ctx, '点击候选数字放置所选的 ' + activeBoat + ' 船，然后校验', W / 2, H * 0.94, { align: 'center', size: 12, color: DIM });
          } else {
            K.label(ctx, '自由拖动阶段 · 点右侧【出谜题】开启挑战', W / 2, H * 0.88, { align: 'center', size: 13, color: DIM });
          }
        }
      };
      function drawBoat(ctx, x, y, tone, tag) {
        K.polyline(ctx, [[x - 27, y - 4], [x + 27, y - 4], [x + 17, y + 15], [x - 17, y + 15]],
          { color: '#fff', width: 2, closed: true, fill: tone });
        K.polyline(ctx, [[x, y - 4], [x, y - 32], [x + 17, y - 8]], { color: '#f3f4f8', closed: true, fill: '#f3f4f8' });
        K.label(ctx, tag, x, y + 32, { align: 'center', size: 13, weight: 'bold', color: TXT });
      }
    };
    /* ---------- 8. nlops 数轴运算 ---------- */
    MODES['nlops'] = function () {
      var av = 3, bv = -4, op = '+', jumpT = 1, hist = [], dragFrog = false, G = null;
      function result() { return op === '+' ? av + bv : (op === '−' ? av - bv : av * bv); }
      function hops() {
        var list = [];
        if (op === '+' || op === '−') {
          var delta = op === '+' ? bv : -bv;
          var sg = delta > 0 ? 1 : (delta < 0 ? -1 : 0);
          var n2 = Math.min(40, Math.abs(delta));
          for (var i = 0; i < n2; i++) list.push({ from: av + sg * i, len: sg });
        } else {
          var times = Math.min(40, Math.abs(bv));
          var dirS = (av === 0 || bv === 0) ? 0 : ((av * bv) > 0 ? 1 : -1);
          for (var j = 0; j < times; j++) list.push({ from: dirS * av * j, len: dirS * av });
        }
        return list;
      }
      function domSpan() {
        var res = result();
        if (op === '×') { var m = Math.max(Math.abs(res), Math.abs(av)) + 1; return [-m, m]; }
        var lo = Math.min(av, av + bv, av - bv, res, 0) - 1;
        var hi = Math.max(av, av + bv, av - bv, res, 0) + 1;
        return [lo, hi];
      }
      return {
        reset: function () { av = 3; bv = -4; op = '+'; jumpT = 1; hist = []; dragFrog = false; G = null; },
        tick: function (dt) { if (jumpT < 1) jumpT = Math.min(1, jumpT + dt / 0.8); },
        down: function (x, y) {
          if (tapScan(x, y)) return;
          if (G && Math.abs(x - G.map.X(av)) < 18 && Math.abs(y - (G.y0 - 10)) < 18) dragFrog = true;
        },
        ptMove: function (x) {
          if (!dragFrog || !G) return;
          av = clampI(Math.round(G.map.XI(x)), -10, 10);
          jumpT = 0;
        },
        ptUp: function () { dragFrog = false; },
        hitTest: function (x, y) { if (!G) return false; return Math.abs(x - G.map.X(av)) < 18 && Math.abs(y - (G.y0 - 10)) < 18; },
        rows: function () {
          return [
            { label: '表达式', value: av + ' ' + op + ' ' + bv, color: '#7fb2ff' },
            { label: '结果', value: String(result()), color: '#63e2a5' },
            { label: '跳跃段数', value: String(hops().length), color: COL.orange },
            { label: '历史记录', value: hist.length + ' 条', color: COL.purple }
          ];
        },
        presets: function () {
          return [
            { name: '负数乘法 3×(−2)', apply: function () { this.demo('×', 3, -2); }.bind(this) },
            { name: '跨越零点 −5+8', apply: function () { this.demo('+', -5, 8); }.bind(this) }
          ];
        },
        demo: function (o, x2, y2) { op = o; av = x2; bv = y2; jumpT = 0; },
        controls: function () {
          return [
            { type: 'slider', id: 'nlops_a', label: '起点 / 因数 a', value: av, min: -10, max: 10, step: 1,
              onChange: function (v) { av = Math.round(v); jumpT = 0; } },
            { type: 'slider', id: 'nlops_b', label: '跳步 / 因数 b', value: bv, min: -10, max: 10, step: 1,
              onChange: function (v) { bv = Math.round(v); jumpT = 0; } },
            { type: 'select', id: 'nlops_op', label: '运算', value: op,
              options: [{ value: '+', label: '＋ 加法' }, { value: '−', label: '－ 减法' }, { value: '×', label: '× 乘法' }],
              onChange: function (v) { op = String(v); jumpT = 0; } },
            { type: 'button', id: 'nlops_save', label: '存入历史链',
              action: function () {
                var eq = av + ' ' + op + ' ' + bv + ' ＝ ' + result();
                hist.unshift(eq);
                if (hist.length > 7) hist.pop();
                toast('已记录：' + eq);
              } },
            { type: 'button', id: 'nlops_clr', label: '清空历史链', action: function () { hist = []; } }
          ];
        },
        draw: function (ctx, W, H, t) {
          headTitle(ctx, W, '数轴上的加减乘', '每条弧是一次跳跃，橙色高亮点是落点（运算结果）');
          var sp = domSpan();
          var y0 = H * 0.56, xA = W * 0.10, xB = W * 0.66;
          drawNumLine(ctx, sp[0], sp[1], xA, xB, y0, 5, null);
          var map = linMap(sp[0], sp[1], xA, xB);
          G = { map: map, y0: y0 };
          var hs = hops();
          var easeT = jumpT * hs.length;
          var arcH = H * 0.14;
          for (var i = 0; i < hs.length; i++) {
            var prog = K.clamp(easeT - i, 0, 1);
            if (prog <= 0) break;
            var hx0 = map.X(hs[i].from), hx1 = map.X(hs[i].from + hs[i].len);
            var lift = arcH * (i % 2 ? 1.15 : 0.85);
            ctx.strokeStyle = (i === hs.length - 1 && prog >= 1) ? COL.orange : 'rgba(126,170,255,0.85)';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(hx0, y0 - 10);
            var curX = hx0 + (hx1 - hx0) * prog;
            ctx.quadraticCurveTo((hx0 + hx1) / 2, y0 - 10 - lift, curX, y0 - 10 - Math.sin(prog * Math.PI) * lift);
            ctx.stroke();
            if (prog >= 1 && i < hs.length - 1) K.circle(ctx, hx1, y0 - 10, 4, { fill: '#9cc0ff' });
          }
          K.circle(ctx, map.X(0), y0 - 10, 6, { fill: 'rgba(255,255,255,0.25)', stroke: DIM });
          /* 起点标记（可拖拽改 a） */
          if (dragFrog) K.circle(ctx, map.X(av), y0 - 10, 14, { stroke: COL.yellow, lineWidth: 2.5 });
          K.circle(ctx, map.X(av), y0 - 10, 7, { fill: '#7fb2ff', stroke: '#fff', lineWidth: 1.5 });
          K.label(ctx, 'a=' + av, map.X(av), y0 - 26, { align: 'center', size: 11, color: '#7fb2ff' });
          hintDrag(ctx, '👆 拖动起点', map.X(av), y0 - 46);
          if (jumpT >= 1 && hs.length) {
            var last = hs[hs.length - 1];
            var endX = map.X(last.from + last.len);
            var pulse = 9 + Math.sin(t * 6) * 3;
            K.circle(ctx, endX, y0 - 10, pulse, { fill: K.rgba(COL.orange, 0.30), stroke: COL.orange, lineWidth: 2.5 });
            K.label(ctx, '＝ ' + result(), endX, y0 - 46, { align: 'center', size: 20, weight: 'bold', color: COL.orange });
          }
          /* 表达式面板 */
          K.panel(ctx, W / 2 - 110, H * 0.78, 220, 46, { fill: 'rgba(255,255,255,0.08)', radius: 10 });
          K.label(ctx, av + ' ' + op + ' ' + bv + ' ＝ ?', W / 2, H * 0.78 + 23, { align: 'center', size: 22, weight: 'bold', color: TXT });
          /* 历史等式链 */
          var hcx = xB + (W - xB) / 2;
          K.label(ctx, '历史等式链', hcx, 66, { align: 'center', size: 13, color: DIM });
          if (!hist.length) {
            K.label(ctx, '（暂无，点【存入历史链】）', hcx, 94, { align: 'center', size: 12, color: DIM });
          }
          for (var k = 0; k < hist.length; k++) {
            K.chip(ctx, hist[k], hcx, 92 + k * 28,
              { size: 13, bg: k === 0 ? 'rgba(56,132,255,0.22)' : 'rgba(255,255,255,0.08)' });
          }
        }
      };
    };
    /* ---------- 9. ratioxy 比率与比例（调色） ---------- */
    MODES['ratioxy'] = function () {
      var red = 3, blue = 2, tgt = { r: 4, b: 2 };
      var lvl = 1, mixN = 0, failN = 0, okAnim = 0, showTable = true;
      var FX = { shake: 0 };
      var dragCup = false, G = null, dragR0 = 0.5, dragSY = 0, dragT0 = 0;
      function newTgt() {
        var R = K.rng(seedMix(44400, lvl));
        tgt = { r: 1 + Math.floor(R() * 5), b: 1 + Math.floor(R() * 4) };
        okAnim = 0; FX.shake = 0;
        toast('新目标杯已上桌，配方保密！');
      }
      function mixC(rn, bn) {
        var s = rn + bn, wr = s ? rn / s : 0.5;
        return [Math.round(K.lerp(70, 225, wr)), Math.round(K.lerp(110, 62, wr)), Math.round(K.lerp(230, 72, wr))];
      }
      function taste() {
        if (red + blue === 0) { toast('杯子是空的，先加点颜料'); return; }
        mixN++;
        var sameRatio = red * tgt.b === blue * tgt.r;
        var c1 = mixC(red, blue), c2 = mixC(tgt.r, tgt.b);
        var dsum = Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2]);
        if (sameRatio || dsum <= 10) {
          okAnim = 1; lvl++;
          toast('🍷 成功！' + red + ':' + blue + ' 与目标比值一致');
          setTimeout(function () { newTgt(); }, 1400);
        } else {
          FX.shake = 1; failN++;
          toast(failN % 3 === 0 ? ('💡 提示：目标是 红' + tgt.r + ' : 蓝' + tgt.b) : '颜色还差一点，保持红蓝份数的比试试');
        }
      }
      return {
        reset: function () { red = 3; blue = 2; lvl = 1; mixN = 0; failN = 0; dragCup = false; G = null; newTgt(); },
        tick: function (dt) {
          if (okAnim > 0) okAnim = Math.max(0, okAnim - dt * 1.1);
          popAnim(FX, 'shake', dt, 3);
        },
        down: function (x, y) {
          if (tapScan(x, y)) return;
          if (G) {
            var cupBottom = G.cupY + G.cupH / 2 - 5, cupTop = G.cupY - G.cupH / 2 + 5;
            if (Math.abs(x - G.cupX) < G.cupW / 2 + 12 && y >= cupTop - 12 && y <= cupBottom + 12) {
              dragCup = true; dragSY = y; dragT0 = red + blue;
              dragR0 = dragT0 > 0 ? red / dragT0 : 0.5;
            }
          }
        },
        ptMove: function (x, y) {
          if (!dragCup || !G) return;
          var dy = dragSY - y;
          var newTotal = K.clamp(dragT0 + Math.round(dy / G.cupH * 10), 0, 20);
          red = Math.round(newTotal * dragR0); blue = newTotal - red;
        },
        ptUp: function () { dragCup = false; },
        hitTest: function (x, y) { if (!G) return false; var cupBottom = G.cupY + G.cupH / 2 - 5, cupTop = G.cupY - G.cupH / 2 + 5; return Math.abs(x - G.cupX) < G.cupW / 2 + 12 && y >= cupTop - 12 && y <= cupBottom + 12; },
        rows: function () {
          var g2 = gcd(red, blue);
          return [
            { label: '我的配方', value: red + ' : ' + blue, color: '#ff9f76' },
            { label: '最简比', value: red + blue ? ((red / g2) + ':' + (blue / g2)) : '—', color: COL.teal },
            { label: '通关数', value: String(lvl - 1), color: COL.purple },
            { label: '尝试次数', value: String(mixN), color: '#7fb2ff' }
          ];
        },
        presets: function () {
          return [
            { name: '双倍配方 6 : 4', apply: function () { red = 6; blue = 4; } },
            { name: '清空重来', apply: function () { red = 0; blue = 0; } }
          ];
        },
        controls: function () {
          return [
            { type: 'slider', id: 'ratio_red', label: '红色（份）', value: red, min: 0, max: 10, step: 1,
              onChange: function (v) { red = Math.round(v); } },
            { type: 'slider', id: 'ratio_blue', label: '蓝色（份）', value: blue, min: 0, max: 10, step: 1,
              onChange: function (v) { blue = Math.round(v); } },
            { type: 'checkbox', id: 'ratio_tbl', label: '显示等效比表', value: showTable, onChange: function (v) { showTable = !!v; } },
            { type: 'button', id: 'ratio_taste', label: '尝一口判定', action: function () { taste(); } },
            { type: 'button', id: 'ratio_new', label: '换一个目标杯', action: function () { newTgt(); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '调色实验室：让我的杯子和目标杯同色', '颜色相同 ⟺ 红 : 蓝 比值相等（ΔRGB<10）');
          var shX = FX.shake > 0 ? Math.sin(Date.now() / 25) * 5 : 0;
          var cupY = H * 0.50, cupW = Math.min(108, W * 0.14), cupH = Math.min(190, H * 0.36);
          G = { cupX: W * 0.32, cupY: cupY, cupW: cupW, cupH: cupH };
          if (dragCup) K.circle(ctx, W * 0.32 + shX, cupY, cupH * 0.4, { stroke: COL.yellow, lineWidth: 2.5 });
          drawCup(ctx, W * 0.32 + shX, cupY, cupW, cupH, mixC(red, blue), '我的配方 ' + red + ':' + blue,
            red + blue ? Math.min(0.9, 0.18 + (red + blue) / 20) : 0, false);
          hintDrag(ctx, '👆 拖动调比例', W * 0.32, cupY - cupH / 2 - 42);
          var reveal = failN >= 3;
          drawCup(ctx, W * 0.68 - shX, cupY, cupW, cupH, mixC(tgt.r, tgt.b),
            reveal ? ('目标杯 ' + tgt.r + ':' + tgt.b) : '目标杯 ???',
            Math.min(0.9, 0.18 + (tgt.r + tgt.b) / 20), !reveal);
          if (okAnim > 0) {
            ctx.save(); ctx.globalAlpha = okAnim;
            K.label(ctx, '✔ 颜色一致！', W * 0.5, cupY - cupH / 2 - 30, { align: 'center', size: 24, weight: 'bold', color: '#7dffab' });
            ctx.restore();
          }
          K.chip(ctx, '份数越多颜色越深 · 拖动左侧滑块配方', W * 0.5, cupY + cupH / 2 + 34, { size: 12 });
          if (showTable) {
            var gx = W * 0.85, g2 = gcd(tgt.r, tgt.b);
            K.label(ctx, '目标比等效族', gx, 76, { align: 'center', size: 12.5, color: DIM });
            for (var k = 1; k <= 3; k++) {
              K.chip(ctx, k * (tgt.r / g2) + ' : ' + k * (tgt.b / g2), gx, 100 + k * 30,
                { size: 12.5, bg: k === 1 ? 'rgba(255,159,118,0.2)' : 'rgba(255,255,255,0.07)' });
            }
            K.label(ctx, '同乘 k 不变值', gx, 208, { align: 'center', size: 11, color: DIM });
          }
        }
      };
      function drawCup(ctx, cx, cy, cw, chh, rgb, tag, fillLvl, mystery) {
        K.panel(ctx, cx - cw / 2, cy - chh / 2, cw, chh, { fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.5)', lw: 2, radius: 12 });
        var fh = (chh - 16) * K.clamp(fillLvl || 0.12, 0.08, 1);
        K.roundRect(ctx, cx - cw / 2 + 5, cy + chh / 2 - 5 - fh, cw - 10, fh, 6);
        ctx.fillStyle = mystery ? 'rgba(150,120,255,0.55)' : ('rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')');
        ctx.fill();
        K.label(ctx, tag, cx, cy - chh / 2 - 18, { align: 'center', size: 13.5, weight: 'bold', color: TXT });
      }
    };
    /* ---------- 11. proppl 比例游乐场（齿轮传动） ---------- */
    MODES['proppl'] = function () {
      var F = 44, Rr = 22, cadence = 60, sceneSel = '日常骑行';
      var PRESETS = [{ name: '1 : 1', F: 44, R: 44 }, { name: '2 : 1', F: 52, R: 26 }, { name: '3 : 1', F: 54, R: 18 }];
      function ratioSimple() { var g = gcd(F, Rr); return { n: F / g, d: Rr / g }; }
      function ratioVal() { return F / Rr; }
      function speedKmh() { return cadence * ratioVal() * 2.1 * 60 / 1000; }
      function applyPreset(p) {
        F = p.F; Rr = p.R;
        var rs = ratioSimple();
        toast('预设传动比 ' + rs.n + ' : ' + rs.d);
      }
      return {
        reset: function () { F = 44; Rr = 22; cadence = 60; },
        tick: function () {},
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          var rs = ratioSimple();
          return [
            { label: '传动比', value: rs.n + ':' + rs.d, color: COL.purple },
            { label: '踏频', value: cadence + ' 转/分', color: '#7fb2ff' },
            { label: '车速', value: K.fmt(speedKmh(), 1) + ' km/h', color: '#63e2a5' },
            { label: '场景', value: sceneSel, color: COL.teal }
          ];
        },
        presets: function () {
          return [
            { name: '蜂鸟冲刺', apply: function () { this.scenePick('蜂鸟冲刺'); }.bind(this) },
            { name: '巨轮爬坡', apply: function () { this.scenePick('巨轮爬坡'); }.bind(this) }
          ];
        },
        scenePick: function (nm) {
          sceneSel = nm;
          if (nm === '蜂鸟冲刺') { cadence = 140; applyPreset(PRESETS[2]); }
          else if (nm === '巨轮爬坡') { cadence = 30; applyPreset(PRESETS[0]); }
          else { cadence = 66; applyPreset(PRESETS[1]); }
        },
        controls: function () {
          var self = this;
          return [
            { type: 'slider', id: 'pp_front', label: '前齿轮齿数', value: F, min: 30, max: 60, step: 2,
              onChange: function (v) { F = Math.round(v / 2) * 2; } },
            { type: 'slider', id: 'pp_rear', label: '后齿轮齿数', value: Rr, min: 14, max: 40, step: 2,
              onChange: function (v) { Rr = Math.round(v / 2) * 2; } },
            { type: 'slider', id: 'pp_cad', label: '踏频（转/分）', value: cadence, min: 20, max: 160, step: 2,
              onChange: function (v) { cadence = Math.round(v / 2) * 2; } },
            { type: 'select', id: 'pp_scene', label: '骑行场景', value: sceneSel,
              options: [{ value: '蜂鸟冲刺', label: '蜂鸟冲刺' }, { value: '日常骑行', label: '日常骑行' }, { value: '巨轮爬坡', label: '巨轮爬坡' }],
              onChange: function (v) { self.scenePick(String(v)); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          headTitle(ctx, W, '自行车传动比游乐场', '链条把转动从前齿轮搬到后齿轮 · 双数字线等比移动');
          var rs = ratioSimple(), gy = H * 0.34;
          var r1 = 22 + F * 0.9, r2 = 22 + Rr * 0.9;
          drawGear(ctx, W * 0.33, gy, r1, F, COL.orange, '前 ' + F + ' 齿');
          drawGear(ctx, W * 0.67, gy, r2, Rr, COL.blue, '后 ' + Rr + ' 齿');
          ctx.strokeStyle = 'rgba(205,205,225,0.65)'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(W * 0.33, gy - r1); ctx.lineTo(W * 0.67, gy - r2);
          ctx.moveTo(W * 0.33, gy + r1); ctx.lineTo(W * 0.67, gy + r2);
          ctx.stroke();
          K.chip(ctx, rs.n + ' : ' + rs.d, W / 2, gy, { size: 17, bg: 'rgba(155,89,182,0.3)' });
          tapeMove(ctx, W * 0.10, W * 0.60, H * 0.62, t * cadence * ratioVal() * 1.4, COL.orange, '踏板圈数 ×' + K.fmt(ratioVal(), 2));
          tapeMove(ctx, W * 0.10, W * 0.60, H * 0.72, t * cadence * 1.4, COL.blue, '车轮圈数');
          for (var k = 1; k <= 3; k++) {
            var ft = k * ratioVal();
            var isInt = Math.abs(ft - Math.round(ft)) < 1e-9;
            uiChip(ctx, W * 0.25 + k * W * 0.24, H * 0.85,
              '后轮 ' + k + ' 圈 ↔ 前轮 ' + (isInt ? Math.round(ft) : K.fmt(ft, 2)) + ' 圈',
              null, { size: 12.5, bg: isInt ? 'rgba(99,226,165,0.16)' : 'rgba(255,255,255,0.06)', color: isInt ? '#9df0c2' : DIM });
          }
          var py = 66;
          for (var i = 0; i < PRESETS.length; i++) {
            (function (pp, xx) {
              var act = rs.n * pp.R === pp.F * rs.d;
              uiChip(ctx, xx, py, pp.name, function () { applyPreset(pp); },
                { size: 14, bg: act ? 'rgba(99,226,165,0.28)' : 'rgba(255,255,255,0.10)', color: act ? '#9df0c2' : TXT });
            })(PRESETS[i], W / 2 + (i - 1) * 64);
          }
          K.label(ctx, '车速 ' + K.fmt(speedKmh(), 1) + ' km/h（轮周 2.1 m）', W / 2, H - 14, { align: 'center', size: 12.5, color: DIM });
        }
      };
      function drawGear(ctx, x, y, rad, teeth, tone, tag) {
        K.circle(ctx, x, y, rad, { fill: K.rgba(tone, 0.22), stroke: tone, lineWidth: 3 });
        var stepT = Math.max(1, Math.ceil(teeth / 22));
        for (var i = 0; i < teeth; i += stepT) {
          var ang = i / teeth * 6.2832;
          K.circle(ctx, x + Math.cos(ang) * (rad + 4), y + Math.sin(ang) * (rad + 4), 3.5, { fill: tone });
        }
        K.circle(ctx, x, y, 6, { fill: '#fff' });
        K.label(ctx, tag, x, y + rad + 20, { align: 'center', size: 13, color: TXT });
      }
      function tapeMove(ctx, x0, x1, y, offset, tone, tag) {
        var seg = 34, off = ((offset % seg) + seg) % seg;
        K.label(ctx, tag, x0, y - 18, { size: 12, color: DIM });
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        for (var px = x0 - off; px < x1; px += seg) {
          ctx.strokeStyle = tone; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(px, y - 8); ctx.lineTo(px + 12, y); ctx.lineTo(px, y + 8); ctx.stroke();
        }
      }
    };
    /* ---------- 10. unitrate 单位速率 ---------- */
    MODES['unitrate'] = function () {
      var A = { price: 9, grams: 300 }, B2 = { price: 12, grams: 450 };
      var quizMode = false, quizWins = 0, quizLoss = 0, guessed = false, qi = 0;
      function unit(o) { return o.price / o.grams; }
      function cheaper() { return unit(A) <= unit(B2) ? 0 : 1; }
      function fmtU(o) { return '¥' + K.fmt(unit(o), 3) + '/克'; }
      function newQuiz() {
        quizMode = true; guessed = false;
        var R = K.rng(seedMix(77777, qi));
        A = { price: 5 + Math.floor(R() * 30), grams: 100 + Math.floor(R() * 8) * 50 + 50 };
        B2 = { price: 5 + Math.floor(R() * 30), grams: 100 + Math.floor(R() * 8) * 50 + 50 };
        if (unit(A) === unit(B2)) B2.price += 1;
        qi++;
        toast('🧠 心算挑战：不许看数据，先点你心目中更划算的商品卡！');
      }
      function guess(side) {
        if (!quizMode) {
          toast('单价对比：' + fmtU(side === 0 ? A : B2) + '　（另一件 ' + fmtU(side === 0 ? B2 : A) + '）');
          return;
        }
        if (guessed) { toast('本轮已揭晓，再点【心算挑战】来一局'); return; }
        guessed = true;
        if (side === cheaper()) { quizWins++; toast('✅ 答对！单价 ' + fmtU(A) + ' vs ' + fmtU(B2)); }
        else { quizLoss++; toast('❌ 更划算的是' + (cheaper() === 0 ? '甲' : '乙') + '商品'); }
      }
      return {
        reset: function () {
          A = { price: 9, grams: 300 }; B2 = { price: 12, grams: 450 };
          quizMode = false; quizWins = 0; quizLoss = 0; guessed = false; qi = 0;
        },
        tick: function () {},
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          return [
            { label: '甲 单价', value: fmtU(A), color: '#7fb2ff' },
            { label: '乙 单价', value: fmtU(B2), color: COL.orange },
            { label: '更划算', value: cheaper() === 0 ? '甲商品' : '乙商品', color: '#63e2a5' },
            { label: quizMode ? '战绩' : '模式', value: quizMode ? (quizWins + '胜 ' + quizLoss + '负') : '自由探索', color: COL.purple }
          ];
        },
        presets: function () {
          return [
            { name: '总价陷阱 ¥40/500g vs ¥45/400g', apply: function () { A = { price: 40, grams: 500 }; B2 = { price: 45, grams: 400 }; } },
            { name: '近似难辨局', apply: function () { newQuiz(); } }
          ];
        },
        controls: function () {
          return [
            { type: 'slider', id: 'ur_pa', label: '甲 价格(¥)', value: A.price, min: 1, max: 60, step: 1,
              onChange: function (v) { A.price = Math.round(v); } },
            { type: 'slider', id: 'ur_ga', label: '甲 克数', value: A.grams, min: 50, max: 1000, step: 10, unit: 'g',
              onChange: function (v) { A.grams = Math.round(v / 10) * 10; } },
            { type: 'slider', id: 'ur_pb', label: '乙 价格(¥)', value: B2.price, min: 1, max: 60, step: 1,
              onChange: function (v) { B2.price = Math.round(v); } },
            { type: 'slider', id: 'ur_gb', label: '乙 克数', value: B2.grams, min: 50, max: 1000, step: 10, unit: 'g',
              onChange: function (v) { B2.grams = Math.round(v / 10) * 10; } },
            { type: 'button', id: 'ur_quiz', label: '🧠 心算挑战',
              action: function () { newQuiz(); } },
            { type: 'button', id: 'ur_back', label: '返回自由探索',
              action: function () { quizMode = false; guessed = false; toast('可随意拖动滑块对比单价'); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, quizMode && !guessed ? '心算挑战：谁更划算？' : '单位速率：谁更划算？',
            '单价 ＝ 价格 ÷ 克数 · 点击商品卡互动');
          var cy = H * 0.46, cw = Math.min(235, W * 0.29), chh = Math.min(215, H * 0.42);
          itemCard(ctx, W * 0.28, cy, cw, chh, A, '甲商品', 0, COL.blue, quizMode);
          itemCard(ctx, W * 0.72, cy, cw, chh, B2, '乙商品', 1, COL.orange, quizMode);
          var showStamp = !quizMode || guessed;
          if (showStamp) {
            ctx.save();
            ctx.translate(cheaper() === 0 ? W * 0.28 : W * 0.72, cy - chh / 2 + 36);
            ctx.rotate(-0.16);
            K.chip(ctx, '💰 更划算', 0, 0, { size: 17, bg: 'rgba(60,200,120,0.30)', color: '#8effbe' });
            ctx.restore();
          } else {
            K.label(ctx, '先心算，点击你心中更划算的商品卡！', W / 2, cy + chh / 2 + 36, { align: 'center', size: 14, color: COL.yellow });
          }
          K.label(ctx, '总价大 ≠ 单价低 · 例：¥40/500g 比 ¥45/400g 贵一点点', W / 2, H - 16, { align: 'center', size: 12, color: DIM });
        }
      };
      function itemCard(ctx, cx, cy, cw, chh, dat, name, side, tone, inQuiz) {
        K.panel(ctx, cx - cw / 2, cy - chh / 2, cw, chh,
          { fill: 'rgba(255,255,255,0.07)', stroke: 'rgba(255,255,255,0.3)', lw: 1.5, radius: 14 });
        K.label(ctx, name, cx, cy - chh / 2 + 26, { align: 'center', size: 16, weight: 'bold', color: TXT });
        K.label(ctx, '¥' + dat.price + ' / ' + dat.grams + ' 克', cx, cy - chh / 2 + 56, { align: 'center', size: 14, color: DIM });
        K.label(ctx, inQuiz ? '? 元/克' : fmtU(dat), cx, cy + 6, { align: 'center', size: 21, weight: 'bold', color: tone });
        pushHit(cx, cy, Math.max(cw, chh) / 2, function () { guess(side); });
      }
    };
    /* ---------- 12. fracintro 分数入门：图/数轴/百分数三视图 ---------- */
    MODES['fracintro'] = function () {
      var shape = 'pie', d = 4, eaten = [], n = 0;
      var quiz = false, tgt = { n: 1, d: 4 }, wins = 0, tries = 0, qi = 0, done = false;
      var dragEat = false, G = null;
      function resetSlices() { eaten = []; n = 0; done = false; }
      function setD(v) { d = clampI(v, 2, 10); resetSlices(); }
      function syncN() { n = 0; for (var k = 0; k < d; k++) if (eaten[k]) n++; }
      function checkQuiz() {
        if (quiz && !done) {
          if (fSame({ n: n, d: d }, tgt)) {
            done = true; wins++;
            toast('✅ 太棒了！' + fStr(tgt) + ' 恰好是' + n + '/' + d);
          } else if (n > 0) toast('目前 ' + fStr({ n: n, d: d }) + '，目标是 ' + fStr(tgt));
        }
      }
      function toggle(i) {
        eaten[i] = !eaten[i]; syncN(); checkQuiz();
      }
      function eatSlice(i) {
        if (i < 0 || i >= d || eaten[i]) return;
        eaten[i] = true; syncN(); checkQuiz();
      }
      function newQuiz() {
        var R = K.rng(seedMix(30301, qi));
        var dd = 3 + Math.floor(R() * 6);            // 目标分母 3..8
        tgt = { n: 1 + Math.floor(R() * (dd - 1)), d: dd };
        quiz = true; done = false; setD(dd); qi++; tries++;
        toast('🎯 用滑块分好格后，点 slice 吃到恰好 ' + fStr(tgt));
      }
      return {
        reset: function () { shape = 'pie'; d = 4; resetSlices(); quiz = false; wins = 0; tries = 0; qi = 0; dragEat = false; G = null; },
        tick: function () {},
        down: function (x, y) { tapScan(x, y); dragEat = true; },
        ptMove: function (x, y) {
          if (!dragEat || !G) return;
          if (G.shape === 'pie') {
            var dx = x - G.cx, dy = y - G.cy;
            if (Math.hypot(dx, dy) < G.R0 * 1.1) {
              var ang = Math.atan2(dy, dx) + Math.PI / 2;
              if (ang < 0) ang += 2 * Math.PI;
              eatSlice(Math.floor(ang / (2 * Math.PI / G.d)) % G.d);
            }
          } else {
            if (x >= G.bx && x <= G.bx + G.bw && Math.abs(y - G.cy) < G.bh) {
              eatSlice(Math.floor((x - G.bx) / G.bw * G.d));
            }
          }
        },
        ptUp: function () { dragEat = false; },
        hitTest: function (x, y) { if (!G) return false; if (G.shape === 'pie') return Math.hypot(x - G.cx, y - G.cy) < G.R0 * 1.1; return x >= G.bx && x <= G.bx + G.bw && Math.abs(y - G.cy) < G.bh; },
        rows: function () {
          var fr = { n: n, d: d };
          return [
            { label: '当前分数', value: fStr(fr), color: COL.orange },
            { label: '等值小数', value: K.fmt(n / d, 3), color: COL.teal },
            { label: '百分数', value: K.fmt(n / d * 100, 1) + '%', color: COL.pink },
            { label: quiz ? '目标/战绩' : '挑战', value: quiz ? fStr(tgt) + ' · ' + wins + '/' + tries : '自由探索', color: COL.purple }
          ];
        },
        presets: function () {
          return [
            { name: '半个披萨', apply: function () { shape = 'pie'; setD(2); } },
            { name: '巧克力条 4/8', apply: function () { shape = 'bar'; setD(8); for (var i = 0; i < 4; i++) eaten[i] = true; n = 4; } },
            { name: '挑战 5/6', apply: function () { quiz = true; tgt = { n: 5, d: 6 }; setD(6); done = false; tries++; } }
          ];
        },
        controls: function () {
          return [
            { type: 'select', id: 'fi_shape', label: '形状', value: shape,
              options: [{ value: 'pie', label: '🍕 圆披萨' }, { value: 'bar', label: '🍫 巧克力条' }],
              onChange: function (v) { shape = v === 'bar' ? 'bar' : 'pie'; } },
            { type: 'slider', id: 'fi_d', label: '等分份数 d', value: d, min: 2, max: 10, step: 1,
              onChange: function (v) { setD(Math.round(v)); } },
            { type: 'button', id: 'fi_quiz', label: '🎯 出题挑战', action: function () { newQuiz(); } },
            { type: 'button', id: 'fi_reset', label: '清空重摆', action: function () { resetSlices(); toast('已清空，重新点击切块'); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '分数入门：一块蛋糕的三种说法',
            quiz && !done ? '目标 ' + fStr(tgt) + ' · 点击切块取走对应份数' : '点击切块，观察三视图同步变化');
          var cx = W * 0.34, cy = H * 0.52, R0 = Math.min(H * 0.27, W * 0.16);
          if (shape === 'pie') {
            pieChart(ctx, cx, cy, R0, d, eaten, null);
            for (var i = 0; i < d; i++) {
              (function (idx) {
                var a = -Math.PI / 2 + (idx + 0.5) * 2 * Math.PI / d;
                pushHit(cx + Math.cos(a) * R0 * 0.62, cy + Math.sin(a) * R0 * 0.62,
                  Math.max(R0 / d, MINR), function () { toggle(idx); });
              })(i);
            }
          } else {
            var bw = Math.min(W * 0.42, H * 0.5), bh = H * 0.11, bx = cx - bw / 2;
            barFrac(ctx, bx, cy - bh / 2, bw, bh, d, eaten, null);
            for (var j = 0; j < d; j++) {
              (function (idx) {
                pushHit(bx + (idx + 0.5) * bw / d, cy, Math.max(bw / d / 2, bh, MINR), function () { toggle(idx); });
              })(j);
            }
          }
          var bwG = Math.min(W * 0.42, H * 0.5), bhG = H * 0.11, bxG = cx - bwG / 2;
          G = { shape: shape, cx: cx, cy: cy, R0: R0, d: d, bx: bxG, bw: bwG, bh: bhG };
          if (shape === 'pie') hintDrag(ctx, '👆 拖动切块', G.cx, G.cy - G.R0 - 18);
          else hintDrag(ctx, '👆 拖动切块', G.cx, G.cy - G.bh - 18);
          if (dragEat) K.circle(ctx, cx, cy, R0 + 8, { stroke: COL.yellow, lineWidth: 2.5 });
          /* 大分数牌 */
          K.label(ctx, fStr({ n: n, d: d }), W * 0.66, H * 0.36, { align: 'center', size: 40, weight: 'bold', color: COL.orange });
          K.label(ctx, K.fmt(n / d, 3) + ' ＝ ' + K.fmt(n / d * 100, 1) + '%', W * 0.66, H * 0.44, { align: 'center', size: 18, color: TXT });
          /* [0,1] 小数轴 */
          var lx0 = W * 0.60, lx1 = W * 0.92, ly = H * 0.58, M = linMap(0, 1, lx0, lx1);
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(lx0, ly); ctx.lineTo(lx1, ly); ctx.stroke();
          for (var s = 0; s <= d; s++) {
            var major = s % Math.max(1, Math.round(d / 4)) === 0 || s === d;
            ctx.strokeStyle = major ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.moveTo(M.X(s / d), ly - (major ? 6 : 4)); ctx.lineTo(M.X(s / d), ly + (major ? 6 : 4)); ctx.stroke();
            if (major) K.label(ctx, K.fmt(s / d, 2), M.X(s / d), ly + 17, { align: 'center', size: 10.5, color: DIM });
          }
          if (!quiz || n > 0 || done)
            K.circle(ctx, M.X(n / d), ly, 7, { fill: COL.orange, stroke: '#fff', lineWidth: 2 });
          if (quiz) starRow(ctx, W - 96, 24, Math.min(wins, 3), Math.max(tries > 0 ? 3 : 0, wins > 3 ? 5 : 3), 12);
          K.label(ctx, quiz ? (done ? '🎉 完成！再出一题试试别的分母' : '提示：先心算要吃几块') : '分子＝吃掉的块数 · 分母＝总块数',
            W / 2, H - 14, { align: 'center', size: 12.5, color: DIM });
        }
      };
    };
    /* ---------- 13. fraceq 等值分数：基本性质与对齐条 ---------- */
    MODES['fraceq'] = function () {
      var d0 = 4, eat = [], k = 2, opts = [], okIdx = -1, quiz = false, qi = 0, wins = 0, tries = 0, flash = '';
      var dragFill = false, G = null;
      function resetSlices() { eat = []; }
      function setD(v) { d0 = clampI(v, 2, 6); resetSlices(); }
      function nOf() { var c = 0; for (var i = 0; i < d0; i++) if (eat[i]) c++; return c; }
      function toggle(i) {
        eat[i] = !eat[i];
        if (quiz && opts.length) toast('先答完这道闪电题～点击候选分数');
      }
      function fillSeg(i) {
        if (i < 0 || i >= d0 || eat[i]) return;
        eat[i] = true;
      }
      function newQuiz() {
        var R = K.rng(seedMix(40307, qi));
        var a = fRed(1 + Math.floor(R() * 7), 2 + Math.floor(R() * 6));
        var m = 2 + Math.floor(R() * 2);
        var ans = { n: a.n * m, d: a.d * m };
        opts = [fStr(ans), fStr(fAdd(ans, { n: 1, d: ans.d })), fStr({ n: ans.n + 1, d: ans.d })];
        shuffle(opts, R);
        okIdx = opts.indexOf(fStr(ans));
        quiz = true; qi++; tries++;
        toast('⚡ ' + fStr(a) + ' ＝ 几分之几？点选正确答案');
      }
      function pick(i) {
        if (!quiz) return;
        if (i === okIdx) { wins++; flash = '✅ 正确！分子分母同乘不为 0 的数，大小不变'; }
        else { flash = '❌ 再想想：' + opts[okIdx]; }
        quiz = false;
        setTimeout(function () { flash = ''; }, 2600);
      }
      return {
        reset: function () { d0 = 4; k = 2; resetSlices(); opts = []; quiz = false; qi = 0; wins = 0; tries = 0; flash = ''; dragFill = false; G = null; },
        tick: function () {},
        down: function (x, y) { tapScan(x, y); dragFill = true; },
        ptMove: function (x, y) {
          if (!dragFill || !G) return;
          var x0 = G.bx - G.bw / 2;
          if (x >= x0 && x <= x0 + G.bw && Math.abs(y - G.cy) < G.bh) {
            fillSeg(Math.floor((x - x0) / G.bw * G.d0));
          }
        },
        ptUp: function () { dragFill = false; },
        hitTest: function (x, y) { if (!G) return false; var x0 = G.bx - G.bw / 2; return x >= x0 && x <= x0 + G.bw && Math.abs(y - G.cy) < G.bh; },
        rows: function () {
          var nn = nOf();
          return [
            { label: '原图', value: fStr({ n: nn, d: d0 }), color: COL.orange },
            { label: '×' + k + ' 后', value: fStr({ n: nn * k, d: d0 * k }), color: COL.teal },
            { label: '是否相等', value: fSame({ n: nn, d: d0 }, { n: nn * k, d: d0 * k }) ? '相等 ✓' : '不等', color: '#63e2a5' },
            { label: '战绩', value: wins + '/' + tries + ' 题', color: COL.purple }
          ];
        },
        presets: function () {
          return [
            { name: '1/2 ↔ 2/4', apply: function () { setD(2); eat[0] = true; k = 2; } },
            { name: '1/3 ↔ 2/6', apply: function () { setD(3); eat[0] = true; k = 2; } },
            { name: '3/5 ↔ 9/15', apply: function () { setD(5); for (var i = 0; i < 3; i++) eat[i] = true; k = 3; } }
          ];
        },
        controls: function () {
          return [
            { type: 'slider', id: 'fe_d', label: '原图份数', value: d0, min: 2, max: 6, step: 1,
              onChange: function (v) { setD(Math.round(v)); } },
            { type: 'select', id: 'fe_k', label: '整体放缩', value: String(k),
              options: [{ value: '1', label: '不变 ×1' }, { value: '2', label: '放大 ×2' }, { value: '3', label: '放大 ×3' }, { value: '4', label: '放大 ×4' }],
              onChange: function (v) { k = clampI(parseInt(v, 10) || 1, 1, 4); } },
            { type: 'button', id: 'fe_quiz', label: '⚡ 闪电答题', action: function () { newQuiz(); } },
            { type: 'button', id: 'fe_reset', label: '清空', action: resetSlices }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '等值分数：外形变了，大小没变',
            quiz ? '选出与左式相等的分数' : '点击主图取块 → 放大倍数观察对齐');
          var nn = nOf();
          var bx = W * 0.30, bw = Math.min(W * 0.26, H * 0.44), bh = H * 0.10, cy = H * 0.47;
          G = { bx: bx, bw: bw, bh: bh, cy: cy, d0: d0 };
          hintDrag(ctx, '👆 拖动取块', G.bx, G.cy - G.bh / 2 - 20);
          if (dragFill) K.panel(ctx, bx - bw / 2 - 4, cy - bh / 2 - 4, bw + 8, bh + 8, { stroke: COL.yellow, lw: 2.5, radius: 6 });
          K.label(ctx, '主图 ' + fStr({ n: nn, d: d0 }), bx + bw / 2, H * 0.20, { align: 'center', size: 14, color: DIM });
          barFrac(ctx, bx - bw / 2, cy - bh / 2, bw, bh, d0, eat, COL.orange);
          for (var i = 0; i < d0; i++) {
            (function (idx) {
              pushHit(bx - bw / 2 + (idx + 0.5) * bw / d0, cy, Math.max(bw / d0 / 2, bh, MINR), function () { toggle(idx); });
            })(i);
          }
          /* 对齐的放缩条（同一起点） */
          var gx = bx + bw / 2 + 46, gw = Math.min(W * 0.24, H * 0.42);
          K.label(ctx, '×' + k + ' 放缩', (gx + gw / 2), H * 0.20, { align: 'center', size: 14, color: DIM });
          barFrac(ctx, gx, cy - bh / 2, gw, bh, d0 * k, partMask(nn * k, d0 * k), COL.teal);
          ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath(); ctx.moveTo(bx - bw / 2, cy - bh / 2 - 12); ctx.lineTo(gx + gw, cy - bh / 2 - 12);
          ctx.moveTo(bx - bw / 2, cy + bh / 2 + 12); ctx.lineTo(gx + gw, cy + bh / 2 + 12); ctx.stroke();
          ctx.restore();
          K.label(ctx, fStr({ n: nn, d: d0 }) + ' ＝ ' + fStr({ n: nn * k, d: d0 * k }), gx + gw / 2, cy + bh / 2 + 34,
            { align: 'center', size: 17, weight: 'bold', color: TXT });
          /* 等值表 */
          var ty = H * 0.68;
          K.label(ctx, '等值表', W * 0.22, ty - 18, { align: 'center', size: 13, color: DIM });
          for (var r = 1; r <= 4; r++) {
            var rV = fRed(Math.max(nn, 1) * r, d0 * r);
            uiChip(ctx, W * 0.16, ty + (r - 1) * 21, fStr(rV) + (fSame(rV, { n: Math.max(nn, 1), d: d0 }) ? ' ✓' : ''),
              null, { bg: r === 1 ? 'rgba(255,169,64,0.28)' : 'rgba(255,255,255,0.08)', color: r === 1 ? COL.orange : DIM, size: 12 });
          }
          /* 闪电答题区 */
          if (quiz) {
            var qx = W * 0.55;
            starRow(ctx, W - 96, 24, Math.min(wins, 3), 3, 12);
            for (var o = 0; o < opts.length; o++) {
              (function (oi) {
                var wOp = uiBtn(ctx, qx + oi * 108, ty + 8, 96, 38, opts[oi], function () { pick(oi); },
                  { bg: 'rgba(126,171,255,0.20)', stroke: 'rgba(160,190,255,0.55)', lw: 1.5, size: 15 });
                void wOp;
              })(o);
            }
          }
          K.label(ctx, flash || '同乘或同除一个非零数 → 同一位置', W / 2, H - 14, { align: 'center', size: 12.5,
            color: flash.charAt(0) === '✅' ? '#63e2a5' : (flash.charAt(0) === '❌' ? COL.red : DIM) });
        }
      };
    };
    /* ---------- 14. fracmixed 带分数 ↔ 假分数 ---------- */
    MODES['fracmixed'] = function () {
      var w = 1, n = 1, d = 3, quiz = false, hideKey = 'N', opts = [], okIdx = -1, qi = 0, wins = 0, tries = 0, flash = '';
      function total() { return w * d + n; }
      function setW(v) { w = clampI(v, 0, 3); }
      function setN(v) { n = clampI(v, 0, d - 1); }
      function setD(v) { d = clampI(v, 2, 8); if (n > d - 1) n = d - 1; }
      function newQuiz() {
        var R = K.rng(seedMix(50509, qi));
        d = 2 + Math.floor(R() * 6); w = Math.floor(R() * 3);
        n = Math.floor(R() * d);
        var keys = ['w', 'n', 'N'];
        hideKey = keys[Math.floor(R() * keys.length)];
        var Nv = w * d + n;
        var val = hideKey === 'w' ? w : (hideKey === 'n' ? n : Nv);
        opts = [val, val + 1, Math.max(0, val - 2)];
        shuffle(opts, R);
        okIdx = opts.indexOf(val);
        quiz = true; qi++; tries++;
        toast('🎲 求被问号遮住的数值：' + (hideKey === 'w' ? '整数部分 ？' : hideKey === 'n' ? '分子部分 ？' : '总份数 ？'));
      }
      function pick(i) {
        if (!quiz) return;
        var qName = hideKey === 'w' ? '整数部分' : hideKey === 'n' ? '分子部分' : '总份数';
        flash = i === okIdx ? '✅ 对！' + qName + ' ＝ ' + opts[okIdx] : '❌ 正确答案：' + qName + ' ＝ ' + opts[okIdx];
        if (i === okIdx) wins++;
        quiz = false;
      }
      return {
        reset: function () { w = 1; n = 1; d = 3; quiz = false; qi = 0; wins = 0; tries = 0; opts = []; flash = ''; },
        tick: function () {},
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          return [
            { label: '带分数', value: w + ' 又 ' + n + '/' + d, color: COL.orange },
            { label: '假分数', value: fStr({ n: total(), d: d }), color: COL.teal },
            { label: '整圆数 / 余块', value: w + ' 个 + ' + n + ' 块', color: COL.blue },
            { label: quiz ? '问号处' : '战绩', value: quiz ? '?' : wins + '/' + tries, color: COL.purple }
          ];
        },
        presets: function () {
          return [
            { name: '1又1/2 ↔ 3/2', apply: function () { w = 1; n = 1; d = 2; } },
            { name: '2又3/4 ↔ 11/4', apply: function () { w = 2; n = 3; d = 4; } },
            { name: '随机考一题', apply: newQuiz }
          ];
        },
        controls: function () {
          return [
            { type: 'slider', id: 'fm_w', label: '整数部分 w', value: w, min: 0, max: 3, step: 1,
              onChange: function (v) { setW(Math.round(v)); } },
            { type: 'slider', id: 'fm_n', label: '分子部分 n', value: n, min: 0, max: Math.max(1, d - 1), step: 1,
              onChange: function (v) { setN(Math.round(v)); } },
            { type: 'slider', id: 'fm_d', label: '分母 d', value: d, min: 2, max: 8, step: 1,
              onChange: function (v) { setD(Math.round(v)); } },
            { type: 'button', id: 'fm_quiz', label: '🎲 出题挑战', action: newQuiz }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '带分数 ⇆ 假分数：同一样东西两种写法',
            quiz ? '点击下方候选数回答问号处的值' : '拖动滑块，观察整圆与分块的换算');
          /* 左：w 个满圆 + 部分圆 */
          var cy = H * 0.45, rr = Math.min(H * 0.15, W * 0.075), gapX = rr * 2.6;
          var ox = W * 0.055 + rr;
          for (var i = 0; i < w + 1 && i < 5; i++) {
            var cxx = ox + i * gapX;
            if (i < w) pieChart(ctx, cxx, cy, rr, d, fullMask(d), null);
            else pieChart(ctx, cxx, cy, rr, d, partMask(n, d), null);
          }
          K.label(ctx, w + ' 又 ' + n + '/' + d, ox + (w + 1) * gapX * 0.9, cy + rr + 26,
            { align: 'center', size: 21, weight: 'bold', color: COL.orange });
          /* 中间等号 */
          K.label(ctx, '=', W * 0.46, cy, { align: 'center', size: 34, weight: 'bold', color: DIM });
          /* 右：假分数分段条（每 d 格为一组） */
          var Nv = total(), bx = W * 0.52, bw = Math.min(W * 0.42, H * 0.72), bh = H * 0.09;
          for (var g = 0; g * d < Nv; g++) {
            var gFill = Math.max(0, Math.min(d, Nv - g * d));
            barFrac(ctx, bx, cy - bh / 2 + g * (bh + 7), bw, bh, d, partMask(gFill, d), COL.teal);
          }
          K.label(ctx, fStr({ n: Nv, d: d }) + ' （共 ' + Nv + ' 份）', bx + bw / 2, cy + ((g | 0)) * (bh + 7) + 18,
            { align: 'center', size: 20, weight: 'bold', color: COL.teal });
          /* 出题候选区 */
          if (quiz) {
            starRow(ctx, W - 96, 24, Math.min(wins, 3), 3, 12);
            for (var o = 0; o < opts.length; o++) {
              (function (oi) {
                uiBtn(ctx, W * 0.36 + oi * 104, H - 74, 92, 38, String(opts[oi]), function () { pick(oi); },
                  { bg: 'rgba(171,126,255,0.20)', stroke: 'rgba(190,160,255,0.55)', lw: 1.5, size: 16 });
              })(o);
            }
          } else if (flash) {
            K.label(ctx, flash, W / 2, H - 55, { align: 'center', size: 14, color: flash.charAt(0) === '✅' ? '#63e2a5' : COL.red });
          }
          K.label(ctx, flash || '整圆个数 × 分母 ＋ 零头块数 ＝ 总份数', W / 2, H - 16, { align: 'center', size: 12.5, color: DIM });
        }
      };
    };
    /* ---------- 15. fracmatch 等值分数配对（图 ⇄ 数字翻牌） ---------- */
    MODES['fracmatch'] = function () {
      var cols = 4, rowsN = 3, cards = [], open = [], matched = [], stack = [];
      var steps = 0, wrong = 0, wins = 0, qi = 0, lockT = 0, doneT = 0;
      function deal() {
        var R = K.rng(seedMix(60611, qi));
        cards = []; stack = [];
        for (var p = 0; p < 6; p++) {
          var dd = 2 + Math.floor(R() * 4);            // 分母 2..5
          var nn = 1 + Math.floor(R() * (dd - 1));
          var base = fRed(nn, dd);
          if (cards.some(function (c) { return c.kind === 'pie' && fSame(c.val, base); })) { p--; continue; }
          var kk = R() < 0.45 ? 1 : (R() < 0.5 ? 2 : 3);
          cards.push({ kind: 'pie', val: { n: base.n, d: base.d } });
          cards.push({ kind: 'num', val: { n: base.n * kk, d: base.d * kk } });
        }
        shuffle(cards, R);
        open = new Array(cards.length); matched = new Array(cards.length);
        for (var i = 0; i < cards.length; i++) { open[i] = false; matched[i] = false; }
      }
      function pick(i) {
        if (lockT > 0 || matched[i] || open[i]) return;
        open[i] = true; stack.push(i);
        if (stack.length < 2) return;
        steps++;
        var a = cards[stack[0]], b = cards[stack[1]];
        if (a.kind !== b.kind && fSame(a.val, b.val)) {
          matched[stack[0]] = matched[stack[1]] = true;
          var leftMatched = matched.filter(function (m) { return m; }).length;
          toast('✅ ' + fStr(a.val) + ' 配对了！还剩 ' + ((cards.length - leftMatched) / 2) + ' 对');
          if (leftMatched >= cards.length) {
            wins++; doneT = 1.4;
            var st = wrong <= 2 ? 3 : (wrong <= 5 ? 2 : 1);
            toast('🎉 全部配对完成！星级 ' + st + '/3（翻错 ' + wrong + ' 次）');
          }
        } else {
          wrong++; lockT = 0.75;
          toast(a.kind === b.kind ? '❌ 两张类型相同，要一图一数' : '❌ 不相等，' + fStr(a.val) + ' ≠ ' + fStr(b.val));
        }
        stack = [];
      }
      function starsOf() { return wrong <= 2 ? 3 : (wrong <= 5 ? 2 : 1); }
      return {
        reset: function () { steps = 0; wrong = 0; wins = 0; qi = 0; lockT = 0; doneT = 0; deal(); },
        tick: function (dt, t) {
          void t;
          if (lockT > 0) {
            lockT -= dt;
            if (lockT <= 0) {
              for (var i = 0; i < cards.length; i++) if (!matched[i]) open[i] = false;
              lockT = 0;
            }
          }
          if (doneT > 0) { doneT -= dt; if (doneT <= 0) { qi++; deal(); } }
        },
        down: function (x, y) { tapScan(x, y); },
        rows: function () {
          var got = matched.filter(function (m) { return m; }).length / 2;
          return [
            { label: '已消除', value: got + '/6 对', color: '#63e2a5' },
            { label: '翻牌步数', value: String(steps), color: COL.blue },
            { label: '翻错', value: String(wrong), color: wrong > 5 ? COL.red : COL.orange },
            { label: '本局星级', value: steps ? starsOf() + '/3 ★' : '—', color: COL.yellow }
          ];
        },
        presets: function () {
          return [
            { name: '新一局', apply: function () { wrong = 0; steps = 0; deal(); toast('重新洗牌，加油！'); } },
            { name: '简单示范局', apply: function () {
                var fixed = ['1/2', '2/4', '1/3', '2/6', '3/4', '6/8', '1/1', '2/2', '1/5', '2/10', '2/3', '4/6'];
                cards = fixed.map(function (s, i) {
                  var pt = s.split('/');
                  return i % 2 === 0
                    ? { kind: 'pie', val: { n: +pt[0], d: +pt[1] } }
                    : { kind: 'num', val: { n: +pt[0], d: +pt[1] } };
                });
                shuffle(cards, K.rng(97531)); steps = 0; wrong = 0;
                open = new Array(cards.length); matched = new Array(cards.length);
                for (var i = 0; i < cards.length; i++) { open[i] = false; matched[i] = false; }
                toast('示范局：全是常见等值分数');
              } }
          ];
        },
        controls: function () {
          return [{ type: 'button', id: 'fm2_new', label: '🔄 换一副牌',
            action: function () { steps = 0; wrong = 0; deal(); toast('洗好了！点击翻牌'); } }];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '等值分数配对：图找数 · 数找图', '翻开两张，一张图形分数 ＋ 一张数字分数且大小相等即消除');
          var gy0 = H * 0.16, gh = H - gy0 - 44, gx0 = W * 0.06, gw = W * 0.88;
          var cell = cardLayout(cols, rowsN, gx0, gy0, gw, gh, 8);
          for (var i = 0; i < cards.length && i < cell.length; i++) {
            var c = cell[i], cd = cards[i];
            var flipT = (open[i] || matched[i]);
            ctx.save();
            K.panel(ctx, c.x, c.y, c.w, c.h, {
              fill: matched[i] ? 'rgba(99,226,165,0.14)' : (flipT ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)'),
              stroke: matched[i] ? 'rgba(99,226,165,0.7)' : (flipT ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'),
              lineWidth: matched[i] ? 2 : 1.4, radius: 10
            });
            if (matched[i]) {
              K.label(ctx, fStr(cd.val), c.x + c.w / 2, c.y + c.h / 2,
                { align: 'center', size: 15, weight: 'bold', color: 'rgba(140,230,180,0.85)' });
            } else if (!flipT) {
              ctx.globalAlpha *= 0.35;
              K.circle(ctx, c.x + c.w / 2, c.y + c.h / 2, Math.min(c.w, c.h) * 0.16, { fill: 'rgba(255,255,255,0.9)' });
              K.label(ctx, '?', c.x + c.w / 2, c.y + c.h / 2 + 1, { align: 'center', size: 20, weight: 'bold', color: TXT });
              ctx.globalAlpha /= 0.35;
            } else if (cd.kind === 'pie') {
              var pr = Math.min(c.w, c.h) * 0.34;
              pieChart(ctx, c.x + c.w / 2, c.y + c.h / 2 - 5, pr, cd.val.d, partMask(cd.val.n, cd.val.d), null);
              K.label(ctx, fStr(cd.val), c.x + c.w / 2, c.y + c.h - 12, { align: 'center', size: 11, color: DIM });
            } else {
              var ptF = cd.val;
              K.label(ctx, String(ptF.n), c.x + c.w / 2, c.y + c.h / 2 - 9, { align: 'center', size: 19, weight: 'bold', color: COL.blue });
              K.label(ctx, '—', c.x + c.w / 2, c.y + c.h / 2 + 3, { align: 'center', size: 13, color: DIM });
              K.label(ctx, String(ptF.d), c.x + c.w / 2, c.y + c.h / 2 + 17, { align: 'center', size: 19, weight: 'bold', color: COL.blue });
            }
            ctx.restore();
            pushHit(c.x + c.w / 2, c.y + c.h / 2, Math.max(Math.min(c.w, c.h) / 2 + 6, MINR),
              function (idx) { return function () { pick(idx); }; }(i));
          }
          starRow(ctx, W - 96, 24, Math.min(starsOf(), 3), 3, 12);
          K.label(ctx, doneT > 0 ? '🎉 太棒了！马上开始下一副…' : '小提示：先把数字换算成小数更直观', W / 2, H - 16,
            { align: 'center', size: 12.5, color: DIM });
        }
      };
    };
    /* ---------- 16. buildfrac 用 1/2 1/3 1/4 零件拼出目标分数 ---------- */
    MODES['buildfrac'] = function () {
      var TYPES = [{ d: 2, tag: '½ 半圆', col: COL.orange }, { d: 3, tag: '⅓ 三分块', col: COL.teal }, { d: 4, tag: '¼ 四分块', col: COL.purple }];
      var LIMIT = 4;
      var stack = [], tgt = { n: 1, d: 2 }, qi = 0, wins = 0, tries = 0, flash = '', lockT = 0;
      var dragAdd = false, G = null;
      function usedOf(ti) { var c = 0; for (var i = 0; i < stack.length; i++) if (stack[i] === ti) c++; return c; }
      function total() {
        var t = { n: 0, d: 1 };
        for (var i = 0; i < stack.length; i++) t = fAdd(t, { n: 1, d: TYPES[stack[i]].d });
        return t;
      }
      function newQuiz() {
        var R = K.rng(seedMix(70713, qi));
        var pool = [];
        for (var a = 0; a <= 3; a++) for (var b = 0; b <= 3; b++) for (var c = 0; c <= 3; c++) {
          var s = a + b + c;
          if (s < 1 || s > 4) continue;
          var fs = fRed(a * 6 + b * 4 + c * 3, 12);   // a/2 + b/3 + c/4 通分到 /12
          var key = fStr(fs), dup = false;
          for (var qI = 0; qI < pool.length; qI++) if (fStr(pool[qI].f) === key) { dup = true; break; }
          if (!dup) pool.push({ f: fs, s: s });
        }
        var pickE = pool[Math.floor(R() * pool.length)];
        tgt = pickE.f; stack = []; flash = ''; qi++; tries++;
        toast('🎯 拼出 ' + fStr(tgt) + '！点击左侧零件加入托盘');
      }
      function add(ti) {
        if (lockT > 0) return;
        if (usedOf(ti) >= LIMIT) { toast('该零件最多用 ' + LIMIT + ' 个'); return; }
        stack.push(ti);
        if (fSame(total(), tgt)) {
          wins++; flash = '✅ 正确！' + fStr(tgt);
          lockT = 1.1;
        } else if (total().n * tgt.d >= tgt.n * total().d && stack.length > 0) {
          toast('已经 ≥ 目标啦，试着撤一块');   // 超额提示（不强制清空）
        }
      }
      return {
        reset: function () { stack = []; tgt = { n: 1, d: 2 }; qi = 0; wins = 0; tries = 0; flash = ''; lockT = 0; dragAdd = false; G = null; },
        tick: function (dt, t) {
          void t;
          if (lockT > 0) { lockT -= dt; if (lockT <= 0) { lockT = 0; newQuiz(); toast('新目标来了！'); } }
        },
        down: function (x, y) { tapScan(x, y); dragAdd = true; },
        ptMove: function (x, y) {
          if (!dragAdd || !G || lockT > 0) return;
          for (var ti = 0; ti < G.types; ti++) {
            var yy = G.ay + ti * 58;
            if (Math.abs(x - G.ax) < G.aw / 2 + 8 && y >= yy && y <= yy + 46) { add(ti); return; }
          }
        },
        ptUp: function () { dragAdd = false; },
        hitTest: function (x, y) { if (!G) return false; if (Math.abs(x - G.ax) >= G.aw / 2 + 8) return false; for (var ti = 0; ti < G.types; ti++) { var yy = G.ay + ti * 58; if (y >= yy && y <= yy + 46) return true; } return false; },
        rows: function () {
          var tt = total();
          return [
            { label: '目标', value: fStr(tgt), color: COL.yellow },
            { label: '当前累计', value: fStr(tt), color: COL.blue },
            { label: '状态', value: lockT > 0 ? '✅ 完成' : (tt.n * tgt.d === tgt.n * tt.d ? '已相等' : (tt.n * tgt.d > tgt.n * tt.d ? '偏多 ⚠' : '还差一点')), color: '#63e2a5' },
            { label: '战绩', value: wins + '/' + tries + ' 题', color: COL.purple }
          ];
        },
        presets: function () {
          return [
            { name: '目标 5/6', apply: function () { tgt = fRed(5, 6); stack = []; flash = ''; tries++; toast('把 1/2 ＋ 1/3 拖进托盘试试'); } },
            { name: '目标 1', apply: function () { tgt = { n: 1, d: 1 }; stack = []; flash = ''; tries++; } },
            { name: '随机出一题', apply: newQuiz }
          ];
        },
        controls: function () {
          return [
            { type: 'button', id: 'bf_new', label: '🎲 随机出新题', action: newQuiz },
            { type: 'button', id: 'bf_undo', label: '↩️ 撤销最后一块',
              action: function () { if (lockT > 0) return; if (!stack.length) { toast('托盘是空的'); return; } stack.pop(); } },
            { type: 'button', id: 'bf_clear', label: '🧹 清空托盘',
              action: function () { if (lockT > 0) return; stack = []; toast('托盘已清空'); } }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '拼出分数：零件库 → 托盘',
            lockT > 0 ? '🎉 拼对了！即将换新目标…' : '目标 ' + fStr(tgt) + ' · 点击零件累加到托盘');
          /* 左侧零件架 */
          var ax = W * 0.16, ay = H * 0.32, aw = Math.min(W * 0.24, H * 0.34);
          G = { ax: ax, ay: ay, aw: aw, types: TYPES.length };
          hintDrag(ctx, '👆 拖动加零件', ax, ay - 46);
          if (dragAdd) K.panel(ctx, ax - aw / 2 - 6, ay - 6, aw + 12, TYPES.length * 58 + 10, { stroke: COL.yellow, lw: 2.5, radius: 12 });
          K.label(ctx, '零件架', ax, ay - 26, { align: 'center', size: 14, color: DIM });
          for (var ti = 0; ti < TYPES.length; ti++) {
            (function (idx) {
              var yy = ay + idx * 58;
              K.panel(ctx, ax - aw / 2, yy, aw, 46,
                { fill: usedOf(idx) >= LIMIT ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)', radius: 9 });
              barFrac(ctx, ax - aw / 2 + 12, yy + 13, aw * 0.52, 20, TYPES[idx].d, partMask(1, TYPES[idx].d), TYPES[idx].col);
              K.label(ctx, TYPES[idx].tag, ax + aw * 0.02, yy + 23, { align: 'left', size: 13, color: TXT });
              K.label(ctx, usedOf(idx) + '/' + LIMIT, ax + aw / 2 - 10, yy + 23, { align: 'right', size: 12, color: DIM });
              pushHit(ax, yy + 23, Math.max(aw / 2, 28, MINR), function () { add(idx); });
            })(ti);
          }
          /* 右侧托盘分型展示 */
          var px = W * 0.62, pw = Math.min(W * 0.44, H * 0.62), py = H * 0.30;
          K.label(ctx, '托盘', px + pw / 2 - 60, py - 16, { align: 'center', size: 14, color: DIM });
          K.panel(ctx, px - 60, py - 30, pw + 60, H * 0.34, { fill: 'rgba(0,0,0,0.25)', stroke: 'rgba(255,255,255,0.25)', lineWidth: 1.2, radius: 12 });
          for (var rI = 0; rI < TYPES.length; rI++) {
            var cnt = usedOf(rI);
            K.label(ctx, TYPES[rI].d + ' 分之…×' + cnt, px - 40, py + 2 + rI * 42, { align: 'left', size: 11.5, color: DIM });
            barFrac(ctx, px + 36, py - 7 + rI * 42, pw - 90, 24, Math.max(cnt, 1),
              partMask(cnt, Math.max(cnt, 1)), TYPES[rI].col);
            K.label(ctx, cnt ? (cnt + '/' + TYPES[rI].d) : '—', px + pw - 48, py + 5 + rI * 42,
              { align: 'right', size: 12.5, weight: 'bold', color: cnt ? TYPES[rI].col : DIM });
          }
          var totF = total();
          K.label(ctx, '累计：' + fStr(totF) + (fSame(totF, tgt) ? ' ✓ ' : '') + '　目标：' + fStr(tgt),
            px + pw / 2 - 30, py + H * 0.27, { align: 'center', size: 15.5, weight: 'bold', color: TXT });
          starRow(ctx, W - 96, 24, Math.min(wins, 3), 3, 12);
          if (flash) K.label(ctx, flash, W / 2, H - 38, { align: 'center', size: 15, color: '#63e2a5' });
          K.label(ctx, '目标分数可先用 1/2 系列逼近，再补零头', W / 2, H - 16, { align: 'center', size: 12.5, color: DIM });
        }
      };
    };
    /* ---------- 17. quadshape 四边形分类实验室（拖动顶点） ---------- */
    MODES['quadshape'] = function () {
      var P = [{ nx: 0.25, ny: 0.30 }, { nx: 0.62, ny: 0.26 }, { nx: 0.66, ny: 0.72 }, { nx: 0.22, ny: 0.68 }];
      var dragI = -1, snapN = [];
      function px(i, W, H) { return { x: K.clamp(P[i].nx, 0.05, 0.95) * W, y: K.clamp(P[i].ny, 0.10, 0.92) * H }; }
      function seg(a, b) {
        return {
          dx: b.x - a.x, dy: b.y - a.y,
          len: Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)) || 1
        };
      }
      function crossN(u, v) { return Math.abs(u.dx * v.dy - u.dy * v.dx) / (u.len * v.len); }
      function dotN(u, v) { return Math.abs(u.dx * v.dx + u.dy * v.dy) / (u.len * v.len); }
      function classify(W, H) {
        var v = [], i;
        for (i = 0; i < 4; i++) v.push(seg(px(i, W, H), px((i + 1) % 4, W, H)));
        var par02 = crossN(v[0], v[2]) <= 0.07;   // 上 vs 下
        var par13 = crossN(v[1], v[3]) <= 0.07;   // 左前 vs 右前
        var ra = dotN(v[0], v[1]) <= 0.11 && dotN(v[1], v[2]) <= 0.11 &&
                 dotN(v[2], v[3]) <= 0.11 && dotN(v[3], v[0]) <= 0.11;
        var lMin = Math.min(v[0].len, v[1].len, v[2].len, v[3].len);
        var lMax = Math.max(v[0].len, v[1].len, v[2].len, v[3].len);
        var eq = (lMax - lMin) <= 0.06 * lMax;
        var res = [];
        if (par02 && par13 && ra && eq) res.push('正方形');
        else if (par02 && par13 && ra) res.push('矩形');
        else if (par02 && par13 && eq) res.push('菱形');
        else if (par02 && par13) res.push('平行四边形');
        else if (par02 || par13) res.push('梯形');
        else res.push('一般四边形');
        return { list: res, main: res[res.length - 1], para: [par02, par13] };
      }
      function setShape(fourPt) {
        for (var i = 0; i < 4; i++) { P[i].nx = fourPt[i][0]; P[i].ny = fourPt[i][1]; }
        toast('形状已载入，试着拖一拖再观察判定');
      }
      return {
        reset: function () {
          P = [{ nx: 0.25, ny: 0.30 }, { nx: 0.62, ny: 0.26 }, { nx: 0.66, ny: 0.72 }, { nx: 0.22, ny: 0.68 }];
          dragI = -1; snapN = null;
        },
        tick: function () {},
        down: function (x, y, W, H, ev) {
          void ev;
          var best = -1, bd = 1e9;
          for (var i = 0; i < 4; i++) {
            var pp = px(i, W, H), dd = dist2(x, y, pp.x, pp.y);
            if (dd <= Math.max(MINR + 6, 18) && dd < bd) { bd = dd; best = i; }
          }
          if (best >= 0) { dragI = best; return true; }
          tapScan(x, y);
          return false;
        },
        ptMove: function (x, y, W, H) {
          if (dragI < 0) return;
          P[dragI].nx = x / W; P[dragI].ny = y / H;
        },
        ptUp: function () { dragI = -1; },
        hitTest: function (x, y, W, H) { for (var i = 0; i < 4; i++) { var pp = px(i, W, H); if (dist2(x, y, pp.x, pp.y) <= Math.max(MINR + 6, 18)) return true; } return false; },
        rows: function () {
          var Qref = classify(1000, 560);          // 归一化顶点 → 参考视口即可判定
          return [
            { label: '主类别', value: Qref.main, color: COL.orange },
            { label: '操作', value: '拖动四个圆点改变形状', color: COL.blue },
            { label: '提示', value: '对边平行＋直角＝矩形', color: COL.teal },
            { label: '判定容差', value: '角度约 ≤6°、边长约 ≤6%', color: DIM }
          ];
        },
        presets: function () {
          return [
            { name: '标准矩形', apply: function () { setShape([[0.22, 0.28], [0.70, 0.28], [0.70, 0.70], [0.22, 0.70]]); } },
            { name: '倾斜菱形', apply: function () { setShape([[0.44, 0.20], [0.72, 0.50], [0.44, 0.80], [0.16, 0.50]]); } },
            { name: '直角梯形', apply: function () { setShape([[0.24, 0.32], [0.60, 0.32], [0.76, 0.72], [0.24, 0.72]]); } },
            { name: '不规则形', apply: function () { setShape([[0.26, 0.34], [0.64, 0.24], [0.58, 0.74], [0.20, 0.60]]); } }
          ];
        },
        controls: function () {
          return [{ type: 'button', id: 'qs_reset', label: '↩️ 复位形状',
            action: function () {
              P = [{ nx: 0.25, ny: 0.30 }, { nx: 0.62, ny: 0.26 }, { nx: 0.66, ny: 0.72 }, { nx: 0.22, ny: 0.68 }];
              dragI = -1; toast('已恢复初始四边形');
            } }];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '四边形分类实验室：拖动顶点看类别变化',
            dragI >= 0 ? '正在拖动顶点…松开即定格' : '四个圆点都可以拖');
          hintDrag(ctx, '👆 拖动顶点', W * 0.30, H * 0.13);
          var Q = classify(W, H);
          /* 多边形本体 */
          ctx.beginPath();
          for (var i = 0; i < 4; i++) {
            var pp = px(i, W, H);
            if (i) ctx.lineTo(pp.x, pp.y); else ctx.moveTo(pp.x, pp.y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(126,171,255,0.16)'; ctx.fill();
          ctx.strokeStyle = 'rgba(160,195,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
          /* 对角线 */
          ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.4;
          var A0 = px(0, W, H), A2 = px(2, W, H), B1 = px(1, W, H), B3 = px(3, W, H);
          ctx.beginPath(); ctx.moveTo(A0.x, A0.y); ctx.lineTo(A2.x, A2.y);
          ctx.moveTo(B1.x, B1.y); ctx.lineTo(B3.x, B3.y); ctx.stroke();
          ctx.restore();
          /* 顶点手柄 */
          for (var j = 0; j < 4; j++) {
            var hq = px(j, W, H);
            K.circle(ctx, hq.x, hq.y, dragI === j ? 11 : 8,
              { fill: dragI === j ? COL.orange : COL.blue, stroke: '#fff', lineWidth: 2 });
            pushHit(hq.x, hq.y, 16, null);
          }
          /* 判定面板 */
          var lx = W * 0.74, ly = H * 0.36;
          K.panel(ctx, lx - 12, ly - 40, W * 0.23, 190, { fill: 'rgba(0,0,0,0.28)', stroke: 'rgba(255,255,255,0.2)', lineWidth: 1, radius: 12 });
          K.label(ctx, '当前判定', lx + (W * 0.23 - 24) / 2, ly - 20, { align: 'center', size: 13, color: DIM });
          var cats = ['正方形', '矩形', '菱形', '平行四边形', '梯形', '一般四边形'];
          for (var cI = 0; cI < cats.length; cI++) {
            var isMain = cats[cI] === Q.main;
            uiChip(ctx, lx, ly + cI * 24 + 6, cats[cI] + (isMain ? ' ←' : ''),
              null, { size: 12.5, bg: isMain ? 'rgba(255,169,64,0.30)' : 'rgba(255,255,255,0.06)',
                color: isMain ? COL.orange : 'rgba(255,255,255,0.45)' });
          }
          K.label(ctx, Q.para[0] ? '上下一组对边平行 ✓' : '上下不平行 ✗', lx + (W * 0.23 - 24) / 2, ly + 158, { align: 'center', size: 11, color: Q.para[0] ? '#63e2a5' : DIM });
          K.label(ctx, Q.para[1] ? '左右一组对边平行 ✓' : '左右不平行 ✗', lx + (W * 0.23 - 24) / 2, ly + 176, { align: 'center', size: 11, color: Q.para[1] ? '#63e2a5' : DIM });
          snapN = Q.list.join('/');
          K.label(ctx, '拖动中发现：先有「两组平行」再有「直角」，最后才是「边相等」', W * 0.42, H - 16, { align: 'center', size: 12.5, color: DIM });
        }
      };
    };
    /* ---------- 18. areabuild 面积与周长构建器 ---------- */
    MODES['areabuild'] = function () {
      var L = 6, D = 4, T = 0, quiz = false, qi = 0, wins = 0, tries = 0, flash = '', lockT = 0;
      var dragL = false, dragD = false, G = null;
      function area() { return L * D; }
      function peri() { return 2 * (L + D); }
      function newQuiz() {
        var R = K.rng(seedMix(80817, qi));
        T = 6 + Math.floor(R() * 25);              // 目标面积 6..30
        quiz = true; lockT = 0; flash = ''; qi++; tries++;
        L = Math.max(2, Math.min(12, Math.round(Math.sqrt(T) + 2)));
        D = clampI(Math.round(T / Math.max(L, 1)), 2, 9);
        if (area() === T) { L += 1; D = clampI(Math.ceil(T / L), 2, 9); }
        toast('🎯 挑战：拼一个面积为 ' + T + ' 的长方形（周长越小越好）');
      }
      function checkWin() {
        if (!quiz || lockT > 0 || area() !== T) return;
        wins++; flash = '✅ S=' + T + ' 达成！周长 C=' + peri();
        lockT = 1.3;
        toast(flash + (peri() === minimalPeri(T) ? '　已经是最优周长！' : '　试试能不能周长更小？'));
      }
      function minimalPeri(a) {
        var bestP = Infinity, l, d;
        for (l = 1; l <= a; l++) {
          if (a % l === 0) {
            d = a / l;
            if (l >= 2 && d >= 2) bestP = Math.min(bestP, 2 * (l + d));
          }
        }
        return isFinite(bestP) ? bestP : 0;
      }
      return {
        reset: function () { L = 6; D = 4; T = 0; quiz = false; qi = 0; wins = 0; tries = 0; flash = ''; lockT = 0; dragL = false; dragD = false; G = null; },
        tick: function (dt, t) {
          void t;
          if (lockT > 0) { lockT -= dt; if (lockT <= 0) { lockT = 0; quiz = false; toast('继续自由探索或再出一题'); } }
        },
        down: function (x, y) {
          if (tapScan(x, y)) return;
          if (G) {
            var rx = G.ox + L * G.cs, by = G.oy + D * G.cs;
            if (Math.abs(x - rx) < 16 && y >= G.oy - 10 && y <= by + 10) dragL = true;
            else if (Math.abs(y - by) < 16 && x >= G.ox - 10 && x <= rx + 10) dragD = true;
          }
        },
        ptMove: function (x, y) {
          if (!G) return;
          if (dragL) { L = clampI(Math.round((x - G.ox) / G.cs), 2, 12); checkWin(); }
          else if (dragD) { D = clampI(Math.round((y - G.oy) / G.cs), 2, 9); checkWin(); }
        },
        ptUp: function () { dragL = false; dragD = false; },
        hitTest: function (x, y) { if (!G) return false; var rx = G.ox + L * G.cs, by = G.oy + D * G.cs; return (Math.abs(x - rx) < 16 && y >= G.oy - 10 && y <= by + 10) || (Math.abs(y - by) < 16 && x >= G.ox - 10 && x <= rx + 10); },
        rows: function () {
          return [
            { label: '长 × 宽', value: L + ' × ' + D, color: COL.blue },
            { label: '面积 S', value: String(area()), color: COL.orange },
            { label: '周长 C', value: String(peri()), color: COL.teal },
            { label: quiz ? ('目标 S=' + T) : '战绩', value: quiz ? (lockT > 0 ? '✅ 完成！' : '调整中…') : wins + '/' + tries, color: COL.purple }
          ];
        },
        presets: function () {
          return [
            { name: '同积异形 24', apply: function () { L = 6; D = 4; quiz = false; toast('S=24 C=20 · 再试 8×3: C=22；12×2: C=28 —— 正方形最紧'); } },
            { name: '紧凑挑战 16', apply: function () { L = 8; D = 2; quiz = true; T = 16; tries++; lockT = 0; flash = ''; toast('把 8×2 调成周长最小的形状！'); } },
            { name: '随机出一题', apply: newQuiz }
          ];
        },
        controls: function () {
          return [
            { type: 'slider', id: 'ab_l', label: '长 L', value: L, min: 2, max: 12, step: 1,
              onChange: function (v) { L = Math.round(v); checkWin(); } },
            { type: 'slider', id: 'ab_d', label: '宽 D', value: D, min: 2, max: 9, step: 1,
              onChange: function (v) { D = Math.round(v); checkWin(); } },
            { type: 'button', id: 'ab_new', label: '🎯 面积挑战', action: newQuiz }
          ];
        },
        draw: function (ctx, W, H, t) {
          void t;
          headTitle(ctx, W, '面积构建器：S ＝ 长×宽',
            quiz ? '目标 S=' + T + (lockT > 0 ? ' · 🎉达成！' : '') : '拖动滑块改变长方形，观察网格填充');
          var cs = Math.floor(Math.min(W * 0.40 / 12, (H - 120) / 9));
          var gw = L * cs, gh = D * cs;
          var ox = Math.round(W * 0.05 + (W * 0.42 - gw) / 2), oy = Math.round(H * 0.54 - gh / 2);
          G = { ox: ox, oy: oy, cs: cs };
          hintDrag(ctx, '👆 拖动长', ox + gw + 26, oy + gh / 2 - 24);
          hintDrag(ctx, '👆 拖动宽', ox + gw / 2 - 46, oy + gh + 22);
          if (dragL) K.circle(ctx, ox + gw, oy + gh / 2, 12, { stroke: COL.yellow, lineWidth: 2.5 });
          if (dragD) K.circle(ctx, ox + gw / 2, oy + gh, 12, { stroke: COL.yellow, lineWidth: 2.5 });
          for (var r = 0; r < D; r++) {
            for (var c = 0; c < L; c++) {
              K.panel(ctx, ox + c * cs + 1, oy + r * cs + 1, cs - 2, cs - 2,
                { fill: 'rgba(255,169,64,0.32)', radius: 3 });
            }
          }
          K.panel(ctx, ox, oy, gw, gh, { fill: null, stroke: COL.orange, lineWidth: 2, radius: 4 });
          K.arrow(ctx, ox, oy + gh + 14, ox + gw, oy + gh + 14, { color: COL.blue, width: 2 });
          K.label(ctx, '长 L＝' + L, ox + gw / 2, oy + gh + 26, { align: 'center', size: 13, color: COL.blue });
          K.arrow(ctx, ox - 14, oy, ox - 14, oy + gh, { color: COL.teal, width: 2 });
          ctx.save(); ctx.translate(ox - 26, oy + gh / 2); ctx.rotate(-Math.PI / 2);
          K.label(ctx, '宽 D＝' + D, 0, 0, { align: 'center', size: 13, color: COL.teal });
          ctx.restore();
          /* 右侧信息面板 */
          var ix = W * 0.60;
          K.panel(ctx, ix - 10, H * 0.25, W * 0.34, H * 0.52,
            { fill: 'rgba(0,0,0,0.26)', stroke: 'rgba(255,255,255,0.18)', lineWidth: 1, radius: 12 });
          K.label(ctx, '面积 S ＝ ' + L + ' × ' + D + ' ＝ ' + area(), ix + (W * 0.34 - 20) / 2, H * 0.33,
            { align: 'center', size: 19, weight: 'bold', color: COL.orange });
          K.label(ctx, '周长 C ＝ 2×(' + L + '+' + D + ') ＝ ' + peri(), ix + (W * 0.34 - 20) / 2, H * 0.41,
            { align: 'center', size: 17, weight: 'bold', color: COL.teal });
          if (quiz) {
            starRow(ctx, ix + (W * 0.34 - 20) / 2, H * 0.47, Math.min(wins, 3), 3, 13);
            K.label(ctx, '目标 S = ' + T, ix + (W * 0.34 - 20) / 2, H * 0.53,
              { align: 'center', size: 15, weight: 'bold', color: COL.yellow });
          } else {
            K.label(ctx, '点【面积挑战】开始游戏', ix + (W * 0.34 - 20) / 2, H * 0.50, { align: 'center', size: 13, color: DIM });
          }
          K.label(ctx, '每格面积都是 1，数格子也能得到 S 哦！', ix + (W * 0.34 - 20) / 2, H * 0.68,
            { align: 'center', size: 11.5, color: DIM });
          K.label(ctx, flash || '秘密：S 相同时，越接近正方形 C 越小', W / 2, H - 14, { align: 'center', size: 12.5,
            color: flash.charAt(0) === '✅' ? '#63e2a5' : DIM });
        }
      };
    };
    /* ================= 模式分派与实例 ================= */
    var modeKey = cfg && (cfg.mode || cfg.id) ? String(cfg.mode || cfg.id) : 'arithmetic';
    if (!MODES[modeKey]) modeKey = 'arithmetic';
    var M = null, lastW = 820, lastH = 480, dataCacheStr = '';

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
        loader.setKnowledge(KNOW[modeKey] || '<p>探索本实验的规律。</p>');
        loader.setPresets(M.presets ? M.presets() : []);
        pushData(true);
      },
      getControls: function () {
        /* 每次返回全新数组，避免控件缓存旧值 */
        if (!M || !M.controls) return [];
        try { return M.controls(); } catch (e) { return []; }
      },
      update: function (dt, t) {
        if (!M) return;
        if (!(dt > 0)) dt = 0;
        if (dt > 0.05) dt = 0.05;
        try { M.tick(dt, t); } catch (err) { console.error('[numbers:' + modeKey + '] tick 异常', err); }
        pushData(false);
      },
      render: function (ctx, W, H, t) {
        K.background(ctx, W, H);
        if (!M) return;
        lastW = W; lastH = H;
        UI.hits.length = 0;               // 命中表随帧重建
        try { M.draw(ctx, W, H, t); } catch (err) { console.error('[numbers:' + modeKey + '] draw 异常', err); }
      },
      reset: function () {
        UI.hits.length = 0;
        dataCacheStr = '';
        if (!M) return;
        try { M.reset(); } catch (err) { console.error('[numbers:' + modeKey + '] reset 异常', err); }
        pushData(true);
      }
    };

    /* 指针事件转发：down → 命中扫描；move/up → 拖拽类模式（quadshape） */
    inst.onPointerDown = function (x, y, ev) {
      if (!M) return;
      try {
        if (typeof M.down === 'function') M.down(x, y, lastW, lastH, ev);
        else tapScan(x, y);
      } catch (err) { console.error('[numbers:' + modeKey + '] pointerDown 异常', err); }
    };
    inst.onPointerMove = function (x, y, ev) {
      if (!M || typeof M.ptMove !== 'function') return;
      try { M.ptMove(x, y, lastW, lastH, ev); } catch (err) { console.error('[numbers:' + modeKey + '] pointerMove 异常', err); }
    };
    inst.onPointerUp = function (x, y, ev) {
      if (!M || typeof M.ptUp !== 'function') return;
      try { M.ptUp(x, y, lastW, lastH, ev); } catch (err) { console.error('[numbers:' + modeKey + '] pointerUp 异常', err); }
    };
    inst.hitTest = function (x, y) {
      if (!M || typeof M.hitTest !== 'function') return false;
      try { return !!M.hitTest(x, y, lastW, lastH); } catch (err) { return false; }
    };

    return inst;
  }
});
