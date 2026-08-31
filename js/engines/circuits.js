/**
 * 电路实验引擎（factory 名: 'circuits'）
 * 覆盖实验ID（5种模式）：
 *   circuit-dc               → dc       直流电路构建套件
 *   circuit-dc-virtual-lab   → dcvirt   直流电路虚拟实验室
 *   circuit-ac               → ac       交流电路构建套件
 *   circuit-ac-virtual-lab   → acvirt   交流电路虚拟实验室（含谐振检测）
 *   resistance-wire          → reswire  导线电阻
 *
 * 契约：顶层只执行 window.EngineRegistry.register；不触碰 document。
 * 共享元件绘制助手：drawResistor / drawBatterySymbol / drawBulb /
 *                   drawGauge / smoothEma
 */
(function () {
'use strict';

window.EngineRegistry.register('circuits', {
  create: function (cfg) {
    cfg = cfg || {};
    var mode = String(cfg.mode || ID2MODE[cfg.id] || '');
    if (!BUILD[mode]) mode = 'dc';
    return BUILD[mode]();
  }
});

/* ============================================================
 * 一、通用小工具
 * ============================================================ */
function KT() { return window.Kit; }
function row(lb, val, unit, color) { return { label: lb, value: val, unit: unit || '', color: color }; }
function NF(v, d) {
  if (!isFinite(v)) v = 0;
  var k = KT();
  return (k && k.fmt) ? k.fmt(v, d === undefined ? 2 : d) : v.toFixed(d === undefined ? 2 : d);
}
function ROW(lb, val, unit, color) { return { label: lb, value: val, unit: unit, color: color }; }
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
function RC(ctx, x, y, w, h, fill, stroke, lw, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  if (fill && w > 0.5 && h > 0.5) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.strokeRect(x, y, w, h); }
  ctx.restore();
}
function DISK(ctx, x, y, r, fill, stroke, lw, alpha) {
  KT().circle(ctx, x, y, Math.max(r, 0.4), {
    fill: fill, stroke: stroke, lineWidth: lw || 2, alpha: alpha === undefined ? 1 : alpha
  });
}
function smoothEma(cur, target, k) { return cur + (target - cur) * Math.min(1, Math.max(0, k)); }

function hintDrag(ctx, text, x, y) { ctx.save(); ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var w=ctx.measureText(text).width+12; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-w/2, y-11, w, 22); ctx.fillStyle='#ffd54f'; ctx.fillText(text, x, y); ctx.restore(); }
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

/* ============================================================
 * 二、共享元件绘制助手（本文件五种模式共用）
 * ============================================================ */

/* 电阻：锯齿形符号（zigzag），可水平或竖直，自带两端引线 */
function drawResistor(ctx, cx, cy, len, horiz, color, thick) {
  thick = thick || 12;
  var amp = thick / 2, segs = 6, i;
  ctx.save();
  ctx.strokeStyle = color || '#b9c4cf';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  function P(along, off) { /* along: 轴向偏移(px)，off: 垂直偏移(px) */
    if (horiz) return { x: cx + along, y: cy + off };
    return { x: cx + off, y: cy + along };
  }
  /* 两端引线：±(0.62len → ±0.44len 锯齿起点) */
  KT().polyline(ctx, [P(-len * 0.62, 0), P(-len * 0.44, 0)], { color: color, width: 2.4 });
  KT().polyline(ctx, [P(len * 0.44, 0), P(len * 0.62, 0)], { color: color, width: 2.4 });
  /* 中段锯齿主体 [-0.44, +0.44]·len，端点落在轴线上 */
  var seq = [];
  var bodyA = len * 0.44;
  for (i = 0; i <= segs; i++) {
    var along = -bodyA + 2 * bodyA * i / segs;
    var off = (i === 0 || i === segs) ? 0 : ((i % 2 === 1) ? -amp : amp);
    seq.push(P(along, off));
  }
  KT().polyline(ctx, seq, { color: color, width: 2.4 });
  ctx.restore();
}

/* 电池符号：长板正极/短板负极，水平引线在左右两侧 */
function drawBatterySymbol(ctx, cx, cy, volts, colWire) {
  var tall = 26, short_ = 13;
  ctx.save();
  ctx.strokeStyle = colWire || '#d9b64e';
  ctx.lineWidth = 2.4;
  /* 左引线 → 负极（短） */
  ctx.beginPath(); ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 7, cy); ctx.stroke();
  RC(ctx, cx - 7, cy - short_ / 2, 6, short_, null, ctx.strokeStyle, 2.4);
  /* 中间长板（正极） */
  RC(ctx, cx + 3, cy - tall / 2, 6, tall, null, ctx.strokeStyle, 2.4);
  ctx.beginPath(); ctx.moveTo(cx + 9, cy); ctx.lineTo(cx + 34, cy); ctx.stroke();
  TXT(ctx, '+', cx + 20, cy - 17, { size: 12, weight: 'bold', color: '#ffd97a' });
  TXT(ctx, NF(volts, 2) + ' V', cx, cy + 22, { align: 'center', size: 11.5, color: '#ffe9a8', weight: 'bold' });
  ctx.restore();
}

/* 灯泡：brightness∈[0,1]，辉光半径随亮度；黄白光心 + 灯座 */
function drawBulb(ctx, x, y, brightness, radius) {
  radius = radius || 17;
  var br = KT().clamp(brightness, 0, 1);
  if (br > 0.02) {
    DISK(ctx, x, y, radius * (1.3 + 1.6 * br), KT().rgba('#ffd94d', 0.14 + 0.42 * br));
  }
  DISK(ctx, x, y, radius, br > 0.02 ? KT().rgba('#ffe9a0', 0.38 + 0.62 * br) : '#574f39', '#caa83c', 2.2);
  /* 灯丝 */
  ctx.save();
  ctx.strokeStyle = '#b98a33';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 5, y + radius - 4);
  ctx.lineTo(x - 5, y + 2);
  ctx.lineTo(x, y - 4);
  ctx.lineTo(x + 5, y + 2);
  ctx.lineTo(x + 5, y + radius - 4);
  ctx.stroke();
  ctx.restore();
  RC(ctx, x - 9, y + radius - 2, 18, 11, '#8d7c4d', '#6b5d3f', 1.5);
}

