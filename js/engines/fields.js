/**
 * 电场 / 磁场 / 静电 实验引擎（factory 名: 'fields'）
 * 覆盖实验ID（12个 / 11种模式）：
 *   charges-fields            → charges        电荷与电场
 *   coulombs-law              → coulomb        库仑定律
 *   gravity-force-lab(-basics)→ gravlab        万有引力实验室
 *   magnets-electromagnets    → magnetsA       磁铁和电磁铁
 *   magnet-compass            → compassmode    磁铁与指南针
 *   faradays-electromagnetic-lab → emlab       法拉第电磁实验室
 *   faradays-law              → faradaybulb    法拉第定律
 *   generator                 → generatorTurbine 发电机
 *   john-travoltage           → travoltage     静电发生器
 *   balloons-static-electricity → balloonstatic 气球与静电
 *   capacitor-lab-basics      → capacitor      电容器实验室基础
 *
 * 契约：顶层只执行 window.EngineRegistry.register；不触碰 document。
 *       DOM 交互一律经 loader（setKnowledge/setPresets/updateDataDisplay/showToast）。
 */
(function () {
'use strict';
/* 可拖拽元素悬停提示标签（自包含，不依赖任何状态） */
function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.fillStyle = '#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }

window.EngineRegistry.register('fields', {
  create: function (cfg) {
    cfg = cfg || {};
    var mode = String(cfg.mode || ID2MODE[cfg.id] || '');
    var basic = !!cfg.basic;
    if (!BUILD[mode]) mode = 'charges';
    return BUILD[mode](basic);
  }
});

/* ============================================================
 * 一、通用小工具
 * ============================================================ */
function KT() { return window.Kit; }
function NF(v, d) {
  if (!isFinite(v)) v = 0;
  var k = KT();
  return (k && k.fmt) ? k.fmt(v, d === undefined ? 2 : d) : v.toFixed(d === undefined ? 2 : d);
}
function row(lb, val, unit, color) { return { label: lb, value: val, unit: unit, color: color }; }
/* 数据卡片缓存：字符串变化才刷 */
function flushRows(st, rows) {
  if (!st.L || !st.L.updateDataDisplay) return;
  try {
    var key = JSON.stringify(rows);
    if (key === st._dcKey) return;
    st._dcKey = key;
    st.L.updateDataDisplay(rows);
  } catch (err) { /* 忽略序列化异常 */ }
}
function TXT(ctx, s, x, y, o) {
  o = o || {};
  KT().label(ctx, s, x, y, {
    size: o.size || 13,
    color: o.color || '#eef2f7',
    align: o.align || 'left',
    baseline: o.baseline || 'alphabetic',
    weight: o.weight || 'normal',
    alpha: o.alpha
  });
}
function PN(ctx, x, y, w, h, o) { KT().panel(ctx, x, y, w, h, o || {}); }
function ARW(ctx, x1, y1, x2, y2, color, width, head) {
  KT().arrow(ctx, x1, y1, x2, y2, { color: color, width: width || 3, head: head === undefined ? 10 : head });
}
function DST(ctx, x1, y1, x2, y2, color, width, seg) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width || 1.4;
  ctx.setLineDash(seg || [5, 4]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}
function DISK(ctx, x, y, r, fill, stroke, lw, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0.5), 0, 6.2832);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  ctx.restore();
}
function RC(ctx, x, y, w, h, fill, stroke, lw, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  if (fill && w > 0.5 && h > 0.5) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.strokeRect(x, y, w, h); }
  ctx.restore();
}
function HYP(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }

/* 科学计数法字符串 '3.45×10⁻²' */
var SUPS = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function sup(n) {
  var s = String(n), out = '', i;
  for (i = 0; i < s.length; i++) out += SUPS[s[i]] || s[i];
  return out;
}
function SCI(v, d) {
  if (!isFinite(v)) return '--';
  if (v === 0) return '0';
  var e = Math.floor(Math.log10(Math.abs(v)));
  var m = v / Math.pow(10, e);
  return NF(m, d === undefined ? 2 : d) + '×10' + sup(e);
}

/* 控件构造器 */
function SL(id, label, min, max, step, value, unit, fn) {
  return { id: id, type: 'slider', label: label, min: min, max: max, step: step, value: value, unit: unit || '', onChange: fn };
}
function SEL(id, label, opts, value, fn) {
  return {
    id: id, type: 'select', label: label,
    options: opts.map(function (o) { return { value: o[0], label: o[1] }; }),
    value: value, onChange: fn
  };
}
function CK(id, label, value, fn) { return { id: id, type: 'checkbox', label: label, value: value, onChange: fn }; }
function BTN(id, label, act) { return { id: id, type: 'button', label: label, action: act }; }

/* 平滑插值（含角度最短路径） */
function EMA(cur, target, k) { return cur + (target - cur) * Math.min(1, Math.max(0, k)); }
function angEMA(cur, target, k) {
  var d = (target - cur) % 6.28318;
  if (d > Math.PI) d -= 6.28318;
  if (d < -Math.PI) d += 6.28318;
  return cur + d * Math.min(1, Math.max(0, k));
}

/* 罗盘方位词：aDeg 为自"北(屏幕上方)"起顺时针角度 */
function bearingWord(aDeg) {
  aDeg = ((aDeg % 360) + 360) % 360;
  if (aDeg < 2.25 || aDeg > 357.75) return '正北';
  if (Math.abs(aDeg - 90) < 2.25) return '正东';
  if (Math.abs(aDeg - 180) < 2.25) return '正南';
  if (Math.abs(aDeg - 270) < 2.25) return '正西';
  if (aDeg < 90) return '北偏东' + NF(aDeg, 0) + '°';
  if (aDeg < 180) return '南偏东' + NF(180 - aDeg, 0) + '°';
  if (aDeg < 270) return '南偏西' + NF(aDeg - 180, 0) + '°';
  return '北偏西' + NF(360 - aDeg, 0) + '°';
}

/* ============================================================
 * 二、共享绘制：磁偶极子 / 条形磁铁 / 罗盘表盘
 * ============================================================ */
/* 偶极子解析磁感线簇：r=a·sin²θ，上半 lobe + 下半镜像，各带流向箭头。
 * axisU 为磁轴单位向量（指向 N 极）；scale 控制线族大小。 */
function dipoleLines(ctx, cx, cy, ux, uy, scale) {
  var nx = -uy, ny = ux; /* 垂直基 */
  var loops = [0.55, 1.0, 1.55], side, li, i;
  for (li = 0; li < loops.length; li++) {
    var a = loops[li] * scale;
    var th0 = Math.asin(Math.sqrt(Math.min(1, 14 / a))); /* 避开奇点 */
    for (side = -1; side <= 1; side += 2) {
      var pts = [], iArrow = [];
      var NPT = 42;
      for (i = 0; i <= NPT; i++) {
        var th = th0 + (Math.PI - 2 * th0) * i / NPT;
        var r = a * Math.sin(th) * Math.sin(th);
        var px = cx + ux * r * Math.cos(th) + nx * side * r * Math.sin(th);
        var py = cy + uy * r * Math.cos(th) + ny * side * r * Math.sin(th);
        pts.push({ x: px, y: py });
        if (i === Math.floor(NPT * 0.62)) iArrow.push({ x: px, y: py });
      }
      KT().polyline(ctx, pts, { color: 'rgba(255,255,255,0.38)', width: 1.3 });
      for (i = 0; i < iArrow.length; i++) {
        var p0 = pts[Math.max(0, Math.floor(NPT * 0.62) - 4)], p1 = iArrow[i];
        ARW(ctx, p0.x, p0.y, p1.x, p1.y, 'rgba(255,255,255,0.75)', 2, 9);
      }
    }
  }
}

/* 条形磁铁：N 半红 / S 半蓝，挤压系数 sq 用于翻转动画 */
function barMagnet(ctx, cx, cy, halfLen, halfTh, pol, sq) {
  var C = KT().COLORS;
  sq = sq === undefined ? 1 : sq;
  var L = halfLen * Math.abs(sq);
  ctx.save();
  ctx.translate(cx, cy);
  /* 阴影底 */
  PN(ctx, -L - 4, -halfTh - 2, L * 2 + 8, halfTh * 2 + 12, { radius: 9, fill: 'rgba(0,0,0,0.30)' });
  var nRight = (sq >= 0 ? 1 : -1) * pol > 0; /* N 是否在右 */
  /* 左右两半 */
  var leftCol = nRight ? C.blue : C.red;
  var rightCol = nRight ? C.red : C.blue;
  RC(ctx, -L, -halfTh, L, halfTh * 2, leftCol, 'rgba(0,0,0,0.35)', 2);
  RC(ctx, 0, -halfTh, L, halfTh * 2, rightCol, 'rgba(0,0,0,0.35)', 2);
  if (L > 14) {
    TXT(ctx, nRight ? 'S' : 'N', -L / 2, 1, { align: 'center', baseline: 'middle', size: 16, weight: 'bold', color: '#fff' });
    TXT(ctx, nRight ? 'N' : 'S', L / 2, 1, { align: 'center', baseline: 'middle', size: 16, weight: 'bold', color: '#fff' });
  }
  ctx.restore();
}

/* 罗盘表盘：外环刻度 + 中文方位 + 平滑指针 */
function compassDial(ctx, cx, cy, r, needleAng, big) {
  var C = KT().COLORS;
  DISK(ctx, cx, cy, r, '#f5f0e4', '#8a7f68', big ? 3 : 2);
  DISK(ctx, cx, cy, r * 0.82, null, 'rgba(120,110,90,0.5)', 1);
  var names = [['北', -Math.PI / 2], ['东', 0], ['南', Math.PI / 2], ['西', Math.PI]];
  var i;
  for (i = 0; i < names.length; i++) {
    var ang = names[i][1];
    var tx = cx + Math.cos(ang) * r * 0.64, ty = cy + Math.sin(ang) * r * 0.64;
    TXT(ctx, names[i][0], tx, ty, { align: 'center', baseline: 'middle', size: big ? 13 : 10, weight: 'bold', color: '#5c5342' });
  }
  for (i = 0; i < 24; i++) {
    var a2 = i * Math.PI / 12;
    var r1 = r * (i % 6 === 0 ? 0.86 : 0.92);
    DST(ctx, cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1,
      cx + Math.cos(a2) * r * 0.96, cy + Math.sin(a2) * r * 0.96, 'rgba(90,80,60,0.45)', 1, []);
  }
  /* 指针：红端指场方向（B 方向），白端相反 */
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(needleAng);
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, 0); ctx.lineTo(r * 0.8, -r * 0.11); ctx.lineTo(r * 0.8, r * 0.11);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.moveTo(r * 0.12, 0); ctx.lineTo(-r * 0.8, -r * 0.11); ctx.lineTo(-r * 0.8, r * 0.11);
  ctx.closePath(); ctx.fill();
  DISK(ctx, 0, 0, r * 0.09, '#333');
  ctx.restore();
}

/* 电磁铁线圈（围绕条形磁体画 5 匝椭圆），cur 决定绕行箭头方向 */
function solenoidCoil(ctx, cx, cy, spanY, turnXs, curSign, colTop, colBot) {
  var i, rx = 9, ry = spanY;
  for (i = 0; i < turnXs.length; i++) {
    var tx = cx + turnXs[i];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(tx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = colBot;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tx, cy, rx, ry, 0, -0.15 * Math.PI, 1.15 * Math.PI);
    ctx.strokeStyle = colTop;
    ctx.stroke();
    ctx.restore();
    /* 匝上小电流箭头 */
    if (curSign !== 0) {
      var ay = cy - ry - 7;
      ARW(ctx, tx - (curSign > 0 ? 6 : -6), ay, tx + (curSign > 0 ? 6 : -6), ay, KT().COLORS.yellow, 2, 7);
    }
  }
}

/* 中央面板标签 */
function infoPanel(ctx, x, y, w, lines) {
  var h = 20 + lines.length * 17;
  PN(ctx, x, y, w, h, { radius: 9, fill: 'rgba(255,255,255,0.88)', stroke: 'rgba(0,0,0,0.25)' });
  var i;
  for (i = 0; i < lines.length; i++) {
    TXT(ctx, lines[i][0], x + 12, y + 22 + i * 17, { size: 12.5, color: lines[i][2] || '#2d3436', weight: lines[i][3] || 'normal' });
    TXT(ctx, lines[i][1], x + w - 12, y + 22 + i * 17, { size: 12.5, align: 'right', color: '#16324a', weight: 'bold' });
  }
}

/* ============================================================
 * 三、模式 1：charges —— 电荷与电场 (charges-and-fields)
 * ============================================================ */
