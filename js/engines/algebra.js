/**
 * 代数引擎（仿 PhET 中文平台 · 数学篇）
 * 注册名 'algebra'，按 cfg.mode 分支支持 11 种模式（覆盖 12 个实验 ID）：
 *   eqexplor   等式探索            eqexplorB  等式探索·基础版
 *   eqexplor2v 双变量等式探索      exprxn     表达式交换
 *   areaalg    面积模型·代数       areadec    面积模型·小数
 *   areamult   面积模型·乘法       areaintro  面积模型·入门
 *   vecadd     矢量加法            veceq      矢量加法·方程
 *   funcbuild  函数构建器（cfg.basic=true 时为基础版）
 * 依赖加载顺序：window.Kit → window.EngineRegistry。
 * 本文件顶层只注册工厂，绝不触碰 document；DOM 全部延迟到方法内。
 */
window.EngineRegistry.register('algebra', {
  create(cfg) {
    var K = window.Kit, COL = K.COLORS, PI = Math.PI;
    var TXT = '#f2f5fa', DIM = 'rgba(255,255,255,0.55)';
    var LOADER = null, BASIC = !!(cfg && cfg.basic);
    function toast(m) { if (LOADER && LOADER.showToast) LOADER.showToast(String(m)); }
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.fillStyle = '#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }
    /* 左上角中文标题胶囊 */
    function capTag(ctx, txt, x, y, c) {
      K.chip(ctx, txt, x, y, { size: 13, color: c || TXT, bg: 'rgba(0,0,0,0.32)', pad: 7 });
    }
    /* 数值排版：负号统一用 −，最多三位小数 */
    function nm(v) { v = Math.round(v * 1000) / 1000; return v < 0 ? '−' + Math.abs(v) : String(v); }
    /* 二次三项式串："2x² − 3x + 5"，零项略过，全零给 '0' */
    function polyStr(c2, c1, c0) {
      var parts = [];
      [[c2, 'x²'], [c1, 'x'], [c0, '']].forEach(function (p) {
        var v = p[0];
        if (!v) return;
        var head = parts.length === 0 ? (v < 0 ? '−' : '') : (v < 0 ? ' − ' : ' + ');
        parts.push(head + ((p[1] && Math.abs(v) === 1) ? '' : Math.abs(v)) + p[1]);
      });
      return parts.length ? parts.join('') : '0';
    }
    /* 彩色分段粗体一行字（矢量方程等着色排版），返回行尾 X 像素 */
    function richText(ctx, segs, x, y, size) {
      var cx = x;
      ctx.save();
      ctx.font = 'bold ' + size + 'px sans-serif';
      ctx.textBaseline = 'middle';
      segs.forEach(function (s) { ctx.fillStyle = s.c || TXT; ctx.fillText(s.t, cx, y); cx += ctx.measureText(s.t).width; });
      ctx.restore(); return cx;
    }

    /* ================================================================
     * 模式 1/2 —— 等式探索 eqexplor / eqexplorB（基础版）
     * 天平横梁两侧托盘：左 n₁·x + u₁，右 n₂·x + u₂；
     * 倾斜∝差值（±15° 钳制）；完整版附两步解方程推导，基础版玩配平游戏。
     * ============================================================== */
    function mdEq(isB) {
      var MX = isB ? 4 : 6, MU = isB ? 9 : 14;
      var st = { nxL: 2, uL: 3, nxR: 1, uR: 5, tilt: true, res: null, drag: null, _sy: 0, _sv: 0 };
      function dirty() { st.res = null; }
      function solve() { /* 两步消元：移项合并 → 除以系数 */
        var dn = st.nxL - st.nxR, du = st.uR - st.uL;
        st.res = dn === 0 ? (du === 0 ? { k: 'inf' } : { k: 'none' }) : { k: 'val', x: du / dn };
        toast(st.res.k === 'val' ? '已解出 x = ' + K.fmt(st.res.x, 2)
          : st.res.k === 'inf' ? '两侧完全相同：恒成立（无限多解）' : '合并后矛盾：该方程无解');
      }
      function tiles(ctx, bx, by, nBox, nUnit) { /* 自托盘面向上码放：底层单位块（每行7），上层 x 箱（每行4） */
        var i, uRow = Math.ceil(nUnit / 7), boxBase = by - 6 - uRow * 17;
        for (i = 0; i < nUnit; i++) K.panel(ctx, bx + (i % 7) * 15, by - 6 - (Math.floor(i / 7) + 1) * 17, 13, 14, { fill: 'rgba(241,196,15,0.94)', radius: 3 });
        for (i = 0; i < nBox; i++) {
          var xx = bx + (i % 4) * 27, xy = boxBase - (Math.floor(i / 4) + 1) * 24;
          K.panel(ctx, xx, xy, 22, 19, { fill: 'rgba(52,152,219,0.92)', stroke: '#bfe3ff', lineWidth: 1, radius: 4 });
          K.label(ctx, 'x', xx + 11, xy + 10, { align: 'center', size: 12, weight: 'bold', color: '#fff' });
        }
      }
      function ctl() {
        var a = [
          { id: 'eq_nl', type: 'slider', label: '左侧 x 箱数', min: 0, max: MX, step: 1, value: st.nxL, onChange: function (v) { st.nxL = Math.round(v); dirty(); } },
          { id: 'eq_ul', type: 'slider', label: '左侧单位块', min: 0, max: MU, step: 1, value: st.uL, onChange: function (v) { st.uL = Math.round(v); dirty(); } },
          { id: 'eq_nr', type: 'slider', label: '右侧 x 箱数', min: 0, max: MX, step: 1, value: st.nxR, onChange: function (v) { st.nxR = Math.round(v); dirty(); } },
          { id: 'eq_ur', type: 'slider', label: '右侧单位块', min: 0, max: MU, step: 1, value: st.uR, onChange: function (v) { st.uR = Math.round(v); dirty(); } },
          { id: 'eq_tilt', type: 'checkbox', label: '显示天平倾斜指示', value: st.tilt, onChange: function (v) { st.tilt = !!v; } }
        ];
        if (!isB) a.push({ id: 'eq_solve', type: 'button', label: '解出 x', action: solve });
        return a;
      }
      function panGeo(W, H) { return { cx: W / 2, pvY: H * 0.42, HB: Math.min(W * 0.33, 320) }; }
      /* 拖动天平两侧托盘：上半区拖动增减 x 箱，下半区拖动增减单位块（垂直方向计数） */
      function down(x, y, W, H) {
        st.drag = null;
        var g = panGeo(W, H), panTop = g.pvY + 64, sides = [
          { k: 'L', ex: g.cx - g.HB, box: 'nxL', unit: 'uL' },
          { k: 'R', ex: g.cx + g.HB, box: 'nxR', unit: 'uR' }
        ];
        for (var si = 0; si < 2; si++) {
          var s = sides[si];
          if (x > s.ex - 60 && x < s.ex + 60 && y > panTop - 100 && y < panTop + 16) {
            var key = y < panTop - 45 ? s.box : s.unit;
            st.drag = key; st._sy = y; st._sv = st[key];
            return;
          }
        }
      }
      function move(x, y) {
        if (!st.drag) return;
        var max = (st.drag === 'nxL' || st.drag === 'nxR') ? MX : MU;
        st[st.drag] = K.clamp(st._sv + Math.round((st._sy - y) / 18), 0, max);
        dirty();
      }
      function up() { st.drag = null; }
      function draw(ctx, W, H, t) {
        var cx = W / 2, pvY = H * 0.42, HB = Math.min(W * 0.33, 320);
        var rot = st.tilt ? -K.clamp((st.nxL - st.nxR) * 2 + (st.uL - st.uR), -5, 5) * 3 * PI / 180 : 0;
        var bal = (st.nxL === st.nxR && st.uL === st.uR);
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, isB ? '等式探索 · 基础：使天平水平' : '等式探索 · 天平与一元一次方程', 16, 12, COL.teal);
        K.chip(ctx, '当前方程　' + polyStr(0, st.nxL, st.uL) + ' ＝ ' + polyStr(0, st.nxR, st.uR), cx - 118, 40, { size: 14, bg: 'rgba(116,185,255,0.16)' });
        K.polyline(ctx, [{ x: cx, y: pvY + 4 }, { x: cx - 30, y: H - 30 }, { x: cx + 30, y: H - 30 }], { color: '#39445c', width: 4, closed: true, fill: '#39445c' });
        ctx.save(); ctx.translate(cx, pvY); ctx.rotate(rot);
        K.panel(ctx, -HB, -8, HB * 2, 16, { fill: '#cfd8e3', radius: 7 });
        ctx.restore();
        [[st.nxL, st.uL], [st.nxR, st.uR]].forEach(function (p, si) {
          var ex = cx + Math.cos(rot) * HB * (si ? 1 : -1), ey = pvY + Math.sin(rot) * HB * (si ? 1 : -1), panTop = ey + 64;
          K.dashLine(ctx, ex - 34, ey + 8, ex - 44, panTop, { color: '#93a4bd', dash: [3, 3] });
          K.dashLine(ctx, ex + 34, ey + 8, ex + 44, panTop, { color: '#93a4bd', dash: [3, 3] });
          K.panel(ctx, ex - 58, panTop, 116, 12, { fill: '#aab7cb', radius: 5 });
          tiles(ctx, ex - 54, panTop, p[0], p[1]);
          if (st.drag && (si ? st.drag === 'nxR' || st.drag === 'uR' : st.drag === 'nxL' || st.drag === 'uL')) {
            var dz = (st.drag === 'nxL' || st.drag === 'nxR') ? panTop - 96 : panTop - 44;
            K.panel(ctx, ex - 56, dz, 112, 40, { stroke: COL.yellow, lineWidth: 2.2, radius: 6, fill: 'rgba(241,196,15,0.10)' });
          }
        });
        hintDrag(ctx, '👆 拖动', cx - HB, pvY + 34);
        hintDrag(ctx, '👆 拖动', cx + HB, pvY + 34);
        /* 倾斜指示表（±15°量程）*/
        if (st.tilt) {
          var gx = W - 108, gy = 96, deg = K.clamp(-rot * 180 / PI, -15, 15);
          ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(gx, gy, 30, PI * 1.12, PI * 1.88); ctx.stroke(); ctx.restore();
          var aAng = -PI / 2 + deg * PI / 180;
          K.arrow(ctx, gx, gy, gx + Math.cos(aAng) * 26, gy + Math.sin(aAng) * 26, { color: COL.orange, width: 2.5, head: 7 });
          K.label(ctx, '倾角 ' + K.fmt(deg, 1) + '°', gx, gy + 48, { align: 'center', size: 11.5, color: DIM });
        }
        var pa = 0.55 + 0.45 * Math.sin(t * 5);
        if (bal) K.chip(ctx, isB ? '天平水平 ✓ 成功！' : '两侧结构一致 → 天平平衡 ✓', cx - 104, pvY - 56,
          { size: 13, bg: 'rgba(39,174,96,' + pa.toFixed(2) + ')', color: '#eafff2' });
        else if (isB) K.chip(ctx, '目标：增减两侧的箱子与块，让天平水平', cx - 150, pvY - 56, { size: 12.5, bg: 'rgba(255,255,255,0.10)' });
        /* 解题步骤（解出后两行金色辉光）*/
        if (st.res && st.res.k === 'val') {
          ctx.save(); ctx.shadowColor = COL.yellow; ctx.shadowBlur = 8 + 6 * Math.sin(t * 6);
          K.label(ctx, '① 移项合并：( ' + nm(st.nxL) + ' − ' + nm(st.nxR) + ' )·x ＝ ' + nm(st.uR - st.uL),
            cx, H - 74, { align: 'center', size: 16, weight: 'bold', color: COL.yellow });
          K.label(ctx, '② 两边同除以系数 ' + nm(st.nxL - st.nxR) + ' ：x ＝ ' + K.fmt(st.res.x, 2),
            cx, H - 50, { align: 'center', size: 16, weight: 'bold', color: COL.yellow });
          ctx.restore();
        } else if (st.res && st.res.k !== 'val') {
          K.label(ctx, st.res.k === 'inf' ? '① 合并后两侧恒等 → 无限多解' : '① 合并后出现矛盾 0·x ≠ 非0 → 无解',
            cx, H - 62, { align: 'center', size: 15, weight: 'bold', color: st.res.k === 'inf' ? COL.green : COL.red });
        }
      }
      var balTxt = function () { return bal ? '水平平衡 ✓' : '倾斜不平衡'; }, balCol = function () { return bal ? COL.green : COL.red; }; // bal 由下次调用重算前使用近似缓存
      function setTo(a, b, c, d) { st.nxL = a; st.uL = b; st.nxR = c; st.uR = d; st.res = null; }
      function statusTxt() {
        if (!st.res) return st.nxL === st.nxR && st.uL === st.uR ? '水平平衡 ✓' : '倾斜不平衡';
        if (st.res.k === 'val') return 'x ＝ ' + K.fmt(st.res.x, 2);
        return st.res.k === 'inf' ? '无限多解' : '无解';
      }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '当前方程', value: polyStr(0, st.nxL, st.uL) + ' ＝ ' + polyStr(0, st.nxR, st.uR), color: COL.sky },
            { label: '天平状态', value: (st.nxL === st.nxR && st.uL === st.uR) ? '水平平衡 ✓' : '倾斜不平衡', color: (st.nxL === st.nxR && st.uL === st.uR) ? COL.green : COL.red },
            { label: isB ? '提示' : '解析解', value: isB ? '调整两侧直至结构相同' : (st.res ? statusTxt() : '点击「解出 x」查看步骤'), color: COL.orange }
          ];
        },
        hitTest: function (x, y, W, H) {
          var g = panGeo(W, H), panTop = g.pvY + 64, sides = [{ ex: g.cx - g.HB }, { ex: g.cx + g.HB }];
          for (var si = 0; si < 2; si++) {
            var s = sides[si];
            if (x > s.ex - 60 && x < s.ex + 60 && y > panTop - 100 && y < panTop + 16) return true;
          }
          return false;
        },
        reset: function () { setTo(2, 3, 1, 5); },
        presets: function () {
          return [
            { name: isB ? '入门范例' : '范例 2x＋3＝x＋5', apply: function () { setTo(2, 3, 1, 5); } },
            { name: '两边相同（恒等）', apply: function () { setTo(3, 2, 3, 2); } },
            { name: '无解情形', apply: function () { setTo(2, 1, 2, 4); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 3 —— 双变量等式探索 eqexplor2v
     * 直线 ax+by=c；拖动平面上的测试点（0.5 栅格吸附），线上亮点记满，
     * 右栏统计满足率进度条。
     * ============================================================== */
    function mdEq2v() {
      var st = { a: 1, b: 2, c: 4, pts: [], drag: false };
      function onLine(p) { return Math.abs(st.a * p.x + st.b * p.y - st.c) < 0.01; }
      function rect(W, H) { return { x: 56, y: 84, w: Math.max(240, W - 306), h: Math.max(160, H - 140) }; }
      function mapOf(rc) { return K.view({ x: [-6, 6], px: [rc.x, rc.x + rc.w], y: [-6, 6], py: [rc.y + rc.h, rc.y] }); }
      function cntSat() { var s = 0; st.pts.forEach(function (p) { if (onLine(p)) s++; }); return s; }
      function ctl() {
        return [
          { id: 'e2_a', type: 'slider', label: '系数 a', min: -3, max: 3, step: 1, value: st.a, onChange: function (v) { st.a = Math.round(v); } },
          { id: 'e2_b', type: 'slider', label: '系数 b', min: -3, max: 3, step: 1, value: st.b, onChange: function (v) { st.b = Math.round(v); } },
          { id: 'e2_c', type: 'slider', label: '常数 c', min: -6, max: 6, step: 1, value: st.c, onChange: function (v) { st.c = Math.round(v); } },
          { id: 'e2_clr', type: 'button', label: '清空测试轨迹', action: function () { st.pts = []; toast('已清空全部测试点'); } }
        ];
      }
      function sample(sx, sy, W, H) { /* 吸附 0.5 栅格并去重记录 */
        var m = mapOf(rect(W, H));
        var wx = Math.round(m.XI(sx) * 2) / 2, wy = Math.round(m.YI(sy) * 2) / 2;
        if (wx < -6 || wx > 6 || wy < -6 || wy > 6) return;
        var last = st.pts[st.pts.length - 1];
        if (!last || last.x !== wx || last.y !== wy) st.pts.push({ x: wx, y: wy });
      }
      function down(x, y, W, H) { var rc = rect(W, H); st.drag = x > rc.x - 8 && x < rc.x + rc.w + 8 && y > rc.y - 8 && y < rc.y + rc.h + 8; sample(x, y, W, H); }
      function move(x, y, W, H) { if (st.drag) sample(x, y, W, H); }
      function up() { st.drag = false; }
      function draw(ctx, W, H, t) {
        var rc = rect(W, H), m = mapOf(rc);
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '双变量等式 · ax＋by＝c 的直线图象', 16, 12, COL.purple);
        K.panel(ctx, rc.x, rc.y, rc.w, rc.h, { fill: 'rgba(17,22,38,0.85)', stroke: 'rgba(255,255,255,0.16)' });
        /* 背景栅格与刻度数字 */
        for (var gv = -6; gv <= 6; gv++) {
          K.dashLine(ctx, m.X(gv), rc.y, m.X(gv), rc.y + rc.h, { color: 'rgba(255,255,255,0.07)', dash: [4, 4] });
          K.dashLine(ctx, rc.x, m.Y(gv), rc.x + rc.w, m.Y(gv), { color: 'rgba(255,255,255,0.07)', dash: [4, 4] });
          K.label(ctx, String(gv), m.X(gv), rc.y + rc.h + 12, { align: 'center', size: 9.5, color: DIM });
        }
        /* 直线：按窗口裁剪采样（b=0 时画竖直线） */
        var lp = [];
        if (st.b !== 0) {
          for (var q = 0; q <= 40; q++) {
            var wx = -6 + 12 * q / 40, wy = (st.c - st.a * wx) / st.b;
            if (Math.abs(wy) <= 6) lp.push({ x: m.X(wx), y: m.Y(wy) });
          }
        } else if (st.a !== 0 && Math.abs(st.c / st.a) <= 6) lp = [{ x: m.X(st.c / st.a), y: rc.y }, { x: m.X(st.c / st.a), y: rc.y + rc.h }];
        if (lp.length > 1) K.polyline(ctx, lp, { color: COL.purple, width: 3 });
        /* 测试点：满足→发光绿点；不满足→灰点 */
        st.pts.forEach(function (p) {
          var ok = onLine(p);
          K.circle(ctx, m.X(p.x), m.Y(p.y), ok ? 6 : 4, ok ? { fill: COL.green, stroke: '#dcffe9', lineWidth: 1.5 } : { fill: 'rgba(149,165,166,0.55)' });
        });
        var nSat = cntSat(), prog = st.pts.length ? nSat / st.pts.length : 0;
        /* 进度条与统计 chips */
        K.panel(ctx, W - 232, 84, 200, 20, { fill: 'rgba(255,255,255,0.08)', radius: 9 });
        K.panel(ctx, W - 231, 85, 198 * prog, 18, { fill: 'rgba(39,174,96,0.85)', radius: 8 });
        K.label(ctx, '满足率 ' + K.fmt(prog * 100, 0) + '%', W - 132, 118, { align: 'center', size: 12.5, color: TXT });
        K.chip(ctx, '已测 ' + st.pts.length + ' 点 · 满足 ' + nSat + ' 点', W - 228, 132, { size: 12, bg: 'rgba(155,89,182,0.25)' });
        hintDrag(ctx, '👆 拖动测试点', rc.x + rc.w / 2, rc.y - 20);
        K.label(ctx, '拖动图中的点做检验（0.5 步进吸附，恰好落在直线上变亮）', rc.x + 4, rc.y - 36, { size: 12, color: DIM });
      }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '当前方程', value: nm(st.a) + 'x ＋ ' + nm(st.b) + 'y ＝ ' + nm(st.c), color: COL.sky },
            { label: '线上点 / 总测点', value: cntSat() + ' / ' + st.pts.length, color: COL.green },
            { label: '说明', value: '拖动点寻找 ax＋by＝c 的全部解', color: DIM }
          ];
        },
        hitTest: function (x, y, W, H) { var rc = rect(W, H); return x > rc.x - 8 && x < rc.x + rc.w + 8 && y > rc.y - 8 && y < rc.y + rc.h + 8; },
        reset: function () { st.pts = []; st.drag = false; st.a = 1; st.b = 2; st.c = 4; },
        presets: function () {
          return [
            { name: '直线 y＝(4−x)/2', apply: function () { st.a = 1; st.b = 2; st.c = 4; st.pts = []; } },
            { name: '竖直直线 x＝2', apply: function () { st.a = 1; st.b = 0; st.c = 2; st.pts = []; } },
            { name: '下降线 x＋y＝3', apply: function () { st.a = 1; st.b = 1; st.c = 3; st.pts = []; } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 4 —— 表达式交换 exprxn
     * 面积瓷砖可视化 x²/x/常数三组条块（宽度∝|系数|，正蓝负红），
     * 化简结果随滑块实时汇总；挑战模式隐藏答案、三选一作答计连对。
     * ============================================================== */
    function mdExprxn() {
      var st = { c2: 1, c1: -2, c0: 3, challenge: false, opts: [], streak: 0, reveal: false, drag: -1, _sx: 0, _sv: 0 };
      function str(a, b, c) { return polyStr(a, b, c); }
      function genOpts() { /* 正确 + 两个扰动项，确定性洗牌 */
        var cand = [{ t: str(st.c2, st.c1, st.c0), ok: true }];
        [[st.c2, st.c1 + 1, st.c0], [st.c2, st.c1, st.c0 + 1], [st.c2 + 1, st.c1, st.c0]].forEach(function (d) {
          var s2 = str(d[0], d[1], d[2]);
          if (s2 !== cand[0].t && !cand.some(function (o) { return o.t === s2; })) cand.push({ t: s2, ok: false });
        });
        while (cand.length < 3) cand.push({ t: '－', ok: false });
        cand = cand.slice(0, 3);
        var R = K.rng(Math.abs(st.c2 * 31 + st.c1 * 7 + st.c0) + 1);
        for (var i = cand.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var tmp = cand[i]; cand[i] = cand[j]; cand[j] = tmp; }
        st.opts = cand; st.reveal = false;
      }
      function pick(i) {
        var o = st.opts[i]; if (!o) return;
        st.reveal = true;
        if (o.ok) { st.streak++; toast('答对了！已连对 ' + st.streak + ' 题'); }
        else { st.streak = 0; toast('不对哦，正确化简是 ' + str(st.c2, st.c1, st.c0)); }
      }
      function ctl() {
        var a = [
          { id: 'ex_c2', type: 'slider', label: 'x² 系数', min: -3, max: 3, step: 1, value: st.c2, onChange: function (v) { st.c2 = Math.round(v); if (st.challenge) genOpts(); else st.reveal = false; } },
          { id: 'ex_c1', type: 'slider', label: 'x 系数', min: -5, max: 5, step: 1, value: st.c1, onChange: function (v) { st.c1 = Math.round(v); if (st.challenge) genOpts(); else st.reveal = false; } },
          { id: 'ex_c0', type: 'slider', label: '常数项', min: -9, max: 9, step: 1, value: st.c0, onChange: function (v) { st.c0 = Math.round(v); if (st.challenge) genOpts(); else st.reveal = false; } },
          { id: 'ex_ch', type: 'checkbox', label: '挑战模式（先答再看）', value: st.challenge, onChange: function (v) { st.challenge = !!v; if (st.challenge) genOpts(); else st.reveal = false; } }
        ];
        ['A', 'B', 'C'].forEach(function (tag, i) {
          a.push({
            id: 'ex_o' + i, type: 'button',
            label: st.challenge || st.reveal ? tag + '：' + (st.opts[i] ? st.opts[i].t : '—') : tag + '：开启挑战后可选',
            action: function () { pick(i); }
          });
        });
        return a;
      }
      /* 拖动三组表达式瓷砖（x²/x/常数）：水平拖动按 24px/格 改系数 */
      var KEYS = ['c2', 'c1', 'c0'], MINS = [-3, -5, -9], MAXS = [3, 5, 9];
      function down(x, y) {
        st.drag = -1; var x0 = 70;
        for (var i = 0; i < 3; i++) {
          var ry = 96 + i * 86;
          if (x > x0 - 14 && x < x0 + 880 && y > ry - 12 && y < ry + 46) {
            st.drag = i; st._sx = x; st._sv = st[KEYS[i]];
            return;
          }
        }
      }
      function move(x) {
        if (st.drag < 0) return;
        var i = st.drag;
        st[KEYS[i]] = K.clamp(st._sv + Math.round((x - st._sx) / 24), MINS[i], MAXS[i]);
        if (st.challenge) genOpts(); else st.reveal = false;
      }
      function up() { st.drag = -1; }
      function draw(ctx, W, H, t) {
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '表达式交换 · 合并同类项', 16, 12, COL.blue);
        /* 左：三组面积砖（宽 ∝|系数|）*/
        var x0 = 70, rows = [['x² 区块', st.c2, 52], ['x 条形', st.c1, 34], ['单位方块 ×|常数|', st.c0, 18]];
        rows.forEach(function (r0, i) {
          var y = 96 + i * 86, w = Math.abs(r0[1]) * 30;
          K.label(ctx, r0[0], x0, y - 12, { size: 12, color: DIM });
          if (i === 2) {
            for (var u = 0; u < Math.min(Math.abs(r0[1]), 28); u++)
              K.panel(ctx, x0 + u * 16, y, 13, 13, { fill: r0[1] >= 0 ? 'rgba(241,196,15,0.92)' : 'rgba(231,76,60,0.88)', radius: 3 });
            if (!r0[1]) K.label(ctx, '( 0 个单位方格 )', x0, y + 7, { size: 11, color: DIM });
            if (Math.abs(r0[1]) > 28) K.label(ctx, '+' + (Math.abs(r0[1]) - 28), x0 + 28 * 16 + 6, y + 7, { size: 11, color: DIM });
          } else if (w > 0.5) K.panel(ctx, x0, y, w, r0[2], { fill: r0[1] > 0 ? 'rgba(52,152,219,0.85)' : 'rgba(231,76,60,0.85)', radius: 4 });
          if (i < 2) K.label(ctx, nm(r0[1]), x0 + w + 8, y + r0[2] / 2, { size: 12, color: DIM });
          if (st.drag === i) K.panel(ctx, x0 - 8, y - 8, Math.max(w, 120) + 24, r0[2] + 16, { stroke: COL.yellow, lineWidth: 2, radius: 6, fill: 'rgba(241,196,15,0.08)' });
        });
        /* 结果或问号 */
        var hide = st.challenge && !st.reveal;
        K.label(ctx, '化简结果：', x0, H - 66, { size: 15, color: DIM });
        if (!hide) {
          ctx.save(); ctx.shadowColor = COL.teal; ctx.shadowBlur = 8 + 5 * Math.sin(t * 5);
          K.label(ctx, str(st.c2, st.c1, st.c0), x0 + 92, H - 66, { size: 21, weight: 'bold', color: COL.teal });
          ctx.restore();
        } else K.chip(ctx, '？　先从右侧 A/B/C 里选一个吧', x0 + 92, H - 80, { size: 14, bg: 'rgba(241,196,15,0.2)' });
        hintDrag(ctx, '👆 拖动改系数', x0 + 120, 74);
        K.label(ctx, '蓝色 = 正系数，红色 = 负系数；条宽正比 |系数|。挑战连对：' + st.streak + ' 题',
          x0, H - 28, { size: 12, color: DIM });
      }
      function setC(a, b, c) { st.c2 = a; st.c1 = b; st.c0 = c; if (st.challenge) genOpts(); }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '原始表达式', value: str(st.c2, st.c1, st.c0), color: COL.sky },
            { label: st.challenge ? '挑战状态' : '化简结果', value: st.challenge && !st.reveal ? '？？？' : str(st.c2, st.c1, st.c0), color: COL.teal },
            { label: '挑战连对', value: String(st.streak), color: COL.yellow }
          ];
        },
        hitTest: function (x, y) { var x0 = 70; for (var i = 0; i < 3; i++) { var ry = 96 + i * 86; if (x > x0 - 14 && x < x0 + 880 && y > ry - 12 && y < ry + 46) return true; } return false; },
        reset: function () { setC(1, -2, 3); st.streak = 0; st.reveal = false; },
        presets: function () {
          return [
            { name: '纯粹一次式', apply: function () { setC(0, 2, 5); } },
            { name: '负系数混合', apply: function () { setC(-1, -3, 4); } },
            { name: '平方为主', apply: function () { setC(3, 1, -6); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 5 —— 面积模型·代数 areaalg
     * 大矩形四分区着色呈现 (ax+b)(cx+d) 各部分乘积，下方动态展开式。
     * ============================================================== */
    function mdAreaAlg() {
      var st = { a: 1, b: 2, c: 1, d: -3, drag: null, _sx: 0, _sy: 0, _sv: 0 };
      function coefTerm(v) { return v === 1 ? '' : (v === -1 ? '−' : nm(v)); }
      function signed(v) { return v < 0 ? '− ' + Math.abs(v) : '+ ' + v; }
      function ctl() {
        return [
          { id: 'aa_a', type: 'slider', label: 'a（配 x² 的系数）', min: -5, max: 5, step: 1, value: st.a, onChange: function (v) { st.a = Math.round(v); } },
          { id: 'aa_b', type: 'slider', label: 'b（可取 0）', min: -5, max: 5, step: 1, value: st.b, onChange: function (v) { st.b = Math.round(v); } },
          { id: 'aa_c', type: 'slider', label: 'c（另一维 x 系数）', min: -5, max: 5, step: 1, value: st.c, onChange: function (v) { st.c = Math.round(v); } },
          { id: 'aa_d', type: 'slider', label: 'd（可取 0）', min: -5, max: 5, step: 1, value: st.d, onChange: function (v) { st.d = Math.round(v); } }
        ];
      }
      function layout(W, H) {
        var X = 90, Y = 78, AW = Math.max(220, W - 380), AH = Math.max(150, H - 210);
        var u = Math.min(AW / Math.max(1e-6, Math.abs(st.a) + Math.abs(st.b)), AH / Math.max(1e-6, Math.abs(st.c) + Math.abs(st.d)));
        return { X: X, Y: Y, AW: AW, AH: AH, wA: Math.abs(st.a) * u, wB: Math.abs(st.b) * u, hC: Math.abs(st.c) * u, hD: Math.abs(st.d) * u };
      }
      /* 拖动竖直分区边改 b，拖动水平分区边改 d（24px/步） */
      function down(x, y, W, H) {
        st.drag = null; var L = layout(W, H);
        if (x < L.X - 8 || x > L.X + L.wA + L.wB + 8 || y < L.Y - 8 || y > L.Y + L.hC + L.hD + 8) return;
        if (Math.abs(x - (L.X + L.wA)) < 20) { st.drag = 'v'; st._sx = x; st._sv = st.b; }
        else if (Math.abs(y - (L.Y + L.hC)) < 20) { st.drag = 'h'; st._sy = y; st._sv = st.d; }
      }
      function move(x, y) {
        if (st.drag === 'v') st.b = K.clamp(st._sv + Math.round((x - st._sx) / 24), -5, 5);
        else if (st.drag === 'h') st.d = K.clamp(st._sv + Math.round((y - st._sy) / 24), -5, 5);
      }
      function up() { st.drag = null; }
      function draw(ctx, W, H, t) {
        var ac = st.a * st.c, ad = st.a * st.d, bc = st.b * st.c, bd = st.b * st.d;
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '面积模型 · 整式乘法 (ax＋b)(cx＋d)', 16, 12, COL.purple);
        var X = 90, Y = 78, AW = Math.max(220, W - 380), AH = Math.max(150, H - 210);
        var u = Math.min(AW / Math.max(1e-6, Math.abs(st.a) + Math.abs(st.b)), AH / Math.max(1e-6, Math.abs(st.c) + Math.abs(st.d)));
        var wA = Math.abs(st.a) * u, wB = Math.abs(st.b) * u, hC = Math.abs(st.c) * u, hD = Math.abs(st.d) * u;
        [{ x: X, y: Y, w: wA, h: hC, f: 'rgba(155,89,182,0.30)', s: nm(ac) + 'x²' },
         { x: X + wA, y: Y, w: wB, h: hC, f: 'rgba(52,152,219,0.26)', s: nm(bc) + 'x' },
         { x: X, y: Y + hC, w: wA, h: hD, f: 'rgba(243,156,18,0.26)', s: nm(ad) + 'x' },
         { x: X + wA, y: Y + hC, w: wB, h: hD, f: 'rgba(26,188,156,0.28)', s: nm(bd)}
        ].forEach(function (cl) {
          if (cl.w < 0.5 || cl.h < 0.5) return;
          K.panel(ctx, cl.x, cl.y, cl.w, cl.h, { fill: cl.f, stroke: 'rgba(255,255,255,0.35)', lineWidth: 1, radius: 2 });
          K.label(ctx, cl.s, cl.x + cl.w / 2, cl.y + cl.h / 2, { align: 'center', size: Math.min(19, cl.w / 3.2, cl.h / 2), weight: 'bold', color: TXT });
        });
        /* 可拖拽分区边把手（竖直改 b、水平改 d） */
        var dvx = X + wA, dhy = Y + hC;
        if (wA > 1 && wB > 1) K.circle(ctx, dvx, Y + hC / 2, st.drag === 'v' ? 8 : 5, { fill: COL.yellow, stroke: '#fff', lineWidth: 1.4 });
        if (hC > 1 && hD > 1) K.circle(ctx, X + wA / 2, dhy, st.drag === 'h' ? 8 : 5, { fill: COL.pink, stroke: '#fff', lineWidth: 1.4 });
        hintDrag(ctx, '👆 拖动b', X + wA, Y + hC / 2 - 30);
        hintDrag(ctx, '👆 拖动d', X + wA / 2 - 46, Y + hC);
        /* 边尺寸刻度 */
        if (wA > 8) K.label(ctx, nm(st.a) + 'x', X + wA / 2, Y - 14, { align: 'center', size: 13, weight: 'bold', color: COL.light });
        if (wB > 8) K.label(ctx, nm(st.b), X + wA + wB / 2, Y - 14, { align: 'center', size: 13, weight: 'bold', color: COL.light });
        if (hC > 8) K.label(ctx, nm(st.c) + 'x', X - 34, Y + hC / 2, { align: 'right', size: 13, weight: 'bold', color: COL.light });
        if (hD > 8) K.label(ctx, nm(st.d), X - 34, Y + hC + hD / 2, { align: 'right', size: 13, weight: 'bold', color: COL.light });
        /* 展开式（辉光）与交叉项注释 */
        ctx.save(); ctx.shadowColor = COL.purple; ctx.shadowBlur = 7 + 4 * Math.sin(t * 5);
        K.label(ctx, '= ' + polyStr(ac, ad + bc, bd), X + 320, Y + AH + 46, { size: 21, weight: 'bold', color: COL.purple });
        ctx.restore();
        K.label(ctx, '( ' + coefTerm(st.a) + 'x ' + signed(st.b) + ' )( ' + coefTerm(st.c) + 'x ' + signed(st.d) + ' )', X, Y + AH + 46, { size: 17, color: DIM });
        K.chip(ctx, '交叉项来源：ad·x ＋ bc·x ＝ ' + nm(ad + bc) + 'x', X, Y + AH + 82, { size: 12.5, bg: 'rgba(155,89,182,0.22)' });
      }
      function setABCD(a, b, c, d) { st.a = a; st.b = b; st.c = c; st.d = d; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '乘积表达式', value: '( ' + coefTerm(st.a) + 'x ' + signed(st.b) + ' )( ' + coefTerm(st.c) + 'x ' + signed(st.d) + ' )', color: COL.sky },
            { label: '展开结果', value: polyStr(st.a * st.c, st.a * st.d + st.b * st.c, st.b * st.d), color: COL.purple },
            { label: '中间项 ad＋bc', value: nm(st.a * st.d + st.b * st.c) + 'x', color: COL.orange }
          ];
        },
        hitTest: function (x, y, W, H) { var L = layout(W, H); if (x < L.X - 8 || x > L.X + L.wA + L.wB + 8 || y < L.Y - 8 || y > L.Y + L.hC + L.hD + 8) return false; return Math.abs(x - (L.X + L.wA)) < 20 || Math.abs(y - (L.Y + L.hC)) < 20; },
        reset: function () { setABCD(1, 2, 1, -3); },
        presets: function () {
          return [
            { name: '完全平方 (x＋2)²', apply: function () { setABCD(1, 2, 1, 2); } },
            { name: '平方差 (x＋3)(x−3)', apply: function () { setABCD(1, 3, 1, -3); } },
            { name: '大系数挑战', apply: function () { setABCD(3, -5, 2, 1); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 6 —— 面积模型·小数 areadec
     * 10×10 百格板：列带 ∝ x，行带 ∝ y，交叠区即乘积面积（两位小数读出）。
     * ============================================================== */
    function mdAreaDec() {
      var st = { x: 0.3, y: 0.2, drag: null };
      function ctl() {
        return [
          { id: 'ad_x', type: 'slider', label: '小数 x', min: 0.1, max: 0.9, step: 0.1, value: st.x, onChange: function (v) { st.x = Math.round(v * 10) / 10; } },
          { id: 'ad_y', type: 'slider', label: '小数 y', min: 0.1, max: 0.9, step: 0.1, value: st.y, onChange: function (v) { st.y = Math.round(v * 10) / 10; } }
        ];
      }
      function geo(W, H) { return { gx: 86, gy: 72, side: Math.min(H - 150, W - 330) }; }
      /* 拖动右边框改 x（列数），拖动下边框改 y（行数），0.1 步进 */
      function down(x, y, W, H) {
        st.drag = null; var g = geo(W, H);
        if (x < g.gx - 10 || x > g.gx + g.side + 16 || y < g.gy - 10 || y > g.gy + g.side + 16) return;
        if (Math.abs(x - (g.gx + g.side)) < 20 && y > g.gy - 6 && y < g.gy + g.side + 6) st.drag = 'x';
        else if (Math.abs(y - (g.gy + g.side)) < 20 && x > g.gx - 6 && x < g.gx + g.side + 6) st.drag = 'y';
      }
      function move(x, y, W, H) {
        if (!st.drag) return; var g = geo(W, H);
        if (st.drag === 'x') st.x = K.clamp(Math.round((x - g.gx) / g.side * 10) / 10, 0.1, 0.9);
        else st.y = K.clamp(Math.round((g.gy + g.side - y) / g.side * 10) / 10, 0.1, 0.9);
      }
      function up() { st.drag = null; }
      function draw(ctx, W, H) {
        var cols = Math.round(st.x * 10), rws = Math.round(st.y * 10);
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '面积模型 · 小数乘法 0.x × 0.y', 16, 12, COL.teal);
        var side = Math.min(H - 150, W - 330), gx = 86, gy = 72, cs = side / 10;
        K.panel(ctx, gx, gy, side, side, { fill: 'rgba(17,22,38,0.9)', stroke: 'rgba(255,255,255,0.3)', lineWidth: 1.5, radius: 4 });
        if (cols) K.panel(ctx, gx, gy, cs * cols, side, { fill: 'rgba(52,152,219,0.28)', radius: 0 });
        if (rws) K.panel(ctx, gx, gy + side - cs * rws, side, cs * rws, { fill: 'rgba(253,121,168,0.26)', radius: 0 });
        if (cols && rws) K.panel(ctx, gx, gy + side - cs * rws, cs * cols, cs * rws, { fill: 'rgba(26,188,156,0.65)', radius: 0 });
        for (var g = 1; g < 10; g++) {
          K.dashLine(ctx, gx + cs * g, gy, gx + cs * g, gy + side, { color: 'rgba(255,255,255,0.10)', dash: [] });
          K.dashLine(ctx, gx, gy + cs * g, gx + side, gy + cs * g, { color: 'rgba(255,255,255,0.10)', dash: [] });
        }
        /* 可拖拽边把手：右边改 x，下边改 y */
        K.circle(ctx, gx + cs * cols, gy + side / 2, st.drag === 'x' ? 8 : 5, { fill: COL.sky, stroke: '#fff', lineWidth: 1.4 });
        K.circle(ctx, gx + side / 2, gy + side - cs * rws, st.drag === 'y' ? 8 : 5, { fill: COL.pink, stroke: '#fff', lineWidth: 1.4 });
        hintDrag(ctx, '👆 拖动x', gx + cs * cols + 44, gy + side / 2 - 16);
        hintDrag(ctx, '👆 拖动y', gx + side / 2, gy + side - cs * rws + 34);
        K.label(ctx, '列方向 ' + cols + '/10（×' + nm(st.x) + '）', gx, gy - 14, { size: 12, color: COL.sky });
        K.label(ctx, '行方向 ' + rws + '/10（×' + nm(st.y) + '）', gx + 8, gy + side + 14, { size: 12, color: COL.pink });
        var prod = Math.round(st.x * st.y * 100) / 100, cellsN = Math.round(prod * 100);
        ctx.save(); ctx.shadowColor = COL.teal; ctx.shadowBlur = 6;
        K.label(ctx, nm(st.x) + ' × ' + nm(st.y) + ' ＝ ' + prod.toFixed(2), gx + side + 34, gy + 40, { size: 24, weight: 'bold', color: COL.teal });
        ctx.restore();
        K.chip(ctx, '相当于 ' + cellsN + ' 个「百分之一」格', gx + side + 36, gy + 68, { size: 13, bg: 'rgba(26,188,156,0.20)' });
        K.label(ctx, '青绿深色区域 = 行带与列带的交集，面积即乘积', gx, H - 32, { size: 12, color: DIM });
      }
      function setXY(a, b) { st.x = a; st.y = b; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '小数乘积', value: (Math.round(st.x * st.y * 100) / 100).toFixed(2), color: COL.teal },
            { label: '覆盖百格数', value: String(Math.round(st.x * st.y * 100)), unit: ' 格', color: COL.green },
            { label: '估算提示', value: '两个小于 1 的小数相乘会更小！', color: DIM }
          ];
        },
        hitTest: function (x, y, W, H) { var g = geo(W, H); if (x < g.gx - 10 || x > g.gx + g.side + 16 || y < g.gy - 10 || y > g.gy + g.side + 16) return false; return (Math.abs(x - (g.gx + g.side)) < 20 && y > g.gy - 6 && y < g.gy + g.side + 6) || (Math.abs(y - (g.gy + g.side)) < 20 && x > g.gx - 6 && x < g.gx + g.side + 6); },
        reset: function () { setXY(0.3, 0.2); },
        presets: function () {
          return [
            { name: '示例 0.3×0.2', apply: function () { setXY(0.3, 0.2); } },
            { name: '接近满板 0.9×0.9', apply: function () { setXY(0.9, 0.9); } },
            { name: '薄薄一条 0.1×0.9', apply: function () { setXY(0.1, 0.9); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 7 —— 面积模型·乘法 areamult
     * 两位数按十位/个位拆分四块 tinted 部分积；右侧标准竖式对照。
     * ============================================================== */
    function mdAreaMult() {
      var st = { a1: 2, a2: 3, b1: 4, b2: 5, drag: null, _sx: 0, _sy: 0, _sv: 0 }; // 被乘数 = a1·10+a2，乘数 = b1·10+b2
      function A() { return st.a1 * 10 + st.a2; }
      function B() { return st.b1 * 10 + st.b2; }
      function P() { return [st.a1 * st.b1 * 100, st.a1 * st.b2 * 10, st.a2 * st.b1 * 10, st.a2 * st.b2]; }
      function ctl() {
        return [
          { id: 'am_a1', type: 'slider', label: '被乘数十位', min: 1, max: 9, step: 1, value: st.a1, onChange: function (v) { st.a1 = Math.round(v); } },
          { id: 'am_a2', type: 'slider', label: '被乘数个位', min: 0, max: 9, step: 1, value: st.a2, onChange: function (v) { st.a2 = Math.round(v); } },
          { id: 'am_b1', type: 'slider', label: '乘数十位', min: 1, max: 9, step: 1, value: st.b1, onChange: function (v) { st.b1 = Math.round(v); } },
          { id: 'am_b2', type: 'slider', label: '乘数个位', min: 0, max: 9, step: 1, value: st.b2, onChange: function (v) { st.b2 = Math.round(v); } }
        ];
      }
      function geo(W, H) {
        var X = 86, Y = 84, AW = Math.max(220, Math.min(430, W - 430)), AH = Math.max(150, Math.min(320, H - 190));
        var wa = (st.a1 * 10) / (st.a1 * 10 + st.a2) * AW, ha = (st.b1 * 10) / (st.b1 * 10 + st.b2) * AH;
        return { X: X, Y: Y, AW: AW, AH: AH, wa: wa, ha: ha };
      }
      /* 四个把手：竖直分区边改 a1（十位）、右边框改 a2（个位）、水平分区边改 b1、下边框改 b2（24px/步） */
      function down(x, y, W, H) {
        st.drag = null; var g = geo(W, H);
        if (x < g.X - 10 || x > g.X + g.AW + 16 || y < g.Y - 10 || y > g.Y + g.AH + 16) return;
        if (Math.abs(x - (g.X + g.wa)) < 20 && y > g.Y && y < g.Y + g.AH) { st.drag = 'a1'; st._sx = x; st._sv = st.a1; }
        else if (Math.abs(x - (g.X + g.AW)) < 20) { st.drag = 'a2'; st._sx = x; st._sv = st.a2; }
        else if (Math.abs(y - (g.Y + g.ha)) < 20 && x > g.X && x < g.X + g.AW) { st.drag = 'b1'; st._sy = y; st._sv = st.b1; }
        else if (Math.abs(y - (g.Y + g.AH)) < 20) { st.drag = 'b2'; st._sy = y; st._sv = st.b2; }
      }
      function move(x, y) {
        if (st.drag === 'a1') st.a1 = K.clamp(st._sv + Math.round((x - st._sx) / 24), 1, 9);
        else if (st.drag === 'a2') st.a2 = K.clamp(st._sv + Math.round((x - st._sx) / 24), 0, 9);
        else if (st.drag === 'b1') st.b1 = K.clamp(st._sv + Math.round((y - st._sy) / 24), 1, 9);
        else if (st.drag === 'b2') st.b2 = K.clamp(st._sv + Math.round((y - st._sy) / 24), 0, 9);
      }
      function up() { st.drag = null; }
      function draw(ctx, W, H) {
        var Pv = P();
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '面积模型 · 两位数乘法拆分', 16, 12, COL.orange);
        var X = 86, Y = 84, AW = Math.max(220, Math.min(430, W - 430)), AH = Math.max(150, Math.min(320, H - 190));
        var wa = (st.a1 * 10) / (st.a1 * 10 + st.a2) * AW, ha = (st.b1 * 10) / (st.b1 * 10 + st.b2) * AH;
        var fills = ['rgba(243,156,18,0.30)', 'rgba(253,121,168,0.30)', 'rgba(116,185,255,0.30)', 'rgba(39,174,96,0.30)'];
        [{ x: X, y: Y, w: wa, h: ha, f: fills[0], n: 0, e: nm(st.a1) + '0×' + nm(st.b1) + '0' },
         { x: X + wa, y: Y, w: AW - wa, h: ha, f: fills[1], n: 1, e: nm(st.a1) + '0×' + nm(st.b2) },
         { x: X, y: Y + ha, w: wa, h: AH - ha, f: fills[2], n: 2, e: nm(st.a2) + '×' + nm(st.b1) + '0' },
         { x: X + wa, y: Y + ha, w: AW - wa, h: AH - ha, f: fills[3], n: 3, e: nm(st.a2) + '×' + nm(st.b2)}
        ].forEach(function (c0) {
          K.panel(ctx, c0.x, c0.y, c0.w, c0.h, { fill: c0.f, stroke: 'rgba(255,255,255,0.35)', radius: 2 });
          K.label(ctx, String(Pv[c0.n]), c0.x + c0.w / 2, c0.y + c0.h / 2 - 4, { align: 'center', size: Math.min(22, c0.w / 3), weight: 'bold', color: TXT });
          if (c0.w > 70 && c0.h > 46) K.label(ctx, c0.e, c0.x + c0.w / 2, c0.y + c0.h / 2 + 16, { align: 'center', size: 11, color: DIM });
        });
        /* 可拖拽把手：分区边/外边框各两个 */
        K.circle(ctx, X + wa, Y + AH / 2, st.drag === 'a1' ? 8 : 5, { fill: COL.orange, stroke: '#fff', lineWidth: 1.4 });
        K.circle(ctx, X + AW, Y + AH / 2, st.drag === 'a2' ? 8 : 5, { fill: COL.yellow, stroke: '#fff', lineWidth: 1.4 });
        K.circle(ctx, X + AW / 2, Y + ha, st.drag === 'b1' ? 8 : 5, { fill: COL.pink, stroke: '#fff', lineWidth: 1.4 });
        K.circle(ctx, X + AW / 2, Y + AH, st.drag === 'b2' ? 8 : 5, { fill: COL.teal, stroke: '#fff', lineWidth: 1.4 });
        hintDrag(ctx, '👆 拖动', X + wa, Y + AH / 2 - 24);
        hintDrag(ctx, '👆 拖动', X + AW + 30, Y + AH / 2 - 24);
        hintDrag(ctx, '👆 拖动', X + AW / 2, Y + ha - 24);
        hintDrag(ctx, '👆 拖动', X + AW / 2, Y + AH + 24);
        K.label(ctx, '← 宽分 ' + nm(st.a1) + '0｜' + nm(st.a2) + ' →', X + AW / 2, Y - 14, { align: 'center', size: 12, color: COL.orange });
        K.label(ctx, '高：( ' + nm(st.b1) + '0｜' + nm(st.b2) + ' )', X - 14, Y + AH / 2, { align: 'right', size: 12, color: COL.orange });
        /* 右侧标准竖式对照 */
        var vx = X + AW + 78, vy = Y + 8, cw = 26;
        K.label(ctx, String(A()), vx, vy, { size: 19, weight: 'bold', align: 'right' });
        K.label(ctx, '× ' + B(), vx, vy + 30, { size: 19, weight: 'bold', align: 'right' });
        K.dashLine(ctx, vx - cw * 3, vy + 48, vx, vy + 48, { color: 'rgba(255,255,255,0.4)' });
        K.label(ctx, String(Pv[1] + Pv[3]), vx, vy + 74, { size: 17, color: COL.pink, align: 'right' });
        K.label(ctx, String(Pv[0] + Pv[2]), vx, vy + 102, { size: 17, color: COL.sky, align: 'right' });
        K.dashLine(ctx, vx - cw * 3, vy + 120, vx, vy + 120, { color: 'rgba(255,255,255,0.4)' });
        K.label(ctx, String(A() * B()), vx, vy + 148, { size: 21, weight: 'bold', color: COL.yellow, align: 'right' });
        K.label(ctx, '部分积之和：' + Pv.join(' ＋ '), X, H - 34, { size: 13, color: DIM });
      }
      function setD(a, b, c, d) { st.a1 = a; st.a2 = b; st.b1 = c; st.b2 = d; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '算式', value: A() + ' × ' + B() + ' ＝ ' + (A() * B()), color: COL.yellow },
            { label: '四个部分积', value: P().join(' , '), color: COL.orange },
            { label: '拆分逻辑', value: '十位积 ×100/×10 加个位积 ×10/×1', color: DIM }
          ];
        },
        hitTest: function (x, y, W, H) { var g = geo(W, H); if (x < g.X - 10 || x > g.X + g.AW + 16 || y < g.Y - 10 || y > g.Y + g.AH + 16) return false; return (Math.abs(x - (g.X + g.wa)) < 20 && y > g.Y && y < g.Y + g.AH) || (Math.abs(x - (g.X + g.AW)) < 20) || (Math.abs(y - (g.Y + g.ha)) < 20 && x > g.X && x < g.X + g.AW) || (Math.abs(y - (g.Y + g.AH)) < 20); },
        reset: function () { setD(2, 3, 4, 5); },
        presets: function () {
          return [
            { name: '示例 23×45', apply: function () { setD(2, 3, 4, 5); } },
            { name: '整十巧算 70×12', apply: function () { setD(7, 0, 1, 2); } },
            { name: '大数挑战 89×97', apply: function () { setD(8, 9, 9, 7); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 8 —— 面积模型·入门 areaintro
     * 单矩形 w×h；改动时格子逐格点亮计数动画，公式卡「面积=长×宽」。
     * ============================================================== */
    function mdAreaIntro() {
      var st = { w: 4, h: 3, disp: 12, drag: null };
      function target() { return st.w * st.h; }
      function tick(dt) { /* 计数补间：指数逼近目标格数（NaN 防御） */
        dt = dtGuard(dt);
        if (!isFinite(st.disp)) st.disp = 0;
        st.disp += (target() - st.disp) * Math.min(1, dt * 6);
        if (Math.abs(target() - st.disp) < 0.02) st.disp = target();
      }
      function bump(k, v) { st[k] = Math.round(v); st.disp = 0; }
      function setWH(w, h) { st.w = w; st.h = h; st.disp = 0; }
      function ctl() {
        return [
          { id: 'ai_w', type: 'slider', label: '长 w', min: 1, max: 12, step: 1, value: st.w, onChange: function (v) { bump('w', v); } },
          { id: 'ai_h', type: 'slider', label: '宽 h', min: 1, max: 12, step: 1, value: st.h, onChange: function (v) { bump('h', v); } }
        ];
      }
      function geo(W, H) {
        var X = 90, Y = 80, AW = Math.max(220, W - 350), AH = Math.max(150, H - 190);
        var cs = Math.min(AW / Math.max(1, st.w), AH / Math.max(1, st.h));
        return { X: X, Y: Y, AW: AW, AH: AH, cs: cs };
      }
      /* 拖动右边框改长 w，拖动下边框改宽 h（整数格） */
      function down(x, y, W, H) {
        st.drag = null; var g = geo(W, H), rx = g.X + st.w * g.cs, by = g.Y + st.h * g.cs;
        if (Math.abs(x - rx) < 20 && y > g.Y - 8 && y < by + 8) st.drag = 'w';
        else if (Math.abs(y - by) < 20 && x > g.X - 8 && x < rx + 8) st.drag = 'h';
      }
      function move(x, y, W, H) {
        if (!st.drag) return; var g = geo(W, H);
        if (st.drag === 'w') st.w = K.clamp(Math.round((x - g.X) / g.cs), 1, 12);
        else st.h = K.clamp(Math.round((y - g.Y) / g.cs), 1, 12);
        st.disp = 0;
      }
      function up() { st.drag = null; }
      function draw(ctx, W, H) {
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '面积模型 · 入门 数格子', 16, 12, COL.green);
        var X = 90, Y = 80, AW = Math.max(220, W - 350), AH = Math.max(150, H - 190);
        var cs = Math.min(AW / st.w, AH / st.h), shown = Math.min(target(), Math.floor(st.disp + 1e-9));
        for (var j = 0; j < st.h; j++) for (var i = 0; i < st.w; i++) {
          var idx = j * st.w + i, on = idx < shown, cur = idx === shown - 1 && shown < target();
          K.panel(ctx, X + i * cs, Y + j * cs, cs - 2, cs - 2, {
            fill: on ? (cur ? 'rgba(241,196,15,0.95)' : 'rgba(39,174,96,0.72)') : 'rgba(255,255,255,0.06)',
            stroke: 'rgba(255,255,255,0.16)', radius: 3
          });
        }
        /* 可拖拽边把手：右边改 w，下边改 h */
        K.circle(ctx, X + st.w * cs, Y + st.h * cs / 2, st.drag === 'w' ? 8 : 5, { fill: COL.green, stroke: '#fff', lineWidth: 1.4 });
        K.circle(ctx, X + st.w * cs / 2, Y + st.h * cs, st.drag === 'h' ? 8 : 5, { fill: COL.sky, stroke: '#fff', lineWidth: 1.4 });
        hintDrag(ctx, '👆 拖动', X + st.w * cs + 34, Y + st.h * cs / 2 - 18);
        hintDrag(ctx, '👆 拖动', X + st.w * cs / 2, Y + st.h * cs + 34);
        var fx = X + st.w * cs + 44, fy = Y + 26;
        K.panel(ctx, fx, fy, 250, 112, { fill: 'rgba(39,174,96,0.14)', stroke: 'rgba(39,174,96,0.5)', lineWidth: 1.2, radius: 12 });
        K.label(ctx, '面积 ＝ 长 × 宽', fx + 125, fy + 28, { align: 'center', size: 15, weight: 'bold', color: COL.green });
        K.label(ctx, nm(st.w) + ' × ' + nm(st.h) + ' ＝ ' + target() + ' 平方单位', fx + 125, fy + 62, { align: 'center', size: 16, color: TXT });
        K.label(ctx, '已数到 ' + Math.round(st.disp) + ' 格', fx + 125, fy + 90, { align: 'center', size: 12, color: DIM });
      }
      return {
        ctl: ctl, tick: tick, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '长 × 宽', value: st.w + ' × ' + st.h, color: COL.sky },
            { label: '面积（计数动画中）', value: Math.round(st.disp) + ' / ' + target(), color: COL.green },
            { label: '单位', value: '平方单位（格）', color: DIM }
          ];
        },
        hitTest: function (x, y, W, H) { var g = geo(W, H), rx = g.X + st.w * g.cs, by = g.Y + st.h * g.cs; return (Math.abs(x - rx) < 20 && y > g.Y - 8 && y < by + 8) || (Math.abs(y - by) < 20 && x > g.X - 8 && x < rx + 8); },
        reset: function () { setWH(4, 3); },
        presets: function () {
          return [
            { name: '小面积 3×2', apply: function () { setWH(3, 2); } },
            { name: '正方形 6×6', apply: function () { setWH(6, 6); } },
            { name: '大长条 12×2', apply: function () { setWH(12, 2); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 9 —— 矢量加法 vecadd
     * O 点 A(蓝)+B(橙)=R(红)：尾接头平移、平行四边形虚线补边；
     * 分量投影虚线、|R| 与 θ 圆弧读数；可直接拖拽端点（30px 内、0.5 吸附）。
     * ============================================================== */
    function mdVecAdd() {
      var st = { ax: 3, ay: 4, bx: -2, by: 5, comp: true, drag: null, vw: null, panelW: 208 };
      function Rv() { return { x: st.ax + st.bx, y: st.ay + st.by }; }
      function areaOf(W, H) { return { x0: 78, x1: W - st.panelW - 24, y0: 58, y1: H - 54 }; }
      function syncMap(W, H) {
        var r = areaOf(W, H);
        st.vw = K.view({ x: [-11.5, 11.5], px: [r.x0, r.x1], y: [-9, 9], py: [r.y1, r.y0] });
      }
      function ctl() {
        return [
          { id: 'va_ax', type: 'slider', label: 'Ax 分量', min: -10, max: 10, step: 0.5, value: st.ax, onChange: function (v) { st.ax = v; } },
          { id: 'va_ay', type: 'slider', label: 'Ay 分量', min: -10, max: 10, step: 0.5, value: st.ay, onChange: function (v) { st.ay = v; } },
          { id: 'va_bx', type: 'slider', label: 'Bx 分量', min: -10, max: 10, step: 0.5, value: st.bx, onChange: function (v) { st.bx = v; } },
          { id: 'va_by', type: 'slider', label: 'By 分量', min: -10, max: 10, step: 0.5, value: st.by, onChange: function (v) { st.by = v; } },
          { id: 'va_cp', type: 'checkbox', label: '显示分量虚线投影', value: st.comp, onChange: function (v) { st.comp = !!v; } }
        ];
      }
      function down(x, y) {
        if (!st.vw) return;
        var best = null, bd = 30, self = this;
        ['A', 'B'].forEach(function (tag) {
          var tp = tag === 'A' ? { x: st.ax, y: st.ay } : { x: st.bx, y: st.by };
          var d = Math.hypot(st.vw.X(tp.x) - x, st.vw.Y(tp.y) - y);
          if (d < bd) { bd = d; best = tag; }
        });
        st.drag = best;
      }
      function move(x, y) {
        if (!st.drag || !st.vw) return;
        var nv = { x: K.clamp(Math.round(st.vw.XI(x) * 2) / 2, -10, 10), y: K.clamp(Math.round(st.vw.YI(y) * 2) / 2, -10, 10) };
        if (st.drag === 'A') { st.ax = nv.x; st.ay = nv.y; } else { st.bx = nv.x; st.by = nv.y; }
      }
      function up() { st.drag = null; }
      function draw(ctx, W, H) {
        syncMap(W, H);
        var m = st.vw, ox = m.X(0), oy = m.Y(0), rv = Rv(), ar = areaOf(W, H);
        var rLen = Math.hypot(rv.x, rv.y), thDeg = Math.atan2(rv.y, rv.x) * 180 / PI;
        K.grid(ctx, W, H, { step: 42 });
        capTag(ctx, '矢量加法 · A ＋ B ＝ R（可拖拽端点）', 16, 12, COL.red);
        K.arrow(ctx, ar.x0, oy, ar.x1 + 6, oy, { color: 'rgba(255,255,255,0.45)', width: 1.5, head: 8 });
        K.arrow(ctx, ox, ar.y1, ox, 30, { color: 'rgba(255,255,255,0.45)', width: 1.5, head: 8 });
        [-10, -5, 5, 10].forEach(function (v) {
          K.label(ctx, String(v), m.X(v), oy + 16, { align: 'center', size: 10, color: DIM });
          K.label(ctx, String(v), ox + 12, m.Y(v), { size: 10, color: DIM });
        });
        /* 平行四边形虚线补边 + 可选分量投影 */
        K.dashLine(ctx, m.X(st.bx), m.Y(st.by), m.X(rv.x), m.Y(rv.y), { color: 'rgba(236,240,241,0.4)', dash: [7, 5], width: 1.6 });
        if (st.comp) [st.ax, st.bx].forEach(function (_, si) {
          var vx0 = si ? st.bx : st.ax, vy0 = si ? st.by : st.ay, cc = si ? COL.orange : COL.blue;
          K.dashLine(ctx, m.X(vx0), m.Y(vy0), m.X(vx0), oy, { color: K.rgba(cc, 0.55), dash: [4, 4] });
          K.dashLine(ctx, m.X(vx0), m.Y(vy0), ox, m.Y(vy0), { color: K.rgba(cc, 0.55), dash: [4, 4] });
        });
        /* 尾接头：平移 B 至 A 尖端（半透明），再画合力 R */
        K.arrow(ctx, m.X(st.ax), m.Y(st.ay), m.X(rv.x), m.Y(rv.y), { color: K.rgba(COL.orange, 0.55), width: 3, head: 11 });
        K.arrow(ctx, ox, oy, m.X(st.ax), m.Y(st.ay), { color: COL.blue, width: 3.5, head: 12 });
        K.arrow(ctx, ox, oy, m.X(st.bx), m.Y(st.by), { color: COL.orange, width: 3.5, head: 12 });
        hintDrag(ctx, '👆 拖动', m.X(st.ax), m.Y(st.ay) - 22);
        hintDrag(ctx, '👆 拖动', m.X(st.bx), m.Y(st.by) - 22);
        K.arrow(ctx, ox, oy, m.X(rv.x), m.Y(rv.y), { color: COL.red, width: 4.5, head: 13 });
        if (rLen > 0.6) { /* θ 角度弧：自 x 轴正向扫到 R 方向（取劣弧） */
          var angScr = -thDeg * PI / 180;
          ctx.save(); ctx.strokeStyle = COL.yellow; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(ox, oy, 34, 0, angScr, angScr < 0); ctx.stroke(); ctx.restore();
          K.label(ctx, 'θ=' + K.fmt(thDeg, 1) + '°', ox + 54 * Math.cos(angScr / 2), oy + 54 * Math.sin(angScr / 2), { align: 'center', size: 12, color: COL.yellow });
        }
        K.circle(ctx, ox, oy, 5, { fill: COL.white });
        /* 右侧读数面板 */
        var px = W - st.panelW - 8, py = 70;
        K.panel(ctx, px, py, st.panelW - 16, 182, { fill: 'rgba(0,0,0,0.42)', radius: 12 });
        [['|R| 模长', K.fmt(rLen, 2), COL.red], ['θ 方向角', K.fmt(thDeg, 1) + '°', COL.yellow],
         ['Rx ＝ Ax＋Bx', K.fmt(rv.x, 1), COL.red], ['Ry ＝ Ay＋By', K.fmt(rv.y, 1), COL.red]].forEach(function (rw, i) {
          K.label(ctx, rw[0], px + 14, py + 26 + i * 34, { size: 11.5, color: DIM });
          K.label(ctx, rw[1], px + st.panelW - 30, py + 26 + i * 34, { align: 'right', size: 14, weight: 'bold', color: rw[2] });
        });
        K.circle(ctx, px + st.panelW - 26, py + 166, st.drag === 'A' ? 9 : 7, { fill: COL.blue });
        K.label(ctx, '拖我', px + st.panelW - 42, py + 166, { align: 'right', size: 10.5, color: DIM });
      }
      function setV(ax, ay, bx, by) { st.ax = ax; st.ay = ay; st.bx = bx; st.by = by; st.drag = null; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var rv = Rv();
          return [
            { label: '|R| 模长', value: K.fmt(Math.hypot(rv.x, rv.y), 2), color: COL.red },
            { label: 'R 分量', value: '( ' + K.fmt(rv.x, 1) + ', ' + K.fmt(rv.y, 1) + ' )', color: COL.red },
            { label: '操作方式', value: '也可直接拖动蓝/橙箭头端点', color: DIM }
          ];
        },
        hitTest: function (x, y, W, H) {
          var r = areaOf(W, H);
          var vw = K.view({ x: [-11.5, 11.5], px: [r.x0, r.x1], y: [-9, 9], py: [r.y1, r.y0] });
          var best = null, bd = 30;
          ['A', 'B'].forEach(function (tag) {
            var tp = tag === 'A' ? { x: st.ax, y: st.ay } : { x: st.bx, y: st.by };
            var d = Math.hypot(vw.X(tp.x) - x, vw.Y(tp.y) - y);
            if (d < bd) { bd = d; best = tag; }
          });
          return best != null;
        },
        reset: function () { setV(3, 4, -2, 5); },
        presets: function () {
          return [
            { name: '垂直示例 (3,4)＋(−2,5)', apply: function () { setV(3, 4, -2, 5); } },
            { name: '同向叠加 (2,3)＋(4,6)', apply: function () { setV(2, 3, 4, 6); } },
            { name: '恰好抵消 (5,5)＋(−5,−5)', apply: function () { setV(5, 5, -5, -5); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 10 —— 矢量加法·方程 veceq
     * 等式逐项着色大字；直角坐标 ↔ 极坐标两种表达切换 + 折算公式注释。
     * ============================================================== */
    function mdVecEq() {
      var st = { ax: 4, ay: 2, bx: 1, by: 5, show: 'rc', drag: null, vw: null, panelW: 260 };
      function Rv() { return { x: st.ax + st.bx, y: st.ay + st.by }; }
      function areaOf(W, H) { return { x0: W - st.panelW + 4, x1: W - 24, y0: H - 200, y1: H - 44 }; }
      function syncMap(W, H) {
        var r = areaOf(W, H);
        st.vw = K.view({ x: [-11.5, 11.5], px: [r.x0, r.x1], y: [-9, 9], py: [r.y1, r.y0] });
      }
      /* 可拖拽矢量小图：拖 A/B 端点改分量，R ＝ A＋B 实时跟随 */
      function drawPad(ctx, W, H) {
        syncMap(W, H); var m = st.vw, r = areaOf(W, H), ox = m.X(0), oy = m.Y(0), rv = Rv();
        K.panel(ctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, { fill: 'rgba(0,0,0,0.32)', radius: 10 });
        K.label(ctx, '拖动 A/B 端点改分量', r.x0 + 12, r.y0 + 12, { size: 11, color: DIM });
        K.dashLine(ctx, r.x0, oy, r.x1, oy, { color: 'rgba(255,255,255,0.22)', dash: [4, 4] });
        K.dashLine(ctx, ox, r.y0, ox, r.y1, { color: 'rgba(255,255,255,0.22)', dash: [4, 4] });
        K.arrow(ctx, ox, oy, m.X(st.ax), m.Y(st.ay), { color: COL.blue, width: 3, head: 10 });
        K.arrow(ctx, ox, oy, m.X(st.bx), m.Y(st.by), { color: COL.orange, width: 3, head: 10 });
        K.arrow(ctx, ox, oy, m.X(rv.x), m.Y(rv.y), { color: COL.red, width: 3.5, head: 11 });
        K.circle(ctx, ox, oy, 4, { fill: COL.white });
        K.circle(ctx, m.X(st.ax), m.Y(st.ay), st.drag === 'A' ? 9 : 6, { fill: COL.blue, stroke: '#fff', lineWidth: 1.5 });
        K.circle(ctx, m.X(st.bx), m.Y(st.by), st.drag === 'B' ? 9 : 6, { fill: COL.orange, stroke: '#fff', lineWidth: 1.5 });
        hintDrag(ctx, '👆 拖动', m.X(st.ax), m.Y(st.ay) - 20);
        hintDrag(ctx, '👆 拖动', m.X(st.bx), m.Y(st.by) - 20);
      }
      function down(x, y, W, H) {
        syncMap(W, H); if (!st.vw) return;
        var best = null, bd = 22;
        ['A', 'B'].forEach(function (tag) {
          var tp = tag === 'A' ? { x: st.ax, y: st.ay } : { x: st.bx, y: st.by };
          var d = Math.hypot(st.vw.X(tp.x) - x, st.vw.Y(tp.y) - y);
          if (d < bd) { bd = d; best = tag; }
        });
        st.drag = best;
      }
      function move(x, y) {
        if (!st.drag || !st.vw) return;
        var nx = K.clamp(Math.round(st.vw.XI(x) * 2) / 2, -10, 10), ny = K.clamp(Math.round(st.vw.YI(y) * 2) / 2, -10, 10);
        if (st.drag === 'A') { st.ax = nx; st.ay = ny; } else { st.bx = nx; st.by = ny; }
      }
      function up() { st.drag = null; }
      function ctl() {
        return [
          { id: 've_ax', type: 'slider', label: 'Ax 分量', min: -10, max: 10, step: 0.5, value: st.ax, onChange: function (v) { st.ax = v; } },
          { id: 've_ay', type: 'slider', label: 'Ay 分量', min: -10, max: 10, step: 0.5, value: st.ay, onChange: function (v) { st.ay = v; } },
          { id: 've_bx', type: 'slider', label: 'Bx 分量', min: -10, max: 10, step: 0.5, value: st.bx, onChange: function (v) { st.bx = v; } },
          { id: 've_by', type: 'slider', label: 'By 分量', min: -10, max: 10, step: 0.5, value: st.by, onChange: function (v) { st.by = v; } },
          { id: 've_md', type: 'select', label: '显示形式', value: st.show,
            options: [{ value: 'rc', label: '直角坐标（分量方程）' }, { value: 'pc', label: '极坐标（模长∠方向）' }],
            onChange: function (v) { st.show = String(v); } }
        ];
      }
      function triGlyph(g, x, y, rv, S) { /* Rx-Ry-R 直角三角形分解示意 */
        K.arrow(g, x, y, x + rv.x * S, y, { color: COL.red, width: 2.2, head: 8 });
        K.arrow(g, x + rv.x * S, y, x + rv.x * S, y - rv.y * S, { color: COL.green, width: 2.2, head: 8 });
        K.arrow(g, x, y, x + rv.x * S, y - rv.y * S, { color: COL.yellow, width: 2.2, head: 8 });
        K.label(g, 'Rx', x + rv.x * S / 2, y + 14, { align: 'center', size: 11.5, color: COL.red });
        K.label(g, 'Ry', x + rv.x * S + 16, y - rv.y * S / 2, { size: 11.5, color: COL.green });
      }
      function draw(ctx, W, H, t) {
        var rv = Rv(), rLen = Math.hypot(rv.x, rv.y), th = Math.atan2(rv.y, rv.x) * 180 / PI;
        var segs = [
          { t: '(', c: DIM }, { t: 'Ax', c: COL.blue }, { t: ' ＋ ', c: DIM }, { t: 'Bx', c: COL.orange },
          { t: ' , ', c: DIM }, { t: 'Ay', c: COL.blue }, { t: ' ＋ ', c: DIM }, { t: 'By', c: COL.orange },
          { t: ' ) ＝ ( ', c: DIM }, { t: 'Rx', c: COL.red }, { t: ' , ', c: DIM }, { t: 'Ry', c: COL.red }, { t: ' )', c: DIM }
        ];
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '矢量加法 · 分量方程逐项对应', 16, 12, COL.blue);
        var cy = H * 0.38, sz = W > 900 ? 30 : 24;
        richText(ctx, segs, (W - segWidth(ctx, segs, sz)) / 2 + 44, cy, sz);
        var lx = 84;
        [['矢量 A', COL.blue], ['矢量 B', COL.orange], ['合力 R', COL.red]].forEach(function (lg) {
          lx += K.chip(ctx, lg[0], lx, cy + sz + 22, { size: 12, bg: K.rgba(lg[1], 0.22), color: lg[1] }) + 10;
        });
        /* 第二表示形式 + 折算公式注释 */
        var y2 = cy + sz + 74;
        if (st.show === 'pc') {
          K.label(ctx, '折算公式：r ＝ √( Rx² ＋ Ry² )，θ ＝ arctan( Ry / Rx )', 84, y2, { size: 13.5, color: DIM });
          ctx.save(); ctx.shadowColor = COL.yellow; ctx.shadowBlur = 6 + 4 * Math.sin(t * 5);
          K.label(ctx, 'R ＝ ' + K.fmt(rLen, 2) + ' ∠ ' + K.fmt(th, 1) + '°', 84, y2 + 44, { size: 26, weight: 'bold', color: COL.yellow });
          ctx.restore();
        } else {
          K.label(ctx, '等价极坐标：r ＝ √( ' + K.fmt(rv.x, 1) + '² ＋ ' + K.fmt(rv.y, 1) + '² ) ＝ ' + K.fmt(rLen, 2), 84, y2, { size: 14, color: DIM });
          K.label(ctx, 'θ ＝ arctan( ' + K.fmt(rv.y, 1) + ' / ' + K.fmt(rv.x, 1) + ' ) ＝ ' + K.fmt(th, 1) + '°', 84, y2 + 34, { size: 14, color: COL.yellow });
        }
        drawPad(ctx, W, H);
        K.label(ctx, '同一矢量的两种语言：分量式精确可算，极坐标直观有向。', 84, H - 34, { size: 12, color: DIM });
        function segWidth(g, sgs, s) {
          g.save(); g.font = 'bold ' + s + 'px sans-serif';
          var w = 0; sgs.forEach(function (sg) { w += g.measureText(sg.t).width; });
          g.restore(); return w;
        }
      }
      function setAll(a, b, c, d) { st.ax = a; st.ay = b; st.bx = c; st.by = d; }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          var rv = Rv();
          return [
            { label: 'Rx ／ Ry', value: K.fmt(rv.x, 1) + ' ／ ' + K.fmt(rv.y, 1), color: COL.red },
            { label: '模长 |R|', value: K.fmt(Math.hypot(rv.x, rv.y), 2), color: COL.yellow },
            { label: '方向 θ', value: K.fmt(Math.atan2(rv.y, rv.x) * 180 / PI, 1) + '°', color: COL.green }
          ];
        },
        hitTest: function (x, y, W, H) {
          var r = areaOf(W, H);
          var vw = K.view({ x: [-11.5, 11.5], px: [r.x0, r.x1], y: [-9, 9], py: [r.y1, r.y0] });
          var best = null, bd = 22;
          ['A', 'B'].forEach(function (tag) {
            var tp = tag === 'A' ? { x: st.ax, y: st.ay } : { x: st.bx, y: st.by };
            var d = Math.hypot(vw.X(tp.x) - x, vw.Y(tp.y) - y);
            if (d < bd) { bd = d; best = tag; }
          });
          return best != null;
        },
        reset: function () { setAll(4, 2, 1, 5); st.show = 'rc'; },
        presets: function () {
          return [
            { name: '钝角合力示例', apply: function () { setAll(6, -2, -3, 4); } },
            { name: '指向正北', apply: function () { setAll(0, 3, 0, 4); } },
            { name: '零矢量抵消', apply: function () { setAll(3, 3, -3, -3); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 11 —— 函数构建器 funcbuild（含基础版）
     * 输入 x 依次穿过启用的机器箱；输出管道脉冲点流动；猜谜模式隐藏
     * 输出先用预测滑块竞猜，再「揭晓判定」计连对。基础版仅 ×2/+3 单层。
     * ============================================================== */
    function mdFuncBuild() {
      var OPS = [
        { k: 'm2', lbl: '×2', tail: '×2', ap: function (v) { return v * 2; }, sq: false },
        { k: 'p3', lbl: '＋3', tail: '+3', ap: function (v) { return v + 3; }, sq: false },
        { k: 'm1', lbl: '−1', tail: '−1', ap: function (v) { return v - 1; }, sq: false },
        { k: 'sq', lbl: '平方 ^2', tail: '', ap: function (v) { return v * v; }, sq: true }
      ];
      var st = { x: 3, en: { m2: true }, guess: false, pred: 10, streak: 0, revealed: false, drag: false, _sx: 0, _sv: 0 };
      function active() { return OPS.filter(function (o) { return !!st.en[o.k]; }).slice(0, BASIC ? 1 : 2); }
      function chain() { var vs = [st.x], cur = st.x; active().forEach(function (o) { cur = o.ap(cur); vs.push(cur); }); return vs; }
      function outVal() { var vs = chain(); return vs[vs.length - 1]; }
      function exprStr() { var e = 'x'; active().forEach(function (o) { e = o.sq ? e + '²' : '(' + e + o.tail + ')'; }); return e; }
      function dirty() { st.revealed = false; }
      function toggleOp(k, on) {
        if (BASIC) { st.en.m2 = k === 'm2' && on; st.en.p3 = k === 'p3' && on; } // 基础版单层互斥
        else if (on) {
          st.en[k] = true;
          var act = active();
          if (act.length > 2) { toast('最多串联 2 层机器，已自动关闭最早的'); st.en[act[0].k] = false; }
        } else st.en[k] = false;
        dirty();
      }
      function judge() {
        if (!st.guess) { toast('先勾选「猜谜模式」再竞猜'); return; }
        var out = outVal(), hit = Math.round(out * 2) === Math.round(st.pred * 2); // 0.5 步进精确匹配
        st.revealed = true;
        if (hit) { st.streak++; toast('猜对了！输出正是 ' + K.fmt(out, 1) + ' · 连对 ' + st.streak); }
        else { st.streak = 0; toast('差一点～正确输出是 ' + K.fmt(out, 2)); }
      }
      function ctl() {
        var a = [{ id: 'fb_x', type: 'slider', label: '输入 x', min: -5, max: 5, step: 0.5, value: st.x, onChange: function (v) { st.x = v; dirty(); } }];
        OPS.forEach(function (o) { /* 基础版只提供 ×2 与 +3 两台单层机器 */
          if (BASIC && o.k !== 'm2' && o.k !== 'p3') return;
          a.push({ id: 'fb_' + o.k, type: 'checkbox', label: '机器 ' + o.lbl, value: !!st.en[o.k], onChange: function (v) { toggleOp(o.k, !!v); } });
        });
        a.push(
          { id: 'fb_gu', type: 'checkbox', label: '猜谜模式（隐藏输出先猜）', value: st.guess, onChange: function (v) { st.guess = !!v; st.revealed = false; } },
          { id: 'fb_pr', type: 'slider', label: '我的预测', min: -60, max: 60, step: 0.5, value: st.pred, onChange: function (v) { st.pred = v; dirty(); } },
          { id: 'fb_ok', type: 'button', label: '揭晓判定', action: judge }
        );
        return a;
      }
      function pipePath(g, pts, col) { for (var i = 1; i < pts.length; i++) K.dashLine(g, pts[i - 1].x + (i > 1 ? 0 : 24), pts[i - 1].y, pts[i].x - (i < pts.length - 1 ? 0 : 30), pts[i].y, { color: col, dash: [], width: 6 }); }
      function layout(W, H, act) { /* 计算 机器箱/输入/输出 节点像素位置序列 */
        var midY = H * 0.46, boxW = 108, gap = 34, total = boxW * Math.max(act.length, 1) + gap * act.length;
        var xIn = Math.max(56, (W - total) / 2 - 70), pts = [{ x: xIn, y: midY }], bx0 = xIn + 62;
        act.forEach(function (_, i) { pts.push({ x: bx0 + i * (boxW + gap) + boxW / 2, y: midY }); });
        pts.push({ x: bx0 + act.length * (boxW + gap) + 28, y: midY });
        return { midY: midY, boxW: boxW, gap: gap, xIn: xIn, bx0: bx0, pts: pts };
      }
      /* 拖动输入指针（数轴上左右滑动）改 x 值，0.5 步进 */
      function down(x, y, W, H) {
        st.drag = false; var L = layout(W, H, active());
        var d = Math.hypot(x - L.pts[0].x, y - L.pts[0].y);
        if (d < 24) { st.drag = true; st._sx = x; st._sv = st.x; }
      }
      function move(x) {
        if (!st.drag) return;
        st.x = K.clamp(Math.round((st._sv + (x - st._sx) / 30) * 2) / 2, -5, 5);
        dirty();
      }
      function up() { st.drag = false; }
      function draw(ctx, W, H, t) {
        var act = active(), vs = chain(), out = vs[vs.length - 1];
        var L = layout(W, H, act), hidden = st.guess && !st.revealed;
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, BASIC ? '函数构建器 · 基础 单层机器' : '函数构建器 · 串联机器 y＝f(g(x))', 16, 12, COL.pink);
        pipePath(ctx, L.pts, 'rgba(255,255,255,0.16)');
        /* 机器箱序列 + 中间值 */
        act.forEach(function (o, i) {
          var bx = L.bx0 + i * (L.boxW + L.gap);
          K.panel(ctx, bx, L.midY - 44, L.boxW, 88, { fill: 'rgba(155,89,182,0.22)', stroke: 'rgba(214,183,255,0.65)', lineWidth: 1.6, radius: 12 });
          K.label(ctx, o.lbl, bx + L.boxW / 2, L.midY - 12, { align: 'center', size: 21, weight: 'bold', color: TXT });
          K.label(ctx, vs[i + 1].toFixed(1), bx + L.boxW / 2, L.midY + 22, { align: 'center', size: 14, color: COL.pink });
        });
        /* 输入/输出节点 */
        K.label(ctx, '输入 x＝' + K.fmt(st.x, 1), L.pts[0].x, L.midY - 66, { size: 12.5, color: COL.sky });
        K.circle(ctx, L.pts[0].x, L.midY, st.drag ? 11 : 8, { fill: COL.sky, stroke: '#fff', lineWidth: 1.6 });
        hintDrag(ctx, '👆 拖动x', L.pts[0].x, L.midY - 40);
        K.label(ctx, 'x', L.pts[0].x, L.midY, { align: 'center', size: 11, weight: 'bold', color: '#fff' });
        var outX = L.pts[L.pts.length - 1].x;
        K.circle(ctx, outX, L.midY, 34, { fill: 'rgba(26,188,156,0.16)', stroke: COL.teal, lineWidth: 2 });
        if (hidden) K.label(ctx, '?', outX, L.midY, { align: 'center', size: 30, weight: 'bold', color: COL.teal });
        else K.label(ctx, K.fmt(out, 1), outX, L.midY, { align: 'center', size: 19, weight: 'bold', color: COL.teal });
        /* 脉冲点沿管道匀速流动 */
        var pp = (t * 0.45) % 1, segAcc = 0, posPt = L.pts[L.pts.length - 1];
        for (var si = 1; si < L.pts.length; si++) {
          var LL = Math.hypot(L.pts[si].x - L.pts[si - 1].x, L.pts[si].y - L.pts[si - 1].y);
          if (pp <= segAcc + LL) {
            var uu = LL > 0 ? (pp - segAcc) / LL : 0;
            posPt = { x: K.lerp(L.pts[si - 1].x, L.pts[si].x, uu), y: K.lerp(L.pts[si - 1].y, L.pts[si].y, uu) };
            break;
          }
          segAcc += LL;
        }
        if (!(hidden && posPt.x > outX - 20)) K.circle(ctx, posPt.x, posPt.y, 6.5, { fill: COL.yellow, stroke: '#7a5c00' });
        K.label(ctx, '表达式 y ＝ ' + exprStr() + ' （当前 x＝' + K.fmt(st.x, 1) + '）', 60, H - 58, { size: 15, weight: 'bold', color: TXT });
        K.label(ctx, '中间过程：' + vs.map(function (v) { return K.fmt(v, 1); }).join(' → '), 60, H - 32, { size: 13, color: DIM });
        if (st.guess) {
          K.chip(ctx, st.revealed ? (Math.round(out * 2) === Math.round(st.pred * 2) ? '判定：正确 ✓' : '判定：不对 ✗') : '竞猜中……', W - 208, 16, { size: 13, bg: 'rgba(241,196,15,0.2)' });
          K.label(ctx, '连对 ' + st.streak + ' 题', W - 206, 64, { size: 13, color: COL.yellow });
        }
      }
      function basicSet(k) { st.en = {}; st.en[k] = true; dirty(); }
      function multiSet(arr) { st.en = {}; arr.forEach(function (k0) { st.en[k0] = true; }); dirty(); }
      return {
        ctl: ctl, tick: function () {}, draw: draw, down: down, move: move, up: up,
        rows: function () {
          return [
            { label: '函数表达式', value: 'y ＝ ' + exprStr() + ' （x＝' + K.fmt(st.x, 1) + '）', color: COL.pink },
            { label: '最终输出 y', value: st.guess && !st.revealed ? '？？？（先猜！）' : K.fmt(outVal(), 2), color: COL.teal },
            { label: '猜谜连对', value: String(st.streak), color: COL.yellow }
          ];
        },
        hitTest: function (x, y, W, H) { var L = layout(W, H, active()); return Math.hypot(x - L.pts[0].x, y - L.pts[0].y) < 24; },
        reset: function () { st.x = 3; st.en = { m2: true }; st.streak = 0; st.revealed = false; st.pred = 10; },
        presets: function () {
          return BASIC
            ? [{ name: '单层 ×2', apply: function () { basicSet('m2'); } }, { name: '单层 +3', apply: function () { basicSet('p3'); } }]
            : [{ name: '双层 (x+3)×2', apply: function () { multiSet(['p3', 'm2']); } },
               { name: '平方流线 (x×2)²', apply: function () { multiSet(['m2', 'sq']); } },
               { name: '挑战组合 (x²−1)', apply: function () { multiSet(['sq', 'm1']); } }];
        }
      };
    }

    /* ================= 知识点文案 / 模式分派 / 实例组装 ================= */
    var KNOW = {
      eqexplor: '<p>天平的<b>平衡</b>就是等号的含义：左右两边的“结构”相同时天平水平。<b>解方程</b>即移项——把同类项搬到同侧变成 (n₁−n₂)x ＝ u₂−u₁，再两边同除以系数。“等式性质”：两边同加减、同乘除（除数≠0）不会破坏相等关系。</p>',
      eqexplorB: '<p>这是面向初学者的天平游戏：只用<b>正整数</b>的小数量。试着不断往一侧添加箱子 x 与单位块 1，直到<b>左右完全一样</b>、指针回中——你便构造了一个恒成立的等式。</p>',
      eqexplor2v: '<p>一个二元一次方程 <b>ax＋by＝c</b> 有<b>无穷多个解</b>，它们恰好排成一条直线。拖动测试点逐个代入验证：在线上的是它的解（亮绿点），偏离则不是。满足率会告诉你解“藏”在多窄的一条带上。</p>',
      exprxn: '<p><b>同类项</b>（字母部分完全相同）才能合并：x² 只和 x² 相加，x 与 x 相加，数字与数字相加。红色 = 负系数。挑战模式下先心算合并结果，再三选一作答，锻炼符号运算直觉。</p>',
      areaalg: '<p>(ax＋b)(cx＋d) 的几何意义是把大矩形切成四块：<b>x² 一块、x 两块、常数一块</b>。中间两项 ad·x 与 bc·x 自动合并为 (ad＋bc)x——这就是“十字相乘”里中间项系数的来历。</p>',
      areadec: '<p>把 0.x 看成「10 份里占 x·10 列」，0.y 占 y·10 行，<b>交叠格子数 = x·y·100</b>。例：0.3×0.2＝0.06，正好铺 6 个百分之一格——直观感受“乘小数反而变小”。</p>',
      areamult: '<p>两位数乘法的<b>部分积</b>拆分：如 23×45 可切成四块 800／100／120／15，相加即得总积 935。右侧竖式的每一行其实都是这样一块“面积”。</p>',
      areaintro: '<p>矩形的面积就是<b>一行一行数格子</b>的结果：每行有 长 w 格，共 h 行，所以 面积＝长×宽。观察黄色扫描格逐个点亮的过程即是计数演示。</p>',
      vecadd: '<p>矢量相加遵守<b>三角形法则</b>（尾接头）：把 B 平移到 A 的终点，从原点指向 B 新终点的矢量即 A+B；也可画<b>平行四边形</b>——对角线即合力。分量式 Rx＝Ax+Bx、Ry＝Ay+By 最方便计算模长与角度。</p>',
      veceq: '<p>同一个矢量可以写成<b>分量式</b> (Rx, Ry)，也能写成<b>极坐标</b> r∠θ：换算用 r＝√(Rx²＋Ry²)、θ＝arctan(Ry/Rx)。逐项着色帮你把方程里的每个数和图上颜色一一对应。</p>',
      funcbuild: '<p>函数就是把输入<b>一步步加工</b>成输出的机器。串联两层时注意<b>顺序敏感</b>：先 ×2 再 +3 得 2x+3，先 +3 再 ×2 却得 2(x+3)。猜谜模式训练你对复合函数的心算能力。</p>'
    };
    var MODES = {
      eqexplor: function () { return mdEq(false); },
      eqexplorB: function () { return mdEq(true); },
      eqexplor2v: mdEq2v, exprxn: mdExprxn, areaalg: mdAreaAlg,
      areadec: mdAreaDec, areamult: mdAreaMult, areaintro: mdAreaIntro,
      vecadd: mdVecAdd, veceq: mdVecEq, funcbuild: mdFuncBuild
    };
    var modeKey = cfg && (cfg.mode || cfg.id) ? String(cfg.mode || cfg.id) : 'eqexplor';
    if (!MODES[modeKey]) modeKey = 'eqexplor';
    var M = null, lastW = 820, lastH = 480, cache = '';
    function dtGuard(dt) { if (!(dt > 0) || !isFinite(dt)) return 0; return dt > 0.05 ? 0.05 : dt; }
    function pushData(force) { /* 数据卡缓存：内容未变化时不刷新 DOM */
      if (!M || !LOADER || !LOADER.updateDataDisplay) return;
      try {
        var arr = M.rows ? M.rows() : [];
        var key = JSON.stringify(arr);
        if (force || key !== cache) { cache = key; LOADER.updateDataDisplay(arr); }
      } catch (e) { /* 数据行异常不阻塞主循环 */ }
    }
    var inst = {
      init: function (loader) {
        LOADER = loader;
        M = MODES[modeKey]();
        loader.setKnowledge(KNOW[modeKey] || '<p>动手探索代数的规律。</p>');
        loader.setPresets(M.presets ? M.presets() : []);
        pushData(true);
      },
      getControls: function () { /* 每次返回携带当前值的新数组 */
        if (!M || !M.ctl) return [];
        try { return M.ctl(); } catch (e) { console.error('[algebra:' + modeKey + '] ctl 异常', e); return []; }
      },
      update: function (dt, t) {
        if (!M) return;
        try { M.tick(dtGuard(dt), t); } catch (err) { console.error('[algebra:' + modeKey + '] tick 异常', err); }
        pushData(false);
      },
      render: function (ctx, W, H, t) {
        lastW = W; lastH = H;
        K.background(ctx, W, H);
        if (!M) return;
        try { M.draw(ctx, W, H, t); } catch (err) { console.error('[algebra:' + modeKey + '] draw 异常', err); }
      },
      reset: function () {
        cache = '';
        if (!M) return;
        try { M.reset(); } catch (err) { console.error('[algebra:' + modeKey + '] reset 异常', err); }
        pushData(true);
      }
    };
    inst.onPointerDown = function (x, y, ev) { if (M && M.down) { try { M.down(x, y, lastW, lastH, ev); } catch (err) { console.error(err); } } };
    inst.onPointerMove = function (x, y, ev) { if (M && M.move) { try { M.move(x, y, lastW, lastH, ev); } catch (err) { console.error(err); } } };
    inst.onPointerUp = function (x, y, ev) { if (M && M.up) { try { M.up(x, y, lastW, lastH, ev); } catch (err) { console.error(err); } } };
    inst.hitTest = function (x, y) { if (!M || typeof M.hitTest !== 'function') return false; try { return !!M.hitTest(x, y, lastW, lastH); } catch (err) { return false; } };
    inst.onResize = function () { /* 几何逐帧由 W/H 重算 */ };
    return inst;
  }
});
