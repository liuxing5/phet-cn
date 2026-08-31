/**
 * Engine Kit —— 仿真引擎通用 Canvas2D 辅助库
 *
 * - 挂载到 window.Kit，各实验引擎按统一签名调用
 * - 无任何第三方依赖；除传入的 canvas context 外不访问 DOM
 */

window.Kit = (() => {

    /* ============================ 调色板 ============================ */

    /** @type {Record<string,string>} 预置调色板 */
    const COLORS = {
        red: '#e74c3c', blue: '#3498db', green: '#27ae60', orange: '#f39c12',
        purple: '#9b59b6', teal: '#1abc9c', pink: '#fd79a8', yellow: '#f1c40f',
        gray: '#95a5a6', dark: '#2d3436', light: '#ecf0f1', white: '#ffffff',
        sky: '#74b9ff', ground: '#8d6e63'
    };

    /** 内部默认字体栈（含中文字体） */
    const FONT = '"Microsoft YaHei", "PingFang SC", system-ui, Arial, sans-serif';

    /* ============================ 数值工具 ============================ */

    /**
     * 十六进制颜色转 rgba 字符串
     * @param {string} hex 颜色，支持 #rgb 与 #rrggbb
     * @param {number} [a=1] 不透明度 0~1（自动截断）
     * @returns {string} 'rgba(r,g,b,a)'；hex 非法时原样返回
     */
    function rgba(hex, a) {
        if (typeof hex !== 'string') return hex;
        let m = /^#([0-9a-fA-F]{3})$/.exec(hex);
        let r, g, b;
        if (m) {
            r = parseInt(m[1][0] + m[1][0], 16);
            g = parseInt(m[1][1] + m[1][1], 16);
            b = parseInt(m[1][2] + m[1][2], 16);
        } else {
            m = /^#([0-9a-fA-F]{6})$/.exec(hex);
            if (!m) return hex;
            r = parseInt(m[1].slice(0, 2), 16);
            g = parseInt(m[1].slice(2, 4), 16);
            b = parseInt(m[1].slice(4, 6), 16);
        }
        const alpha = (typeof a === 'number' && isFinite(a)) ? clamp(a, 0, 1) : 1;
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    /**
     * 将数值限制在闭区间 [min, max]
     * @param {number} v 输入值
     * @param {number} min 下限
     * @param {number} max 上限
     * @returns {number}
     */
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    /**
     * 线性插值
     * @param {number} a 起点
     * @param {number} b 终点
     * @param {number} t 系数 0~1（不做强制截断）
     * @returns {number} a + (b - a) * t
     */
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * 数字格式化：最多 d 位小数并去掉多余的 0
     * @param {number} v 数值
     * @param {number} [d=1] 最大小数位数
     * @returns {string} NaN / Infinity 返回 '--'，负零规范化为 '0'
     */
    function fmt(v, d = 1) {
        if (typeof v !== 'number' || !isFinite(v)) return '--';
        let s = v.toFixed(clamp(d | 0, 0, 20));
        if (s.indexOf('.') >= 0) {
            s = s.replace(/0+$/, '').replace(/\.$/, '');
        }
        if (parseFloat(s) === 0) s = '0'; // 规范化 -0 / "-0.0"
        return s;
    }

    /* ============================ 图形基元 ============================ */

    /**
     * 圆角矩形路径（只建路径，不填充不描边）
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} x 左上角 X
     * @param {number} y 左上角 Y
     * @param {number} w 宽
     * @param {number} h 高
     * @param {number} [r=8] 圆角半径（自动收缩到 min(w,h)/2）
     */
    function roundRect(ctx, x, y, w, h, r = 8) {
        r = clamp(r, 0, Math.min(w, h) / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /**
     * 面板：圆角矩形填充/描边
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} x 左上角 X
     * @param {number} y 左上角 Y
     * @param {number} w 宽
     * @param {number} h 高
     * @param {object} [opt] {fill?,stroke?,lineWidth=1,radius=10,alpha=1}
     */
    function panel(ctx, x, y, w, h, opt = {}) {
        const { fill = null, stroke = null, lineWidth = 1, radius = 10, alpha = 1 } = opt;
        ctx.save();
        ctx.globalAlpha *= alpha;
        roundRect(ctx, x, y, w, h, radius);
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * 圆形填充/描边
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} x 圆心 X
     * @param {number} y 圆心 Y
     * @param {number} r 半径
     * @param {object} [opt] {fill?,stroke?,lineWidth=1,alpha=1}
     */
    function circle(ctx, x, y, r, opt = {}) {
        const { fill = null, stroke = null, lineWidth = 1, alpha = 1 } = opt;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * 箭头：线段 + 实心三角箭头
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} x1 起点 X
     * @param {number} y1 起点 Y
     * @param {number} x2 终点（箭尖）X
     * @param {number} y2 终点（箭尖）Y
     * @param {object} [opt] {color='#fff',width=2,head=10}
     */
    function arrow(ctx, x1, y1, x2, y2, opt = {}) {
        const { color = '#fff', width = 2, head = 10 } = opt;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (!(len > 1e-6)) return; // 零向量直接跳过
        const ux = dx / len, uy = dy / len;
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        // 线段终点回退，避免压住箭头
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 - ux * head * 0.7, y2 - uy * head * 0.7);
        ctx.stroke();
        // 实心三角箭头
        const hw = head * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ux * head - uy * hw, y2 - uy * head + ux * hw);
        ctx.lineTo(x2 - ux * head + uy * hw, y2 - uy * head - ux * hw);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * 虚线段
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} x1 起点 X
     * @param {number} y1 起点 Y
     * @param {number} x2 终点 X
     * @param {number} y2 终点 Y
     * @param {object} [opt] {color='#fff',dash=[6,4],width=1}
     */
    function dashLine(ctx, x1, y1, x2, y2, opt = {}) {
        const { color = '#fff', dash = [6, 4], width = 1 } = opt;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(Array.isArray(dash) ? dash : []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * 折线/多边形
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {Array<{x:number,y:number}>} pts 顶点序列（至少 2 个）
     * @param {object} [opt] {color='#fff',width=2,dash=null,closed=false,fill=null,alpha=1}
     */
    function polyline(ctx, pts, opt = {}) {
        const { color = '#fff', width = 2, dash = null, closed = false, fill = null, alpha = 1 } = opt;
        if (!Array.isArray(pts) || pts.length < 2) return;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.setLineDash(Array.isArray(dash) ? dash : []);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (closed) ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    /* ============================ 文本 ============================ */

    /**
     * 文字标注
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {string} text 文本内容
     * @param {number} x 锚点 X
     * @param {number} y 锚点 Y
     * @param {object} [opt] {size=14,color='#fff',align='left',baseline='middle',weight='normal',alpha=1}
     */
    function label(ctx, text, x, y, opt = {}) {
        const {
            size = 14, color = '#fff', align = 'left',
            baseline = 'middle', weight = 'normal', alpha = 1
        } = opt;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.font = weight + ' ' + size + 'px ' + FONT;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        ctx.fillText(String(text), x, y);
        ctx.restore();
    }

    /**
     * 信息胶囊：圆角底 + 居中文本
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {string} text 文本内容
     * @param {number} x 胶囊左上角 X
     * @param {number} y 胶囊左上角 Y
     * @param {object} [opt] {size=12,color='#fff',bg='rgba(255,255,255,0.15)',pad=6}
     * @returns {number} 胶囊总宽度（文本宽 + 左右内边距，单位 px）
     */
    function chip(ctx, text, x, y, opt = {}) {
        const { size = 12, color = '#fff', bg = 'rgba(255,255,255,0.15)', pad = 6 } = opt;
        const t = String(text);
        ctx.save();
        ctx.font = size + 'px ' + FONT;
        const tw = ctx.measureText(t).width;
        const h = size + pad * 2;
        const w = tw + pad * 2;
        ctx.beginPath();
        roundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, x + w / 2, y + h / 2);
        ctx.restore();
        return w;
    }

    /* ============================ 场景辅助 ============================ */

    /**
     * 满屏网格线（从第一个 step 开始，不含边缘）
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} W 画布宽
     * @param {number} H 画布高
     * @param {object} [opt] {step=50,color='rgba(255,255,255,0.05)'}
     */
    function grid(ctx, W, H, opt = {}) {
        const { step = 50, color = 'rgba(255,255,255,0.05)' } = opt;
        if (!(step > 0) || !(W > 0) || !(H > 0)) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = step; gx < W; gx += step) {
            const px = Math.round(gx) + 0.5; // 对齐像素，线条更锐利
            ctx.moveTo(px, 0);
            ctx.lineTo(px, H);
        }
        for (let gy = step; gy < H; gy += step) {
            const py = Math.round(gy) + 0.5;
            ctx.moveTo(0, py);
            ctx.lineTo(W, py);
        }
        ctx.stroke();
        ctx.restore();
    }

    /**
     * 左下角 L 形坐标轴：主轴 + 刻度短线 + 刻度数字（Kit.ticks 生成）+ 可选轴标题
     * 若提供 minX/maxX/minY/maxY 则按数据范围映射刻度
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} W 画布宽
     * @param {number} H 画布高
     * @param {object} [opt] {margin=45,color='rgba(255,255,255,0.7)',
     *   xLabel='',yLabel='',minX=0,maxX=10,minY=0,maxY=10}
     */
    function axes(ctx, W, H, opt = {}) {
        const {
            margin = 45,
            color = 'rgba(255,255,255,0.7)',
            xLabel = '',
            yLabel = '',
            minX = 0, maxX = 10,
            minY = 0, maxY = 10
        } = opt;

        const m = clamp(margin, 20, Math.min(W, H) / 2);
        const ox = m;             // 原点像素 X
        const oy = H - m;         // 原点像素 Y
        const xLen = W - m * 2;   // X 轴像素长度
        const yLen = H - m * 2;   // Y 轴像素长度

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        ctx.font = '11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // L 形主轴线
        ctx.beginPath();
        ctx.moveTo(ox, oy - yLen);
        ctx.lineTo(ox, oy);
        ctx.lineTo(ox + xLen, oy);
        ctx.stroke();

        const spanX = maxX - minX;
        const spanY = maxY - minY;

        // X 轴刻度短线与数字
        if (isFinite(spanX) && spanX !== 0) {
            ticks(minX, maxX, 6).forEach(v => {
                const px = ox + (v - minX) / spanX * xLen;
                if (px < ox - 1 || px > ox + xLen + 1) return;
                ctx.beginPath();
                ctx.moveTo(px, oy);
                ctx.lineTo(px, oy + 5);
                ctx.stroke();
                ctx.fillText(fmt(v, 2), px, oy + 8);
            });
        }

        // Y 轴刻度短线与数字
        if (isFinite(spanY) && spanY !== 0) {
            ticks(minY, maxY, 6).forEach(v => {
                const py = oy - (v - minY) / spanY * yLen;
                if (py < oy - yLen - 1 || py > oy + 1) return;
                ctx.beginPath();
                ctx.moveTo(ox, py);
                ctx.lineTo(ox - 5, py);
                ctx.stroke();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(fmt(v, 2), ox - 8, py);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
            });
        }

        // 轴标题：X 标题居中于轴下方；Y 标题旋转 90°
        if (xLabel) {
            ctx.font = 'bold 13px ' + FONT;
            ctx.fillText(xLabel, ox + xLen / 2, oy + 24);
        }
        if (yLabel) {
            ctx.font = 'bold 13px ' + FONT;
            ctx.translate(ox - 26, oy - yLen / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(yLabel, 0, 0);
        }

        ctx.restore();
    }

    /* ============================ 坐标系 ============================ */

    /**
     * 构建世界坐标 <-> 像素坐标的双向线性映射
     * @param {{x:number[],px:number[],y:number[],py:number[]}} def
     *   x:[xmin,xmax] ↔ px:[x0px,x1px]，y:[ymin,ymax] ↔ py:[y0px,y1px]
     *   （纯线性映射；希望世界上方为屏幕上方时，py 传 [底边y, 顶边y]）
     * @returns {{X:(wx:number)=>number, Y:(wy:number)=>number,
     *            XI:(sx:number)=>number, YI:(sy:number)=>number}}
     */
    function view(def) {
        const xmin = def.x[0], xmax = def.x[1];
        const xp0 = def.px[0], xp1 = def.px[1];
        const ymin = def.y[0], ymax = def.y[1];
        const yp0 = def.py[0], yp1 = def.py[1];

        const kx = (xp1 - xp0) / (xmax - xmin);
        const ky = (yp1 - yp0) / (ymax - ymin);

        return {
            X: wx => xp0 + (wx - xmin) * kx,   // 世界 X → 像素 X
            Y: wy => yp0 + (wy - ymin) * ky,   // 世界 Y → 像素 Y
            XI: sx => xmin + (sx - xp0) / kx,  // 像素 X → 世界 X
            YI: sy => ymin + (sy - yp0) / ky   // 像素 Y → 世界 Y
        };
    }

    /**
     * 生成"优雅"刻度（步长取 1/2/5 × 10^k），只包含落在 [min,max] 内的值
     * @param {number} min 最小值
     * @param {number} max 最大值
     * @param {number} [n=6] 期望刻度数量（仅作密度参考）
     * @returns {number[]} 升序刻度值数组
     */
    function ticks(min, max, n = 6) {
        if (!isFinite(min) || !isFinite(max)) return [];
        if (max < min) { const t = min; min = max; max = t; }
        if (min === max) return [min];
        const count = Math.max(1, (n | 0) || 1);

        const raw = (max - min) / count;                       // 目标原始步长
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));  // 数量级
        const norm = raw / mag;                                 // 归一化到 [1,10)
        let unit;
        if (norm <= 1) unit = 1;
        else if (norm <= 2) unit = 2;
        else if (norm <= 5) unit = 5;
        else unit = 10;
        const step = unit * mag;

        const dec = Math.max(0, 1 - Math.floor(Math.log10(step))); // 用于消除浮点尾差
        const start = Math.ceil(min / step - 1e-9) * step;
        const end = max + step * 1e-6;
        const out = [];
        let guard = 0;
        for (let v = start; v <= end && guard++ < 100000; v += step) {
            let val = Number((Math.round(v / step) * step).toFixed(dec));
            if (val === 0) val = 0; // 规范化 -0
            if (val >= min - 1e-9 && val <= max + 1e-9) out.push(val);
        }
        return out;
    }

    /**
     * 创建确定性伪随机数生成器（mulberry32）
     * @param {number} seed 种子（自动转 uint32）
     * @returns {function():number} 每次调用返回 [0,1) 的随机数
     */
    function rng(seed) {
        let a = seed >>> 0;
        return function () {
            let t = (a += 0x6D2B79F5) >>> 0;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * 铺满画布的深色渐变背景（自上而下 '#1a2036' → '#11141f'）
     * @param {CanvasRenderingContext2D} ctx 画布上下文
     * @param {number} W 画布宽
     * @param {number} H 画布高
     */
    function background(ctx, W, H) {
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1a2036');
        grad.addColorStop(1, '#11141f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    /* ============================ 导出 ============================ */

    return {
        COLORS,
        rgba, clamp, lerp, fmt,
        roundRect, panel, circle, arrow, dashLine, polyline,
        label, chip, grid, axes,
        view, ticks, rng, background
    };

})();