function buildCharges(basic) {
  var st = {
    W: 800, H: 480, qs: [], drag: -1, probeDrag: false,
    probe: null, showEq: !basic, rand: null, _dcKey: ''
  };

  function place(q) {
    if (st.qs.length >= 12) { st.L.showToast('电荷数量已达上限（12 个）'); return; }
    var r = st.rand;
    st.qs.push({
      x: st.W * 0.5 + (r() - 0.5) * 120,
      y: st.H * 0.44 + (r() - 0.5) * 100,
      q: q
    });
  }

  /* 叠加场强：E=q·r̂/r²（像素示教单位），r≥RMIN 保护分母 */
  function fieldAt(px, py) {
    var ex = 0, ey = 0, i;
    for (i = 0; i < st.qs.length; i++) {
      var c = st.qs[i];
      var dx = px - c.x, dy = py - c.y;
      var d = HYP(px, py, c.x, c.y);
      if (d < 15) continue;
      ex += c.q * dx / (d * d * d);
      ey += c.q * dy / (d * d * d);
    }
    return { x: ex, y: ey, m: Math.sqrt(ex * ex + ey * ey) };
  }
  function potentialAt(px, py) {
    var v = 0, i;
    for (i = 0; i < st.qs.length; i++) {
      var d = HYP(px, py, st.qs[i].x, st.qs[i].y);
      if (d >= 15) v += st.qs[i].q / d;
    }
    return v;
  }

  function geoSize(W, H) {
    return { x0: 30, y0: 26, x1: W - 30, y1: H - 66 };
  }

  function drawFieldArrows(ctx, g) {
    /* 移动端按设备能力降级采样总数 240→144/84，保持纵横比；桌面端不变 */
    var _tot = window.Mobile ? window.Mobile.reduceParticleCount(240) : 240;
    var _r = Math.sqrt(_tot / 240);
    var cols = Math.max(8, Math.round(20 * _r)), rows = Math.max(5, Math.round(12 * _r)), i, j;
    var eMaxLog = 2.5, eMinLog = -2.5;
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var px = g.x0 + (g.x1 - g.x0) * (i + 0.5) / cols;
        var py = g.y0 + (g.y1 - g.y0) * (j + 0.5) / rows;
        var E = fieldAt(px, py);
        if (E.m < 1e-4) continue;
        var lg = Math.log10(E.m);
        var t = KT().clamp((lg - eMinLog) / (eMaxLog - eMinLog), 0, 1);
        var len = 8 + 10 * t;
        var al = 0.18 + 0.72 * t;
        ARW(ctx, px - E.x / E.m * len, py - E.y / E.m * len,
          px + E.x / E.m * len, py + E.y / E.m * len,
          'rgba(120,220,220,' + NF(al, 2) + ')', 1.6, 7);
      }
    }
  }

  /* 粗略 Marching Squares 等势线（± 若干级） */
  function drawEquipotential(ctx, g) {
    if (st.qs.length === 0) return;
    var NX = 40, NY = 26, i, j;
    var vals = [], vmax = 0;
    for (j = 0; j <= NY; j++) {
      vals.push([]);
      for (i = 0; i <= NX; i++) {
        var vx = g.x0 + (g.x1 - g.x0) * i / NX;
        var vy = g.y0 + (g.y1 - g.y0) * j / NY;
        var v = potentialAt(vx, vy);
        vals[j].push(v);
        if (Math.abs(v) > vmax) vmax = Math.abs(v);
      }
    }
    if (!(vmax > 0)) return;
    var levels = [-0.85, -0.55, -0.3, -0.12, 0.12, 0.3, 0.55, 0.85];
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(240,240,255,0.30)';
    ctx.beginPath();
    for (var L = 0; L < levels.length; L++) {
      var lv = levels[L] * vmax;
      for (j = 0; j < NY; j++) {
        for (i = 0; i < NX; i++) {
          var v00 = vals[j][i], v10 = vals[j][i + 1], v01 = vals[j + 1][i], v11 = vals[j + 1][i + 1];
          if (v00 === undefined) continue;
          /* 收集跨越阈值的两条边交点 */
          var pts = [];
          function cross(va, vb, xa, ya, xb, yb) {
            if ((va - lv) * (vb - lv) < 0) {
              var tt = (lv - va) / (vb - va);
              pts.push({ x: xa + (xb - xa) * tt, y: ya + (yb - ya) * tt });
            }
          }
          cross(v00, v10, gx(i), gy(j), gx(i + 1), gy(j));
          cross(v10, v11, gx(i + 1), gy(j), gx(i + 1), gy(j + 1));
          cross(v11, v01, gx(i + 1), gy(j + 1), gx(i), gy(j + 1));
          cross(v01, v00, gx(i), gy(j + 1), gx(i), gy(j));
          if (pts.length >= 2) {
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
          }
        }
      }
    }
    ctx.stroke();
    ctx.restore();
    function gx(i) { return g.x0 + (g.x1 - g.x0) * i / NX; }
    function gy(j) { return g.y0 + (g.y1 - g.y0) * j / NY; }
  }

  return {
    init: function (L) {
      st.L = L;
      st.rand = KT().rng(Date.now() >>> 0);
      L.setKnowledge(
        '<p><strong>场的叠加原理</strong>：空间某点的合电场等于每个点电荷单独产生电场的矢量之和。</p>' +
        '<div class="formula">E⃗ = Σ k·qᵢ·r̂ᵢ / rᵢ²</div>' +
        '<ul style="padding-left:20px"><li>红色为正电荷（场线射出），蓝色为负电荷（场线汇入）</li>' +
        '<li>靠近电荷处场强急剧增大（平方反比）</li>' +
        '<li>等势线与电场线处处垂直，沿等势线移动电荷不做功</li></ul>' +
        '<p style="color:#888">提示：拖动电荷可实时改变分布；鼠标悬停显示探针处的场值。</p>'
      );
      L.setPresets([
        { name: '电偶极子', apply: function () { st.qs = [{ x: st.W * 0.36, y: st.H * 0.42, q: 4 }, { x: st.W * 0.64, y: st.H * 0.42, q: -4 }]; } },
        { name: '两条平行带电板', apply: function () { var ys = [0.3, 0.4, 0.5, 0.6]; st.qs = []; for (var k = 0; k < 4; k++) { st.qs.push({ x: st.W * 0.34, y: st.H * ys[k], q: 2 }); st.qs.push({ x: st.W * 0.66, y: st.H * ys[k], q: -2 }); } } },
        { name: '随机布点', apply: function () { BTN随机(); } }
      ]);
      function BTN随机() { st.qs = []; for (var z = 0; z < 6; z++) place(z % 2 === 0 ? 1 : -1); }
      this._randAll = BTN随机;
    },
    getControls: function () {
      return [
        BTN('ch_p', '放置 +1 μC 电荷', function () { place(1); }),
        BTN('ch_n', '放置 −1 μC 电荷', function () { place(-1); }),
        BTN('ch_r', '随机布点', function () { st.qs = []; for (var z = 0; z < 6; z++) place(z % 2 === 0 ? 1 : -1); }),
        BTN('ch_c', '清空电荷', function () { st.qs = []; st.probe = null; st.L.showToast('已清空所有电荷'); })
      ].concat(!basic ? [CK('ch_eq', '显示等势线', st.showEq, function (v) { st.showEq = !!v; })] : []);
    },
    update: function () { /* 无随时间演化的量 */ },
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      var C = KT().COLORS, g = geoSize(W, H);
      KT().background(ctx, W, H);
      KT().grid(ctx, W, H, { step: 44, color: 'rgba(255,255,255,0.05)' });

      drawFieldArrows(ctx, g);
      if (st.showEq) drawEquipotential(ctx, g);

      /* 电荷圆球 */
      var i;
      for (i = 0; i < st.qs.length; i++) {
        var c = st.qs[i];
        var r = 8 + 4 * Math.sqrt(Math.abs(c.q));
        var col = c.q > 0 ? C.red : C.blue;
        DISK(ctx, c.x, c.y, r + 5, c.q > 0 ? 'rgba(231,76,60,0.22)' : 'rgba(52,152,219,0.22)');
        DISK(ctx, c.x, c.y, r, col, '#0e1a2a', 2);
        TXT(ctx, c.q > 0 ? '+' : '−', c.x, c.y + 1, { align: 'center', baseline: 'middle', size: 17, weight: 'bold', color: '#fff' });
        hintDrag(ctx, '👆 拖动', c.x, c.y - r - 14);
        if (i === st.drag) DISK(ctx, c.x, c.y, r + 9, null, C.yellow, 2);
      }

      /* 探针十字 + 局部 E 矢量 */
      if (st.probe) {
        var E = fieldAt(st.probe.x, st.probe.y);
        DST(ctx, st.probe.x - 11, st.probe.y, st.probe.x + 11, st.probe.y, 'rgba(255,255,255,0.85)', 1.4, []);
        DST(ctx, st.probe.x, st.probe.y - 11, st.probe.x, st.probe.y + 11, 'rgba(255,255,255,0.85)', 1.4, []);
        if (E.m > 1e-3) {
          var ln = KT().clamp(8 + 9 * Math.log10(E.m + 1), 8, 30);
          ARW(ctx, st.probe.x, st.probe.y, st.probe.x + E.x / E.m * ln, st.probe.y + E.y / E.m * ln, C.yellow, 2.2, 8);
        }
        PN(ctx, st.probe.x + 14, st.probe.y - 26, 108, 22, { radius: 6, fill: 'rgba(10,16,28,0.78)', stroke: 'rgba(255,255,255,0.2)' });
        TXT(ctx, '|E| = ' + NF(E.m, 2) + ' (示教)', st.probe.x + 68, st.probe.y - 14, { align: 'center', size: 11.5, color: '#dfe8f2' });
      }

      infoPanel(ctx, W - 196, 12, 184, [
        ['电荷总数', String(st.qs.length)],
        ['净电量 Σq', NF(netQ(), 1) + ' μC']
      ]);
      flushRows(st, [
        row('电荷总数', st.qs.length, '个'),
        row('净电量', NF(netQ(), 1), 'μC', C.purple),
        row('探针 |E|', st.probe ? NF(fieldAt(st.probe.x, st.probe.y).m, 2) : '—', '示教单位')
      ]);
      function netQ() { var s = 0; for (var k = 0; k < st.qs.length; k++) s += st.qs[k].q; return s; }
    },
    reset: function () {
      st.qs = []; st.drag = -1; st.probe = null; st.probeDrag = false;
      st.rand = KT().rng(Date.now() >>> 0);
      st._dcKey = '';
    },
    onPointerDown: function (x, y) {
      /* 命中优先级：最近的电荷优先 */
      var best = -1, bd = 1e9, i;
      for (i = 0; i < st.qs.length; i++) {
        var d = HYP(x, y, st.qs[i].x, st.qs[i].y);
        if (d < 18 + 4 * Math.sqrt(Math.abs(st.qs[i].q)) && d < bd) { bd = d; best = i; }
      }
      if (best >= 0) { st.drag = best; return; }
      st.probeDrag = true;
      st.probe = clampProbe(x, y);
    },
    hitTest: function (x, y) {
      var i;
      for (i = 0; i < st.qs.length; i++) {
        if (HYP(x, y, st.qs[i].x, st.qs[i].y) < 18 + 4 * Math.sqrt(Math.abs(st.qs[i].q))) return true;
      }
      return false;
    },
    onPointerMove: function (x, y) {
      if (st.drag >= 0) {
        var g = geoSize(st.W, st.H);
        st.qs[st.drag].x = KT().clamp(x, g.x0, g.x1);
        st.qs[st.drag].y = KT().clamp(y, g.y0, g.y1);
        return;
      }
      st.probe = clampProbe(x, y);
    },
    onPointerUp: function () { st.drag = -1; st.probeDrag = false; }
  };
  function clampProbe(x, y) {
    var g = geoSize(st.W, st.H);
    return { x: KT().clamp(x, g.x0, g.x1), y: KT().clamp(y, g.y0, g.y1) };
  }
}

/* ============================================================
 * 四、模式 2：coulomb —— 库仑定律 (coulombs-law)
 * ============================================================ */
function buildCoulomb() {
  var KQ = 8.99e9; /* N·m²/C² */
  var st = {
    q1: 5, q2: -5, rcm: 10, showSub: true, _dcKey: ''
  };
  function force() {
    var F = KQ * (st.q1 * 1e-6) * (st.q2 * 1e-6) / Math.pow(st.rcm / 100, 2);
    return isFinite(F) ? F : 0;
  }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>库仑定律</strong>：真空中两个静止点电荷之间的相互作用力，与电量乘积成正比，与距离平方成反比。</p>' +
        '<div class="formula">F = k·|q₁·q₂| / r²　(k = 8.99×10⁹ N·m²/C²)</div>' +
        '<ul style="padding-left:20px"><li>同号相斥，异号相吸</li><li>力总是大小相等、方向相反（牛顿第三定律）</li>' +
        '<li>距离减半，力增大到 4 倍</li></ul>'
      );
      L.setPresets([
        { name: '异号相吸', apply: function () { st.q1 = 5; st.q2 = -5; st.rcm = 10; } },
        { name: '同号相斥', apply: function () { st.q1 = 5; st.q2 = 5; st.rcm = 10; } },
        { name: '近距离大力量', apply: function () { st.q1 = 10; st.q2 = 10; st.rcm = 4; } }
      ]);
    },
    getControls: function () {
      return [
        SL('cl_q1', '电荷 q₁', -10, 10, 0.5, st.q1, ' μC', function (v) { st.q1 = v; }),
        SL('cl_q2', '电荷 q₂', -10, 10, 0.5, st.q2, ' μC', function (v) { st.q2 = v; }),
        SL('cl_r', '间距 r', 4, 20, 0.5, st.rcm, ' cm', function (v) { st.rcm = v; }),
        CK('cl_sub', '显示公式代入式', st.showSub, function (v) { st.showSub = !!v; })
      ];
    },
    update: function () {},
    render: function (ctx, W, H, t) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var cy = H * 0.46;
      var ppc = Math.min((W - 300) / 40, 16);          /* 像素/厘米 */
      var sep = st.rcm * ppc;
      var x1 = W / 2 - sep / 2, x2 = W / 2 + sep / 2;
      var R = 30;

      /* 刻度尺 */
      RC(ctx, W / 2 - sep / 2, cy + R + 26, sep, 6, 'rgba(255,255,255,0.35)', null);
      TXT(ctx, NF(st.rcm, 1) + ' cm', W / 2, cy + R + 48, { align: 'center', size: 13, color: '#bcd' });
      DST(ctx, x1, cy, x1, cy + R + 22, 'rgba(255,255,255,0.3)', 1);
      DST(ctx, x2, cy, x2, cy + R + 22, 'rgba(255,255,255,0.3)', 1);

      /* 力箭头：同号向外排斥，异号向内吸引 */
      var F = force(), attr = st.q1 * st.q2 < 0;
      var lg = Math.log10(Math.max(Math.abs(F), 1e-3));
      var ln = KT().clamp(lerpMap(lg, -2.5, 3, 12, 78), 12, 78);
      function lerpMap(v, a, b, c, d) { return c + (v - a) / (b - a) * (d - c); }
      var dir1 = attr ? 1 : -1;                        /* q1 受力方向 */
      ARW(ctx, x1, cy, x1 + dir1 * ln, cy, C.orange, 3.5, 11);
      ARW(ctx, x2, cy, x2 - dir1 * ln, cy, C.orange, 3.5, 11);
      TXT(ctx, 'F₁', x1 + dir1 * (ln + 20), cy - 14, { size: 13, color: C.orange, weight: 'bold', align: 'center' });
      TXT(ctx, 'F₂', x2 - dir1 * (ln + 20), cy - 14, { size: 13, color: C.orange, weight: 'bold', align: 'center' });
      TXT(ctx, attr ? '相互吸引' : '相互排斥', W / 2, cy - R - 46, { align: 'center', size: 16, weight: 'bold', color: attr ? '#7ec8ff' : C.pink });

      /* 两小球 */
      function drawBall(bx, q, name) {
        var col = q > 0 ? C.red : (q < 0 ? C.blue : C.gray);
        DISK(ctx, bx, cy, R + 5, 'rgba(255,255,255,0.10)');
        var grad = ctx.createRadialGradient(bx - 10, cy - 10, 4, bx, cy, R);
        grad.addColorStop(0, KT().rgba(col, 1));
        grad.addColorStop(1, KT().rgba(col, 0.65));
        DISK(ctx, bx, cy, R, grad, '#101827', 2.5);
        if (q !== 0) {
          TXT(ctx, q > 0 ? '+' : '−', bx, cy + 1, { align: 'center', baseline: 'middle', size: 22, weight: 'bold', color: '#fff' });
        }
        TXT(ctx, name + ' = ' + NF(q, 1) + ' μC', bx, cy - R - 16, { align: 'center', size: 13, weight: 'bold', color: col === C.gray ? C.gray : col });
      }
      drawBall(x1, st.q1, 'q₁');
      drawBall(x2, st.q2, 'q₂');

      /* 公式代入式面板 */
      if (st.showSub) {
        var str = 'F = k·q₁·q₂ / r² = 8.99×10⁹ × (' + NF(st.q1, 1) + '×10⁻⁶) × (' + NF(st.q2, 1) + '×10⁻⁶) ÷ (' + NF(st.rcm / 100, 3) + ')²';
        PN(ctx, W / 2 - 330, 16, 660, 56, { radius: 9, fill: 'rgba(8,14,26,0.8)', stroke: 'rgba(255,255,255,0.2)' });
        TXT(ctx, str, W / 2, 38, { align: 'center', size: 13, color: '#cfe3ff' });
        TXT(ctx, '= ' + SCI(F, 3) + ' N' + (F < 0 ? ' （负号代表吸引）' : ''), W / 2, 58, { align: 'center', size: 13.5, weight: 'bold', color: F < 0 ? '#7ec8ff' : C.pink });
      }

      flushRows(st, [
        row('静电力大小', SCI(Math.abs(F), 3), 'N', C.orange),
        row('作用类型', attr ? '异号相吸' : '同号相斥', '', attr ? '#7ec8ff' : C.pink),
        row('间距 r', NF(st.rcm, 1), 'cm'),
        row('电量乘积', NF(st.q1 * st.q2, 2), 'μC²')
      ]);
    },
    reset: function () { st.q1 = 5; st.q2 = -5; st.rcm = 10; st._dcKey = ''; }
  };
}