/* 半圆指针表盘（gauge）：val/min/max 映射到 180°→360° 扇区 */
function drawGauge(ctx, cx, cy, r, val, vmin, vmax, title, unit, col) {
  var C = KT().COLORS;
  PN(ctx, cx - r - 12, cy - r - 30, r * 2 + 24, r * 2 + 52, { radius: 10, fill: 'rgba(255,255,255,0.90)', stroke: C.gray });
  TXT(ctx, title, cx, cy - r - 13, { size: 12, align: 'center', weight: 'bold', color: '#2d3436' });
  var a0 = Math.PI, a1 = Math.PI * 2;
  ctx.save();
  ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
  var frac = KT().clamp((val - vmin) / ((vmax - vmin) || 1), 0, 1);
  ctx.strokeStyle = col || C.green;
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + frac * Math.PI); ctx.stroke();
  ctx.restore();
  /* 刻度短线 */
  var i;
  for (i = 0; i <= 4; i++) {
    var ang = a0 + Math.PI * i / 4;
    DST2(ctx, cx + Math.cos(ang) * (r - 4), cy + Math.sin(ang) * (r - 4),
      cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 'rgba(45,52,54,0.7)', 1.4);
  }
  var angN = a0 + Math.PI * KT().clamp(frac, 0, 1);
  KT().arrow(ctx, cx, cy, cx + Math.cos(angN) * (r - 6), cy + Math.sin(angN) * (r - 6),
    { color: C.dark, width: 3, head: 9 });
  DISK(ctx, cx, cy, 3.5, '#333');
  TXT(ctx, NF(val, 2) + ' ' + unit, cx, cy + 16, { size: 13, align: 'center', weight: 'bold', color: '#16324a' });
}
function DST2(ctx, x1, y1, x2, y2, color, width) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width || 1.2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}
/* 虚线线段：DST(ctx, x1, y1, x2, y2, color, width, dash?) */
function DST(ctx, x1, y1, x2, y2, color, width, dash) {
  ctx.save();
  ctx.strokeStyle = color || '#fff'; ctx.lineWidth = width || 1.2;
  ctx.setLineDash(dash || []);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}
