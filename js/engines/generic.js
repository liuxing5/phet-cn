/**
 * 通用演示引擎（factory 名: 'generic'）
 * 用于尚未精调的实验：根据学科（物理/化学/生物/地球/数学）显示一个可交互的基础演示，
 * 保证每个实验都有入口、都能打开并调节参数（先覆盖、后精修）。
 * 契约：顶层只注册工厂；DOM 交互一律经 loader。
 */
(function () {
  'use strict';
  function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.fillStyle = '#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }

  window.EngineRegistry.register('generic', {
    create: function (cfg) {
      cfg = cfg || {};
      var K = window.Kit, COL = K.COLORS, PI = Math.PI;
      var TXT = '#f2f5fa', DIM = 'rgba(255,255,255,0.55)';
      var LOADER = null;
      var st = { amp: 40, freq: 1.5, speed: 1, n: 24, t: 0, drag: null };
      var SUBJECT_COLOR = { physics: '#4fc3f7', chemistry: '#66bb6a', biology: '#ef5350', 'earth-science': '#ffa726', mathematics: '#ab47bc' };
      var SUBJECT_EN = { physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', 'earth-science': 'Earth Science', mathematics: 'Mathematics' };
      var SUBJECT_ZH = { physics: '物理', chemistry: '化学', biology: '生物', 'earth-science': '地球与空间', mathematics: '数学' };

      function findSim() {
        var cfgMap = window.simulationsConfig || {};
        var subjects = Object.keys(cfgMap), i, j;
        for (i = 0; i < subjects.length; i++) {
          var list = cfgMap[subjects[i]] || [];
          for (j = 0; j < list.length; j++) {
            if (list[j].id === cfg.id) return { sim: list[j], subject: subjects[i] };
          }
        }
        return { sim: { name: cfg.id }, subject: 'physics' };
      }
      var info = findSim();
      var subj = info.subject;
      var nameZh = info.sim.name || cfg.id;
      var nameEn = info.sim.slug || cfg.id;

      function toast(m) { if (LOADER && LOADER.showToast) LOADER.showToast(String(m)); }
      function SL(id, label, min, max, step, value, fn) { return { id: id, type: 'slider', label: label, min: min, max: max, step: step, value: value, unit: '', onChange: fn }; }

      return {
        init: function (loader) {
          LOADER = loader;
          loader.setKnowledge(
            '<p><strong>' + nameZh + ' / ' + nameEn + '</strong></p>' +
            '<p>这是「' + SUBJECT_ZH[subj] + ' ' + SUBJECT_EN[subj] + '」学科的互动模拟实验。当前为基础演示版，拖动下方参数滑块或画布内元素观察变化。</p>' +
            '<p>完整的高保真复刻正在持续补充中。</p>'
          );
          loader.setPresets([
            { name: '默认参数', apply: function () { st.amp = 40; st.freq = 1.5; st.speed = 1; st.n = 24; } },
            { name: '快速波动', apply: function () { st.freq = 3; st.speed = 2; } },
            { name: '更多元素', apply: function () { st.n = 40; } }
          ]);
        },
        getControls: function () {
          return [
            SL('gc_amp', '幅度 Amplitude', 10, 80, 1, st.amp, function (v) { st.amp = v; }),
            SL('gc_freq', '频率 Frequency', 0.5, 5, 0.1, st.freq, function (v) { st.freq = v; }),
            SL('gc_speed', '速度 Speed', 0.2, 3, 0.1, st.speed, function (v) { st.speed = v; }),
            SL('gc_n', '元素数量 Count', 6, 48, 1, st.n, function (v) { st.n = Math.round(v); })
          ];
        },
        update: function (dt, t) {
          if (!(dt > 0)) dt = 0;
          if (dt > 0.05) dt = 0.05;
          st.t += dt * st.speed;
        },
        render: function (ctx, W, H, t) {
          K.background(ctx, W, H);
          var col = SUBJECT_COLOR[subj] || '#4fc3f7';
          var cx = W * 0.5, cy = H * 0.52, i;

          /* 标题 */
          K.label(ctx, nameZh + '  ' + nameEn, W * 0.5, 30, { align: 'center', size: 20, weight: 'bold', color: col });
          K.chip(ctx, SUBJECT_ZH[subj] + ' ' + SUBJECT_EN[subj] + ' · 基础演示 Basic Demo', W * 0.5, 52, { size: 12, bg: 'rgba(0,0,0,0.35)', color: TXT });

          /* 依据学科绘制不同演示 */
          if (subj === 'physics') {
            // 波 + 粒子
            var baseY = cy + 40;
            ctx.save();
            ctx.strokeStyle = col; ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (i = 0; i <= 200; i++) {
              var wx = 30 + (W - 60) * i / 200;
              var wy = baseY - st.amp * Math.sin(i / 200 * 6.28318 * st.freq + st.t * 3);
              if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
            }
            ctx.stroke(); ctx.restore();
            K.label(ctx, '波 Wave', 30, baseY + 26, { size: 12, color: DIM });
            var pn = Math.round(st.n / 2);
            for (i = 0; i < pn; i++) {
              var px = 40 + (i / Math.max(pn - 1, 1)) * (W - 80);
              var py = cy - 60 - st.amp * 0.6 * Math.sin(i * 0.7 + st.t * 4);
              K.circle(ctx, px, py, 4.5, { fill: col, stroke: '#000', lineWidth: 0.8 });
            }
          } else if (subj === 'chemistry') {
            // 分子：中心 + 环绕原子
            K.circle(ctx, cx, cy, 22, { fill: col, stroke: '#fff', lineWidth: 2 });
            K.label(ctx, '分子 Molecule', cx, cy, { align: 'center', baseline: 'middle', size: 12, weight: 'bold', color: '#fff' });
            var mn = Math.min(st.n, 12);
            for (i = 0; i < mn; i++) {
              var a = st.t * 1.2 + i / mn * 6.28318;
              var ax = cx + Math.cos(a) * (70 + st.amp * 0.4);
              var ay = cy + Math.sin(a) * (70 + st.amp * 0.4);
              K.circle(ctx, ax, ay, 12, { fill: '#ffb74d', stroke: '#000', lineWidth: 1 });
            }
          } else if (subj === 'biology') {
            // 细胞 + 细胞核
            K.circle(ctx, cx, cy, 70, { fill: 'rgba(239,83,80,0.15)', stroke: col, lineWidth: 2.5 });
            K.circle(ctx, cx, cy, 24, { fill: col, stroke: '#fff', lineWidth: 1.5 });
            K.label(ctx, '细胞核 Nucleus', cx, cy, { align: 'center', baseline: 'middle', size: 11, weight: 'bold', color: '#fff' });
            var bn = Math.min(st.n, 20);
            for (i = 0; i < bn; i++) {
              var bA = st.t * 0.8 + i / bn * 6.28318;
              var bx = cx + Math.cos(bA) * (46 + st.amp * 0.3);
              var by = cy + Math.sin(bA) * (46 + st.amp * 0.3);
              K.circle(ctx, bx, by, 4, { fill: '#ffe082', stroke: '#000', lineWidth: 0.6 });
            }
          } else if (subj === 'earth-science') {
            // 行星轨道
            K.circle(ctx, cx, cy, 14, { fill: '#ffca28', stroke: '#fff', lineWidth: 1.5 });
            K.label(ctx, '恒星 Star', cx, cy + 26, { align: 'center', size: 11, color: DIM });
            var on = Math.min(st.n, 6);
            for (i = 0; i < on; i++) {
              var orr = 46 + i * 22;
              var oa = st.t * (0.7 - i * 0.08) + i * 2.1;
              ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(cx, cy, orr, 0, 6.28318); ctx.stroke(); ctx.restore();
              K.circle(ctx, cx + Math.cos(oa) * orr, cy + Math.sin(oa) * orr, 6, { fill: SUBJECT_COLOR[subj], stroke: '#fff', lineWidth: 1 });
            }
          } else {
            // 数学：函数曲线 + 可拖动点
            var fy0 = cy + 20;
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(30, fy0); ctx.lineTo(W - 30, fy0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(30, cy - 120); ctx.lineTo(30, fy0); ctx.stroke(); ctx.restore();
            ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (i = 0; i <= 200; i++) {
              var mx = 30 + (W - 60) * i / 200;
              var mxx = (mx - 30) / (W - 60) * 10 - 5;
              var my = fy0 - st.amp * 0.5 * Math.sin(mxx * st.freq + st.t);
              if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
            }
            ctx.stroke(); ctx.restore();
            K.label(ctx, '函数 Function', W - 60, fy0 + 22, { align: 'right', size: 12, color: DIM });
          }

          /* 提示 */
          K.label(ctx, '👆 用右侧面板调节参数，或拖动画面元素', W * 0.5, H - 22, { align: 'center', size: 12, color: DIM });
        },
        reset: function () { st.amp = 40; st.freq = 1.5; st.speed = 1; st.n = 24; st.t = 0; }
      };
    }
  });
})();