/* ============================================================
 * 五、模式 3：gravlab —— 万有引力实验室 (gravity-force-lab / basics)
 * ============================================================ */
function buildGravLab(basic) {
  var GCONST = 6.674e-11;
  var st = { m1: 100, m2: 100, distPx: 96, showCurve: false, flipT: 0, dir1: 1, _dcKey: '' };
  function massKg(m) { return m * 1e22; }
  function force() {
    var rm = st.distPx * 1e6; /* 1px ↔ 1Mm 示教换算 */
    return GCONST * massKg(st.m1) * massKg(st.m2) / (rm * rm);
  }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>万有引力定律</strong>：任意两个物体之间都存在相互吸引力。</p>' +
        '<div class="formula">F = G·m₁·m₂ / r²　(G = 6.674×10⁻¹¹ N·m²/kg²)</div>' +
        '<ul style="padding-left:20px"><li>质量越大引力越强</li><li>距离翻倍，引力衰减为 1/4（平方反比）</li>' +
        '<li>本实验使用天体级质量（10²² kg 数量级）才能得到可观的力</li></ul>'
      );
      L.setPresets([
        { name: '双恒星', apply: function () { st.m1 = 300; st.m2 = 300; st.distPx = 70; } },
        { name: '恒星级 + 行星级', apply: function () { st.m1 = 500; st.m2 = 10; st.distPx = 100; } },
        { name: '远距弱引力', apply: function () { st.m1 = 50; st.m2 = 50; st.distPx = 180; } }
      ]);
    },
    getControls: function () {
      var cs = [
        SL('gv_m1', '天体一质量 m₁', 10, 500, 10, st.m1, ' ×10²² kg', function (v) { st.m1 = v; }),
        SL('gv_m2', '天体二质量 m₂', 10, 500, 10, st.m2, ' ×10²² kg', function (v) { st.m2 = v; }),
        SL('gv_r', '间距 r', 30, 180, 1, st.distPx, ' Mm', function (v) { st.distPx = v; })
      ];
      if (!basic) cs.push(CK('gv_curve', '显示平方反比曲线缩略图', st.showCurve, function (v) { st.showCurve = !!v; }));
      else st.showCurve = false;
      return cs;
    },
    update: function (dt) {
      /* 两球被引力轻微"呼吸"缩放的动画因子 */
      st.flipT = (st.flipT + dt * 1.4) % 1;
    },
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var cy = H * 0.44;
      var ppm = Math.min((W - 320) / 190, 3.6); /* Mm→px 显示比例 */
      var sep = st.distPx * ppm;
      var x1 = W / 2 - sep / 2, x2 = W / 2 + sep / 2;
      var r1 = KT().clamp(14 + 20 * Math.cbrt(st.m1 / 500), 16, 40);
      var r2 = KT().clamp(14 + 20 * Math.cbrt(st.m2 / 500), 16, 40);

      /* 力箭头互指，长度 ∝ logF */
      var F = force();
      var lg = Math.log10(Math.max(F, 1e5));
      var ln = KT().clamp(10 + (lg - 17) / 6 * 58, 10, 74);
      ARW(ctx, x1 - 60, cy, x1 - 60 + ln, cy, C.yellow, 4, 12);
      ARW(ctx, x2 + 60, cy, x2 + 60 - ln, cy, C.yellow, 4, 12);
      TXT(ctx, SCI(F, 2) + ' N', W / 2, cy - 66, { align: 'center', size: 17, weight: 'bold', color: C.yellow });

      /* 天体绘制 */
      function body(bx, rad, colA, colB, seedBase, lab, mv) {
        var grad = ctx.createRadialGradient(bx - rad * 0.3, cy - rad * 0.3, rad * 0.15, bx, cy, rad);
        grad.addColorStop(0, colA); grad.addColorStop(1, colB);
        DISK(ctx, bx, cy, rad, grad, '#0c1322', 2);
        var rnd = KT().rng(seedBase), k;
        for (k = 0; k < 6; k++) { /* 固定陨石坑 */
          var aa = rnd() * 6.28, rr = rad * (0.25 + rnd() * 0.55);
          DISK(ctx, bx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, rad * (0.06 + rnd() * 0.08), 'rgba(0,0,0,0.22)');
        }
        TXT(ctx, lab, bx, cy + rad + 22, { align: 'center', size: 12.5, weight: 'bold', color: colA });
        if (mv) { /* 大天体外发光呼吸 */
          DISK(ctx, bx, cy, rad * (1.06 + 0.04 * Math.sin(st.flipT * 6.28)), null, KT().rgba(colA, 0.35), 3);
        }
      }
      body(x1, r1, '#b183e0', '#5b3a94', 20240101, 'm₁ = ' + st.m1 + ' ×10²² kg', true);
      body(x2, r2, '#ffb95e', '#a05a12', 20240202, 'm₂ = ' + st.m2 + ' ×10²² kg', true);

      /* 中点标注 */
      TXT(ctx, 'r = ' + st.distPx + ' Mm', W / 2, cy + 84, { align: 'center', size: 13, color: '#bcd' });
      DST(ctx, x1, cy + 62, x2, cy + 62, 'rgba(255,255,255,0.4)', 1);

      infoPanel(ctx, 14, 12, 250, [
        ['万有引力 F', SCI(F, 2) + ' N'],
        ['质量乘积', NF(st.m1 * st.m2, 0) + ' ×10⁴⁴ kg²'],
        ['间距 r', st.distPx + ' Mm']
      ]);

      /* inverse-square 缩略图（log-log 直线 斜率 -2） */
      if (st.showCurve) {
        var iw = 200, ih = 130, ix = W - iw - 18, iy = H - ih - 18;
        PN(ctx, ix, iy, iw, ih, { radius: 9, fill: 'rgba(10,16,30,0.85)', stroke: 'rgba(255,255,255,0.22)' });
        TXT(ctx, 'log F − log r（斜率 −2）', ix + iw / 2, iy + 18, { align: 'center', size: 12, color: '#cde' });
        var ax0 = ix + 34, ay0 = iy + ih - 24, awd = iw - 54, aht = ih - 56;
        DST(ctx, ax0, ay0, ax0 + awd, ay0, 'rgba(255,255,255,0.5)', 1.2, []);
        DST(ctx, ax0, ay0 - aht, ax0, ay0, 'rgba(255,255,255,0.5)', 1.2, []);
        TXT(ctx, 'log r', ix + iw - 16, ay0 + 12, { size: 10, color: '#abc', align: 'right' });
        TXT(ctx, 'log F', ax0 - 8, ay0 - aht - 6, { size: 10, color: '#abc', align: 'left' });
        var pts = [], p;
        for (p = 0; p <= 20; p++) {
          var lx = p / 20 * awd;
          var ly = aht * p / 20; /* 直线向下 斜率-2 形状示意 */
          pts.push({ x: ax0 + lx, y: ay0 - aht + ly });
        }
        KT().polyline(ctx, pts, { color: C.teal, width: 2.5 });
        /* 当前状态对应点 */
        var cl = KT().clamp((st.distPx - 30) / 150, 0, 1);
        DISK(ctx, ax0 + cl * awd, ay0 - aht + cl * aht, 5, C.yellow, '#fff', 1);
      }
    },
    reset: function () { st.m1 = 100; st.m2 = 100; st.distPx = 96; st.showCurve = false; st._dcKey = ''; }
  };
}

/* ============================================================
 * 六、模式 4：magnetsA —— 磁铁和电磁铁 (magnets-electromagnets)
 * ============================================================ */
function buildMagnetsA() {
  var st = {
    pol: 1, coil: false, cur: 5,
    flip: 0, flipping: false, flipFrom: 1,
    ndAng: 0, tick: 0, _dcKey: ''
  };
  function effAngle() {
    /* 有效磁轴角：翻转动画期间平滑旋转 π */
    var base = st.pol > 0 ? 0 : Math.PI;
    if (st.flipping) base += Math.PI * easeInOut(st.flip);
    return base;
  }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function dipoleField(px, py, mx, my, ang, mstr) {
    /* B ∝ (3(m·r̂)r̂ − m)/r³ 的平面简化（示教标度） */
    var dx = px - mx, dy = py - my;
    var r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
    if (r < 26 || !(mstr > 0)) return null;
    var mxv = Math.cos(ang) * mstr, myv = Math.sin(ang) * mstr;
    var dot = (mxv * dx + myv * dy) / r2;
    var bx = 3 * dot * dx - mxv, by = 3 * dot * dy - myv;
    var f = mstr / (r2 * r);
    return { x: bx * f * 1e-3, y: by * f * 1e-3 };
  }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>磁体的磁感线</strong>：从 N 极出发经外部空间回到 S 极的闭合曲线。</p>' +
        '<ul style="padding-left:20px"><li>通电螺线管的磁场与条形磁铁相似——电流即产生磁场</li>' +
        '<li>安培定则：右手四指顺电流方向弯曲，拇指所指为 N 极</li>' +
        '<li>改变电流方向，磁极对调</li></ul>' +
        '<p style="color:#888">提示：右下角罗盘的指针始终沿所在位置的磁场方向。</p>'
      );
      L.setPresets([
        { name: '标准条形磁铁', apply: function () { st.coil = false; st.pol = 1; st.flipping = false; st.flip = 0; } },
        { name: '接通线圈（正向电流）', apply: function () { st.coil = true; st.cur = 8; } },
        { name: '反向电流', apply: function () { st.coil = true; st.cur = -8; st.pol = 1; st.flipping = false; st.flip = 0; } }
      ]);
    },
    getControls: function () {
      return [
        BTN('mg_flip', '翻转极性', function () {
          if (st.flipping) return;
          st.flipping = true; st.flip = 0; st.flipFrom = st.pol;
        }),
        CK('mg_coil', '电磁线圈模式', st.coil, function (v) { st.coil = !!v; }),
        SL('mg_cur', '线圈电流 I', -10, 10, 0.5, st.cur, ' A', function (v) { st.cur = v; })
      ];
    },
    update: function (dt) {
      st.tick += dt;
      if (st.flipping) {
        st.flip += dt / 0.7;
        if (st.flip >= 1) { st.flip = 0; st.flipping = false; st.pol *= -1; }
      }
      /* 线圈模式下等效磁矩强度随 |I|，方向由电流符号决定 */
      var mstr, ang;
      if (st.coil) {
        if (st.cur === 0) return; /* 未通电：无磁场，指针保持 */
        mstr = 4.2e6 * KT().clamp(Math.abs(st.cur) / 10, 0.15, 1);
        ang = st.cur > 0 ? 0 : Math.PI;
      } else {
        mstr = 4.2e6;
        ang = effAngle();
      }
      var W = st.W || 800, H = st.H || 480;
      var B = dipoleField(W - 70, H - 70, W / 2, H * 0.44, ang, mstr);
      if (B && (B.x || B.y)) {
        var targ = Math.atan2(B.y, B.x);
        st.ndAng = angEMA(st.ndAng, targ, dt * 5);
      }
    },
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var cx = W * 0.5, cy = H * 0.44;

      var ang = st.coil ? (st.cur > 0 ? 0 : Math.PI) : effAngle();
      var ux = Math.cos(ang), uy = Math.sin(ang) * 0.999;
      var dispPol = st.coil ? (st.cur === 0 ? 0 : (st.cur > 0 ? 1 : -1)) : st.pol;
      var sq = st.coil ? (dispPol === 0 ? 0.02 : Math.abs(Math.cos(ang))) : Math.cos(effAngle());
      var len = 118, th = 21;

      var lineScale = st.coil ? 150 * KT().clamp(Math.abs(st.cur) / 10, 0, 1.15) : 150;
      if (lineScale > 8) dipoleLines(ctx, cx, cy, ux, uy, lineScale);
      barMagnet(ctx, cx, cy, len, th, st.coil ? 1 : st.pol, sq);

      if (st.coil) {
        var turns = [-50, -25, 0, 25, 50];
        solenoidCoil(ctx, cx, cy, th + 30, turns, st.cur > 0 ? 1 : (st.cur < 0 ? -1 : 0), '#ffd94d', '#a88a1a');
        var wireY = cy + th + 34;
        KT().polyline(ctx, [{ x: cx - 150, y: wireY }, { x: cx - 120, y: wireY }, { x: cx + 120, y: wireY }, { x: cx + 150, y: wireY }], { color: '#d9b64e', width: 3 });
        ARW(ctx, cx - 140, wireY, cx - 116, wireY, C.yellow, 2.4, 8);
        ARW(ctx, cx + 116, wireY, cx + 140, wireY, C.yellow, 2.4, 8);
        TXT(ctx, 'I = ' + NF(st.cur, 1) + ' A（' + (st.cur > 0 ? '正向' : st.cur < 0 ? '反向' : '无电流') + '）', cx, wireY + 20, { align: 'center', size: 12.5, color: C.yellow });
        if (st.cur === 0) TXT(ctx, '电流为零：未通电磁铁几乎没有磁性', cx, cy - th - 66, { align: 'center', size: 12.5, color: '#ffb0b0' });
      } else if (st.flipping) {
        TXT(ctx, '翻转中…', cx, cy - th - 46, { align: 'center', size: 13, color: C.orange, weight: 'bold' });
      }

      /* 极性标识大字 */
      var nl = st.coil ? (st.cur > 0 ? 'N' : st.cur < 0 ? 'S' : '?') : (((sq < 0 ? -1 : 1) * st.pol) > 0 ? 'N 左' : 'S 左');
      TXT(ctx, '左端：' + nl, 20, H - 60, { size: 13.5, color: '#dfe8f2', weight: 'bold' });
      var nr = st.coil ? (st.cur > 0 ? 'S' : st.cur < 0 ? 'N' : '?') : (((sq < 0 ? -1 : 1) * st.pol) > 0 ? 'S 右' : 'N 右');
      TXT(ctx, '右端：' + nr, 160, H - 60, { size: 13.5, color: '#dfe8f2', weight: 'bold' });

      /* 右下角罗盘 */
      compassDial(ctx, W - 70, H - 70, 42, st.ndAng, true);

      var needDeg = ((st.ndAng * 180 / Math.PI) % 360 + 360) % 360;
      flushRows(st, [
        row('线圈电流', NF(st.cur, 1), 'A', C.yellow),
        row('磁极极性', st.coil ? (st.cur > 0 ? 'N—S（左N右S）' : st.cur < 0 ? 'S—N（左S右N）' : '无磁性') : (nl.indexOf('N') >= 0 ? 'N左 S右' : 'S左 N右'), ''),
        row('罗盘指针角', NF(needDeg, 0), '°', C.teal)
      ]);
    },
    reset: function () {
      st.pol = 1; st.coil = false; st.cur = 5; st.flipping = false; st.flip = 0; st.ndAng = 0; st._dcKey = '';
    }
  };
}

