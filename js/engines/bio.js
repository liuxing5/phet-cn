/**
 * 生物引擎（仿 PhET 中文平台 · 生物篇）
 * 注册名 'bio'，按 cfg.mode 分支支持 4 种模式：
 *   naturalselection 自然选择        genexp   基因表达基础
 *   neuron           神经元          membrane 膜运输
 * 依赖加载顺序：window.Kit → window.EngineRegistry。
 * 本文件顶层只注册工厂，绝不触碰 document；DOM 全部延迟到方法内。
 */
window.EngineRegistry.register('bio', {
  create(cfg) {
    var K = window.Kit, COL = K.COLORS, PI = Math.PI;
    var TXT = '#f2f5fa', DIM = 'rgba(255,255,255,0.55)';
    var LOADER = null;
    function toast(m) { if (LOADER && LOADER.showToast) LOADER.showToast(String(m)); }
    /* 左上角中文标题胶囊 */
    function capTag(ctx, txt, x, y, c) {
      K.chip(ctx, txt, x, y, { size: 13, color: c || TXT, bg: 'rgba(0,0,0,0.32)', pad: 7 });
    }
    /* '#rrggbb' → [r,g,b]（供色差ΔE计算） */
    function hexRGB(h) {
      var m = /^#?([0-9a-fA-F]{6})$/.exec(String(h || ''));
      return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [128, 128, 128];
    }
    function dtGuard(dt) { if (!(dt > 0) || !isFinite(dt)) return 0; return dt > 0.05 ? 0.05 : dt; }
    /* 可拖拽元素提示标签（只读绘制，不改变任何状态） */
    function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var w=ctx.measureText(text).width+12; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-w/2, y-11, w, 22); ctx.fillStyle='#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }
    var _mb = window.Mobile || null;
    function mbCount(n) { return (_mb && _mb.reduceParticleCount) ? _mb.reduceParticleCount(n) : n; }

    /* ================================================================
     * 模式 1 —— 自然选择 naturalselection
     * 兔群毛色(白/棕)与环境底色的 RGB 色差决定被捕食概率；
     * 草量控制环境容纳量、狼群数量控制猎捕压；每代记录毛色占比，
     * 右上角迷你堆叠面积图呈现"自然选择方向性改变种群色比"。
     * ============================================================== */
    function mdNat() {
      var MAX = mbCount(120), INIT = mbCount(10), GEN_T = 6, SEED = 20260827, FUR = { w: '#fdfdfd', b: '#a9744f' };
      var ENVS = [{ k: 'sand', label: '沙漠（沙黄）', col: '#dcc27e' }, { k: 'grass', label: '草原（草绿）', col: '#4f9450' }, { k: 'snow', label: '雪原（雪白）', col: '#eaf2f8' }];
      var st = { ratio: 0.4, food: 0.6, wolvesN: 0, bonus: 0, env: 'grass', season: '夏', rb: [], wf: [], accB: 0, accC: 0, genAcc: 0, feed: 0, hist: [], sunFx: 0.895, sunFy: 0.13, drag: null, dragged: null };
      var R = K.rng(SEED), wvHuntAcc = 0;
      function envOf() { for (var i = 0; i < ENVS.length; i++) if (ENVS[i].k === st.env) return ENVS[i]; return ENVS[1]; }
      function place() { return { fx: 0.03 + R() * 0.94, fy: R(), ph: R() * PI * 2 }; }
      function newRabbit(fur) { var p = place(); p.fur = fur; return p; }
      function buildPop() { st.rb = []; for (var i = 0; i < INIT; i++) st.rb.push(newRabbit(R() < st.ratio ? 'w' : 'b')); syncWolves(); }
      function syncWolves() { var n = Math.min(8, st.wolvesN + st.bonus); while (st.wf.length < n) st.wf.push({ fx: R(), fy: R(), dir: R() < 0.5 ? -1 : 1, spd: 0.04 + R() * 0.05 }); if (st.wf.length > n) st.wf.length = n; }
      function reshuffle() { st.rb.forEach(function (r0) { r0.fur = R() < st.ratio ? 'w' : 'b'; }); } // 初始比例滑块即时重塑种群
      function shares() { var w = 0; st.rb.forEach(function (r0) { if (r0.fur === 'w') w++; }); return { w: w / Math.max(st.rb.length, 1), brown: 1 - w / Math.max(st.rb.length, 1) }; }
      function visib(fur, envCol) { var a = hexRGB(FUR[fur]), b0 = hexRGB(envCol); return K.clamp(Math.hypot(a[0] - b0[0], a[1] - b0[1], a[2] - b0[2]) / 441, 0, 1); } /* RGB 色差→显眼度 */
      function rpos(r0, ri, W, H, gTop) { /* 兔子屏幕坐标：被拖动过的用 px/py 覆盖，否则按网格布局 */
        if (r0.px != null) return { x: r0.px, y: r0.py };
        return { x: 46 + r0.fx * (W - 140), y: gTop + 22 + ((Math.floor(ri / 7) * 31 + (ri % 7) * 41) % Math.max(H - gTop - 46, 40)) };
      }
      function tick(dt) {
        dt = dtGuard(dt);
        var eCol = envOf().col, N = st.rb.length, totW = st.wolvesN + st.bonus;
        st.feed = Math.max(0, st.feed - dt * 0.06);
        st.genAcc += dt; if (st.genAcc >= GEN_T) { st.genAcc -= GEN_T; st.hist.push(shares()); if (st.hist.length > 60) st.hist.shift(); }
        var foodEff = K.clamp(st.food * (st.season === '冬' ? 0.45 : 1) + st.feed, 0, 1.25), Kc = Math.round(24 + 86 * foodEff);
        if (!isFinite(st.accB)) st.accB = 0;
        st.accB += dt * 2.0 * foodEff * Math.max(0, 1 - N / Kc);   // 繁殖：出生率∝食物×(1−拥挤度)，幼崽继承亲代毛色（6% 突变）
        while (st.accB >= 1 && st.rb.length < MAX) { st.accB -= 1;
          var pa = st.rb[Math.floor(R() * st.rb.length)], f0 = pa ? pa.fur : (R() < 0.5 ? 'w' : 'b');
          if (R() < 0.06) f0 = f0 === 'w' ? 'b' : 'w';
          st.rb.push(newRabbit(f0));
        }
        if (!isFinite(st.accC)) st.accC = 0;   // 拥挤死亡
        if (st.rb.length > Kc) { st.accC += dt * (st.rb.length - Kc) * 0.08; while (st.accC >= 1 && st.rb.length > 4) { st.accC -= 1; st.rb.splice(Math.floor(R() * st.rb.length), 1); } }
        st.wf.forEach(function (wv) { wv.fx += wv.dir * wv.spd * dt; if (wv.fx > 0.96 || wv.fx < 0.04) wv.dir *= -1; });
        if (!isFinite(wvHuntAcc)) wvHuntAcc = 0;
        wvHuntAcc += dt * 0.55 * totW;   // 狼群猎捕：三次抽样取最显眼者 → 选择压力指向融入背景的毛色
        while (wvHuntAcc >= 1 && st.rb.length > 2) {
          wvHuntAcc -= 1;
          var bestI = -1, bestV = -1, s, ci, v0;
          for (s = 0; s < 3 && st.rb.length; s++) { ci = Math.floor(R() * st.rb.length); v0 = visib(st.rb[ci].fur, eCol); if (v0 > bestV) { bestV = v0; bestI = ci; } }
          if (bestI >= 0 && R() < 0.35 + 0.65 * bestV) st.rb.splice(bestI, 1);
        }
      }
      function ctl() {
        return [
          { id: 'ns_ratio', type: 'slider', label: '初始白兔比例', min: 0, max: 1, step: 0.05, value: st.ratio, onChange: function (v) { st.ratio = v; reshuffle(); } },
          { id: 'ns_food', type: 'slider', label: '食物·草量丰度', min: 0, max: 1, step: 0.05, value: st.food, onChange: function (v) { st.food = v; } },
          { id: 'ns_wolf', type: 'slider', label: '狼群数量', min: 0, max: 6, step: 1, value: st.wolvesN, onChange: function (v) { st.wolvesN = Math.round(v); syncWolves(); } },
          { id: 'ns_env', type: 'select', label: '环境背景', value: st.env, options: ENVS.map(function (e0) { return { value: e0.k, label: e0.label }; }), onChange: function (v) { st.env = String(v); } },
          { id: 'ns_sea', type: 'select', label: '季节（影响草再生）', value: st.season, options: [{ value: '夏', label: '夏季' }, { value: '冬', label: '冬季' }], onChange: function (v) { st.season = String(v); } },
          { id: 'ns_feed', type: 'button', label: '投喂一次（+草）', action: function () { st.feed = Math.min(1.2, st.feed + 0.35); toast('草量临时提升'); } },
          { id: 'ns_addw', type: 'button', label: '加入一头狼', action: function () { if (st.bonus < 8) { st.bonus++; syncWolves(); toast('一头新狼加入了草原'); } } }
        ];
      }
      function rabbit(ctx, x, y, fur, t, ph) { /* 简笔兔：身圆 + 双耳 + 眼 */
        var bob = Math.sin(t * 3 + ph) * 1.8, fc = FUR[fur];
        K.circle(ctx, x, y + bob, 5.4, { fill: fc, stroke: 'rgba(0,0,0,0.28)', lineWidth: 1 });
        ctx.fillStyle = fc;
        [-3.2, 2.6].forEach(function (d0) {
          ctx.beginPath(); ctx.moveTo(x + d0 - 2, y + bob - 3); ctx.lineTo(x + d0, y + bob - 12 - Math.abs(d0) * 0.4); ctx.lineTo(x + d0 + 2.4, y + bob - 3); ctx.closePath(); ctx.fill();
        });
        K.circle(ctx, x + 3.4, y + bob - 1.6, 1, { fill: '#333333' });
      }
      function draw(ctx, W, H, t) {
        var eCol = envOf().col, gTop = H * 0.44, sky, gd;
        sky = ctx.createLinearGradient(0, 0, 0, gTop); sky.addColorStop(0, '#4aa3df'); sky.addColorStop(1, '#bfe3ff');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gTop);
        var sunX = W * st.sunFx, sunY = H * st.sunFy;
        K.circle(ctx, sunX, sunY, 26, { fill: COL.yellow, stroke: '#fff3b0', lineWidth: 3 });
        if (st.drag === 'sun') K.circle(ctx, sunX, sunY, 32, { stroke: '#ffffff', lineWidth: 2 });   // 拖拽太阳高亮
        hintDrag(ctx, '👆 拖动太阳', sunX, sunY - 40);
        ctx.fillStyle = eCol; ctx.fillRect(0, gTop, W, H - gTop);
        gd = ctx.createLinearGradient(0, gTop, 0, H); gd.addColorStop(0, eCol); gd.addColorStop(1, 'rgba(0,0,0,0.42)');
        ctx.fillStyle = gd; ctx.fillRect(0, gTop, W, H - gTop);
        if (st.season === '冬') { ctx.fillStyle = 'rgba(234,242,248,0.30)'; ctx.fillRect(0, gTop, W, H - gTop); }
        capTag(ctx, '自然选择 · 伪装与适应', 16, 12, COL.green);
        K.chip(ctx, '环境：' + envOf().label.slice(0, 2) + '　Gen ' + (st.hist.length + 1), W / 2 - 66, 14, { size: 12, bg: 'rgba(0,0,0,0.35)' });
        st.wf.forEach(function (wv, wi) { /* 狼群 */
          var wx = 40 + wv.fx * (W - 120), wy = gTop + (H - gTop) * (0.18 + (wi % 3) * 0.26), d0 = wv.dir;
          ctx.fillStyle = '#5d6470';
          ctx.beginPath(); ctx.ellipse(wx, wy, 11, 6.5, 0, 0, PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(wx - d0 * 10, wy - 1); ctx.lineTo(wx - d0 * 17, wy - 5); ctx.lineTo(wx - d0 * 9, wy - 4); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(wx + d0 * 8, wy - 5); ctx.lineTo(wx + d0 * 13, wy - 9); ctx.lineTo(wx + d0 * 6, wy - 9); ctx.closePath(); ctx.fill();
        });
        st.rb.slice(0, 100).forEach(function (r0, ri) { /* 兔群（上限视觉截断提示） */
          var p = rpos(r0, ri, W, H, gTop);
          /* 朝太阳反方向的地面投影，使光照角度变化可见 */
          var sdx = p.x - sunX, sdy = p.y - sunY, sdl = Math.hypot(sdx, sdy) || 1;
          ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath(); ctx.ellipse(p.x + sdx / sdl * 7, p.y + 6 + sdy / sdl * 2, 6.5, 2.4, Math.atan2(sdy, sdx), 0, PI * 2); ctx.fill(); ctx.restore();
          rabbit(ctx, p.x, p.y, r0.fur, t, r0.ph);
          if (st.dragged === r0) K.circle(ctx, p.x, p.y - 2, 9, { stroke: COL.yellow, lineWidth: 2 });   // 选中兔子高亮
        });
        if (st.rb.length > 100) K.chip(ctx, '+' + (st.rb.length - 100) + ' 只…', 20, H - 34, { size: 12, bg: 'rgba(0,0,0,0.4)' });
        if (st.rb.length) { var p0 = rpos(st.rb[0], 0, W, H, gTop); hintDrag(ctx, '👆 拖动兔子', p0.x, p0.y - 18); }
        /* 迷你堆叠面积图：世代 × 白/棕占比 */
        var cx0 = W - 216, cy0 = 58, cw = 188, chh = 86, n = st.hist.length;
        K.panel(ctx, cx0, cy0, cw, chh + 20, { fill: 'rgba(0,0,0,0.45)', radius: 10 }); K.label(ctx, '世代毛色占比演变', cx0 + cw / 2, cy0 + 11, { align: 'center', size: 11.5, color: DIM });
        if (n >= 2) {
          var ptsA = [], ptsB = [], hi;
          for (hi = 0; hi < n; hi++) { var px = cx0 + 8 + (cw - 16) * hi / (n - 1), py = cy0 + 18 + chh - 2; ptsA.push({ x: px, y: py - (chh - 12) * st.hist[hi].w }); ptsB.push({ x: px, y: py }); }
          var polyW = ptsA.slice(); polyW.push({ x: cx0 + cw - 8, y: cy0 + chh + 16 }, { x: cx0 + 8, y: cy0 + chh + 16 });
          K.polyline(ctx, polyW, { color: COL.white, width: 1, closed: true, fill: 'rgba(255,255,255,0.75)' });
          K.polyline(ctx, ptsA.concat(ptsB.slice().reverse()), { color: FUR.b, width: 1, closed: true, fill: 'rgba(169,116,79,0.85)' });
        } else K.label(ctx, '累计满 2 个世代后绘出…', cx0 + cw / 2, cy0 + chh / 2 + 8, { align: 'center', size: 11, color: DIM });
      }
      return {
        ctl: ctl, tick: tick, draw: draw,
        rows: function () {
          var sh = shares();
          return [
            { label: '兔子总数（上限 ' + MAX + '）', value: String(st.rb.length), color: COL.green }, { label: '白兔占比', value: (sh.w * 100).toFixed(0) + '%', color: COL.white },
            { label: '棕兔占比', value: (sh.brown * 100).toFixed(0) + '%', color: FUR.b }, { label: '世代数 Gen', value: String(st.hist.length + 1), color: COL.sky }
          ];
        },
        reset: function () { R = K.rng(SEED); wvHuntAcc = 0; st.bonus = 0; st.feed = 0; st.accB = 0; st.accC = 0; st.genAcc = 0; st.hist = []; st.wf = []; st.drag = null; st.dragged = null; buildPop(); },
        hitTest: function (x, y, W, H) {
          var gTop = H * 0.44, sunX = W * st.sunFx, sunY = H * st.sunFy;
          if (Math.hypot(x - sunX, y - sunY) < 32) return true;
          for (var i = 0; i < st.rb.length; i++) {
            var p = rpos(st.rb[i], i, W, H, gTop);
            if (Math.hypot(x - p.x, y - p.y) < 16) return true;
          }
          return false;
        },
        /* —— 拖拽交互：拖动太阳改变光照角度；点击并拖动兔子到新位置 —— */
        down: function (x, y, W, H, ev) {
          var gTop = H * 0.44, sunX = W * st.sunFx, sunY = H * st.sunFy;
          if (Math.hypot(x - sunX, y - sunY) < 32) { st.drag = 'sun'; return; }
          for (var i = 0; i < st.rb.length; i++) {
            var p = rpos(st.rb[i], i, W, H, gTop);
            if (Math.hypot(x - p.x, y - p.y) < 16) { st.drag = i; st.dragged = st.rb[i]; return; }
          }
        },
        move: function (x, y, W, H, ev) {
          if (st.drag === 'sun') { st.sunFx = K.clamp(x / W, 0.05, 0.97); st.sunFy = K.clamp(y / H, 0.05, 0.40); return; }
          if (!st.dragged) return;
          st.dragged.px = K.clamp(x, 24, W - 24);
          st.dragged.py = K.clamp(y, H * 0.44 + 8, H - 14);
        },
        up: function (x, y, W, H, ev) { st.drag = null; st.dragged = null; },
        presets: function () {
          return [
            { name: '经典伪装局', apply: function () { setAll('grass', 0.5, 0); } },
            { name: '雪原漂变', apply: function () { setAll('snow', 0.15, 0); } }, { name: '沙漠猎杀', apply: function () { setAll('sand', 0.45, 3); } }
          ];
        }
      };
      function setAll(env, ratio, wolves) { st.env = env; st.ratio = ratio; st.wolvesN = wolves; st.season = '夏'; reset(); }
    }

    /* ================================================================
     * 模式 2 —— 基因表达基础 genexp
     * 中心法则流水线：DNA → RNA聚合酶转录 → mRNA(AUGC 流动字母) →
     * 核糖体按密码子表翻译成串珠多肽；阻遏蛋白勾选后转录减半，
     * 达到阈值 aa 数即点亮「色素 / 酶」表现型 chips。
     * ============================================================== */
    function mdGeneExp() {
      var GENE = 54, THRESH = 10;
      var TABLE = { UUU: '#f39c12', UUC: '#f39c12', UUA: '#e67e22', UUG: '#e67e22', CUU: '#e67e22', CUC: '#e67e22', CUA: '#e67e22', CUG: '#e67e22', AUG: '#e74c3c', UAA: '#95a5a6' }; // 简表：密码子→串珠色（UAA 终止；表外用通用灰蓝）
      var CODES = ['A', 'U', 'G', 'C'];
      var st = { rate: 6, speed: 1, rep: false, trF: 0, mrna: '', riboAcc: 0, consumed: 0, beads: [], done: false, ema: 0, drag: false };
      var R = K.rng(88121003), FS = (window.Mobile && Mobile.frameScale != null) ? Mobile.frameScale : 1;
      function tick(dt) {
        dt = dtGuard(dt);
        var dts = dt * st.speed * FS, eff = st.rate * dts * (st.rep ? 0.5 : 1);
        if (!isFinite(eff)) eff = 0;
        st.trF = Math.min(GENE, st.trF + eff);
        while (st.mrna.length < Math.floor(st.trF)) st.mrna += CODES[Math.floor(R() * 4)];
        var avail = Math.floor(st.mrna.length / 3) - st.consumed;
        if (!isFinite(st.riboAcc)) st.riboAcc = 0;
        if (!st.done) st.riboAcc += dts * 2.2;
        var grew = 0;
        while (st.riboAcc >= 1 && avail > 0 && !st.done) {
          st.riboAcc -= 1; avail--; st.consumed++; grew++;
          var cs = st.mrna.substr((st.consumed - 1) * 3, 3);
          if (cs === 'UAA') { st.done = true; break; }   // 终止密码子封链
          st.beads.push(TABLE[cs] || '#aab2bd');
        }
        var instRate = dt > 0 ? grew / dt : 0; if (!isFinite(instRate)) instRate = 0;
        if (!isFinite(st.ema)) st.ema = 0;
        st.ema = st.ema * 0.93 + instRate * 0.07;
      }
      function ctl() {
        return [
          { id: 'ge_rate', type: 'slider', label: 'RNA 聚合酶转录速率', min: 2, max: 12, step: 1, value: st.rate, unit: ' nt/s', onChange: function (v) { st.rate = Math.round(v); } },
          { id: 'ge_speed', type: 'slider', label: '全局反应速率', min: 0.2, max: 3, step: 0.1, value: st.speed, unit: '×', onChange: function (v) { st.speed = v; } },
          { id: 'ge_rep', type: 'checkbox', label: '阻遏蛋白（抑制转录）', value: st.rep, onChange: function (v) { st.rep = !!v; toast(st.rep ? '阻遏蛋白已结合启动子，转录速率减半' : '阻遏解除'); } }
        ];
      }
      function draw(ctx, W, H, t) {
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '基因表达 · 中心法则流水线', 16, 12, COL.pink);
        var dnaX0 = 76, dnaX1 = W * 0.34, dnaY = H * 0.42, amp = 15;
        /* DNA 双螺旋简画 + 梯级横档 */
        ['#ff9ff3', '#48dbfb'].forEach(function (cc, si) {
          ctx.strokeStyle = cc; ctx.lineWidth = 2.4; ctx.beginPath();
          for (var xx = dnaX0; xx <= dnaX1; xx += 3) { var yy = dnaY + Math.sin(xx / 24 + si * PI + t * 1.2) * amp; xx === dnaX0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); }
          ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.30)'; ctx.lineWidth = 1.6;
        for (var rx = dnaX0 + 8; rx < dnaX1 - 4; rx += 17) {
          var ya = dnaY + Math.sin(rx / 24 + t * 1.2) * amp, yb = dnaY + Math.sin(rx / 24 + PI + t * 1.2) * amp;
          ctx.beginPath(); ctx.moveTo(rx, ya); ctx.lineTo(rx, yb); ctx.stroke();
        }
        K.chip(ctx, 'DNA', dnaX0 - 4, dnaY - amp - 34, { size: 12, bg: 'rgba(255,159,243,0.25)' });
        K.chip(ctx, '启动子', dnaX0 + 18, dnaY + amp + 12, { size: 10.5, bg: 'rgba(241,196,15,0.28)' });
        /* RNA 聚合酶楔形沿基因推进 */
        var prog = st.trF / GENE, polX = dnaX0 + 30 + prog * (dnaX1 - dnaX0 - 60);
        ctx.fillStyle = 'rgba(155,89,182,0.92)';
        ctx.beginPath(); ctx.moveTo(polX - 16, dnaY - 26); ctx.lineTo(polX + 14, dnaY); ctx.lineTo(polX - 16, dnaY + 26); ctx.closePath(); ctx.fill();
        K.label(ctx, '聚合酶', polX - 8, dnaY - 38, { size: 11.5, color: '#d9b8ff', align: 'center' });
        if (st.drag) K.circle(ctx, polX, dnaY, 22, { stroke: COL.yellow, lineWidth: 2 });   // 拖拽聚合酶高亮
        hintDrag(ctx, '👆 拖动聚合酶', polX, dnaY - 56);
        if (st.rep) { /* 阻遏蛋白：紫色团块扣在启动子上，脉动描边 */
          var prX = dnaX0 + 40;
          K.circle(ctx, prX, dnaY, 15, { fill: 'rgba(108,52,131,0.95)', stroke: 'rgba(214,120,255,' + (0.4 + 0.35 * Math.sin(t * 5)).toFixed(2) + ')', lineWidth: 2 });
          K.label(ctx, '阻遏蛋白', prX, dnaY + 26, { align: 'center', size: 10.5, color: '#d6a2f2' });
        }
        /* mRNA 字母流带（正弦起伏，末位碱基高亮） */
        var mx0 = W * 0.38, mw = W * 0.52, myy = H * 0.26, tail = st.mrna.slice(-22);
        K.panel(ctx, mx0 - 14, myy - 32, mw + 28, 64, { fill: 'rgba(0,0,0,0.42)', radius: 10 });
        K.chip(ctx, 'mRNA ' + st.mrna.length + ' / ' + GENE + ' nt', mx0 - 6, myy - 56, { size: 11.5, bg: 'rgba(72,219,251,0.22)' });
        ctx.save(); ctx.font = 'bold 17px monospace';
        for (var li = 0; li < tail.length; li++) {
          var lx = mx0 + li * 19, lyy = myy + Math.sin(t * 4 + li * 0.55) * 3.4;
          ctx.fillStyle = li === tail.length - 1 ? COL.yellow : '#7fdcff';
          ctx.fillText(tail.charAt(li), lx, lyy);
        }
        ctx.restore();
        /* 核糖体 + 多肽串珠弧线 */
        var ribX = mx0 + 44, ribY = myy + 118, bx = ribX + 34;
        K.circle(ctx, ribX, ribY, 25, { fill: 'rgba(149,165,166,0.9)', stroke: '#ecf0f1', lineWidth: 2 });
        K.dashLine(ctx, ribX - 18, ribY + 4, ribX + 18, ribY + 4, { color: 'rgba(45,52,54,0.55)', dash: [], width: 2 });
        K.label(ctx, '核糖体', ribX, ribY + 42, { align: 'center', size: 11.5, color: DIM });
        st.beads.slice(-18).forEach(function (bc, bi) {
          K.circle(ctx, bx + bi * 21, ribY - Math.sin(bi * 0.5 + t * 2) * 9, 7, { fill: bc, stroke: 'rgba(0,0,0,0.35)', lineWidth: 1 });
        });
        if (st.beads.length > 18) K.label(ctx, '+' + (st.beads.length - 18), bx + 18 * 21 + 8, ribY, { size: 11, color: DIM });
        /* 表现型阈值 chips */
        var reached = st.beads.length >= THRESH, pa = 0.5 + 0.5 * Math.sin(t * 5);
        if (reached) {
          K.chip(ctx, '色素 表达 ✓', W * 0.40, H - 74, { size: 13, bg: 'rgba(26,188,156,' + pa.toFixed(2) + ')' });
          K.chip(ctx, '酶活性 ✓', W * 0.40 + 110, H - 74, { size: 13, bg: 'rgba(241,196,15,' + pa.toFixed(2) + ')', color: '#5c4a00' });
        }
        K.label(ctx, reached ? '蛋白质产物达标 → 细胞表现型改变！' : '正在积累氨基酸链… (' + st.beads.length + '/' + THRESH + ')', W * 0.40, H - 44, { size: 12.5, color: reached ? COL.teal : DIM });
      }
      return {
        ctl: ctl, tick: tick, draw: draw,
        rows: function () {
          return [
            { label: 'mRNA 长度', value: st.mrna.length + ' / ' + GENE, unit: ' nt', color: COL.sky }, { label: '多肽链', value: String(st.beads.length), unit: ' 个氨基酸', color: COL.yellow },
            { label: '表达速率', value: K.fmt(st.ema, 2), unit: ' aa/s', color: COL.pink }, { label: '表现型状态', value: st.beads.length >= THRESH ? '达标（色素+酶）' : '积累中', color: st.beads.length >= THRESH ? COL.teal : DIM }
          ];
        },
        reset: function () { R = K.rng(88121003); st.trF = 0; st.mrna = ''; st.consumed = 0; st.beads = []; st.done = false; st.riboAcc = 0; st.ema = 0; st.drag = false; },
        hitTest: function (x, y, W, H) {
          var dnaX0 = 76, dnaX1 = W * 0.34, dnaY = H * 0.42;
          var polX = dnaX0 + 30 + (st.trF / GENE) * (dnaX1 - dnaX0 - 60);
          return Math.abs(x - polX) < 26 && Math.abs(y - dnaY) < 30;
        },
        /* —— 拖拽交互：拖动 RNA 聚合酶在 DNA 上的位置（滑动转录起始点）—— */
        down: function (x, y, W, H, ev) {
          var dnaX0 = 76, dnaX1 = W * 0.34, dnaY = H * 0.42;
          var polX = dnaX0 + 30 + (st.trF / GENE) * (dnaX1 - dnaX0 - 60);
          if (Math.abs(x - polX) < 26 && Math.abs(y - dnaY) < 30) st.drag = true;
        },
        move: function (x, y, W, H, ev) {
          if (!st.drag) return;
          var dnaX0 = 76, dnaX1 = W * 0.34;
          var prog = K.clamp((x - dnaX0 - 30) / (dnaX1 - dnaX0 - 60), 0, 1);
          var newTrF = prog * GENE;
          if (newTrF < st.trF) {   // 回拖：截断已转录 mRNA 与已翻译串珠
            st.trF = newTrF;
            st.mrna = st.mrna.slice(0, Math.floor(newTrF));
            st.consumed = Math.min(st.consumed, Math.floor(st.mrna.length / 3));
            st.beads = st.beads.slice(0, st.consumed);
            st.done = false;
          } else { st.trF = newTrF; }
        },
        up: function (x, y, W, H, ev) { st.drag = false; },
        presets: function () {
          return [
            { name: '高表达马拉松', apply: function () { st.rate = 12; st.speed = 3; st.rep = false; } },
            { name: '阻遏观察抑制', apply: function () { st.rep = true; st.rate = 6; st.speed = 1; } }, { name: '慢速精读', apply: function () { st.rate = 3; st.speed = 0.4; st.rep = false; } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 3 —— 神经元 neuron
     * 轴突 + 髓鞘节段；弱刺激 +13mV、强刺激越阈触发动作电位并沿轴突
     * 传播点亮郎飞氏结；不应期 200ms；外接 K⁺ 浓度移动静息基线；
     * 左下示波器滚动描绘膜电位轨迹（V′=−(V−rest)/τ 积分）。
     * ============================================================== */
    function mdNeuron() {
      var REST_OF = function (k) { return -90 + K.clamp(k - 2, 0, 8) / 8 * 40; }; // K⁺ 2→−90mV, 10→−50mV
      var THR = -55, TAU = 0.09, DUR = 0.09, REFR = 0.2, BUF_N = mbCount(200), NODES = mbCount(7);
      var st = { k: 6, V: -70, buf: [], ap: null, refr: 0, waves: [], apCount: 0, hintT: 0, stimFrac: 0, drag: false };
      var rest = REST_OF(st.k);
      function profile(p) { if (p < 0.25) return K.lerp(rest, 42, p / 0.25); if (p < 0.55) return K.lerp(42, -78, (p - 0.25) / 0.3); return K.lerp(-78, rest, (p - 0.55) / 0.45); } /* 动作电位规范波形 */
      function fire() { st.ap = { p: 0 }; st.waves.push({ x: st.stimFrac }); st.apCount++; }   /* 动作电位从刺激点位置发起 */
      function weak() { st.V += 13; toast('弱刺激：膜电位去极化 +13 mV'); }
      function strong() {
        if (st.refr > 0) { st.hintT = 0.6; toast('正处于【不应期】，刺激无效！'); return; }
        fire(); toast('强刺激越过阈值 → 动作电位爆发！');
      }
      function tick(dt) {
        dt = dtGuard(dt);
        rest = REST_OF(st.k);
        st.V += (-(st.V - rest) / TAU) * dt;
        if (st.hintT > 0) st.hintT -= dt; if (st.refr > 0) st.refr -= dt;
        if (st.ap) {
          st.ap.p += dt / DUR;
          st.V = profile(Math.min(1, st.ap.p));
          if (st.ap.p >= 1) { st.ap = null; st.refr = REFR; }
        } else if (st.V >= THR) fire();
        for (var i = st.waves.length - 1; i >= 0; i--) { st.waves[i].x += dt / 0.12; if (st.waves[i].x > 1.18) st.waves.splice(i, 1); }
        if (!isFinite(st.V)) st.V = rest;   // NaN 防御
        st.buf.push(st.V); if (st.buf.length > BUF_N) st.buf.shift();
      }
      function refill() { st.buf = []; for (var i = 0; i < BUF_N; i++) st.buf.push(rest); }
      refill();
      function ctl() {
        return [
          { id: 'ne_k', type: 'slider', label: '外接 K⁺ 浓度', min: 2, max: 10, step: 0.5, value: st.k, unit: ' mM', onChange: function (v) { st.k = v; } },
          { id: 'ne_wk', type: 'button', label: '弱刺激（+13 mV）', action: weak },
          { id: 'ne_st', type: 'button', label: '强刺激（触发动作电位）', action: strong }
        ];
      }
      function draw(ctx, W, H, t) {
        K.grid(ctx, W, H, { step: 46 });
        capTag(ctx, '神经元 · 动作电位与跳跃传导', 16, 12, COL.yellow);
        var axY = H * 0.36, axX0 = 132, axX1 = W - 56;
        /* 胞体 + 树突 */
        K.circle(ctx, axX0 - 34, axY, 30, { fill: 'rgba(253,121,168,0.25)', stroke: COL.pink, lineWidth: 2.4 });
        K.circle(ctx, axX0 - 34, axY, 9, { fill: 'rgba(155,89,182,0.85)' });
        for (var di = 0; di < 3; di++) {
          K.polyline(ctx, [{ x: axX0 - 58, y: axY }, { x: axX0 - 78 - di * 6, y: axY - 24 + di * 26 }, { x: axX0 - 104, y: axY - 34 + di * 34 }], { color: 'rgba(253,121,168,0.55)', width: 2 });
        }
        K.arrow(ctx, axX0, axY, axX1, axY, { color: 'rgba(255,255,255,0.25)', width: 5, head: 0.01 });
        /* 髓鞘节段与郎飞氏结 */
        var segLen = (axX1 - axX0 - 30) / NODES;
        for (var mi = 0; mi < NODES; mi++) {
          var mx0p = axX0 + 18 + mi * segLen;
          ctx.save(); ctx.fillStyle = 'rgba(116,185,255,0.20)'; ctx.strokeStyle = 'rgba(116,185,255,0.55)';
          ctx.beginPath(); ctx.ellipse(mx0p + segLen * 0.4, axY, segLen * 0.38, 13, 0, 0, PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        st.waves.forEach(function (wf) { /* 动作电位波前扫过时依次点亮结点 */
          for (var ni = 0; ni <= NODES; ni++) {
            var nxp = axX0 + 18 + ni * segLen, dx = Math.abs(nxp - (axX0 + wf.x * (axX1 - axX0))), glow = 1 - dx / 26;
            if (dx < 26) {
              K.circle(ctx, nxp, axY, 5 + glow * 4, { fill: 'rgba(241,196,15,' + (0.35 + glow * 0.65).toFixed(2) + ')' });
              K.circle(ctx, nxp, axY, 12 + glow * 8, { stroke: 'rgba(241,196,15,' + (glow * 0.5).toFixed(2) + ')', lineWidth: 1.6 });
            }
          }
          K.panel(ctx, axX0 + wf.x * (axX1 - axX0) - 14, axY - 9, 28, 18, { fill: 'rgba(231,76,60,0.45)', radius: 8 });
        });
        /* 可拖动刺激点探针：沿轴突移动决定动作电位发起位置 */
        var sxp = axX0 + st.stimFrac * (axX1 - axX0);
        K.arrow(ctx, sxp, axY - 32, sxp, axY - 10, { color: COL.red, width: 2, head: 6 });
        K.circle(ctx, sxp, axY, 7, { fill: COL.red, stroke: '#ffffff', lineWidth: 1.5 });
        if (st.drag) K.circle(ctx, sxp, axY, 13, { stroke: COL.yellow, lineWidth: 2 });
        K.label(ctx, '刺激点（可拖动）', sxp, axY - 42, { align: 'center', size: 10, color: '#e57373' });
        hintDrag(ctx, '👆 拖动刺激点', sxp, axY - 64);
        if (st.refr > 0) K.chip(ctx, '不应期 ' + st.refr.toFixed(2) + ' s', axX1 - 150, axY - 58, { size: 12, bg: 'rgba(231,76,60,0.30)' });
        if (st.hintT > 0 && Math.sin(t * 30) > 0) K.chip(ctx, '✋ 刺激被拒：神经元尚在恢复', axX1 - 260, axY + 44, { size: 12.5, bg: 'rgba(231,76,60,0.55)' });
        K.chip(ctx, '静息 ' + rest.toFixed(0) + ' mV ｜ 阈值 −55 mV', 84, axY + 74, { size: 12, bg: 'rgba(255,255,255,0.10)' });
        /* 示波器 */
        var sw = Math.min(340, W * 0.36), sh = 148, sx0 = 56, sy0 = H - sh - 56;
        K.panel(ctx, sx0, sy0, sw, sh, { fill: 'rgba(4,10,6,0.92)', stroke: 'rgba(39,174,96,0.55)', lineWidth: 1.4, radius: 8 });
        K.chip(ctx, '膜电位示波器（mV）', sx0 + 10, sy0 + 8, { size: 11, bg: 'rgba(39,174,96,0.22)' });
        var vy = function (mv) { return sy0 + 30 + (42 - mv) / (42 - (-90)) * (sh - 48); };
        [0, -55].forEach(function (lv) {
          K.dashLine(ctx, sx0 + 12, vy(lv), sx0 + sw - 12, vy(lv), lv === 0 ? { color: 'rgba(255,255,255,0.30)', dash: [4, 4] } : { color: 'rgba(231,76,60,0.55)', dash: [5, 4], width: 1.4 });
        });
        K.label(ctx, '0', sx0 + sw - 18, vy(0), { size: 9.5, color: DIM, baseline: 'bottom' });
        K.label(ctx, '−55 阈值', sx0 + sw - 14, vy(-55) - 6, { align: 'right', size: 9.5, color: '#e57373' });
        ctx.save(); ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 1.8; ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 4;
        ctx.beginPath();
        for (var bi = 0; bi < st.buf.length; bi++) { var px = sx0 + 12 + (sw - 26) * bi / Math.max(1, BUF_N - 1); bi === 0 ? ctx.moveTo(px, vy(st.buf[bi])) : ctx.lineTo(px, vy(st.buf[bi])); }
        ctx.stroke(); ctx.restore();
        K.label(ctx, 'V ＝ ' + st.V.toFixed(1) + ' mV', sx0 + sw - 14, sy0 + sh - 14, { align: 'right', size: 12, weight: 'bold', color: '#2ecc71' });
        K.label(ctx, '波形向左滚动 · 波前沿轴突自左向右跳跃传导', sx0 + sw + 18, H - 70, { size: 11.5, color: DIM });
      }
      return {
        ctl: ctl, tick: tick, draw: draw,
        rows: function () {
          return [
            { label: '当前膜电位 V', value: st.V.toFixed(1), unit: ' mV', color: '#2ecc71' }, { label: '静息电位（随K⁺平移）', value: rest.toFixed(0), unit: ' mV', color: COL.sky },
            { label: '不应期剩余', value: st.refr.toFixed(2), unit: ' s', color: st.refr > 0 ? COL.red : DIM }, { label: '已触发 AP', value: String(st.apCount), unit: ' 次', color: COL.yellow }
          ];
        },
        reset: function () { st.k = 6; rest = REST_OF(6); st.V = rest; st.ap = null; st.refr = 0; st.waves = []; st.apCount = 0; st.hintT = 0; st.stimFrac = 0; st.drag = false; refill(); },
        hitTest: function (x, y, W, H) {
          var axY = H * 0.36, axX0 = 132, axX1 = W - 56;
          var sxp = axX0 + st.stimFrac * (axX1 - axX0);
          return Math.abs(x - sxp) < 22 && Math.abs(y - axY) < 30;
        },
        /* —— 拖拽交互：拖动刺激点位置改变其在轴突上的发起位置 —— */
        down: function (x, y, W, H, ev) {
          var axY = H * 0.36, axX0 = 132, axX1 = W - 56;
          var sxp = axX0 + st.stimFrac * (axX1 - axX0);
          if (Math.abs(x - sxp) < 22 && Math.abs(y - axY) < 30) st.drag = true;
        },
        move: function (x, y, W, H, ev) {
          if (!st.drag) return;
          var axX0 = 132, axX1 = W - 56;
          st.stimFrac = K.clamp((x - axX0) / (axX1 - axX0), 0, 1);
        },
        up: function (x, y, W, H, ev) { st.drag = false; },
        presets: function () {
          return [
            { name: '标准静息 K⁺=6', apply: function () { st.k = 6; } },
            { name: '高钾去极化 K⁺=9', apply: function () { st.k = 9; toast('细胞外高钾 → 静息电位上移，更易兴奋'); } },
            { name: '低钾超极化 K⁺=3', apply: function () { st.k = 3; toast('低钾 → 基线下移，难达阈值'); } }
          ];
        }
      };
    }

    /* ================================================================
     * 模式 4 —— 膜运输 membrane
     * 磷脂双分子层横贯中线；三种通道：Na⁺/K⁺-ATP 泵（按钮耗 1 ATP）、
     * K⁺ 漏通道（开关）、葡萄糖协助扩散（浓度梯度滑块）；粒子仅经由
     * 开放的通道穿膜，梯度箭头与通量表随之收敛至动态平衡。
     * ============================================================== */
    function mdMembrane() {
      var SP = { na: { col: COL.orange, name: 'Na⁺', out: mbCount(21), inn: mbCount(7) }, k: { col: COL.purple, name: 'K⁺', out: mbCount(14), inn: mbCount(14) }, glu: { col: COL.green, name: '葡萄糖', out: mbCount(20), inn: mbCount(8) } };
      var st = { cout: 110, cin: 38, kleak: true, arrows: true, dots: {}, atp: 0, pumpFlash: 0, lidT: 0, openAmt: 1, fl: { na: 0, k: 0, glu: 0 }, acc: { na: 0, k: 0, gi: 0, go: 0 }, steadyT: 0, lastSig: '', seed: 555001, drag: null };
      var R = K.rng(st.seed);
      function spawn() { /* 生成粒子池（确定性散射位置） */
        st.dots = {};
        Object.keys(SP).forEach(function (key) {
          var cfg0 = SP[key], arr = [];
          for (var i = 0; i < cfg0.out + cfg0.inn; i++) arr.push({ side: i < cfg0.out ? 'o' : 'i', fx: (i * 37 % 100) / 100, fy: (i * 53 % 100) / 100, ph: (i * 91 % 360) / 360 * PI * 2, tr: null });
          st.dots[key] = arr;
        });
        st.fl = { na: 0, k: 0, glu: 0 }; st.steadyT = 0; st.lastSig = '';
      }
      spawn();
      function counts(key) { var o = 0, i0 = 0; st.dots[key].forEach(function (d0) { if (d0.side === 'o') o++; else i0++; }); return { o: o, i: i0 }; }
      function startTransit(key, fromSide) { /* 从指定一侧挑空闲粒子穿膜（外→内记 +1 净通量） */
        var cand = st.dots[key].filter(function (d0) { return d0.side === fromSide && !d0.tr; });
        if (!cand.length) return 0;
        var d0 = cand[Math.floor(R() * cand.length)];
        d0.side = fromSide === 'o' ? 'i' : 'o'; d0.tr = { p: 0 };
        st.fl[key] += fromSide === 'o' ? 1 : -1;
        return 1;
      }
      function pumpOnce() {
        var moved = 0, j;
        for (j = 0; j < mbCount(2); j++) moved += startTransit('na', 'i');
        for (j = 0; j < mbCount(2); j++) moved += startTransit('k', 'o');
        if (moved) { st.atp++; st.pumpFlash = 0.6; toast('ATP → ADP：泵出 2 Na⁺、泵入 2 K⁺'); } else toast('没有可转运的粒子了');
      }
      function tick(dt) {
        dt = dtGuard(dt);
        st.pumpFlash = Math.max(0, st.pumpFlash - dt); st.lidT = Math.max(0, st.lidT - dt);
        st.openAmt += ((st.kleak ? 1 : 0) - st.openAmt) * Math.min(1, dt * 6);
        Object.keys(st.dots).forEach(function (key) { /* 粒子穿膜动画推进 */
          st.dots[key].forEach(function (d0) { if (d0.tr) { d0.tr.p += dt * 1.7; if (d0.tr.p >= 1) d0.tr = null; } });
        });
        if (st.openAmt > 0.05) { /* K⁺ 漏通道：往浓度均匀方向净流 + 少量双向渗漏 */
          var ck = counts('k'), bias = K.clamp((ck.i - ck.o) / 60, -1, 1);
          st.acc.k += dt * (0.9 * st.openAmt * Math.abs(bias) * 3 + 0.25 * st.openAmt);
          while (st.acc.k >= 1) { st.acc.k -= 1; var dir = R() < 0.5 + bias * 0.42 ? (bias > 0 ? 'i' : 'o') : (bias > 0 ? 'o' : 'i'); startTransit('k', dir); }
        }
        var cg = counts('glu'), rWant = K.clamp(st.cout / Math.max(st.cin, 1), 0.2, 6), pin = cg.i / Math.max(cg.i + cg.o, 1), wantPin = rWant / (1 + rWant), imb = wantPin - pin; /* 葡萄糖协助扩散：净流 ∝ 目标占比差 */
        st.acc[imb > 0 ? 'gi' : 'go'] += dt * K.clamp(Math.abs(imb) * (cg.i + cg.o) * 2.2, 0, 6);
        while (st.acc.gi >= 1) { st.acc.gi -= 1; if (startTransit('glu', 'o')) st.lidT = 0.5; }
        while (st.acc.go >= 1) { st.acc.go -= 1; if (startTransit('glu', 'i')) st.lidT = 0.5; }
        var dec = Math.exp(-dt * 1.2);   /* 通量 EMA 衰退 */
        ['na', 'k', 'glu'].forEach(function (key) { if (!isFinite(st.fl[key])) st.fl[key] = 0; st.fl[key] *= dec; });
        var sig = ['na', 'k', 'glu'].map(function (key) { var c0 = counts(key); return c0.o + '-' + c0.i; }).join('|'); /* 平衡判定：各侧计数连续 2.5s 不变 */
        st.steadyT = sig === st.lastSig ? st.steadyT + dt : 0;
        st.lastSig = sig;
      }
      function ctl() {
        return [
          { id: 'mb_pump', type: 'button', label: '钠钾泵工作（耗 1 ATP）', action: pumpOnce },
          { id: 'mb_kl', type: 'checkbox', label: '打开 K⁺ 漏通道', value: st.kleak, onChange: function (v) { st.kleak = !!v; } },
          { id: 'mb_co', type: 'slider', label: '葡萄糖胞外浓度 C 外', min: 10, max: 150, step: 5, value: st.cout, unit: '%', onChange: function (v) { st.cout = v; } },
          { id: 'mb_ci', type: 'slider', label: '葡萄糖胞内浓度 C 内', min: 10, max: 150, step: 5, value: st.cin, unit: '%', onChange: function (v) { st.cin = v; } },
          { id: 'mb_ar', type: 'checkbox', label: '显示浓度梯度箭头', value: st.arrows, onChange: function (v) { st.arrows = !!v; } }
        ];
      }
      function dotXY(d0, i0, midY, spanL, spanR, t) { /* 穿膜粒子沿 y 插值滑动到对侧 */
        var yy = d0.side === 'o' ? (d0.tr ? K.lerp(midY + 40, midY - 40, d0.tr.p) : midY - 40) : (d0.tr ? K.lerp(midY - 40, midY + 40, d0.tr.p) : midY + 40);
        return { x: spanL + d0.fx * (spanR - spanL) + Math.sin(t * 1.3 + d0.ph) * 7, y: yy + Math.cos(t * 1.6 + i0) * 4 };
      }
      function draw(ctx, W, H, t) {
        var midY = H * 0.52, mL = 46, mR = W - 306;
        K.panel(ctx, mL - 16, 54, mR - mL + 40, midY - 74, { fill: 'rgba(116,185,255,0.06)', radius: 12 });
        K.panel(ctx, mL - 16, midY + 30, mR - mL + 40, H - 60 - midY - 24, { fill: 'rgba(243,156,18,0.05)', radius: 12 });
        K.label(ctx, '细胞外（膜外）', mL + 4, 68, { size: 12, color: COL.sky });
        K.label(ctx, '细胞内（膜内）', mL + 4, H - 70, { size: 12, color: COL.orange });
        capTag(ctx, '膜运输 · 双分子层与通道蛋白', 16, 12, COL.teal);
        for (var px = mL; px < mR; px += 17) { /* 磷脂双分子层（随波摆动） */
          var sway = Math.sin(t * 2 + px / 30) * 2;
          K.circle(ctx, px, midY - 12 + sway * 0.4, 4.4, { fill: 'rgba(253,121,168,0.85)' }); K.circle(ctx, px, midY + 12 - sway * 0.4, 4.4, { fill: 'rgba(253,121,168,0.85)' });
          ctx.save(); ctx.strokeStyle = 'rgba(253,121,168,0.45)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(px - 3, midY - 9); ctx.quadraticCurveTo(px + sway, midY, px - 2, midY + 8); ctx.stroke(); ctx.restore();
        }
        mbChannels({ st: st, SP: SP }, ctx, mL, mR, midY, t);
        var idx = 0; /* 三类粒子 */
        Object.keys(SP).forEach(function (key) {
          st.dots[key].forEach(function (d0) {
            var pp = dotXY(d0, idx++, midY, mL + 8, mR - 12, t);
            K.circle(ctx, pp.x, pp.y, key === 'glu' ? 5.2 : 4, { fill: SP[key].col, alpha: d0.tr ? 1 : 0.82, stroke: 'rgba(0,0,0,0.4)', lineWidth: 1 });
          });
        });
        if (st.arrows) mbGradArrows({ st: st, SP: SP }, ctx, mR + 26, 78);
        mbEqChip({ st: st }, ctx, W / 2 - 80, 20, t);
        /* —— 右侧可拖动胞外葡萄糖浓度滑块（垂直指针 10~150%）—— */
        var slX = W - 32, slY0 = 80, slY1 = H - 100;
        K.panel(ctx, slX - 8, slY0, 16, slY1 - slY0, { fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.40)', radius: 8 });
        var slPY = slY1 - (st.cout - 10) / 140 * (slY1 - slY0);
        K.circle(ctx, slX, slPY, 8, { fill: SP.glu.col, stroke: '#ffffff', lineWidth: 1.5 });
        if (st.drag === 'slider') K.circle(ctx, slX, slPY, 13, { stroke: '#ffffff', lineWidth: 2 });
        K.label(ctx, '胞外葡萄糖', slX, slY0 - 14, { align: 'center', size: 10, color: DIM });
        K.label(ctx, String(st.cout) + '%', slX, slY1 + 14, { align: 'center', size: 10.5, color: SP.glu.col });
        hintDrag(ctx, '👆 拖动浓度', slX, slY1 + 34);
        hintDrag(ctx, '👆 拖动旋钮', mL + (mR - mL) * 0.52, midY - 60);
        K.label(ctx, '粒子只能经由开放的通道穿膜 —— 泵逆梯度耗能，漏通道顺梯度放能。', mL, H - 30, { size: 12, color: DIM });
      }
      return {
        ctl: ctl, tick: tick, draw: draw,
        rows: function () {
          var cn = counts('na'), ck = counts('k'), cg = counts('glu');
          return [
            { label: 'Na⁺ 外 / 内', value: cn.o + ' / ' + cn.i, color: SP.na.col }, { label: 'K⁺ 外 / 内', value: ck.o + ' / ' + ck.i, color: SP.k.col },
            { label: '葡萄糖净通量', value: K.fmt(st.fl.glu, 1), unit: ' 粒/s', color: SP.glu.col }, { label: 'ATP 消耗累计', value: String(st.atp), unit: ' 个', color: COL.yellow }
          ];
        },
        reset: function () { R = K.rng(st.seed); st.atp = 0; st.pumpFlash = 0; st.lidT = 0; st.drag = null; spawn(); },
        hitTest: function (x, y, W, H) {
          var mL = 46, mR = W - 306, midY = H * 0.52;
          var slX = W - 32, slY0 = 80, slY1 = H - 100;
          if (Math.abs(x - slX) < 18 && y > slY0 - 12 && y < slY1 + 12) return true;
          var kx = mL + (mR - mL) * 0.52;
          return Math.hypot(x - kx, y - midY) < 30;
        },
        /* —— 拖拽交互：拖动浓度滑块指针改胞外葡萄糖浓度；拖动 K⁺ 通道旋钮到开/关位置 —— */
        down: function (x, y, W, H, ev) {
          var mL = 46, mR = W - 306, midY = H * 0.52;
          /* 浓度滑块指针 */
          var slX = W - 32, slY0 = 80, slY1 = H - 100;
          if (Math.abs(x - slX) < 18 && y > slY0 - 12 && y < slY1 + 12) { st.drag = 'slider'; return; }
          /* K⁺ 漏通道旋钮（中心 30px 内） */
          var kx = mL + (mR - mL) * 0.52;
          if (Math.hypot(x - kx, y - midY) < 30) { st.drag = 'kleak'; return; }
        },
        move: function (x, y, W, H, ev) {
          var mL = 46, mR = W - 306, midY = H * 0.52;
          if (st.drag === 'slider') {
            var slY0 = 80, slY1 = H - 100;
            var f = K.clamp((slY1 - y) / (slY1 - slY0), 0, 1);
            st.cout = Math.round((10 + f * 140) / 5) * 5;   // 5% 步进，与控件一致
            return;
          }
          if (st.drag === 'kleak') {
            var kx = mL + (mR - mL) * 0.52;
            st.kleak = x > kx;                            // 拖到通道右侧=开，左侧=关
            return;
          }
        },
        up: function (x, y, W, H, ev) { st.drag = null; },
        presets: function () {
          return [
            { name: '基础对比态', apply: function () { baseSet(110, 38, true); } },
            { name: '关漏通道看累积', apply: function () { baseSet(110, 38, false); toast('关闭漏通道后按几下泵试试离子堆积'); } }, { name: '倒转葡萄糖梯度', apply: function () { baseSet(40, 130, true); } }
          ];
        }
      };
      function baseSet(co, ci, kl) { st.cout = co; st.cin = ci; st.kleak = kl; }
    }

    /* ================= 膜运输绘制子程序（状态经 S = {st, SP} 注入） ================= */
    function mbChannels(S, g, mL, mR, my, tt) { /* 三类通道：ATP 泵 / K⁺ 漏通道 / 葡萄糖载体 */
      var st = S.st, pxx = mL + (mR - mL) * 0.26;
      K.panel(g, pxx - 22, my - 34, 44, 68, { fill: 'rgba(231,76,60,0.20)', stroke: COL.red, lineWidth: 1.6, radius: 8 });
      K.label(g, 'Na⁺/K⁺', pxx, my - 46, { align: 'center', size: 11, color: COL.red });
      K.label(g, 'ATP 泵', pxx, my + 52, { align: 'center', size: 11, color: COL.red });
      if (st.pumpFlash > 0) {
        K.circle(g, pxx, my, 34, { stroke: 'rgba(241,196,15,' + st.pumpFlash.toFixed(2) + ')', lineWidth: 3 });
        K.chip(g, 'ATP→ADP', pxx + 34, my - 62, { size: 11, bg: 'rgba(241,196,15,0.35)', color: '#ffe985' });
      }
      var kx = mL + (mR - mL) * 0.52, gap0 = 7 + st.openAmt * 13;
      g.save(); g.strokeStyle = 'rgba(155,89,182,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.arc(kx, my - gap0 / 2 - 20, 22, PI * 0.15, PI * 0.85, false); g.stroke();
      g.beginPath(); g.arc(kx, my + gap0 / 2 + 20, 22, PI * 1.15, PI * 1.85, false); g.stroke();
      g.restore();
      K.label(g, 'K⁺ 漏通道', kx, my - 46, { align: 'center', size: 11, color: S.SP.k.col });
      /* K⁺ 漏通道开关旋钮（可拖动到开/关位置）：右侧=开(绿)、左侧=关(红) */
      var knobX = kx + (st.kleak ? 16 : -16);
      K.circle(g, knobX, my, 5, { fill: st.kleak ? '#2ecc71' : '#e74c3c', stroke: '#ffffff', lineWidth: 1.5 });
      if (st.drag === 'kleak') K.circle(g, kx, my, 30, { stroke: '#ffffff', lineWidth: 2 });
      var gx = mL + (mR - mL) * 0.76, rot = st.lidT > 0 ? Math.sin(tt * 12) * 0.5 : 0;
      g.save(); g.strokeStyle = 'rgba(39,174,96,0.9)'; g.lineWidth = 3;
      g.translate(gx, my); g.rotate(rot);
      g.beginPath(); g.arc(0, 0, 24, PI * 0.25, PI * 1.25, false); g.stroke();
      g.beginPath(); g.arc(0, 0, 24, PI * 1.35, PI * 1.9, false); g.stroke();
      g.restore();
      K.label(g, '葡萄糖载体', gx, my - 46, { align: 'center', size: 11, color: S.SP.glu.col });
    }
    function mbGradArrows(S, g, ax, ay) { /* 浓度梯度箭头：长度∝|净流量|，方向表内/外流 */
      var st = S.st, SP = S.SP;
      Object.keys(SP).forEach(function (key, si) {
        var mag = K.clamp(Math.abs(st.fl[key]) / 4, 0.12, 1), yy = ay + si * 54, inward = st.fl[key] >= 0;
        K.chip(g, SP[key].name, ax - 4, yy, { size: 11, bg: 'rgba(0,0,0,0.4)' });
        if (mag > 0.13) {
          var len = 22 + mag * 34;
          K.arrow(g, inward ? ax + 52 : ax + 52 + len, yy + 20, inward ? ax + 52 + len : ax + 52, yy + 20, { color: SP[key].col, width: 2 + mag * 2.5, head: 8 + mag * 5 });
        } else K.label(g, '≈ 净通量为 0', ax + 8, yy + 20, { size: 10.5, color: DIM });
      });
      K.label(g, '通量（箭头∝|净流量|）', ax - 2, ay + 3 * 54 - 6, { size: 10.5, color: DIM });
    }
    function mbEqChip(S, g, ex, ey, t) { /* 动态平衡达成徽章 */
      if (S.st.steadyT <= 2.5) return;
      K.chip(g, '动态平衡达成 ✓ 各物种穿膜进出的净迁移≈0', ex, ey, { size: 12.5, bg: 'rgba(39,174,96,' + (0.55 + 0.45 * Math.sin(t * 4)).toFixed(2) + ')' });
    }

    /* ================= 知识点文案 ================= */
    var KNOW = {
      naturalselection: '<p><b>自然选择</b>四要素：个体差异、可遗传、生存斗争、适者生存。本实验中毛色与环境的<b>色差</b>越大越容易被狼捕获；繁殖让有利性状在世代间累积——右上角曲线会展示种群色比被环境「定向」推移的过程。</p>',
      genexp: '<p><b>中心法则</b>：DNA 转录为 mRNA（以 U 替代 T），核糖体再按每 3 个碱基一个<b>密码子</b>把 mRNA 翻译成氨基酸链。阻遏蛋白结合后转录减速。当蛋白质产量达到阈值，细胞就表现出对应性状（色素、酶）。</p>',
      neuron: '<p>静息膜电位约 <b>−70 mV</b>，由 K⁺ 外流维持；去极化超过<b>阈电位 −55 mV</b> 便爆发动作电位（+40 mV 后短暂超射）。兴奋沿髓鞘节段间<b>跳跃传导</b>（郎飞氏结依次点亮）；随后 200 ms <b>不应期</b>内无法再次激发。细胞外 K⁺ 浓度升高会使静息电位整体上移。</p>',
      membrane: '<p>磷脂双分子层是疏水屏障，离子必须走<b>通道蛋白</b>：<b> Na⁺/K⁺-ATP 泵</b>逆浓度梯度每消耗 1 个 ATP 同时运出 3Na⁺/运入 2K⁺（本简化版 2:2）；<b>K⁺ 漏通道</b>顺梯度放能回流；葡萄糖靠载体<b>协助扩散</b>从高浓度侧流向低浓度侧，直至两侧浓度比达到平衡。</p>'
    };
    /* ================= 模式分派与实例组装 ================= */
    var MODES = { naturalselection: mdNat, genexp: mdGeneExp, neuron: mdNeuron, membrane: mdMembrane };
    var modeKey = cfg && (cfg.mode || cfg.id) ? String(cfg.mode || cfg.id) : 'naturalselection';
    if (!MODES[modeKey]) modeKey = 'naturalselection';
    var M = null, lastW = 820, lastH = 480, cache = '';
    function pushData(force) { /* 数据卡缓存：仅在内容变化时刷新 DOM */
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
        loader.setKnowledge(KNOW[modeKey] || '<p>探索生命现象背后的机制。</p>');
        loader.setPresets(M.presets ? M.presets() : []);
        pushData(true);
      },
      getControls: function () { /* 每次返回携带当前值的新数组 */
        if (!M || !M.ctl) return [];
        try { return M.ctl(); } catch (e) { console.error('[bio:' + modeKey + '] ctl 异常', e); return []; }
      },
      update: function (dt, t) {
        if (!M) return;
        try { M.tick(dt, t); } catch (err) { console.error('[bio:' + modeKey + '] tick 异常', err); }
        pushData(false);
      },
      render: function (ctx, W, H, t) {
        lastW = W; lastH = H;
        K.background(ctx, W, H);
        if (!M) return;
        try { M.draw(ctx, W, H, t); } catch (err) { console.error('[bio:' + modeKey + '] draw 异常', err); }
      },
      reset: function () {
        cache = '';
        if (!M) return;
        try { M.reset(); } catch (err) { console.error('[bio:' + modeKey + '] reset 异常', err); }
        pushData(true);
      }
    };
    inst.onPointerDown = function (x, y, ev) { if (M && M.down) { try { M.down(x, y, lastW, lastH, ev); } catch (err) { console.error(err); } } };
    inst.onPointerMove = function (x, y, ev) { if (M && M.move) { try { M.move(x, y, lastW, lastH, ev); } catch (err) { console.error(err); } } };
    inst.onPointerUp = function (x, y, ev) { if (M && M.up) { try { M.up(x, y, lastW, lastH, ev); } catch (err) { console.error(err); } } };
    inst.hitTest = function (x, y) { if (M && M.hitTest) { try { return !!M.hitTest(x, y, lastW, lastH); } catch (err) { return false; } } return false; };
    inst.onResize = function () { /* 视图逐帧由 W/H 重算 */ };
    return inst;
  }
});