/* 双向尺寸箭头：ARW(ctx, x1, y1, x2, y2, color, width, head) */
function ARW(ctx, x1, y1, x2, y2, color, width, head) {
  var k = KT(), h = head || 8;
  k.arrow(ctx, x1, y1, x2, y2, { color: color || '#fff', width: width || 1.5, head: h });
  var ang = Math.atan2(y1 - y2, x1 - x2);
  ctx.save(); ctx.fillStyle = color || '#fff'; ctx.translate(x1, y1); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(h, -h * 0.5); ctx.lineTo(h, h * 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ============================================================
 * 三、模式 1/2：dc 与 dcvirt —— 直流电路构建套件（虚拟实验室扩展）
 * ============================================================ */
var BULB_R = 50; /* 灯泡等效电阻（示教恒定值） */

function buildDC(virtual) {
  var st = {
    nb: 1, nr: 2, nl: 1, swClosed: true,
    V: 9, R: 220, rInt: virtual ? 1.5 : 0,
    mx: -999, my: -999, hoverEl: null,
    brightEMA: {}, bb: [], W: 800, H: 480, _dcKey: '',
    swDrag: false, swX: null, swY: null
  };

  function counts() { return { b: st.nb, r: st.nr, l: st.nl, s: 1 }; }
  function resistors() { return st.nr * st.R + st.nl * BULB_R; }
  function totalR() { return resistors() + st.rInt; }
  function solve() {
    if (!st.swClosed) return { I: 0, Vt: 0 };
    var vt = st.nb * st.V - 0;
    if (!virtual) return { I: vt / Math.max(totalR(), 0.001), Vt: vt };
    /* 含内阻的端电压迭代一次即可（线性电路解析解） */
    var I = vt / Math.max(totalR(), 0.001);
    return { I: I, Vt: vt - I * st.rInt };
  }
  /* 布局槽序固定：电池…→电阻…→灯泡…→开关，全部排在底边 */
  function layoutSlots() {
    var n = st.nb + st.nr + st.nl + 1;
    return n;
  }
  function fmtAmp(i) {
    if (Math.abs(i) >= 0.05) return NF(i, 3) + '';
    return NF(i * 1000, 1);
  }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>欧姆定律与串联电路</strong>：串联电路电流处处相等，总电压等于各元件电压之和。</p>' +
        '<div class="formula">I = U / ΣR　　Uᵢ = I·Rᵢ　　Pᵢ = I²·Rᵢ</div>' +
        '<ul style="padding-left:20px"><li>开关断开 → 无电流，灯泡全灭</li>' +
        '<li>多个电池串联电压相加；电阻越多电流越小</li>' +
        '<li>悬停任一元件可弹出"万用表"读数</li></ul>' +
        (virtual ? '<p style="color:#888">虚拟实验室版：电池带有内阻 r，端电压 = EMF − I·r。</p>' : '')
      );
      L.setPresets([
        { name: '标准点亮实验', apply: function () { st.nb = 1; st.nr = 2; st.nl = 1; st.V = 9; st.R = 100; st.swClosed = true; st.brightEMA = {}; } },
        { name: '断开开关观察', apply: function () { st.swClosed = false; } },
        { name: '大功率对照', apply: function () { st.nb = 3; st.nr = 1; st.nl = 2; st.V = 12; st.R = 40; st.swClosed = true; st.brightEMA = {}; } }
      ]);
    },
    getControls: function () {
      var cs = [
        SL('cc_v', '每节电池电压', 0.5, 12, 0.5, st.V, ' V', function (v) { st.V = v; }),
        SL('cc_r', '电阻阻值', 5, 500, 5, st.R, ' Ω', function (v) { st.R = v; })
      ];
      if (virtual) cs.push(SL('cc_ri', '电池内阻 r', 0, 10, 0.5, st.rInt, ' Ω', function (v) { st.rInt = v; }));
      cs.push(
        BTN('cc_addb', '＋电池（' + st.nb + '）', function () { st.nb = Math.min(4, st.nb + 1); }),
        BTN('cc_subb', '－电池（' + st.nb + '）', function () { st.nb = Math.max(0, st.nb - 1); }),
        BTN('cc_addr', '＋电阻（' + st.nr + '）', function () { st.nr = Math.min(4, st.nr + 1); }),
        BTN('cc_subr', '－电阻（' + st.nr + '）', function () { st.nr = Math.max(0, st.nr - 1); }),
        BTN('cc_addl', '＋灯泡（' + st.nl + '）', function () { st.nl = Math.min(4, st.nl + 1); }),
        BTN('cc_subl', '－灯泡（' + st.nl + '）', function () { st.nl = Math.max(0, st.nl - 1); }),
        BTN('cc_sw', st.swClosed ? '断开开关' : '闭合开关', function () { st.swClosed = !st.swClosed; })
      );
      return cs;
    },
    update: function (dt) {
      var sol = solve();
      st.brightI = EMA_I(st.brightI || 0, normBright(sol.I), dt * 8);
    },
    render: function (ctx, W, H, t) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      st.bb = [];

      var x0 = W * 0.07, x1 = W * (virtual ? 0.56 : 0.62);
      var y0 = H * 0.28, y1 = H * 0.80;
      var sol = solve();
      var wireCol = st.swClosed ? '#e2c169' : '#6f6a58';

      /* 导线闭环 */
      KT().polyline(ctx, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }],
        { color: wireCol, width: 3 });

      /* 元件沿底边均布 */
      var n = layoutSlots(), slotW = (x1 - x0) / (n + 1);
      var elY = y1, idx = 0, k;
      st.hoverEl = null;

      /* 电池们 */
      for (k = 0; k < st.nb; k++, idx++) {
        var bx = x0 + slotW * (idx + 1);
        drawBatterySymbol(ctx, bx, elY, st.V);
        st.bb.push({ kind: 'bat', i: k, x: bx - 34, y: elY - 26, w: 68, h: 46,
          txt: '电源 EMF = ' + NF(st.nb * st.V, 2) + ' V（共 ' + st.nb + ' 节）' });
      }
      /* 电阻们：灰色圆柱体外观 + 色环（示意） */
      for (k = 0; k < st.nr; k++, idx++) {
        var rx = x0 + slotW * (idx + 1);
        KT().polyline(ctx, [{ x: rx - 44, y: elY }, { x: rx - 22, y: elY }], { color: wireCol, width: 3 });
        KT().polyline(ctx, [{ x: rx + 22, y: elY }, { x: rx + 44, y: elY }], { color: wireCol, width: 3 });
        PN(ctx, rx - 22, elY - 16, 44, 32, { radius: 16, fill: '#95a5a6', stroke: '#5d6d7e' });
        RC(ctx, rx - 14, elY - 16, 5, 32, '#b0522f');
        RC(ctx, rx - 5, elY - 16, 5, 32, '#caa83c');
        RC(ctx, rx + 3, elY - 16, 5, 32, '#34495e');
        TXT(ctx, 'R' + (k + 1) + '=' + st.R + 'Ω', rx, elY + 26, { align: 'center', size: 11, color: '#cfd8e2' });
        st.bb.push({ kind: 'res', i: k, x: rx - 36, y: elY - 32, w: 72, h: 60,
          txt: 'U_R' + (k + 1) + ' = ' + NF(sol.I * st.R, 2) + ' V · P = ' + NF(sol.I * sol.I * st.R, 2) + ' W' });
      }
      /* 灯泡们 */
      for (k = 0; k < st.nl; k++, idx++) {
        var lx = x0 + slotW * (idx + 1);
        var br = clampCh(st.brightI || 0);
        drawBulb(ctx, lx, elY - 26, br, 16);
        TXT(ctx, 'L' + (k + 1), lx, elY + 24, { align: 'center', size: 11, color: '#cfd8e2' });
        st.bb.push({ kind: 'bulb', i: k, x: lx - 28, y: elY - 58, w: 56, h: 84,
          txt: '灯泡 L' + (k + 1) + ' U = ' + NF(sol.I * BULB_R, 2) + ' V · P = ' + NF(sol.I * sol.I * BULB_R, 2) + ' W' });
      }
      /* 开关（最后一个槽） */
      var swx = x0 + slotW * (idx + 1);
      DISK(ctx, swx - 22, elY, 4, '#d9c27a'); DISK(ctx, swx + 22, elY, 4, '#d9c27a');
      if (st.swClosed) {
        KT().polyline(ctx, [{ x: swx - 22, y: elY }, { x: swx + 22, y: elY }], { color: '#ffd96a', width: 4.5 });
      } else {
        KT().polyline(ctx, [{ x: swx - 22, y: elY }, { x: swx + 18, y: elY - 18 }], { color: '#d9b64e', width: 4 });
      }
      if (st.swDrag) KT().circle(ctx, swx, elY, 34, { stroke: C.yellow, lineWidth: 2.5 });
      st.swX = swx; st.swY = elY;
      st.bb.push({
        kind: 'sw', i: 0, x: swx - 30, y: elY - 26, w: 60, h: 48,
        txt: st.swClosed ? '开关闭合 ✓ 电路接通' : '开关断开 ✗ 无电流'
      });

      /* 万用表悬浮读数 */
      var hov = hitEl(st.mx, st.my);
      if (hov) {
        var cwid = Math.max(150, hov.txt.length * 7.2 + 22);
        var chx = KT().clamp(st.mx + 14, 6, W - cwid - 6);
        var chy = KT().clamp(st.my - 46, 6, H - 34);
        PN(ctx, chx, chy, cwid, 26, { radius: 13, fill: 'rgba(15,25,40,0.95)', stroke: 'rgba(255,214,106,0.75)' });
        TXT(ctx, '🔍 ' + hov.txt, chx + 11, chy + 18, { size: 11.5, color: '#ffe08a' });
      }

      /* 右侧信息 + （虚拟版）双表盘 */
      infoPanelC(ctx, W - (virtual ? 330 : 260) - 14, 14, virtual ? 320 : 252, [
        ['总电动势', NF(st.nb * st.V, 2) + ' V'],
        ['总电阻 ΣR', NF(totalR(), 0) + ' Ω'],
        ['电流 I', fmtAmp(sol.I) + (sol.I >= 0.05 ? ' A' : ' mA')],
        ['输出端电压', st.swClosed ? NF(sol.Vt, 2) + ' V' : '—'],
        ['元件总功耗', st.swClosed ? NF(Math.pow(sol.I, 2) * resistors(), 2) + ' W' : '0 W']
      ]);
      if (virtual) {
        drawGauge(ctx, W - 232, H * 0.36, 52, sol.Vt, 0, 50, '电压表', 'V', C.orange);
        drawGauge(ctx, W - 100, H * 0.36, 52, sol.I * 1000, 0, 500, '毫安表', 'mA', C.teal);
        PN(ctx, W - 300, H * 0.10, 130, 26, { radius: 13, fill: 'rgba(80,60,140,0.55)', stroke: 'rgba(190,170,255,0.6)' });
        TXT(ctx, '🧪 虚拟实验室', W - 235, H * 0.10 + 18, { align: 'center', size: 12.5, weight: 'bold', color: '#cabfff' });
        /* 端电压拆解式 */
        var decomp = sol.I > 0 ?
          '端压 = ' + NF(st.nb * st.V, 2) + ' − (' + NF(sol.I, 3) + ')·' + NF(st.rInt, 1) :
          '端压 = 电动势（无电流无内降）';
        PN(ctx, W - 296, H * 0.55, 260, 30, { radius: 8, fill: 'rgba(10,16,28,0.8)', stroke: 'rgba(255,255,255,0.2)' });
        TXT(ctx, decomp, W - 166, H * 0.55 + 20, { align: 'center', size: 12, color: '#dff0ff' });
      }
      if (!(st.nb + st.nr + st.nl)) {
        TXT(ctx, '⚠️ 尚未放置任何元件——请点击右侧控件按钮添加', W / 2, y0 - 30, { align: 'center', size: 13.5, color: '#ffb37a', weight: 'bold' });
      }

      flushRows(st, [
        row('总电阻', NF(totalR(), 0), 'Ω' + (virtual ? '（含内阻）' : '')),
        row('电流 I', sol.I >= 0.05 ? NF(sol.I, 3) : NF(sol.I * 1000, 1), sol.I >= 0.05 ? 'A' : 'mA', C.teal),
        row('端电压 U', st.swClosed ? NF(sol.Vt, 2) : '—', 'V', C.orange),
        row('总功率 P', st.swClosed ? NF(Math.pow(sol.I, 2) * resistors(), 2) : '0', 'W', C.pink)
      ]);

      function hitEl(px, py) {
        var best = null, bd = 1e9, q;
        for (q = 0; q < st.bb.length; q++) {
          var b = st.bb[q];
          if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
            var dc = Math.abs(px - (b.x + b.w / 2));
            if (dc < bd) { bd = dc; best = b; }
          }
        }
        return best;
      }
    },
    reset: function () {
      st.nb = 1; st.nr = 2; st.nl = 1; st.swClosed = true;
      st.V = 9; st.R = 220; st.brightI = 0; st._dcKey = '';
      st.swDrag = false; st.swX = null; st.swY = null;
    },
    onPointerDown: function (x, y) {
      st.mx = x; st.my = y;
      if (st.swX != null && Math.abs(x - st.swX) <= 32 && Math.abs(y - st.swY) <= 26) {
        st.swClosed = !st.swClosed;
        st.swDrag = true;
      }
    },
    onPointerMove: function (x, y) { st.mx = x; st.my = y; },
    onPointerUp: function () { st.swDrag = false; }
  };

  function EMA_I(cur, target, k) { return smoothEma(cur, target, k); }
  function normBright(I) { return KT().clamp(Math.pow(I / 0.12, 2), 0, 1); }
  function clampCh(v) { return KT().clamp(v, 0, 1); }
}