/* ============================================================
 * 七、模式 5：compassmode —— 磁铁与指南针 (magnet-and-compass)
 * ============================================================ */
function buildCompassMode() {
  var st = {
    W: 800, H: 480, pol: 1,
    mx: 280, my: 260,
    roam: { x: 520, y: 180 },
    mainAng: 0, roamAng: 0,
    showLines: true,
    drag: '', offX: 0, offY: 0, _dcKey: ''
  };
  function fieldAng(px, py) {
    var dx = px - st.mx, dy = py - st.my;
    var r = Math.sqrt(dx * dx + dy * dy);
    if (r < 30) return null;
    /* 二维近似偶极场方向（只取方向足够） */
    var ang = st.pol > 0 ? 0 : Math.PI;
    var mxv = Math.cos(ang), myv = Math.sin(ang);
    var r2 = dx * dx + dy * dy;
    var dot = (mxv * dx + myv * dy) / r2;
    var bx = 3 * dot * dx - mxv, by = 3 * dot * dy - myv;
    return Math.atan2(by, bx);
  }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>指南针的工作原理</strong>：小磁针在地磁场或附近磁体的磁场中受力，最终停在磁感应强度方向上。</p>' +
        '<ul style="padding-left:20px"><li>磁针红端指向该位置的磁场方向</li>' +
        '<li>磁体附近会压倒地磁场，使指针大幅偏转</li>' +
        '<li>把磁铁拖到罗盘旁边，观察偏转剧烈的位置差异</li></ul>' +
        '<p style="color:#888">提示：拖动磁铁本体或自由罗盘即可移动它们。</p>'
      );
      L.setPresets([
        { name: '贴近观察', apply: function () { st.mx = 430; st.my = 210; st.roam = { x: 600, y: 250 }; } },
        { name: '远离恢复地磁', apply: function () { st.mx = 160; st.my = 400; st.roam = { x: 520, y: 150 }; } }
      ]);
    },
    getControls: function () {
      return [
        CK('cp_lines', '显示磁感线', st.showLines, function (v) { st.showLines = !!v; }),
        BTN('cp_resetpos', '复位位置', function () { st.mx = 280; st.my = 260; st.roam = { x: 520, y: 180 }; })
      ];
    },
    update: function (dt) {
      var t1 = fieldAng(st.W - 96, 84) || 0;
      st.mainAng = angEMA(st.mainAng, t1, dt * 6);
      var t2 = fieldAng(st.roam.x, st.roam.y);
      if (t2 !== null) st.roamAng = angEMA(st.roamAng, t2, dt * 6);
    },
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      KT().background(ctx, W, H);
      if (st.showLines) {
        dipoleLines(ctx, st.mx, st.my, st.pol > 0 ? 1 : -1, 0, 140);
      }
      barMagnet(ctx, st.mx, st.my, 74, 16, st.pol, 1);
      hintDrag(ctx, '👆 拖动磁铁', st.mx, st.my - 16 - 14);
      if (st.drag === 'mag') DISK(ctx, st.mx, st.my, 88, null, KT().COLORS.yellow, 2);

      /* 主罗盘（右上固定） */
      compassDial(ctx, W - 96, 84, 52, st.mainAng, true);
      /* 自由罗盘 */
      compassDial(ctx, st.roam.x, st.roam.y, 34, st.roamAng, false);
      hintDrag(ctx, '👆 拖动罗盘', st.roam.x, st.roam.y - 34 - 14);
      if (st.drag === 'roam') DISK(ctx, st.roam.x, st.roam.y, 42, null, KT().COLORS.yellow, 2);
      TXT(ctx, '自由罗盘（可拖动）', st.roam.x, st.roam.y + 48, { align: 'center', size: 11, color: '#aab6c4' });

      var deg = (((fieldAng(st.W - 96, 84) !== null ? fieldAng(st.W - 96, 84) * 180 / Math.PI : 90)) + 360) % 360;
      /* 屏幕北为上方：角从北顺时针计 */
      var fromNorth = ((deg + 90) % 360 + 360) % 360;
      TXT(ctx, '主罗盘：' + bearingWord(fromNorth), W - 96, 152, { align: 'center', size: 12.5, weight: 'bold', color: '#ffe08a' });

      flushRows(st, [
        row('主罗盘指向', bearingWord(fromNorth), '', KT().COLORS.orange),
        row('自由罗盘方位', bearingWord((((((st.roamAng * 180 / Math.PI) + 90) % 360) + 360) % 360), 0), ''),
        row('磁铁位置', '(' + NF(st.mx, 0) + ', ' + NF(st.my, 0) + ')', 'px')
      ]);
    },
    reset: function () {
      st.mx = 280; st.my = 260; st.roam = { x: 520, y: 180 };
      st.mainAng = 0; st.roamAng = 0; st.drag = ''; st._dcKey = '';
    },
    onPointerDown: function (x, y) {
      if (HYP(x, y, st.roam.x, st.roam.y) < 40) { st.drag = 'roam'; st.offX = x - st.roam.x; st.offY = y - st.roam.y; return; }
      if (HYP(x, y, st.mx, st.my) < 90) { st.drag = 'mag'; st.offX = x - st.mx; st.offY = y - st.my; }
    },
    hitTest: function (x, y) {
      if (HYP(x, y, st.roam.x, st.roam.y) < 40) return true;
      if (HYP(x, y, st.mx, st.my) < 90) return true;
      return false;
    },
    onPointerMove: function (x, y) {
      if (!st.drag) return;
      var nx = KT().clamp(x - st.offX, 60, st.W - 60);
      var ny = KT().clamp(y - st.offY, 60, st.H - 60);
      if (st.drag === 'mag') { st.mx = nx; st.my = ny; }
      else { st.roam.x = nx; st.roam.y = ny; }
    },
    onPointerUp: function () { st.drag = ''; }
  };
}

/* ============================================================
 * 八、模式 6：emlab —— 法拉第电磁实验室（简化场景）
 * ============================================================ */
function buildEMLab() {
  var st = {
    mode: 'auto', magX: 90, freq: 1, tAuto: 0,
    flux: 0, prevFlux: 0, emf: 0, galf: 0, flick: 0,
    bulbFlash: 0, arrowPhase: 0, drag: false, _dcKey: ''
  };
  function fluxOf(x) { return Math.exp(-(x * x) / (2 * 52 * 52)); } /* 相对磁通 bump */
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>电磁感应现象</strong>：穿过闭合回路的磁通量发生变化时，回路中会产生感应电动势。</p>' +
        '<div class="formula">EMF = −ΔΦ / Δt　（楞次定律：感应电流阻碍磁通变化）</div>' +
        '<ul style="padding-left:20px"><li>磁铁插入线圈：磁通增大 → 一个方向的感应电流</li>' +
        '<li>拔出：反向电流；静止时磁通不变，电流为零</li>' +
        '<li>磁铁运动越快，感应电动势越大</li></ul>'
      );
      L.setPresets([
        { name: '手动插拔', apply: function () { st.mode = 'manual'; st.magX = 90; } },
        { name: '慢速往复 0.6Hz', apply: function () { st.mode = 'auto'; st.freq = 0.6; } },
        { name: '快速往复 2Hz', apply: function () { st.mode = 'auto'; st.freq = 2; } }
      ]);
    },
    getControls: function () {
      return [
        SL('em_x', '磁铁水平位置', -150, 150, 2, st.magX, ' px', function (v) { st.magX = v; }),
        SEL('em_mode', '运动方式', [['auto', '往复自动'], ['manual', '手动']], st.mode,
          function (v) { st.mode = String(v); st.tAuto = 0; }),
        SL('em_f', '往复频率 f', 0.5, 2, 0.1, st.freq, ' Hz', function (v) { st.freq = v; })
      ];
    },
    update: function (dt, t) {
      st.arrowPhase += dt;
      var x = st.magX;
      if (st.mode === 'auto') {
        st.tAuto += dt;
        x = Math.sin(6.28318 * st.freq * st.tAuto) * 148;
        st.magX = x;
      }
      st.prevFlux = st.flux;
      st.flux = fluxOf(x);
      st.emf = dt > 0 ? -(st.flux - st.prevFlux) / dt : 0;
      st.galf = EMA(st.galf, st.emf, dt * 8);
      st.flick = (KT().rng(Math.floor(t * 47 + 99))()) * 0.08;
      if (Math.abs(st.emf) > 0.05) st.bulbFlash = EMA(st.bulbFlash, KT().clamp(Math.abs(st.emf) * 1.6, 0, 1), dt * 10);
      else st.bulbFlash = EMA(st.bulbFlash, 0, dt * 6);
    },
    render: function (ctx, W, H, t) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var cy = H * 0.48, coilX = W * 0.36;

      /* 导轨 */
      DST(ctx, coilX - 170, cy, coilX + 320, cy, 'rgba(255,255,255,0.18)', 1.5, []);

      /* 线圈：3 匝并列竖直椭圆 */
      var i, gap = 34, coilHalf = 66;
      for (i = -1; i <= 1; i++) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(coilX + i * gap, cy, 17, coilHalf, 0, 0, 6.28318);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#c98f2f';
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(coilX + i * gap, cy, 17, coilHalf, 0, -0.6, 2.1);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#e8b64f';
        ctx.stroke();
        ctx.restore();
      }
      /* 引出线至检流计与灯泡 */
      KT().polyline(ctx, [{ x: coilX - gap, y: cy + coilHalf }, { x: coilX - gap - 20, y: cy + coilHalf + 34 }, { x: coilX + gap + 40, y: cy + coilHalf + 34 }, { x: coilX + gap, y: cy + coilHalf }], { color: '#b98a33', width: 3 });

      /* 运动的条形磁铁 */
      var mgx = coilX + st.magX;
      barMagnet(ctx, mgx, cy, 52, 13, st.mode === 'auto' ? (Math.cos(6.28318 * st.freq * st.tAuto) > 0 ? 1 : 1) : 1, 1);
      hintDrag(ctx, '👆 拖动', mgx, cy - 13 - 14);
      if (st.drag) DISK(ctx, mgx, cy, 62, null, C.yellow, 2.5);
      if (st.mode === 'auto') {
        var velSign = Math.cos(6.28318 * st.freq * st.tAuto) > 0 ? 1 : -1;
        ARW(ctx, mgx, cy - 34, mgx + velSign * 26, cy - 34, C.sky, 2.6, 9);
        TXT(ctx, '自动往复', mgx, cy + 40, { align: 'center', size: 11.5, color: C.sky });
      } else {
        TXT(ctx, '手动滑块控制', mgx, cy + 40, { align: 'center', size: 11.5, color: '#9fb' });
      }

      /* 检流计：中央零位表针 */
      var gx = coilX + 150, gyy = cy + coilHalf + 82;
      PN(ctx, gx - 52, gyy - 34, 104, 76, { radius: 10, fill: '#f3efe2', stroke: '#9a8f74' });
      TXT(ctx, '检流计', gx, gyy - 19, { align: 'center', size: 11, color: '#6b5d3f', weight: 'bold' });
      ctx.save();
      ctx.beginPath(); ctx.arc(gx, gyy + 18, 24, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = '#fffdf6'; ctx.fill();
      ctx.strokeStyle = '#8d8061'; ctx.lineWidth = 1.5; ctx.stroke();
      /* 刻度 */
      DST(ctx, gx, gyy - 2, gx, gyy + 6, '#7a6f52', 1, []);
      var angc = -Math.PI / 2 + KT().clamp(st.galf * 4, -1, 1) * 1.2;
      ARW(ctx, gx, gyy + 18, gx + Math.cos(angc) * 22, gyy + 18 + Math.sin(angc) * 22, st.galf > 0 ? C.red : C.blue, 2.6, 8);
      ctx.restore();

      /* 灯泡亮度 ∝|EMF|（含微噪闪烁） */
      var br = KT().clamp(KT().clamp(Math.abs(st.emf) * 1.6, 0, 1) - st.flick, 0, 1);
      var bulbX = coilX - 120, bulbY = cy + coilHalf + 70;
      DISK(ctx, bulbX, bulbY, 20 + 12 * br, br > 0.02 ? 'rgba(255,220,90,' + NF(0.25 + 0.5 * br, 2) + ')' : 'transparent');
      DISK(ctx, bulbX, bulbY, 15, br > 0.02 ? KT().rgba('#ffd94d', 0.35 + 0.65 * br) : '#4a4634', '#caa83c', 2);
      TXT(ctx, '灯泡亮度 ∝ |EMF|', bulbX, bulbY + 34, { align: 'center', size: 11, color: '#ccc' });

      /* 感生电流方向指示箭头（环绕线圈流动感） */
      var dirs = Math.abs(st.emf) > 0.04 ? (st.emf > 0 ? 1 : -1) : 0;
      if (dirs !== 0) {
        var ph = (st.arrowPhase * 2.2) % 1;
        var ay = cy - coilHalf - 12;
        var xseg = coilX + (ph * 2 - 1) * gap * 1.4;
        ARW(ctx, xseg - dirs * 10, ay, xseg + dirs * 10, ay, C.teal, 3, 9);
        TXT(ctx, '感生电流：' + (st.emf > 0 ? '↺ 正向环流' : '↻ 反向环流'), coilX, cy - coilHalf - 32, { align: 'center', size: 12.5, color: C.teal, weight: 'bold' });
      } else {
        TXT(ctx, '磁通不变 → 无感应电流', coilX, cy - coilHalf - 32, { align: 'center', size: 12.5, color: '#89a' });
      }

      var fluxPct = st.flux * 100;
      TXT(ctx, 'Φ 相对值 = ' + NF(fluxPct, 0) + '%', coilX, 44, { align: 'center', size: 13, color: '#cde', weight: 'bold' });

      flushRows(st, [
        row('磁通 Φ 相对值', NF(fluxPct, 0), '%', C.purple),
        row('感应电动势 EMF', NF(st.emf, 2), 'V（相对）', C.orange),
        row('电流方向', dirs > 0 ? '↺ 正向' : dirs < 0 ? '↻ 反向' : '—', '', C.teal)
      ]);
    },
    reset: function () {
      st.mode = 'auto'; st.magX = 90; st.freq = 1; st.tAuto = 0;
      st.flux = fluxOf(st.magX); st.prevFlux = st.flux;
      st.emf = 0; st.galf = 0; st.bulbFlash = 0; st.drag = false; st._dcKey = '';
    },
    onPointerDown: function (x, y) {
      var coilX = (st.W || 800) * 0.36, cy = (st.H || 480) * 0.48;
      var mgx = coilX + st.magX;
      if (HYP(x, y, mgx, cy) < 52) { st.drag = true; st.mode = 'manual'; st.tAuto = 0; }
    },
    hitTest: function (x, y) {
      var coilX = (st.W || 800) * 0.36, cy = (st.H || 480) * 0.48;
      var mgx = coilX + st.magX;
      return HYP(x, y, mgx, cy) < 52;
    },
    onPointerMove: function (x, y) {
      if (!st.drag) return;
      var coilX = (st.W || 800) * 0.36;
      st.magX = KT().clamp(x - coilX, -150, 150);
    },
    onPointerUp: function () { st.drag = false; }
  };
}

