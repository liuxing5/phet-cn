/**
 * 单摆实验室
 * 探索单摆运动的规律
 */

const Experiment = {
    // 实验状态
    state: {
        length: 1.0,          // 摆长 (m)
        gravity: 9.8,         // 重力加速度
        angle: 30,            // 初始角度 (度)
        damping: 0.0,         // 阻尼系数
        currentAngle: 0,      // 当前角度
        angularVelocity: 0,   // 角速度
        time: 0,
        period: 0,
        trail: [],
        anchorX: 0,
        anchorY: 0
    },

    // 初始化
    init(loader) {
        this.loader = loader;
        this.setupAnchor();
        this.setupKnowledge();
        this.setupPresets();
        this.setupGuide();
        this.computePeriod();
        this.updateData();
    },

    // 设置分步操作引导
    setupGuide() {
        this.loader.setGuide([
            { text: '拖动摆球改变起始角度（5°~80°）', highlight: true },
            { text: '调整"摆长"滑块，观察周期变化' },
            { text: '点击"▶️ 开始"观察摆动，查看轨迹', highlight: true },
            { text: '尝试"月球上的摆"预设，感受重力影响' },
            { text: '验证公式：周期 T = 2π√(L ÷ g)' }
        ]);
    },

    // 设置悬挂点
    setupAnchor() {
        const canvas = document.getElementById('simulationCanvas');
        this.state.anchorX = canvas.width / 2;
        this.state.anchorY = 80;
    },

    // 设置知识点
    setupKnowledge() {
        this.loader.setKnowledge(`
            <p><strong>单摆</strong>是物理学中经典的简谐运动模型。由一根不可伸长、质量可忽略的细绳和一个质点摆锤组成。</p>
            
            <h4 style="color: var(--primary-color); margin-top: 15px;">📐 单摆周期公式</h4>
            <div class="formula">T = 2π √(L / g)</div>
            <p>其中：</p>
            <ul style="padding-left: 20px; margin-bottom: 15px;">
                <li><strong>T</strong> - 周期 (s)</li>
                <li><strong>L</strong> - 摆长 (m)</li>
                <li><strong>g</strong> - 重力加速度 (m/s²)</li>
            </ul>

            <h4 style="color: var(--primary-color); margin-top: 15px;">🎯 重要特性</h4>
            <ul style="padding-left: 20px; margin-bottom: 15px;">
                <li>单摆周期只与<strong>摆长</strong>和<strong>重力加速度</strong>有关</li>
                <li>周期与<strong>摆球质量</strong>无关</li>
                <li>小角度近似下（< 5°），周期与<strong>起始角度</strong>无关</li>
            </ul>

            <h4 style="color: var(--primary-color); margin-top: 15px;">💡 实际应用</h4>
            <ul style="padding-left: 20px;">
                <li>摆钟 - 利用单摆周期恒定的特性来计时</li>
                <li>地震仪 - 检测地壳运动</li>
                <li>伽利略在1581年发现单摆等时性</li>
            </ul>
        `);
    },

    // 设置预设方案
    setupPresets() {
        const presets = [
            {
                name: '秒摆 (1秒周期)',
                apply: () => {
                    this.state.length = 0.993; // T = 2π√(L/g) = 2s => L ≈ 0.993m
                    this.state.angle = 30;
                    this.syncControls();
                }
            },
            {
                name: '长摆慢摆',
                apply: () => {
                    this.state.length = 3;
                    this.state.angle = 45;
                    this.syncControls();
                }
            },
            {
                name: '短摆快摆',
                apply: () => {
                    this.state.length = 0.3;
                    this.state.angle = 20;
                    this.syncControls();
                }
            },
            {
                name: '月球上的摆',
                apply: () => {
                    this.state.length = 1;
                    this.state.gravity = 1.62; // 月球重力
                    this.state.angle = 30;
                    this.syncControls();
                }
            }
        ];
        this.loader.setPresets(presets);
    },

    // 获取控件配置
    getControls() {
        return [
            {
                type: 'slider',
                id: 'length',
                label: '摆长 (m)',
                value: this.state.length,
                min: 0.1,
                max: 5,
                step: 0.1,
                unit: 'm',
                onChange: (val) => {
                    this.state.length = val;
                    this.computePeriod();
                }
            },
            {
                type: 'slider',
                id: 'gravity',
                label: '重力 (m/s²)',
                value: this.state.gravity,
                min: 0.5,
                max: 25,
                step: 0.1,
                unit: 'm/s²',
                onChange: (val) => {
                    this.state.gravity = val;
                    this.computePeriod();
                }
            },
            {
                type: 'slider',
                id: 'angle',
                label: '起始角度 (°)',
                value: this.state.angle,
                min: 5,
                max: 80,
                step: 1,
                unit: '°',
                onChange: (val) => {
                    this.state.angle = val;
                    this.state.currentAngle = val * Math.PI / 180;
                    this.state.angularVelocity = 0;
                    this.state.trail = [];
                }
            },
            {
                type: 'slider',
                id: 'damping',
                label: '阻尼系数',
                value: this.state.damping,
                min: 0,
                max: 0.5,
                step: 0.01,
                unit: '',
                onChange: (val) => {
                    this.state.damping = val;
                }
            }
        ];
    },

    // 同步控件状态
    syncControls() {
        ['length', 'gravity', 'angle', 'damping'].forEach(key => {
            const slider = document.getElementById(key);
            if (slider) {
                slider.value = this.state[key];
                const unit = key === 'length' ? 'm' : key === 'gravity' ? 'm/s²' : key === 'angle' ? '°' : '';
                document.getElementById(`${key}_value`).textContent = this.state[key] + unit;
            }
        });
        this.state.currentAngle = this.state.angle * Math.PI / 180;
        this.state.angularVelocity = 0;
        this.state.trail = [];
        this.computePeriod();
    },

    // 计算周期
    computePeriod() {
        // T = 2π√(L/g)
        this.state.period = 2 * Math.PI * Math.sqrt(this.state.length / this.state.gravity);
        this.updateData();
    },

    // 更新数据显示
    updateData() {
        const frequency = 1 / this.state.period;
        
        this.loader.updateDataDisplay([
            { label: '摆长 L', value: this.state.length.toFixed(2), unit: 'm', color: '#3498db' },
            { label: '周期 T', value: this.state.period.toFixed(3), unit: 's', color: '#e74c3c' },
            { label: '频率 f', value: frequency.toFixed(3), unit: 'Hz', color: '#2ecc71' },
            { label: '角速度 ω', value: this.state.angularVelocity.toFixed(2), unit: 'rad/s', color: '#f39c12' }
        ]);
    },

    // 更新（每帧）
    update(deltaTime, time) {
        this.state.time = time;
        
        // 使用龙格-库塔法数值求解单摆运动方程
        // θ'' = -(g/L) * sin(θ) - b * θ'
        
        const g = this.state.gravity;
        const L = this.state.length;
        const b = this.state.damping;
        
        // 物理像素比例
        const pixelsPerMeter = 100;
        const L_px = L * pixelsPerMeter;
        
        // 数值积分
        const theta = this.state.currentAngle;
        const omega = this.state.angularVelocity;
        
        // RK4步进
        const f = (th, om) => {
            return -(g / L) * Math.sin(th) - b * om;
        };
        
        const k1v = f(theta, omega);
        const k1x = omega;
        
        const k2v = f(theta + 0.5 * deltaTime * k1x, omega + 0.5 * deltaTime * k1v);
        const k2x = omega + 0.5 * deltaTime * k1v;
        
        const k3v = f(theta + 0.5 * deltaTime * k2x, omega + 0.5 * deltaTime * k2v);
        const k3x = omega + 0.5 * deltaTime * k2v;
        
        const k4v = f(theta + deltaTime * k3x, omega + deltaTime * k3v);
        const k4x = omega + deltaTime * k3v;
        
        this.state.currentAngle += (deltaTime / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        this.state.angularVelocity += (deltaTime / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
        
        // 计算摆球位置
        const bobX = this.state.anchorX + L_px * Math.sin(this.state.currentAngle);
        const bobY = this.state.anchorY + L_px * Math.cos(this.state.currentAngle);
        
        // 记录轨迹
        this.state.trail.push({ x: bobX, y: bobY, angle: this.state.currentAngle });
        if (this.state.trail.length > 200) {
            this.state.trail.shift();
        }
        
        this.updateData();
    },

    // 渲染
    render(ctx, width, height, time) {
        // 清空背景
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#1a1a2e');
        bgGradient.addColorStop(1, '#16213e');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        // 绘制刻度
        this.drawScale(ctx, width, height);
        
        // 绘制参考线
        this.drawReferenceLine(ctx);
        
        // 绘制轨迹
        this.drawTrail(ctx);
        
        // 绘制摆
        this.drawPendulum(ctx);
        
        // 绘制拖拽提示
        this.drawDragHint(ctx);
        
        // 绘制信息
        this.drawInfo(ctx, width);
    },

    // 绘制摆球拖拽提示标签
    drawDragHint(ctx) {
        const L_px = this.state.length * 100;
        const bobX = this.state.anchorX + L_px * Math.sin(this.state.currentAngle);
        const bobY = this.state.anchorY + L_px * Math.cos(this.state.currentAngle);
        ctx.save();
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd54f';
        ctx.fillText('👆 拖动摆球调角度', bobX + 30, bobY);
        ctx.restore();
    },

    // 绘制刻度
    drawScale(ctx, width, height) {
        const pixelsPerMeter = 100;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        
        // 垂直刻度
        for (let i = 0; i <= 5; i++) {
            const y = this.state.anchorY + i * pixelsPerMeter;
            if (y < height - 20) {
                ctx.beginPath();
                ctx.moveTo(this.state.anchorX - 15, y);
                ctx.lineTo(this.state.anchorX - 5, y);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(`${i}m`, this.state.anchorX - 20, y + 3);
            }
        }
        
        // 水平刻度（角度指示）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        for (let angle = -90; angle <= 90; angle += 15) {
            const rad = angle * Math.PI / 180;
            const len = 100;
            const x1 = this.state.anchorX;
            const y1 = this.state.anchorY;
            const x2 = x1 + len * Math.sin(rad);
            const y2 = y1 + len * Math.cos(rad);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    },

    // 绘制参考线
    drawReferenceLine(ctx) {
        // 垂直参考线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(this.state.anchorX, this.state.anchorY);
        ctx.lineTo(this.state.anchorX, this.state.anchorY + 500);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // 起始角度指示
        const L_px = this.state.length * 100;
        const startAngleRad = this.state.angle * Math.PI / 180;
        
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        
        ctx.beginPath();
        ctx.moveTo(this.state.anchorX, this.state.anchorY);
        ctx.lineTo(
            this.state.anchorX + L_px * Math.sin(startAngleRad),
            this.state.anchorY + L_px * Math.cos(startAngleRad)
        );
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(this.state.anchorX, this.state.anchorY);
        ctx.lineTo(
            this.state.anchorX - L_px * Math.sin(startAngleRad),
            this.state.anchorY + L_px * Math.cos(startAngleRad)
        );
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // 角度标注
        ctx.fillStyle = 'rgba(46, 204, 113, 0.8)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`起始角度: ${this.state.angle}°`, this.state.anchorX + 10, this.state.anchorY + 60);
    },

    // 绘制轨迹
    drawTrail(ctx) {
        if (this.state.trail.length < 2) return;
        
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        ctx.moveTo(this.state.trail[0].x, this.state.trail[0].y);
        for (let i = 1; i < this.state.trail.length; i++) {
            ctx.lineTo(this.state.trail[i].x, this.state.trail[i].y);
        }
        ctx.stroke();
    },

    // 绘制摆
    drawPendulum(ctx) {
        const L_px = this.state.length * 100;
        const bobX = this.state.anchorX + L_px * Math.sin(this.state.currentAngle);
        const bobY = this.state.anchorY + L_px * Math.cos(this.state.currentAngle);
        
        // 绘制支架
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(this.state.anchorX - 30, this.state.anchorY - 20, 60, 15);
        
        // 悬挂点
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.arc(this.state.anchorX, this.state.anchorY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 绳子
        ctx.strokeStyle = '#f5f5dc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.state.anchorX, this.state.anchorY);
        ctx.lineTo(bobX, bobY);
        ctx.stroke();
        
        // 摆球
        const bobRadius = 20;
        const gradient = ctx.createRadialGradient(
            bobX - 5, bobY - 5, 0,
            bobX, bobY, bobRadius
        );
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(0.5, '#FFA500');
        gradient.addColorStop(1, '#B8860B');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 摆球高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(bobX - 6, bobY - 6, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 当前角度显示
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        const angleDeg = (this.state.currentAngle * 180 / Math.PI).toFixed(1);
        ctx.fillText(`${angleDeg}°`, bobX, bobY + 4);
    },

    // 绘制信息
    drawInfo(ctx, width) {
        // 公式显示
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(10, 10, 280, 60);
        
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('T = 2π√(L/g)', 20, 30);
        ctx.font = '12px sans-serif';
        ctx.fillText(`T = 2π√(${this.state.length.toFixed(2)}/${this.state.gravity.toFixed(1)}) = ${this.state.period.toFixed(3)}s`, 20, 55);
    },

    // 重置
    reset() {
        this.state.length = 1.0;
        this.state.gravity = 9.8;
        this.state.angle = 30;
        this.state.damping = 0;
        this.state.currentAngle = 30 * Math.PI / 180;
        this.state.angularVelocity = 0;
        this.state.trail = [];
        this.computePeriod();
        this.syncControls();
        this.isDraggingBob = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.startAngle = 0;
        this.startLength = 0;
    },
    
    // 指针事件处理 - 实现拖拽交互（拖动摆球调整角度）
    onPointerDown(x, y, event) {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        const canvasX = x; // 已经是画布坐标
        const canvasY = y;
        
        // 计算摆球位置
        const L_px = this.state.length * 100; // pixelsPerMeter = 100
        const bobX = this.state.anchorX + L_px * Math.sin(this.state.currentAngle);
        const bobY = this.state.anchorY + L_px * Math.cos(this.state.currentAngle);
        
        // 判断是否点击摆球（半径20像素，加上容忍度）
        const dx = canvasX - bobX;
        const dy = canvasY - bobY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 25) { // 命中阈值像素
            this.isDraggingBob = true;
            this.dragStartX = canvasX;
            this.dragStartY = canvasY;
            this.startAngle = this.state.angle;
            this.startLength = this.state.length;
            return true;
        }
        return false;
    },
    
    onPointerMove(x, y, event) {
        if (!this.isDraggingBob) return;
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = x;
        const canvasY = y;
        
        // 计算从悬挂点到指针的角度
        const dx = canvasX - this.state.anchorX;
        const dy = canvasY - this.state.anchorY;
        // angleRad: 从垂直向下顺时针为正（因为y轴向下为正）
        let angleRad = Math.atan2(dx, dy); // dx为水平偏移，dy为垂直偏移（向下为正）
        let angleDeg = angleRad * 180 / Math.PI;
        // 限制角度范围，与起始角度滑块一致（5°~80°）
        angleDeg = Math.max(5, Math.min(80, angleDeg));
        this.state.angle = angleDeg;
        this.syncControls(); // 更新角度滑块及相关状态
    },
    
    onPointerUp(x, y, event) {
        this.isDraggingBob = false;
    },

    // 命中检测：判断坐标是否落在摆球上（供 loader 显示抓手光标）
    hitTest(x, y) {
        const L_px = this.state.length * 100;
        const bobX = this.state.anchorX + L_px * Math.sin(this.state.currentAngle);
        const bobY = this.state.anchorY + L_px * Math.cos(this.state.currentAngle);
        const dx = x - bobX;
        const dy = y - bobY;
        return Math.sqrt(dx * dx + dy * dy) < 28;
    },

    // 画布大小改变
    onResize(w, h) {
        this.setupAnchor();
        this.state.trail = [];
    }
};

// 导出到全局
window.Experiment = Experiment;