/* 信息面板：label/value 两列 */
function infoPanelC(ctx, x, y, w, lines) {
  var h = 20 + lines.length * 17;
  PN(ctx, x, y, w, h, { radius: 9, fill: 'rgba(255,255,255,0.88)', stroke: 'rgba(0,0,0,0.25)' });
  var i;
  for (i = 0; i < lines.length; i++) {
    TXT(ctx, lines[i][0], x + 12, y + 22 + i * 17, { size: 12.5, color: '#2d3436', weight: lines[i][3] || 'normal' });
    TXT(ctx, lines[i][1], x + w - 12, y + 22 + i * 17, { size: 12.5, align: 'right', color: '#16324a', weight: 'bold' });
  }
}

/* ============================================================
 * 四、模式 3/4：ac 与 acvirt —— 交流电路构建套件（含谐振检测）
 * ============================================================ */
var C0 = 220e-6;   /* F，示例电容 */
var L0 = 100e-3;   /* H，示例电感 */

function buildAC(virtual) {
  var st = {
    Vpp: 12, f: 10,
    ldR: true, ldC: true, ldL: false,
    ph: 0, vBuf: [], iBuf: [],
    brightI: 0, W: 800, H: 480, _dcKey: '',
    scopeDrag: false, scopeX: null, sx: 0, sy: 0, sw: 0, sh: 0
  };
  /* 移动端按 particleScale 缩放示波器 trace 缓冲 160→96/56；桌面端 160 不变 */
  var _scopeCap = window.Mobile ? window.Mobile.reduceParticleCount(160) : 160;
  function V0() { return st.Vpp / 2; }
  function omega() { return 6.28318 * st.f; }
  function loadParts() {
    var Rsum = 0;
    var Xc = 1 / (6.28318 * st.f * C0);
    var Xl = 6.28318 * st.f * L0;
    return { R: Rsum + (st.ldR ? 100 : 0), Xc: Xc, Xl: Xl };
  }
  function solve() {
    var p = loadParts();
    var X = p.Xl - p.Xc;
    var Z = Math.sqrt(p.R * p.R + X * X);
    if (!st.ldR && !st.ldC && !st.ldL) Z = 0.01; /* 理想短路保护 */
    var phi = Math.atan2(X, p.R || 0.0001);
    var I0 = V0() / Math.max(Z, 0.01);
    return { Z: Z, phi: phi, I0: I0, Irms: I0 / 1.41421, p: p, X: X };
  }
  function resFreq() { return 1 / (6.28318 * Math.sqrt(L0 * C0)); }

  function pushSample() {
    var sol = solve();
    var v = V0() * Math.sin(st.ph);
    var iAmp = sol.I0 * Math.sin(st.ph - sol.phi);
    st.vBuf.push(v); st.iBuf.push(iAmp);
    while (st.vBuf.length > _scopeCap) st.vBuf.shift();
    while (st.iBuf.length > _scopeCap) st.iBuf.shift();
  }

  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>交流电路与阻抗</strong>：电阻、感抗、容抗共同决定交流电流大小与相位。</p>' +
        '<div class="formula">X_C = 1/(2πfC)　　X_L = 2πfL</div>' +
        '<div class="formula">|Z| = √(R² + (X_L − X_C)²)　　φ = arctan((X_L−X_C)/R)</div>' +
        '<ul style="padding-left:20px"><li>频率越高容抗越小、感抗越大</li>' +
        '<li>f = f₀ = 1/(2π√LC) 时 X_L = X_C 发生串联谐振，阻抗最小、电流最大</li>' +
        '<li>电流波形相对电压发生相移（绿色为电压、青色为电流）</li></ul>' +
        (virtual ? '<p style="color:#888">虚拟实验室版额外提供谐振实时检测标识。</p>' : '')
      );
      L.setPresets([
        { name: '感性负载（低频大感抗）', apply: function () { st.ldR = true; st.ldC = false; st.ldL = true; st.f = 8; st.Vpp = 16; st.ph = 0; } },
        { name: '容性负载', apply: function () { st.ldR = true; st.ldC = true; st.ldL = false; st.f = 45; st.Vpp = 16; st.ph = 0; } },
        { name: '逼近谐振点', apply: function () { st.ldR = true; st.ldC = true; st.ldL = true; st.f = NF(resFreq(), 1) - 0 + 0; st.Vpp = 18; st.ph = 0; } }
      ]);
    },
    getControls: function () {
      return [
        SL('ac_vpp', '信号幅值（峰峰值）', 1, 24, 0.5, st.Vpp, ' V', function (v) { st.Vpp = v; }),
        SL('ac_f', '信号频率 f', 0.5, 60, 0.5, st.f, ' Hz', function (v) { st.f = v; }),
        CK('ac_r', '串联电阻 R（100 Ω）', st.ldR, function (v) { st.ldR = !!v; }),
        CK('ac_c', '串联电容 C（220 μF）', st.ldC, function (v) { st.ldC = !!v; }),
        CK('ac_l', '串联电感 L（100 mH）', st.ldL, function (v) { st.ldL = !!v; })
      ];
    },
    update: function (dt) {
      st.ph += omega() * dt;
      if (st.ph > 1e6) st.ph -= 1e6;
      pushSample();
      var sol = solve();
      st.brightI = smoothEma(st.brightI, KT().clamp(sol.Irms / 0.12, 0, 1), dt * 8);
    },
    render: function (ctx, W, H, t) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var sol = solve();
      var x0 = W * 0.06, x1 = W * 0.62;
      var y0 = H * 0.30, y1 = H * 0.78;

      KT().polyline(ctx, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }],
        { color: '#e2c169', width: 3 });

      /* 元件槽：电源 + 已选负载 */
      var slots = [];
      slots.push({ kind: 'src', label: 'AC 源' });
      if (st.ldR) slots.push({ kind: 'res', label: 'R 100Ω' });
      if (st.ldC) slots.push({ kind: 'cap', label: 'C 220μF' });
      if (st.ldL) slots.push({ kind: 'ind', label: 'L 100mH' });
      var n = slots.length, slotW = (x1 - x0) / (n + 1), elY = y1, si;

      for (si = 0; si < n; si++) {
        var ex = x0 + slotW * (si + 1), s = slots[si];
        if (s.kind === 'src') {
          DISK(ctx, ex, elY, 24, '#20334d', '#e2c169', 2.5);
          ctx.save();
          ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ex - 14, elY);
          ctx.quadraticCurveTo(ex - 7, elY - 13, ex, elY);
          ctx.quadraticCurveTo(ex + 7, elY + 13, ex + 14, elY);
          ctx.stroke();
          ctx.restore();
          TXT(ctx, 'U = ' + NF(st.Vpp, 1) + ' Vpp', ex, elY + 40, { align: 'center', size: 11, color: '#ffd97a' });
        } else if (s.kind === 'res') {
          drawResistor(ctx, ex, elY, 92, true, '#b9c4cf');
          TXT(ctx, s.label, ex, elY + 26, { align: 'center', size: 11, color: '#cfd8e2' });
        } else if (s.kind === 'cap') {
          KT().polyline(ctx, [{ x: ex - 46, y: elY }, { x: ex - 5, y: elY }], { color: '#b9c4cf', width: 2.4 });
          KT().polyline(ctx, [{ x: ex + 5, y: elY }, { x: ex + 46, y: elY }], { color: '#b9c4cf', width: 2.4 });
          RC(ctx, ex - 6, elY - 17, 5, 34, null, '#e8d8a8', 3);
          RC(ctx, ex + 3, elY - 17, 5, 34, null, '#e8d8a8', 3);
          TXT(ctx, s.label, ex, elY + 32, { align: 'center', size: 11, color: '#cfd8e2' });
        } else {
          /* 电感：四个半圆凸起 */
          ctx.save();
          ctx.strokeStyle = '#c8a05a'; ctx.lineWidth = 2.6;
          var k;
          for (k = 0; k < 4; k++) {
            var cxk = ex - 36 + k * 20 + 10;
            ctx.beginPath();
            ctx.arc(cxk, elY, 10, Math.PI, 0, false);
            ctx.stroke();
          }
          KT().polyline(ctx, [{ x: ex - 46, y: elY }, { x: ex - 36, y: elY }], { color: '#c8a05a', width: 2.6 });
          KT().polyline(ctx, [{ x: ex + 44, y: elY }, { x: ex + 46, y: elY }], { color: '#c8a05a', width: 2.6 });
          ctx.restore();
          TXT(ctx, s.label, ex, elY + 26, { align: 'center', size: 11, color: '#cfd8e2' });
        }
      }

      /* 示波器窗口：电压(绿) + 电流(青，浅色叠加 reference) */
      var sw = 330, sh = 150, sx = W - sw - 16, sy = 14;
      st.sx = sx; st.sy = sy; st.sw = sw; st.sh = sh;
      PN(ctx, sx, sy, sw, sh, { radius: 9, fill: 'rgba(4,10,16,0.93)',
        stroke: (virtual && isResonant()) ? KT().rgba('#59f3a1', 0.55 + 0.45 * Math.abs(Math.sin(t * 6))) : 'rgba(90,220,140,0.35)' });
      TXT(ctx, '示波器 · V(t) 与 i(t)', sx + 12, sy + 16, { size: 11, color: '#69d19a', weight: 'bold' });
      TXT(ctx, '1 格 = 时域滚动，右端最新', sx + sw - 12, sy + 16, { align: 'right', size: 9.5, color: '#4a6a56' });
      DST(ctx, sx + 10, sy + sh / 2 + 8, sx + sw - 10, sy + sh / 2 + 8, 'rgba(105,209,154,0.2)', 1, [3, 4]);
      var Sv = (sh / 2 - 20) / Math.max(V0(), 1e-6);
      var Si = (sh / 2 - 26) / Math.max(Math.max.apply(null, st.iBuf.concat([1e-6])), 1e-6);
      var pv = [], pk = [], q;
      for (q = 0; q < st.vBuf.length; q++) {
        pv.push({ x: sx + 10 + (sw - 20) * q / (_scopeCap - 1), y: sy + sh / 2 + 8 - st.vBuf[q] * Sv });
      }
      for (q = 0; q < st.iBuf.length; q++) {
        pk.push({ x: sx + 10 + (sw - 20) * q / (_scopeCap - 1), y: sy + sh / 2 + 8 - st.iBuf[q] * Si });
      }
      if (pk.length > 1) KT().polyline(ctx, pk, { color: KT().rgba('#5fd7ff', 0.75), width: 1.6 });
      if (pv.length > 1) KT().polyline(ctx, pv, { color: '#6ff0aa', width: 2 });
      TXT(ctx, '— V  – i（各自归一）', sx + sw - 14, sy + sh - 10, { align: 'right', size: 10, color: '#7fa88e' });
      hintDrag(ctx, '👆 拖动游标读数', sx + sw / 2, sy + 16);

      /* 示波器游标：可拖拽的竖线，读取对应时刻 V/i 值 */
      if (st.scopeX != null) {
        var cx2 = KT().clamp(st.scopeX, sx + 10, sx + sw - 10);
        KT().polyline(ctx, [{ x: cx2, y: sy + 22 }, { x: cx2, y: sy + sh - 14 }],
          { color: st.scopeDrag ? C.yellow : 'rgba(255,255,255,0.6)', width: st.scopeDrag ? 2.2 : 1.4 });
        DISK(ctx, cx2, sy + 22, 5, st.scopeDrag ? C.yellow : 'rgba(255,255,255,0.75)', C.yellow, 1.5);
        var sIdx = Math.round((cx2 - sx - 10) / (sw - 20) * (_scopeCap - 1));
        sIdx = KT().clamp(sIdx, 0, Math.max(0, st.vBuf.length - 1));
        var vAt = st.vBuf.length ? st.vBuf[sIdx] : 0;
        var iAt = st.iBuf.length ? st.iBuf[sIdx] : 0;
        PN(ctx, cx2 + 6, sy + sh - 28, 96, 22, { radius: 6, fill: 'rgba(4,10,16,0.92)', stroke: 'rgba(255,224,106,0.5)' });
        TXT(ctx, 'V=' + NF(vAt, 2) + 'V  i=' + NF(iAt * 1000, 0) + 'mA', cx2 + 12, sy + sh - 13,
          { size: 10, color: '#ffe066' });
      }

      /* 阻抗公式面板 */
      PN(ctx, W - sw - 16, sy + sh + 10, sw, 46, { radius: 9, fill: 'rgba(255,255,255,0.9)' });
      TXT(ctx, '|Z| = √(R²+(X_L−X_C)²) = ' + NF(sol.Z, 1) + ' Ω', W - sw - 16 + 14, sy + sh + 28,
        { size: 12.5, weight: 'bold', color: '#16324a' });
      TXT(ctx, 'φ = ' + NF(sol.phi * 57.2958, 1) + '°　' + (sol.X > 0 ? '呈感性（电流滞后）' : sol.X < 0 ? '呈容性（电流超前）' : '纯阻性'),
        W - sw - 16 + 14, sy + sh + 48, { size: 12, color: '#33475a' });

      /* 灯泡亮度 ∝ I_RMS */
      var bx = W * 0.5, by = H * 0.86;
      drawBulb(ctx, bx, by, clamp01(st.brightI), 15);

      /* 谐振检测横幅（仅 acvirt） */
      if (virtual) {
        if (isResonant()) {
          var aflash = 0.55 + 0.45 * Math.abs(Math.sin(t * 6));
          PN(ctx, W / 2 - 150, H * 0.06, 300, 32, { radius: 16, fill: KT().rgba('#12502f', aflash), stroke: KT().rgba('#59f3a1', aflash) });
          TXT(ctx, '⚡ 共振！ f ≈ f₀ = ' + NF(resFreq(), 1) + ' Hz（阻抗最小）', W / 2, H * 0.06 + 21, { align: 'center', size: 13, weight: 'bold', color: '#baffda' });
        } else if (st.ldC && st.ldL) {
          TXT(ctx, '当前偏离谐振点 f₀=' + NF(resFreq(), 1) + ' Hz', W / 2, H * 0.06 + 18, { align: 'center', size: 12, color: '#7fb39a' });
        }
      }

      flushRows(st, [
        row('频率 f', NF(st.f, 1), 'Hz', C.blue),
        row('X_C', st.ldC ? NF(sol.p.Xc, 1) : '未接入', 'Ω', C.teal),
        row('X_L', st.ldL ? NF(sol.p.Xl, 1) : '未接入', 'Ω', C.orange),
        row('|Z|', NF(sol.Z, 1), 'Ω', C.purple),
        row('I(RMS)', NF(sol.Irms * 1000, 1), 'mA', C.green)
      ]);

      function isResonant() {
        if (!virtual || !st.ldC || !st.ldL) return false;
        return Math.abs(st.f - resFreq()) <= Math.max(0.5, resFreq() * 0.03);
      }
      function clamp01(v) { return KT().clamp(v, 0, 1); }
    },
    reset: function () {
      st.Vpp = 12; st.f = 10; st.ldR = true; st.ldC = true; st.ldL = false;
      st.ph = 0; st.vBuf = []; st.iBuf = []; st.brightI = 0; st._dcKey = '';
      st.scopeDrag = false; st.scopeX = null;
    },
    hitTest: function (x, y) {
      return x >= st.sx && x <= st.sx + st.sw && y >= st.sy && y <= st.sy + st.sh;
    },
    onPointerDown: function (x, y) {
      if (x >= st.sx && x <= st.sx + st.sw && y >= st.sy && y <= st.sy + st.sh) {
        st.scopeDrag = true;
        st.scopeX = KT().clamp(x, st.sx + 10, st.sx + st.sw - 10);
      }
    },
    onPointerMove: function (x, y) {
      if (!st.scopeDrag) return;
      st.scopeX = KT().clamp(x, st.sx + 10, st.sx + st.sw - 10);
    },
    onPointerUp: function () { st.scopeDrag = false; }
  };
}