/* ============================================================
 * 九、模式 7：faradaybulb —— 法拉第定律 (faradays-law)
 * ============================================================ */
function buildFaradayBulb() {
  var st = {
    pos: 120, vel: 0, emf: 0, lit: false, bright: 0,
    drag: false, jiggleT: 0, shakeSeed: 1, _dcKey: ''
  };
  function fluxOf(p) { return Math.exp(-(p * p) / (2 * 46 * 46)); }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>没有变化就没有感应！</strong>磁铁只有在线圈中<strong>运动</strong>时灯泡才会亮——静止时哪怕完全套在线圈里也毫无电流。</p>' +
        '<div class="formula">EMF ∝ ΔΦ/Δt（变化率！）</div>' +
        '<ul style="padding-left:20px"><li>快速插拔 → 明亮闪光</li><li>缓慢移动 → 微弱电流甚至不亮</li>' +
        '<li>点击"快速抖动"一键制造高速变化的磁通</li></ul>'
      );
      L.setPresets([
        { name: '待机状态', apply: function () { st.pos = 120; st.vel = 0; st.emf = 0; st.jiggleT = 0; } },
        { name: '深入线圈后抖动', apply: function () { st.pos = 0; st.jiggleT = 2.4; } }
      ]);
    },
    getControls: function () {
      return [
        BTN('fb_jiggle', '⚡ 快速抖动（自动摇）', function () { st.jiggleT = 2.0; st.shakeSeed++; st.L.showToast('正在快速抖动磁铁…'); })
      ];
    },
    update: function (dt, t) {
      var prevPos = st.pos;
      if (st.jiggleT > 0) {
        st.jiggleT -= dt;
        st.pos = Math.sin(t * 26 + st.shakeSeed * 3) * 125;
      } else if (st.drag) {
        /* 由指针事件直接设定位置 */
        st.vel = dt > 0 ? (st.pos - prevPos) / dt : 0;
      }
      st.vel = dt > 0 ? (st.pos - prevPos) / dt : 0;
      var phi = fluxOf(st.pos), phiPrev = fluxOf(prevPos);
      st.emf = dt > 0 ? -(phi - phiPrev) / dt * 380 : 0; /* mV 相对标度 */
      var thr = 26;
      st.lit = Math.abs(st.emf) > thr;
      st.bright = EMA(st.bright, st.lit ? KT().clamp(Math.abs(st.emf) / 160, 0.25, 1) : 0, dt * 9);
    },
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var cy = H * 0.46, railY = cy;
      var cx = W * 0.42;

      /* 滑槽 */
      PN(ctx, cx - 240, railY + 26, 480, 10, { radius: 5, fill: 'rgba(255,255,255,0.10)' });
      DST(ctx, cx - 232, railY, cx + 232, railY, 'rgba(255,255,255,0.16)', 1.5, [7, 5]);

      /* 线圈（俯视环形透视） */
      var i;
      for (i = 0; i < 4; i++) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx + (i - 1.5) * 22, cy, 13, 58, 0, 0, 6.28318);
        ctx.lineWidth = 5;
        ctx.strokeStyle = i % 2 ? '#c98f2f' : '#e2ad44';
        ctx.stroke();
        ctx.restore();
      }
      TXT(ctx, '线圈', cx, cy - 76, { align: 'center', size: 12.5, color: '#cab87e' });

      /* 手持磁铁 icon 沿滑槽 */
      var mx = cx + KT().clamp(st.pos, -135, 135);
      /* "手"图标简笔 */
      DISK(ctx, mx + 20, railY - 34, 8, '#e8b98d');
      RC(ctx, mx - 44, railY - 12, 128, 10, 'transparent', 'rgba(255,255,255,0.0)', 0);
      barMagnet(ctx, mx, railY, 40, 12, 1, 1);
      hintDrag(ctx, '👆 拖动', mx, railY - 12 - 14);
      /* 速度箭头 */
      if (Math.abs(st.vel) > 12) ARW(ctx, mx, railY - 30, mx + KT().clamp(st.vel * 0.14, -44, 44), railY - 30, C.sky, 2.4, 8);

      /* 灯泡与导线 */
      var bulbX = cx + 300 > W - 60 ? W - 70 : cx + 300, bulbY = cy - 30;
      KT().polyline(ctx, [
        { x: cx + 66, y: cy + 58 }, { x: bulbX - 30, y: cy + 58 }, { x: bulbX, y: cy + 8 },
        { x: bulbX, y: cy - 8 }
      ], { color: '#b98a33', width: 3 });
      KT().polyline(ctx, [
        { x: cx - 66, y: cy + 58 }, { x: cx - 90, y: cy + 120 }, { x: bulbX, y: cy + 120 }, { x: bulbX, y: cy + 14 }
      ], { color: '#8a6b2b', width: 3 });
      var glow = st.bright;
      if (glow > 0.03) {
        DISK(ctx, bulbX, bulbY - 6, 26 + 26 * glow, 'rgba(255,214,80,' + NF(0.18 + 0.5 * glow, 2) + ')');
      }
      DISK(ctx, bulbX, bulbY - 6, 17, glow > 0.03 ? KT().rgba('#ffe07a', 0.4 + 0.6 * glow) : '#574f39', '#caa83c', 2.2);
      RC(ctx, bulbX - 9, bulbY + 9, 18, 12, '#8d7c4d', '#6b5d3f', 1.5);
      TXT(ctx, st.lit ? '💡 点亮！变化率足够大' : '熄灭：磁通几乎没变', bulbX, bulbY + 48, { align: 'center', size: 12.5, weight: 'bold', color: st.lit ? C.yellow : '#93a3b5' });

      /* 数据标注 */
      infoPanel(ctx, 14, 12, 230, [
        ['瞬时速率', NF(Math.abs(st.vel), 0) + ' px/s'],
        ['感应电动势', NF(st.emf, 0) + ' mV（相对）'],
        ['灯泡状态', st.lit ? '点亮' : '熄灭']
      ]);
      if (st.jiggleT > 0) {
        TXT(ctx, '抖动进行中… ' + NF(st.jiggleT, 1) + 's', 158, 116, { size: 12, color: C.yellow });
      }

      flushRows(st, [
        row('瞬时速率', NF(Math.abs(st.vel), 0), 'cm/s（示教）', C.sky),
        row('EMF', NF(Math.abs(st.emf), 0), 'mV', C.orange),
        row('是否点亮', st.lit ? '是 💡' : '否', '', st.lit ? C.yellow : C.gray)
      ]);
    },
    reset: function () {
      st.pos = 120; st.vel = 0; st.emf = 0; st.lit = false; st.bright = 0;
      st.drag = false; st.jiggleT = 0; st._dcKey = '';
    },
    onPointerDown: function (x, y) {
      var cx = st.W * 0.42, railY = st.H * 0.46;
      var mx = cx + st.pos;
      if (HYP(x, y, mx, railY) < 52) st.drag = true;
    },
    hitTest: function (x, y) {
      var cx = (st.W || 800) * 0.42, railY = (st.H || 480) * 0.46;
      var mx = cx + st.pos;
      return HYP(x, y, mx, railY) < 52;
    },
    onPointerMove: function (x, y) {
      if (st.drag) {
        var cx = st.W * 0.42;
        st.pos = KT().clamp(x - cx, -135, 135);
        st.jiggleT = 0;
      }
    },
    onPointerUp: function () { st.drag = false; }
  };
}

/* ============================================================
 * 十、模式 8：generatorTurbine —— 发电机 (generator)
 * ============================================================ */
function buildGenerator() {
  var st = { strength: 0.75, loops: 2, area: 0.5, theta: 0, omega: 0, flow: 0.5,
    drag: false, lastDragTime: 0, lastDragA: 0, e: 0, buf: [], flick: 0,
    showElectrons: false, showCompass: true, showFieldMeter: true, _dcKey: '' };
  for (var z = 0; z < 160; z++) st.buf.push(0);
  var MAXW = 12; // 最大角速度 rad/s
  function E0() { return st.loops * st.strength * st.area * MAXW; } // 归一化峰值
  function emf() { return st.loops * st.strength * st.area * st.omega * Math.sin(st.theta); }
  function rpm() { return st.omega * 60 / 6.28318; }
  function DIM2() { return 'rgba(255,255,255,0.5)'; }

  function turPos() { return { x: (st.W || 800) * 0.34, y: (st.H || 480) * 0.54 }; }

  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>发电机 Generator</strong>：磁铁在拾波线圈中旋转，穿过线圈的磁通量周期性变化，感应出正弦交流电动势——这就是<b>法拉第电磁感应定律</b>。</p>' +
        '<div class="formula">e = N · B · A · ω · sin(ωt)</div>' +
        '<ul style="padding-left:20px">' +
        '<li><b>N</b> 线圈圈数、<b>B</b> 磁铁强度、<b>A</b> 线圈面积、<b>ω</b> 转速（角速度）</li>' +
        '<li>转速越快、磁铁越强、圈数越多，峰值电压越高</li>' +
        '<li>打开水龙头让水流驱动涡轮，或直接拖动涡轮手动旋转</li>' +
        '<li>电子流方向可用「显示电子」观察，场强计可测量磁场大小与方向</li></ul>'
      );
      L.setPresets([
        { name: '全速发电', apply: function () { st.flow = 1; st.strength = 1; } },
        { name: '慢速观察', apply: function () { st.flow = 0.25; } },
        { name: '停转', apply: function () { st.flow = 0; } },
        { name: '多圈线圈', apply: function () { st.loops = 4; } }
      ]);
    },
    getControls: function () {
      return [
        SL('gn_flow', '水流速率 Water Flow', 0, 1, 0.01, st.flow, '', function (v) { st.flow = v; }),
        SL('gn_str', '磁铁强度 Magnet Strength', 0, 1, 0.01, st.strength, '', function (v) { st.strength = v; }),
        SL('gn_loops', '线圈圈数 Coil Loops', 1, 4, 1, st.loops, '', function (v) { st.loops = Math.round(v); }),
        SL('gn_area', '线圈面积 Loop Area', 0.2, 1, 0.01, st.area, '', function (v) { st.area = v; }),
        CK('gn_el', '显示电子 Electrons', st.showElectrons, function (v) { st.showElectrons = !!v; }),
        CK('gn_cp', '显示指南针 Compass', st.showCompass, function (v) { st.showCompass = !!v; }),
        CK('gn_fm', '显示场强计 Field Meter', st.showFieldMeter, function (v) { st.showFieldMeter = !!v; })
      ];
    },
    update: function (dt, t) {
      if (!st.drag) {
        var target = st.flow * MAXW;
        st.omega = EMA(st.omega, target, dt * 3);
        st.theta += st.omega * dt;
      }
      st.e = emf();
      st.buf.push(st.e);
      while (st.buf.length > 160) st.buf.shift();
      st.flick = KT().rng(Math.floor(t * 53 + 17))() * 0.06;
    },
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);

      var tp = turPos(), cx = tp.x, cy = tp.y;
      var turR = 48;

      /* ===== 水龙头（左上） ===== */
      var fx = W * 0.10, fy = H * 0.16;
      RC(ctx, fx - 8, fy, 16, 26, '#8d9db0', '#5b6b7d', 1.5);
      RC(ctx, fx - 26, fy - 10, 52, 10, '#5b6b7d', '#3f4d5e', 1.5);
      RC(ctx, fx - 20, fy - 26, 40, 16, '#a0b2c6', '#6b7d90', 1.5);
      TXT(ctx, '水龙头 Faucet', fx, fy + 40, { align: 'center', size: 11, color: DIM2() });
      /* 水流：流速越大越粗 */
      var fw = 1 + st.flow * 4;
      ctx.save();
      ctx.strokeStyle = KT().rgba(C.sky, 0.35 + 0.55 * st.flow); ctx.lineWidth = fw; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx, fy + 26);
      ctx.quadraticCurveTo(fx + 26, (fy + 26 + cy - turR) * 0.5, cx - turR - 8, cy - 14);
      ctx.stroke();
      ctx.restore();
      if (st.flow > 0.01) TXT(ctx, '水流速率 Water Flow', fx, fy - 34, { align: 'center', size: 11, color: C.sky });

      /* ===== 涡轮 + 旋转条形磁铁（中央） ===== */
      var blades = 4, b;
      for (b = 0; b < blades; b++) {
        var a0 = st.theta + b * Math.PI / 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a0);
        KT().polyline(ctx, [{ x: 0, y: 0 }, { x: turR - 6, y: -9 }, { x: turR + 6, y: -3 }, { x: turR - 4, y: 8 }],
          { color: KT().rgba(C.teal, 0.9), width: 2, fill: KT().rgba(C.teal, 0.18) });
        ctx.restore();
      }
      /* 条形磁铁（随 θ 旋转，N 红 S 蓝） */
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(st.theta);
      var magLen = 40, magH = 14;
      RC(ctx, -magLen, -magH / 2, magLen, magH, '#d64541', '#5b1f1d', 1.5);
      RC(ctx, 0, -magH / 2, magLen, magH, '#3a6ea5', '#1e3a58', 1.5);
      TXT(ctx, 'N', -magLen + 12, 0, { align: 'center', baseline: 'middle', size: 13, weight: 'bold', color: '#fff' });
      TXT(ctx, 'S', magLen - 12, 0, { align: 'center', baseline: 'middle', size: 13, weight: 'bold', color: '#fff' });
      ctx.restore();
      /* 中心轴 */
      DISK(ctx, cx, cy, 7, '#56707e', '#cfe3ea', 2);
      hintDrag(ctx, '👆 拖动涡轮', cx, cy - turR - 22);
      if (st.drag) DISK(ctx, cx, cy, turR + 12, null, C.yellow, 2.5);

      /* ===== 拾波线圈（环绕磁铁，多圈） ===== */
      var loopH = 92 * (0.6 + 0.4 * st.area), loopW = 30 * (0.6 + 0.4 * st.area);
      var lx = cx - loopW / 2, ly = cy - loopH / 2, li;
      for (li = 0; li < st.loops; li++) {
        var inset = li * 5;
        RC(ctx, lx - inset - 8, ly - inset - 8, loopW + 16 + inset * 2, loopH + 16 + inset * 2, null, '#e8b64f', 2);
      }
      TXT(ctx, '拾波线圈 Pickup Coil', cx + loopW / 2 + 16, cy - loopH / 2 - 12, { size: 11, color: '#e0cf9a' });

      /* ===== 导线 → 灯泡（右上） ===== */
      var bulbX = W * 0.66, bulbY = H * 0.30;
      var bright = KT().clamp((st.e * st.e) / Math.max(E0() * E0(), 1), 0, 1);
      KT().polyline(ctx, [{ x: lx - 14, y: cy + loopH / 2 }, { x: lx - 40, y: cy + loopH / 2 + 40 }, { x: bulbX - 10, y: cy + loopH / 2 + 40 }, { x: bulbX - 10, y: bulbY + 22 }], { color: '#b98a33', width: 3 });
      KT().polyline(ctx, [{ x: lx + loopW + 14, y: cy + loopH / 2 }, { x: lx + loopW + 44, y: cy + loopH / 2 + 66 }, { x: bulbX + 28, y: cy + loopH / 2 + 66 }, { x: bulbX + 28, y: bulbY + 22 }], { color: '#8a6b2b', width: 3 });
      if (bright > 0.02) DISK(ctx, bulbX + 9, bulbY, 22 + 26 * bright, 'rgba(255,214,80,' + NF(0.15 + 0.55 * bright, 2) + ')');
      DISK(ctx, bulbX + 9, bulbY, 17, bright > 0.02 ? KT().rgba('#ffe07a', 0.35 + 0.65 * bright) : '#574f39', '#caa83c', 2.2);
      RC(ctx, bulbX, bulbY + 14, 18, 11, '#8d7c4d', '#6b5d3f', 1.5);
      TXT(ctx, '灯泡 Bulb', bulbX + 9, bulbY + 44, { align: 'center', size: 11, color: DIM2() });

      /* ===== 电压表 + RPM（右上） ===== */
      var voltX = W * 0.66, voltY = H * 0.12;
      PN(ctx, voltX, voltY, 150, 62, { radius: 8, fill: 'rgba(4,10,18,0.85)', stroke: 'rgba(255,255,255,0.25)' });
      TXT(ctx, '− 电压 Voltage  +', voltX + 75, voltY + 14, { align: 'center', size: 10.5, color: DIM2() });
      TXT(ctx, NF(st.e * 12, 1) + ' V', voltX + 75, voltY + 42, { align: 'center', size: 20, weight: 'bold', color: Math.abs(st.e) > 0.01 ? '#6ff0aa' : '#8895a6', baseline: 'middle' });
      TXT(ctx, 'RPM  ' + NF(Math.abs(rpm()), 0), cx, cy - turR - 42, { align: 'center', size: 12, weight: 'bold', color: C.teal });

      /* ===== 指南针（涡轮旁，可关） ===== */
      if (st.showCompass) {
        var cpx = cx + turR + 46, cpy = cy;
        DISK(ctx, cpx, cpy, 22, 'rgba(255,255,255,0.06)', '#cfe3ea', 1.5);
        var needle = st.theta;
        ctx.save(); ctx.translate(cpx, cpy); ctx.rotate(needle);
        ARW(ctx, 0, 0, 16, 0, C.red, 3, 6);
        ARW(ctx, 0, 0, -16, 0, C.sky, 3, 6);
        ctx.restore();
        TXT(ctx, '指南针 Compass', cpx, cpy + 34, { align: 'center', size: 10.5, color: DIM2() });
      }

      /* ===== 电子流（线圈内，可关） ===== */
      if (st.showElectrons) {
        var n = 10, ei;
        for (ei = 0; ei < n; ei++) {
          var ph = (st.theta * 2 + ei / n * 6.28318) % 6.28318;
          var ex = cx + Math.cos(ph) * (turR + 10);
          var ey = cy + Math.sin(ph) * (turR + 10);
          var dir = st.e > 0 ? 1 : -1;
          DISK(ctx, ex, ey, 2.5, dir > 0 ? '#64b5f6' : '#ffb74d', null, 0);
        }
      }

      /* ===== 场强计（可拖动，可关） ===== */
      if (st.showFieldMeter) {
        if (!st.fmX) { st.fmX = cx - turR - 90; st.fmY = cy + 40; }
        var dist = HYP(st.fmX, st.fmY, cx, cy);
        var Bval = KT().clamp(st.strength * 60 * 40 / Math.max(dist, 40), 0, 100);
        var ang = Math.atan2(st.fmY - cy, st.fmX - cx);
        PN(ctx, st.fmX - 40, st.fmY - 28, 80, 56, { radius: 7, fill: 'rgba(4,10,18,0.9)', stroke: 'rgba(120,200,255,0.4)' });
        TXT(ctx, 'B 磁场 Field', st.fmX, st.fmY - 18, { align: 'center', size: 9.5, color: DIM2() });
        TXT(ctx, 'B=' + NF(Bval, 1) + ' G', st.fmX, st.fmY, { align: 'center', size: 11, color: '#8fd3ff' });
        TXT(ctx, 'Bx=' + NF(Bval * Math.cos(ang), 1) + '  By=' + NF(Bval * Math.sin(ang), 1), st.fmX, st.fmY + 12, { align: 'center', size: 9, color: DIM2() });
        TXT(ctx, 'θ=' + NF(ang * 180 / Math.PI, 0) + '°', st.fmX, st.fmY + 24, { align: 'center', size: 9, color: DIM2() });
      }

      /* ===== 示波器波形（底部） ===== */
      var sw = 300, sh = 96, sx = W * 0.10, sy = H - sh - 16;
      PN(ctx, sx, sy, sw, sh, { radius: 9, fill: 'rgba(4,10,18,0.9)', stroke: 'rgba(90,220,140,0.4)' });
      TXT(ctx, '电动势 e(t)  EMF', sx + 12, sy + 15, { size: 11, color: '#69d19a', weight: 'bold' });
      DST(ctx, sx + 10, sy + sh / 2 + 8, sx + sw - 10, sy + sh / 2 + 8, 'rgba(105,209,154,0.25)', 1, [3, 4]);
      var VSC = (sh - 40) / 2 / Math.max(E0(), 0.01);
      var pts = [], i;
      for (i = 0; i < st.buf.length; i++) {
        pts.push({ x: sx + 10 + (sw - 20) * i / (st.buf.length - 1), y: sy + sh / 2 + 8 - st.buf[i] * VSC });
      }
      KT().polyline(ctx, pts, { color: '#6ff0aa', width: 2 });

      /* ===== 右侧控制提示面板 ===== */
      var pnX = W * 0.86, pnY = H * 0.12;
      PN(ctx, pnX, pnY, W * 0.13 - 8, 128, { radius: 8, fill: 'rgba(255,255,255,0.04)', stroke: 'rgba(255,255,255,0.12)' });
      TXT(ctx, '条形磁铁 Bar Magnet', pnX + 10, pnY + 18, { size: 10.5, color: DIM2() });
      TXT(ctx, '强度 ' + NF(st.strength * 100, 0) + '%', pnX + 10, pnY + 34, { size: 11, color: '#fff' });
      TXT(ctx, '圈数 Loops: ' + st.loops, pnX + 10, pnY + 62, { size: 11, color: '#fff' });
      TXT(ctx, '面积 Area: ' + NF(st.area * 100, 0) + '%', pnX + 10, pnY + 78, { size: 11, color: '#fff' });
      TXT(ctx, '（用右侧面板调节）', pnX + 10, pnY + 106, { size: 9.5, color: DIM2() });

      flushRows(st, [
        row('峰值 E₀', NF(E0() * 12, 2), 'V', C.green),
        row('瞬时 e(t)', NF(st.e * 12, 2), 'V', C.orange),
        row('转速 RPM', NF(Math.abs(rpm()), 0), '', C.teal),
        row('频率 f', NF(Math.abs(st.omega) / 6.28318, 2), 'Hz', C.sky)
      ]);
    },
    reset: function () {
      st.strength = 0.75; st.loops = 2; st.area = 0.5; st.theta = 0; st.omega = 0; st.flow = 0.5;
      st.e = 0; st.buf = []; st.drag = false;
      for (var z = 0; z < 160; z++) st.buf.push(0);
      st._dcKey = '';
    },
    onPointerDown: function (x, y) {
      var tp = turPos();
      if (HYP(x, y, tp.x, tp.y) < 60) { st.drag = true; st.lastDragA = Math.atan2(y - tp.y, x - tp.x); st.lastDragTime = performance.now(); return; }
      if (st.showFieldMeter && st.fmX && HYP(x, y, st.fmX, st.fmY) < 30) { st.fmDrag = true; return; }
    },
    hitTest: function (x, y) {
      var tp = turPos();
      if (HYP(x, y, tp.x, tp.y) < 60) return true;
      if (st.showFieldMeter && st.fmX && HYP(x, y, st.fmX, st.fmY) < 30) return true;
      return false;
    },
    onPointerMove: function (x, y) {
      var tp = turPos();
      if (st.drag) {
        var a = Math.atan2(y - tp.y, x - tp.x);
        var now = performance.now(), dt = (now - st.lastDragTime) / 1000;
        if (dt > 0 && dt < 0.5) {
          var d = a - st.lastDragA;
          if (d > Math.PI) d -= 6.28318; if (d < -Math.PI) d += 6.28318;
          st.omega = d / dt;
        }
        st.theta = a; st.lastDragA = a; st.lastDragTime = now;
      } else if (st.fmDrag) {
        st.fmX = x; st.fmY = y;
      }
    },
    onPointerUp: function () { st.drag = false; st.fmDrag = false; }
  };
}

/* ============================================================
 * 十一、模式 9：travoltage —— 静电发生器 (john-travoltage)
 * ============================================================ */