/* ============================================================
 * 五、模式 5：reswire —— 导线电阻 (resistance-in-a-wire)
 * ============================================================ */
var WIRE_MATS = [
  ['铜', 1.68e-8],
  ['铝', 2.65e-8],
  ['铁', 9.71e-8],
  ['镍铬合金', 1.1e-6]
];

function buildResWire() {
  var st = {
    Lcm: 50, rmm: 1, matIdx: 0, showDots: true,
    phase: 0, W: 800, H: 480, _dcKey: '',
    rwDrag: false, rwX0: 0, rwX1: 0, rwCY: 0, rwTH: 0, rwRulerY: 0
  };
  function areaMM2() { return Math.PI * st.rmm * st.rmm; }
  function resistance() {
    var rho = WIRE_MATS[st.matIdx][1];
    var Lm = st.Lcm / 100;
    var Am2 = areaMM2() * 1e-6;
    return rho * Lm / Am2;
  }
  function heatNorm() { return KT().clamp(resistance() * 1000 / 380, 0, 1); }
  return {
    init: function (L) {
      st.L = L;
      L.setKnowledge(
        '<p><strong>导线的电阻</strong>：取决于材料电阻率、长度与横截面积。</p>' +
        '<div class="formula">R = ρ · L / A　（A = πr²）</div>' +
        '<ul style="padding-left:20px"><li>导体越长电阻越大；越粗电阻越小</li>' +
        '<li>镍铬合金的电阻率约为铜的 65 倍——同样尺寸下"费电"得多</li>' +
        '<li>发热功率 P = I²R：电阻越大导线越红热（本演示假定 I = 1 A）</li>' +
        '<li>电子漂移速度与电阻成反比（阻越大越慢）</li></ul>'
      );
      L.setPresets([
        { name: '标准铜线', apply: function () { st.Lcm = 50; st.rmm = 1; st.matIdx = 0; } },
        { name: '细长镍铬丝（红热）', apply: function () { st.Lcm = 100; st.rmm = 0.2; st.matIdx = 3; } },
        { name: '粗短铝排', apply: function () { st.Lcm = 10; st.rmm = 2; st.matIdx = 1; } }
      ]);
    },
    getControls: function () {
      return [
        SL('rw_l', '导线长度 L', 1, 100, 1, st.Lcm, ' cm', function (v) { st.Lcm = v; }),
        SL('rw_r', '半径 r', 0.2, 2, 0.05, st.rmm, ' mm', function (v) { st.rmm = v; }),
        SEL('rw_mat', '材料', WIRE_MATS.map(function (m, i) { return [String(i), m[0]]; }),
          String(st.matIdx), function (v) { st.matIdx = parseInt(v, 10) || 0; }),
        CK('rw_dots', '显示电子漂移动画', st.showDots, function (v) { st.showDots = !!v; })
      ];
    },
    update: function (dt) {
      var speed = KT().clamp(240 / (resistance() * 1000 + 6), 5, 95);
      st.phase += dt * speed;
    },
    render: function (ctx, W, H) {
      st.W = W; st.H = H;
      var C = KT().COLORS;
      KT().background(ctx, W, H);
      var RmO = resistance() * 1000;
      var hz = heatNorm();
      var x0 = W * 0.13, x1 = W * 0.82, cy = H * 0.42;
      var th = 9 + st.rmm * 11;

      /* 导线主体：copper → 红热的渐变 */
      var grad = ctx.createLinearGradient(x0, cy, x1, cy);
      grad.addColorStop(0, '#a15f2e');
      grad.addColorStop(0.45, KT().rgba('#c47a3d', 1));
      grad.addColorStop(0.75, KT().rgba('#e2924a', 1));
      grad.addColorStop(1, '#9c5a28');
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(x0 - 30, cy - th / 2, (x1 - x0) + 60, th, th / 2); }
      else { ctx.rect(x0 - 30, cy - th / 2, (x1 - x0) + 60, th); }
      ctx.fillStyle = grad;
      ctx.fill();
      /* 高光 */
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x0 - 26, cy - th / 2 + th * 0.16, (x1 - x0) + 52, th * 0.22);
      /* 红热叠加层 */
      if (hz > 0.02) {
        var gHot = ctx.createLinearGradient(x0, cy, x1, cy);
        gHot.addColorStop(0, KT().rgba('#ff3b20', 0.25 + 0.7 * hz));
        gHot.addColorStop(0.5, KT().rgba('#ff6a30', 0.32 + 0.68 * hz));
        gHot.addColorStop(1, KT().rgba('#ff3b20', 0.25 + 0.7 * hz));
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(x0 - 30, cy - th / 2, (x1 - x0) + 60, th, th / 2); }
        else { ctx.rect(x0 - 30, cy - th / 2, (x1 - x0) + 60, th); }
        ctx.fillStyle = gHot;
        ctx.fill();
        /* 白热芯线 */
        if (hz > 0.55) {
          ctx.fillStyle = KT().rgba('#ffe9b0', (hz - 0.55) / 0.45);
          ctx.fillRect(x0 - 24, cy - 1.4, (x1 - x0) + 48, 2.8);
        }
      }
      ctx.restore();

      /* 电子漂移点（速度 ∝ 1/R） */
      if (st.showDots) {
        var nd = 18, i;
        var ampY = Math.max(th / 2 - 4, 2);
        ctx.save();
        ctx.globalAlpha = 0.85;
        for (i = 0; i < nd; i++) {
          var span = (x1 - x0) + 56;
          var fx = ((st.phase * 12 + i * span / nd) % span);
          var ex = x0 - 28 + fx;
          var eyy = cy + Math.sin(st.phase * 0.25 + i * 1.7) * ampY * 0.85;
          DISK(ctx, ex, eyy, 2.4, '#63d3ff');
        }
        ctx.restore();
      }

      /* 左端截面放大镜 */
      var mgX = W * 0.115, mgY = H * 0.74, mgR = 46;
      PN(ctx, mgX - 58, mgY - mgR - 26, 116, mgR * 2 + 54, { radius: 10, fill: 'rgba(255,255,255,0.92)', stroke: C.gray });
      TXT(ctx, '截面', mgX, mgY - mgR - 10, { align: 'center', size: 11, weight: 'bold', color: '#2d3436' });
      var mRad = KT().clamp(10 + st.rmm * 17, 12, 44);
      var mrGrad = ctx.createRadialGradient(mgX - mRad * 0.35, mgY - mRad * 0.35, 2, mgX, mgY, mRad);
      mrGrad.addColorStop(0, KT().rgba(mixHeatCol(hz), 1));
      mrGrad.addColorStop(1, '#6e4020');
      DISK(ctx, mgX, mgY, mRad, mrGrad, '#4a2c12', 2);
      /* 面积刻线示意 */
      DST(ctx, mgX - mRad, mgY, mgX + mRad, mgY, 'rgba(255,255,255,0.5)', 1, [3, 3]);
      TXT(ctx, 'A = ' + NF(areaMM2(), 2) + ' mm²', mgX, mgY + mRad + 14, { align: 'center', size: 12, weight: 'bold', color: '#16324a' });

      /* 尺寸标注：右刻度可拖拽改 L */
      var rulerY = cy + th / 2 + 22;
      var rightTickX = x0 + (st.Lcm / 100) * (x1 - x0);
      st.rwX0 = x0; st.rwX1 = x1; st.rwCY = cy; st.rwTH = th; st.rwRulerY = rulerY;
      DST(ctx, x0, rulerY, rightTickX, rulerY, 'rgba(255,255,255,0.55)', 1.4, []);
      DST(ctx, x0, rulerY - 6, x0, rulerY + 6, 'rgba(255,255,255,0.55)', 1.4, []);
      DST(ctx, rightTickX, rulerY - 6, rightTickX, rulerY + 6, 'rgba(255,255,255,0.55)', 1.4, []);
      DISK(ctx, rightTickX, rulerY, 7, st.rwDrag ? C.yellow : 'rgba(255,255,255,0.4)', st.rwDrag ? C.yellow : 'rgba(255,255,255,0.8)', 2);
      TXT(ctx, 'L = ' + st.Lcm + ' cm', (x0 + rightTickX) / 2, rulerY + 16, { align: 'center', size: 12.5, weight: 'bold', color: '#dbe6f2' });
      hintDrag(ctx, '👆 拖动改长度', rightTickX, rulerY - 22);
      ARW(ctx, x0 - 40, cy - th / 2, x0 - 40, cy + th / 2, C.sky, 2, 8);
      TXT(ctx, '⌀ ' + NF(st.rmm * 2, 2) + ' mm', x0 - 48, cy, { align: 'right', size: 12, color: C.sky });

      /* 温度条例 */
      var lgX = W - 210, lgY = H - 66, lgW = 176, lgH = 12;
      PN(ctx, lgX - 14, lgY - 30, lgW + 28, 62, { radius: 9, fill: 'rgba(255,255,255,0.88)' });
      TXT(ctx, '发热程度（P = I²R, 假定 1 A）', lgX - 4, lgY - 14, { size: 11.5, weight: 'bold', color: '#2d3436' });
      var gBar = ctx.createLinearGradient(lgX, 0, lgX + lgW, 0);
      gBar.addColorStop(0, '#b06f3a'); gBar.addColorStop(0.6, '#ff5030'); gBar.addColorStop(1, '#ffd76a');
      ctx.save(); ctx.beginPath(); KT().roundRect(ctx, lgX, lgY, lgW, lgH, 6); ctx.fillStyle = gBar; ctx.fill(); ctx.restore();
      DISK(ctx, lgX + lgW * hz, lgY + lgH / 2, 5, '#fff', '#333', 1.5);
      var word = hz > 0.75 ? '红热 🔥' : hz > 0.4 ? '温热' : '基本不热';
      TXT(ctx, word + '　R = ' + (RmO < 10 ? NF(RmO, 3) : NF(RmO, 1)) + ' mΩ', lgX - 4, lgY + 26, { size: 12, color: '#16324a', weight: 'bold' });

      TXT(ctx, 'R = ρ·L/A = ' + WIRE_MATS[st.matIdx][0] + '·' + NF(st.Lcm, 0) + 'cm / (π·(' + NF(st.rmm, 2) + ')²)', 18, H - 20,
        { size: 12, color: '#8fa3ba' });

      flushRows(st, [
        row('横截面积 A', NF(areaMM2(), 2), 'mm²', C.teal),
        row('电阻 R', RmO < 10 ? NF(RmO, 3) : NF(RmO, 1), 'mΩ', C.orange),
        row('材料', WIRE_MATS[st.matIdx][0], '', C.purple),
        row('发热程度', NF(hz * 100, 0), '%', hz > 0.7 ? C.red : C.green)
      ]);

      function mixHeatCol(hzv) {
        var t = KT().clamp(hzv, 0, 1);
        var rC = Math.round(0xc4 + (0xff - 0xc4) * t);
        var gC = Math.round(0x7a + (0x40 - 0x7a) * t);
        var bC = Math.round(0x3d + (0x2a - 0x3d) * t);
        var hex = (rC << 16 | gC << 8 | bC);
        var s = hex.toString(16);
        while (s.length < 6) s = '0' + s;
        return '#' + s;
      }
    },
    reset: function () {
      st.Lcm = 50; st.rmm = 1; st.matIdx = 0; st.showDots = true; st.phase = 0; st._dcKey = '';
      st.rwDrag = false;
    },
    hitTest: function (x, y) {
      var rightTickX = st.rwX0 + (st.Lcm / 100) * (st.rwX1 - st.rwX0);
      return Math.abs(x - rightTickX) <= 18 && Math.abs(y - st.rwRulerY) <= 14;
    },
    onPointerDown: function (x, y) {
      var rightTickX = st.rwX0 + (st.Lcm / 100) * (st.rwX1 - st.rwX0);
      if (Math.abs(x - rightTickX) <= 18 && Math.abs(y - st.rwRulerY) <= 14) {
        st.rwDrag = true;
      }
    },
    onPointerMove: function (x, y) {
      if (!st.rwDrag) return;
      var frac = (x - st.rwX0) / (st.rwX1 - st.rwX0);
      st.Lcm = Math.round(KT().clamp(frac * 100, 1, 100));
    },
    onPointerUp: function () { st.rwDrag = false; }
  };
}

/* ============================================================
 * 六、实验ID → 模式映射，与工厂分发收尾
 * ============================================================ */
var ID2MODE = {
  'circuit-dc': 'dc',
  'circuit-dc-virtual-lab': 'dcvirt',
  'circuit-ac': 'ac',
  'circuit-ac-virtual-lab': 'acvirt',
  'resistance-wire': 'reswire'
};

var BUILD = {
  dc: function () { return buildDC(false); },
  dcvirt: function () { return buildDC(true); },
  ac: function () { return buildAC(false); },
  acvirt: function () { return buildAC(true); },
  reswire: buildResWire
};

})();