function buildTravoltage() {
  var st = {
    ex: 0, zaps: 0, sparks: [],
    rub: false, lastX: 0, armDrag: false,
    armTip: { x: 0, y: 0 }, arc: null, arcLife: 0,
    leak: false, zapTick: 0, _dcKey: ''
  };
  function knob(w, h) { return { x: w - 92, y: 92 }; }
  function footPos(w, h) { return { x: w * 0.56, y: h - 46 }; }
  function bodyGlow() { return st.ex / 60; }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>摩擦起电与尖端放电</strong>：鞋底在地毯上摩擦时电子转移，人体累积负电荷；手指靠近门把手时发生火花放电。</p>' +
        '<ul style="padding-left:20px"><li>按住脚部左右摩擦 → 电子逐渐增多（上限 60）</li>' +
        '<li>身体电荷越多，辉光越亮；拖动手臂接近门把手 → ⚡ 放电！</li>' +
        '<li>放电瞬间电子迅速流失，可见黄色火花散射</li></ul>' +
        '<p style="color:#888">提示：勾选"缓慢漏电"可在不接触时慢慢放电。</p>'
      );
      L.setPresets([
        { name: '充满电待放电', apply: function () { st.ex = 60; st.sparks = []; st.arc = null; } },
        { name: '清零重来', apply: function () { st.ex = 0; st.zaps = 0; st.sparks = []; st.arc = null; } }
      ]);
    },
    getControls: function () {
      return [
        CK('tv_leak', '缓慢漏电（微弱导电环境）', st.leak, function (v) { st.leak = !!v; })
      ];
    },
    update: function (dt, t) {
      if (st.leak && st.ex > 0) st.ex = Math.max(0, st.ex - dt * 3);
      /* 放电逻辑：手臂尖端接近门把手 */
      var kb = knob(st.W || 800, st.H || 480);
      var dist = HYP(st.armTip.x, st.armTip.y, kb.x, kb.y);
      st.zapTick += dt;
      if (dist < 66 && st.ex > 0) {
        if (st.zapTick > 0.14) {
          st.zapTick = 0;
          /* 生成闪电折线 + 火花粒子 */
          var segs = [], i, n = 7;
          var x0 = st.armTip.x, y0 = st.armTip.y;
          segs.push({ x: x0, y: y0 });
          var rr = KT().rng(Math.floor(t * 971 + st.zaps * 131));
          for (i = 1; i < n; i++) {
            var ft = i / n;
            segs.push({ x: x0 + (kb.x - x0) * ft + (rr() - 0.5) * 26, y: y0 + (kb.y - y0) * ft + (rr() - 0.5) * 26 });
          }
          segs.push({ x: kb.x, y: kb.y });
          st.arc = segs;
          st.arcLife = 0.14;
          /* 移动端降级 burst 上限 10→6/4，最小 3；桌面端保留原随机 5~10 */
          var cnt = (window.Mobile && window.Mobile.isMobile)
            ? Math.max(3, window.Mobile.reduceParticleCount(10))
            : (5 + Math.floor(rr() * 6));
          for (i = 0; i < cnt; i++) {
            var va = rr() * 6.28, sp = 50 + rr() * 120;
            st.sparks.push({ x: kb.x, y: kb.y, vx: Math.cos(va) * sp, vy: Math.sin(va) * sp - 40, life: 0.5 + rr() * 0.4 });
          }
          st.ex = 0;
          st.zaps++;
        }
      } else if (st.zapTick > 0.4 && dist < 96 && st.ex > 30) {
        /* 更远也有细小火花预防性掉电 */
        st.ex = Math.max(0, st.ex - 1);
      }
      if (st.arcLife > 0) st.arcLife -= dt;
      /* 粒子更新 */
      var arr = st.sparks, j;
      for (j = arr.length - 1; j >= 0; j--) {
        var p = arr[j];
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 260 * dt;
        if (p.life <= 0) arr.splice(j, 1);
      }
    },
    render: function (ctx, W, H, t) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var fp = footPos(W, H);
      var glow = bodyGlow();

      /* 地毯（脚所在区域） */
      PN(ctx, fp.x - 90, fp.y - 12, 200, 40, { radius: 10, fill: '#5a3d2e', stroke: '#3c281e' });
      for (var rc = 0; rc < 14; rc++) {
        DST(ctx, fp.x - 82 + rc * 13, fp.y + 8, fp.x - 76 + rc * 13, fp.y + 22, 'rgba(255,255,255,0.14)', 1, []);
      }
      TXT(ctx, '地毯', fp.x + 88, fp.y + 22, { size: 10.5, color: 'rgba(255,255,255,0.5)' });

      /* 门与把手（右上） */
      var kb = knob(W, H);
      RC(ctx, W - 130, 36, 106, 128, '#8d6e63', '#5d4636', 3);
      RC(ctx, W - 122, 44, 90, 112, 'rgba(255,255,255,0.12)', null);
      DISK(ctx, kb.x, kb.y, 8, '#ffd76a', '#a5822a', 2);
      TXT(ctx, '门把手', W - 77, 176, { align: 'center', size: 11, color: 'rgba(255,255,255,0.6)' });

      /* John 简笔小人：蓝帽条纹衫，位于画面中部 */
      var bx = fp.x - 60, by = fp.y - 118; /* 身体锚点 */
      var halo = glow;
      if (halo > 0.02) {
        DISK(ctx, bx, by + 34, 74 + 8 * halo, KT().rgba('#9fd6ff', 0.10 + 0.16 * halo));
      }
      /* 头 + 帽 */
      DISK(ctx, bx, by - 26, 15, '#f3cba5', '#caa27a', 1.5);
      RC(ctx, bx - 16, by - 40, 32, 8, C.blue, '#24567e', 2);
      RC(ctx, bx - 14, by - 50, 28, 11, C.blue, '#24567e', 2, 0.85);
      /* 身体条纹衫 */
      var stripes = ['#3f8fc4', '#ffffff'];
      for (var sgi = 0; sgi < 4; sgi++) {
        RC(ctx, bx - 13, by - 10 + sgi * 9, 26, 9, stripes[sgi % 2], null);
      }
      RC(ctx, bx - 13, by - 10, 26, 36, null, '#2c5d80', 1.5);
      /* 腿 */
      KT().polyline(ctx, [{ x: bx - 6, y: by + 26 }, { x: bx - 6, y: by + 62 }, { x: bx + 40, y: by + 62 }, { x: bx + 40, y: by + 74 }], { color: '#5d7d94', width: 5 });
      KT().polyline(ctx, [{ x: bx + 8, y: by + 26 }, { x: bx + 8, y: by + 58 }], { color: '#5d7d94', width: 5 });
      RC(ctx, bx + 26, by + 70, 28, 10, '#46352c', null); /* 脚 */

      /* 手臂伸向右上，末端为可拖动 hand-tip */
      var aim = st.armDrag ? { x: st.armTip.x, y: st.armTip.y } : { x: bx + 34, y: by + 12 };
      if (!st.armDrag) { st.armTip.x = aim.x; st.armTip.y = aim.y; }
      KT().polyline(ctx, [{ x: bx + 12, y: by + 4 }, { x: bx + 24, y: by + 6 }, { x: aim.x, y: aim.y }], { color: '#f3cba5', width: 5 });
      DISK(ctx, aim.x, aim.y, 7, '#f3cba5', '#caa27a', 1.5);
      hintDrag(ctx, '👆 拖动手臂', aim.x, aim.y - 28);
      if (glow > 0.02) { /* 提示手可拖动 */
        TXT(ctx, '🖐 可拖动手指', aim.x - 8, aim.y - 18, { size: 10.5, color: 'rgba(255,255,255,0.55)' });
      }

      /* 摩擦区提示 + 脚部交互光圈 */
      var hoverFoot = st.rub;
      DISK(ctx, fp.x, fp.y + 2, 30, hoverFoot ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)');
      hintDrag(ctx, '👆 拖动摩擦', fp.x, fp.y - 30);
      TXT(ctx, st.rub ? '摩擦中…' : '按住脚左右摩擦', fp.x, fp.y + 44, { align: 'center', size: 11.5, color: hoverFoot ? C.yellow : 'rgba(255,255,255,0.6)' });

      /* 电子小图标围身漂浮 */
      var rr2 = KT().rng(4242), ei, shown = Math.min(st.ex, 14);
      for (ei = 0; ei < shown; ei++) {
        var ea = rr2() * 6.28 + t * (0.6 + (ei % 4) * 0.14);
        var er = 44 + rr2() * 22;
        DISK(ctx, bx + Math.cos(ea) * er, by + 30 + Math.sin(ea) * er * 0.7, 3, '#63d3ff');
        TXT(ctx, '−', bx + Math.cos(ea) * er, by + 30 + Math.sin(ea) * er * 0.7 + 3.5, { align: 'center', size: 7, color: '#0a3050' });
      }

      /* 闪电弧 */
      if (st.arcLife > 0 && st.arc) {
        KT().polyline(ctx, st.arc, { color: 'rgba(255,255,180,' + NF(Math.min(1, st.arcLife / 0.14), 2) + ')', width: 3.5 });
        KT().polyline(ctx, st.arc, { color: KT().rgba('#fff', 0.7), width: 1.2 });
      }
      /* 火花粒子 */
      var si;
      for (si = 0; si < st.sparks.length; si++) {
        var pp = st.sparks[si];
        DISK(ctx, pp.x, pp.y, 2.5, KT().rgba(C.yellow, KT().clamp(pp.life, 0, 1)));
      }

      /* 计数表盘 */
      infoPanel(ctx, 14, 12, 216, [
        ['身上电子数', String(st.ex) + ' 个'],
        ['高压警告', st.ex >= 45 ? '⚠️ 高压!' : '正常'],
        ['累计放电次数', String(st.zaps)]
      ]);
      /* 电量表 */
      PN(ctx, 14, 106, 216, 16, { radius: 8, fill: 'rgba(0,0,0,0.35)' });
      if (st.ex > 0) PN(ctx, 15.5, 107.5, 213 * KT().clamp(st.ex / 60, 0, 1), 13, { radius: 6, fill: st.ex >= 45 ? C.red : C.yellow });

      flushRows(st, [
        row('身上电子数', st.ex, 'e−', C.yellow),
        row('⚠️ 高压警告', st.ex >= 45 ? '是' : '否', '', st.ex >= 45 ? C.red : C.green),
        row('放电次数', st.zaps, '次', C.orange)
      ]);
    },
    reset: function () {
      st.ex = 0; st.zaps = 0; st.sparks = []; st.rub = false; st.armDrag = false;
      st.arc = null; st.arcLife = 0; st.leak = false; st._dcKey = '';
    },
    onPointerDown: function (x, y) {
      var fp = footPos(st.W || 800, st.H || 480);
      if (HYP(x, y, fp.x, fp.y) < 44) { st.rub = true; st.lastX = x; return; }
      if (HYP(x, y, st.armTip.x, st.armTip.y) < 40) { st.armDrag = true; }
    },
    hitTest: function (x, y) {
      var fp = footPos(st.W || 800, st.H || 480);
      if (HYP(x, y, fp.x, fp.y) < 44) return true;
      if (HYP(x, y, st.armTip.x, st.armTip.y) < 40) return true;
      return false;
    },
    onPointerMove: function (x, y) {
      if (st.rub) {
        var dx = x - st.lastX;
        st.lastX = x;
        if (Math.abs(dx) > 2) {
          var before = st.ex;
          st.ex = Math.min(60, st.ex + Math.floor(Math.abs(dx) / 3));
          if (before < 60 && st.ex >= 60) st.L.showToast('已满 60 电荷！拖着手指去碰门把手吧 ⚡');
        }
      } else if (st.armDrag) {
        st.armTip.x = x; st.armTip.y = y;
      }
    },
    onPointerUp: function () { st.rub = false; st.armDrag = false; }
  };
}

/* ============================================================
 * 十二、模式 10：balloonstatic —— 气球与静电 (balloons-static-electricity)
 * ============================================================ */
function buildBalloonStatic() {
  var st = {
    W: 800, H: 480,
    bx: 400, by: 200, q: 0,
    vx: 0, vy: 0,
    stick: '', stickT: 0, wig: 0,
    drag: false, grabbed: false, _dcKey: ''
  };
  function sweaterZone(w, h) { return { x: w * 0.06, y: h * 0.22, w: w * 0.20, h: h * 0.52 }; }
  function wallLeft(w) { return w - 92; }
  var RADIUS = 30;
  /* 气球与毛衣重叠判定（供 update / render 共用） */
  function overSweater() {
    var sz = sweaterZone(st.W || 800, st.H || 480);
    return st.bx + RADIUS >= sz.x - 6 && st.bx - RADIUS <= sz.x + sz.w + 6 &&
      st.by + RADIUS >= sz.y - 6 && st.by - RADIUS <= sz.y + sz.h + 6;
  }

  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>摩擦起电与静电感应</strong>：气球在毛衣上摩擦获得电子（气球带 −、毛衣带 +）；中性导体墙会被气球静电感应出近侧异号电荷而吸引气球。</p>' +
        '<ul style="padding-left:20px"><li>拖动气球掠过毛衣 → 电子转移计数上升</li>' +
        '<li>带电气球吸附毛衣（异号吸引）、也会"隔空"贴住墙面</li>' +
        '<li>松手后静电力维持数秒（约 3s），随后气球缓缓下滑落地</li></ul>'
      );
      L.setPresets([
        { name: '中等电荷吸附墙面', apply: function () { st.q = 18; st.bx = 560; st.by = 200; st.vx = 0; st.vy = 0; st.stick = ''; } },
        { name: '满电吸附', apply: function () { st.q = 30; st.bx = 420; st.by = 210; st.vx = 0; st.vy = 0; st.stick = ''; } },
        { name: '中性回落地面', apply: function () { st.q = 0; st.by = 200; st.stick = ''; } }
      ]);
    },
    getControls: function () {
      return [
        BTN('bl_resetq', '全部归零（中和）', function () {
          st.q = 0; st.vx = 0; st.vy = 0; st.stick = '';
          st.bx = st.W * 0.5; st.by = st.H * 0.4;
          st.L.showToast('已中和全部电荷');
        })
      ];
    },
    update: function (dt) {
      var W = st.W, H = st.H;
      st.wig += dt;
      if (st.drag) {
        if (overSweater()) { /* 摩擦转移 */
          st.q = Math.min(30, st.q + dt * 16);
          if (st.wig % 0.6 < 0.5) st.grabbed = true;
        }
        return;
      }
      /* 自由运动阶段 */
      var sz = sweaterZone(W, H);
      var attX = 0, attY = 0;
      if (st.q > 0) {
        /* 吸附目标：墙（近侧镜像）与毛衣 */
        var toWall = wallLeft(W) - RADIUS - st.bx;
        var fw = KT().clamp(st.q * 5.5 / Math.max(24, Math.abs(toWall)), 0, 900);
        attX += toWall > 0 ? fw : 0;
        var scx = sz.x + sz.w / 2;
        var toSw = scx - st.bx;
        attX += KT().clamp(toSw * st.q * 0.5, -700, 700);
      } else if (st.q === 0 && st.stick === '') {
        /* 重力轻微下落 */
        attY += 40;
      }
      st.vx = KT().clamp(st.vx + attX * dt, -600, 600);
      st.vy = KT().clamp(st.vy + attY * dt, -600, 600);

      if (st.stick === 'wall') {
        st.bx = wallLeft(W) - RADIUS - 2;
        st.stickT -= dt;
        if (st.stickT <= 0) { st.stick = ''; st.vy = 10; } /* 秒衰后下滑 */
        st.vx = 0; st.vy *= 0.5;
      } else if (st.stick === 'sweater') {
        st.bx = sz.x + sz.w + RADIUS + 2;
        st.stickT -= dt;
        if (st.stickT <= 0) { st.stick = ''; st.vy = 8; }
        st.vx = 0; st.vy *= 0.5;
      } else {
        st.bx += st.vx * dt;
        st.by += st.vy * dt;
        /* 命中判定吸附 */
        if (st.q > 0 && st.bx + RADIUS >= wallLeft(W) - 4 && st.bx < W) {
          st.bx = wallLeft(W) - RADIUS - 2;
          st.stick = 'wall'; st.stickT = 3; st.vx = 0; st.vy = 0;
        }
        if (st.bx + RADIUS >= sz.x && st.bx - RADIUS <= sz.x + sz.w + 12 &&
          st.by + RADIUS >= sz.y && st.by - RADIUS <= sz.y + sz.h) {
          st.bx = sz.x + sz.w + RADIUS + 2;
          st.stick = 'sweater'; st.stickT = 3; st.vx = 0; st.vy = 0;
        }
      }
      /* 边界 */
      st.by = KT().clamp(st.by, RADIUS + 8, H - 34 - RADIUS);
      st.bx = KT().clamp(st.bx, RADIUS + 6, W - RADIUS - 6);
      if (st.by >= H - 34 - RADIUS - 0.5) { st.vy = 0; st.vx *= 0.8; }
    },
    render: function (ctx, W, H, t) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var sz = sweaterZone(W, H);

      /* 毛衣：编织纹理灰块 */
      PN(ctx, sz.x, sz.y, sz.w, sz.h, { radius: 12, fill: '#6f7b8a', stroke: '#48525e' });
      var ri, rj;
      for (ri = 0; ri < Math.floor(sz.h / 14); ri++) {
        for (rj = 0; rj < Math.floor(sz.w / 14); rj++) {
          DISK(ctx, sz.x + 10 + rj * 14 + (ri % 2) * 7, sz.y + 10 + ri * 14, 3.4, 'rgba(255,255,255,0.12)');
        }
      }
      TXT(ctx, '毛衣', sz.x + sz.w / 2, sz.y + sz.h + 20, { align: 'center', size: 13, color: '#cfd8e2', weight: 'bold' });
      if (st.q > 0) TXT(ctx, '+' + NF(st.q, 0), sz.x + sz.w / 2, sz.y - 12, { align: 'center', size: 15, weight: 'bold', color: C.red });

      /* 墙：砖纹 */
      var wl = wallLeft(W);
      PN(ctx, wl, 20, W - wl - 12, H - 60, { radius: 6, fill: '#c9c2b4', stroke: '#8f8676' });
      for (ri = 0; ri < 9; ri++) {
        var wy = 30 + ri * (H - 80) / 9;
        DST(ctx, wl + 6, wy, W - 22, wy, 'rgba(120,105,80,0.5)', 1.2, []);
        var off = (ri % 2) * 22;
        for (rj = 0; rj < 5; rj++) {
          var wxx = wl + 12 + off + rj * 44;
          if (wxx < W - 24) DST(ctx, wxx, wy, wxx, wy + (H - 80) / 9, 'rgba(120,105,80,0.5)', 1.2, []);
        }
      }
      TXT(ctx, '墙面', (wl + W) / 2, H - 44, { align: 'center', size: 12, color: '#e8e0ce' });
      /* 感应+号：当气球带电且吸在墙上 */
      if (st.q > 0 && st.stick === 'wall') {
        var si;
        for (si = 0; si < 5; si++) {
          TXT(ctx, '+', wl - 14, 70 + si * (H - 140) / 4, { align: 'center', size: 17, weight: 'bold', color: KT().rgba(C.red, 0.85) });
        }
      }

      /* 气球 */
      var wob = st.drag && overSweater() ? Math.sin(st.wig * 40) * 2 : 0;
      var px = st.bx + wob, py = st.by;
      if (st.stick) py += Math.sin(st.wig * 30) * 0.8;
      /* 绳尾 */
      KT().polyline(ctx, [{ x: px, y: py + RADIUS }, { x: px + 6, y: py + RADIUS + 16 }, { x: px - 4, y: py + RADIUS + 30 }], { color: '#aaa', width: 1.6 });
      var grad = ctx.createRadialGradient(px - 10, py - 12, 4, px, py, RADIUS);
      grad.addColorStop(0, '#e05e5e'); grad.addColorStop(1, '#8c2222');
      DISK(ctx, px, py, RADIUS, grad, '#4d1414', 2);
      /* 符号云：− 号散布；移动端降级 cap 10→6/4 */
      var _bCap = window.Mobile ? window.Mobile.reduceParticleCount(10) : 10;
      var shown = Math.min(Math.round(st.q / 2), _bCap), zi, rz = KT().rng(777);
      for (zi = 0; zi < shown; zi++) {
        var za = rz() * 6.28, zr = 36 + rz() * 14;
        var zx = px + Math.cos(za + t * 0.6) * zr, zy = py + Math.sin(za + t * 0.6) * zr * 0.72;
        DISK(ctx, zx, zy, 5.5, 'rgba(80,170,255,0.9)');
        TXT(ctx, '−', zx, zy + 3.5, { align: 'center', size: 9, weight: 'bold', color: '#082743' });
      }
      hintDrag(ctx, '👆 拖动气球', px, py - RADIUS - 34);
      TXT(ctx, st.drag ? '拖动中…' : '气球', px, py - RADIUS - 12, { align: 'center', size: 11.5, color: '#ffc9c9' });

      /* 力可视化说明 */
      var pullWall = st.stick === 'wall';
      infoPanel(ctx, 14, 12, 228, [
        ['气球电量', '-' + NF(st.q, 0) + ' e−'],
        ['毛衣电量', '+' + NF(st.q, 0) + ' e+'],
        ['墙面感应吸力', pullWall ? '100%（贴合）' : NF(wallPullPct(), 0) + '%']
      ]);

      flushRows(st, [
        row('气球电量', '-' + NF(st.q, 0), 'e−', C.blue),
        row('墙吸附力相对值', NF(wallPullPct(), 0), '%', C.purple),
        row('状态', st.stick === 'wall' ? '已吸附墙面' : st.stick === 'sweater' ? '已吸附毛衣' : '自由运动', '')
      ]);
      function wallPullPct() {
        if (pullWall) return 100;
        var dl = wallLeft(W) - RADIUS - st.bx;
        return KT().clamp(st.q * 22 / Math.max(30, dl), 0, 96);
      }
    },
    reset: function () {
      st.q = 0; st.bx = 400; st.by = 200; st.vx = 0; st.vy = 0;
      st.stick = ''; st.stickT = 0; st.drag = false; st._dcKey = '';
    },
    onPointerDown: function (x, y) {
      if (HYP(x, y, st.bx, st.by) < RADIUS + 12) {
        st.drag = true; st.stick = ''; st.vx = 0; st.vy = 0;
      }
    },
    hitTest: function (x, y) {
      return HYP(x, y, st.bx, st.by) < RADIUS + 12;
    },
    onPointerMove: function (x, y) {
      if (st.drag) {
        st.bx = KT().clamp(x, 40, st.W - 40);
        st.by = KT().clamp(y, 44, st.H - 46);
      }
    },
    onPointerUp: function () {
      if (st.drag && st.q > 0) st.stickT = 0.01; /* 松手进入吸附判定流程 */
      st.drag = false;
    }
  };
}

/* ============================================================
 * 十三、模式 11：capacitor —— 电容器实验室基础 (capacitor-lab-basics)
 * ============================================================ */
function buildCapacitor() {
  var st = {
    connected: true, Vbat: 1.5, A: 250, d: 10,
    Qpc: null, spark: 0, drag: false, _dcKey: ''
  };
  function capPF() { return 8.854e-3 * st.A / st.d; }        /* ε₀=8.854e-12，A mm²、d mm */
  function batteryVolts() { return st.Vbat; }
  function voltsOut() {
    if (st.connected) return st.Vbat;
    if (st.Qpc === null) return 0;
    return st.Qpc / capPF();
  }
  function chargePC() {
    if (st.connected) return capPF() * st.Vbat;
    return st.Qpc === null ? 0 : st.Qpc;
  }
  function syncCharge() { if (st.connected) st.Qpc = capPF() * st.Vbat; }
  syncCharge();
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>平行板电容器</strong>：电容取决于结构尺寸，与是否带电无关。</p>' +
        '<div class="formula">C = ε₀·A / d　　Q = C·V　　E = V / d</div>' +
        '<ul style="padding-left:20px"><li>连接电池：板间电压锁定为电池电压，改 d / A 会改变 Q</li>' +
        '<li>断开电池：板上电荷 Q 保持不变，改 d 时电压随之变化</li>' +
        '<li>d 越小或 A 越大 → C 越大 → 存的电荷越多</li></ul>' +
        '<p style="color:#888">数值为演示教学值，用于体会规律而非真实量级。</p>'
      );
      L.setPresets([
        { name: '连接电池 充电', apply: function () { st.connected = true; st.A = 250; st.d = 10; st.Vbat = 1.5; syncCharge(); } },
        { name: '断开后减小 d（Q 不变）', apply: function () { st.connected = false; st.d = 6; } },
        { name: '最大面积近距充电', apply: function () { st.connected = true; st.A = 400; st.d = 5; st.Vbat = 1.5; syncCharge(); } }
      ]);
    },
    getControls: function () {
      return [
        CK('cp_bat', '连接电池', st.connected, function (v) { st.connected = !!v; syncCharge(); }),
        SL('cp_v', '电池电压 V', 0, 1.5, 0.05, st.Vbat, ' V', function (v) { st.Vbat = v; syncCharge(); }),
        SL('cp_a', '极板面积 A', 100, 400, 10, st.A, ' mm²', function (v) { st.A = v; syncCharge(); }),
        SL('cp_d', '板间距离 d', 5, 20, 0.5, st.d, ' mm', function (v) { st.d = v; syncCharge(); })
      ];
    },
    update: function () {},
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var cx = W * 0.5, cy = H * 0.48;

      /* 连接状态提示横幅 */
      var tipStr = st.connected ? '🔌 已连接电池 — 调节 A、d 将改变电荷量 Q' : '✂️ 已断开电池 — Q 保持恒定，调节 A、d 只改变电压 V';
      PN(ctx, W / 2 - 250, 12, 500, 26, { radius: 13, fill: st.connected ? 'rgba(20,90,50,0.75)' : 'rgba(110,70,10,0.75)' });
      TXT(ctx, tipStr, W / 2, 29, { align: 'center', size: 12.5, weight: 'bold', color: '#fff' });

      /* 板几何 */
      var gapPx = st.d * 7.4;
      var plateH = 60 + st.A * 0.44;
      var plateW = 16;
      var topY = cy - plateH / 2;
      var negX = cx - gapPx / 2 - plateW, posX = cx + gapPx / 2;

      /* 顶部电路：电池 + 开关 */
      var batX = cx, batY = 64;
      var wireL = cx - 180, wireR = cx + 180;
      function post(px) { DISK(ctx, px, batY, 4, '#c8a34a'); }
      /* 左引线 */
      KT().polyline(ctx, [{ x: negX + plateW / 2, y: topY }, { x: negX + plateW / 2, y: batY }, { x: wireL, y: batY }], { color: '#c8a34a', width: 2.5 });
      KT().polyline(ctx, [{ x: posX + plateW / 2, y: topY }, { x: posX + plateW / 2, y: batY }, { x: wireR, y: batY }], { color: '#c8a34a', width: 2.5 });
      post(wireL); post(wireR);
      /* 电池符号 */
      KT().polyline(ctx, [{ x: wireL + 4, y: batY }, { x: cx - 26, y: batY }], { color: '#c8a34a', width: 2.5 });
      KT().polyline(ctx, [{ x: cx + 26, y: batY }, { x: wireR - 4, y: batY }], { color: '#c8a34a', width: 2.5 });
      RC(ctx, cx - 26, batY - 15, 12, 30, '#d5b25a', '#7c6420', 2);
      RC(ctx, cx - 10, batY - 26, 12, 52, '#d5b25a', '#7c6420', 2);
      RC(ctx, cx + 2, batY - 15, 12, 30, '#d5b25a', '#7c6420', 2);
      RC(ctx, cx + 18, batY - 26, 10, 52, '#d5b25a', '#7c6420', 2);
      TXT(ctx, '+', cx - 20, batY - 34, { size: 13, color: C.orange, weight: 'bold' });
      TXT(ctx, NF(st.Vbat, 2) + ' V', cx, batY + 42, { align: 'center', size: 12, color: '#ffe9a8', weight: 'bold' });
      /* 开关 */
      var swX = cx + 120;
      if (st.connected) {
        KT().polyline(ctx, [{ x: swX - 22, y: batY }, { x: swX + 22, y: batY }], { color: '#ffd96a', width: 4 });
        ARW(ctx, swX - 14, batY + 10, swX + 6, batY + 10, '#7ee08a', 2, 7);
        TXT(ctx, '闭合', swX, batY + 28, { align: 'center', size: 10.5, color: '#8ef0a0' });
      } else {
        DISK(ctx, swX - 22, batY, 4, '#c8a34a'); DISK(ctx, swX + 22, batY, 4, '#c8a34a');
        KT().polyline(ctx, [{ x: swX - 22, y: batY }, { x: swX + 20, y: batY - 16 }], { color: '#d5b25a', width: 4 });
        TXT(ctx, '断开', swX, batY + 28, { align: 'center', size: 10.5, color: '#ffb37a' });
      }

      /* 极板 */
      RC(ctx, negX, topY, plateW, plateH, '#7f96b3', '#3d5570', 2);
      RC(ctx, posX, topY, plateW, plateH, '#c87f5a', '#6e4028', 2);
      TXT(ctx, '−', negX + plateW / 2, topY - 12, { align: 'center', size: 15, weight: 'bold', color: '#9fc3e8' });
      TXT(ctx, '+', posX + plateW / 2, topY - 12, { align: 'center', size: 15, weight: 'bold', color: '#f2b193' });
      hintDrag(ctx, '👆 拖动', posX + plateW / 2, topY - 34);
      if (st.drag) DISK(ctx, posX + plateW / 2, cy, plateH * 0.55 + 8, null, C.yellow, 2.5);

      /* 板上离子点：count ∝ Q 上限 40 */
      var Vout = voltsOut(), QpC = chargePC();
      var Cpf = capPF();
      var frac = KT().clamp(QpC / (capPF() * 1.5), 0, 1); /* 以 1.5V 满充为基准 */
      var nDots = Math.round(frac * 40);
      var i;
      var rz = KT().rng(3030);
      for (i = 0; i < nDots; i++) {
        var side = i % 2;
        var fy = (rz() * 0.92 + 0.04), fx = rz();
        var yy = topY + fy * plateH;
        if (side === 0) DISK(ctx, negX + 4 + fx * (plateW - 8), yy, 3.2, '#4fa3e0');
        else DISK(ctx, posX + 4 + fx * (plateW - 8), yy, 3.2, '#e8896a');
      }

      /* 板间均匀场箭头排 */
      var Evals = voltsOut() / st.d; /* V/mm 示教 */
      var rows = 3, cols = 5;
      for (i = 0; i < cols; i++) {
        var axx = cx - gapPx / 2 + 10 + i * (gapPx - 20) / (cols - 1);
        for (var aj = 0; aj < rows; aj++) {
          var ayy = topY + plateH * (aj + 1) / (rows + 1);
          var op = KT().clamp(Evals / 0.35, 0.15, 1);
          ARW(ctx, axx, ayy - 9, axx, ayy + 9, KT().rgba(C.purple, op), 1.8, 7);
        }
      }
      /* 场强 meter 标注 */
      PN(ctx, cx - 74, cy - 14, 148, 28, { radius: 7, fill: 'rgba(8,14,26,0.72)', stroke: 'rgba(155,89,182,0.55)' });
      TXT(ctx, '场强 E = ' + NF(Evals, 2) + ' V/mm', cx, cy + 4, { align: 'center', size: 12.5, weight: 'bold', color: C.purple });

      /* 数字电压表 LED 式 */
      var vmY = cy + plateH / 2 + 42;
      PN(ctx, cx - 90, vmY, 180, 44, { radius: 8, fill: '#101418', stroke: '#3a4656' });
      TXT(ctx, '数字电压表', cx - 78, vmY + 14, { size: 10, color: '#6a7a8c' });
      TXT(ctx, NF(voltsOut(), 2) + ' V', cx + 26, vmY + 31, { align: 'center', size: 21, weight: 'bold', color: '#59f3a1' });

      infoPanel(ctx, 14, 46, 224, [
        ['电容 C（示教值）', NF(capPF(), 2) + ' pF'],
        ['电荷 Q', NF(QpC * 1000, 1) + ' fC'],
        ['板距 d', NF(st.d, 1) + ' mm'],
        ['面积 A', String(st.A) + ' mm²']
      ]);

      flushRows(st, [
        row('电容 C（示教值）', NF(capPF(), 2), 'pF', C.purple),
        row('电荷量 Q（示教值）', NF(QpC, 3), 'pC', C.blue),
        row('板间电压 V', NF(voltsOut(), 2), 'V', C.green),
        row('场强 E = V/d', NF(Evals, 2), 'V/mm', C.orange)
      ]);
    },
    reset: function () {
      st.connected = true; st.Vbat = 1.5; st.A = 250; st.d = 10;
      syncCharge(); st._dcKey = ''; st.drag = false;
    },
    onPointerDown: function (x, y) {
      var cx = (st.W || 800) * 0.5, cy = (st.H || 480) * 0.48;
      var gapPx = st.d * 7.4;
      var plateH = 60 + st.A * 0.44;
      var posX = cx + gapPx / 2;
      /* 正极板中心附近命中：横向放宽至 ±22px，纵向覆盖板高 ±10px */
      if (Math.abs(x - (posX + 8)) <= 22 && Math.abs(y - cy) <= plateH / 2 + 10) {
        st.drag = true;
      }
    },
    hitTest: function (x, y) {
      var cx = (st.W || 800) * 0.5, cy = (st.H || 480) * 0.48;
      var gapPx = st.d * 7.4;
      var plateH = 60 + st.A * 0.44;
      var posX = cx + gapPx / 2;
      return Math.abs(x - (posX + 8)) <= 22 && Math.abs(y - cy) <= plateH / 2 + 10;
    },
    onPointerMove: function (x, y) {
      if (!st.drag) return;
      var cx = (st.W || 800) * 0.5;
      /* 拖拽正极板水平移动 → 改变板间距 d（与 d=2*(x-cx)/7.4 反解） */
      st.d = KT().clamp(2 * (x - cx) / 7.4, 5, 20);
      syncCharge();
    },
    onPointerUp: function () { st.drag = false; }
  };
}

/* ============================================================
 * 十四、实验ID → 模式映射，与工厂分发
 * ============================================================ */
var ID2MODE = {
  'charges-fields': 'charges',
  'charges-and-fields': 'charges',
  'coulombs-law': 'coulomb',
  'gravity-force-lab': 'gravlab',
  'gravity-force-lab-basics': 'gravlab',
  'magnets-electromagnets': 'magnetsA',
  'magnet-compass': 'compassmode',
  'magnet-and-compass': 'compassmode',
  'faradays-electromagnetic-lab': 'emlab',
  'faradays-law': 'faradaybulb',
  'generator': 'generatorTurbine',
  'john-travoltage': 'travoltage',
  'balloons-static-electricity': 'balloonstatic',
  'capacitor-lab-basics': 'capacitor'
};

var BUILD = {
  charges: buildCharges,
  coulomb: buildCoulomb,
  gravlab: buildGravLab,
  magnetsA: buildMagnetsA,
  compassmode: buildCompassMode,
  emlab: buildEMLab,
  faradaybulb: buildFaradayBulb,
  generatorTurbine: buildGenerator,
  travoltage: buildTravoltage,
  balloonstatic: buildBalloonStatic,
  capacitor: buildCapacitor
};

})();