/**
 * 欧姆定律实验
 * 探索电压、电流和电阻之间的关系
 */

const Experiment = {
    // 实验状态
    state: {
        voltage: 10,      // 电压 (V)
        resistance: 10,   // 电阻 (Ω)
        current: 1,       // 电流 (A)
        time: 0,
        electrons: [],    // 电子粒子
        energyParticles: [] // 能量粒子
    },

    // 初始化
    init(loader) {
        this.loader = loader;
        this.setupElectrons();
        this.setupKnowledge();
        this.setupPresets();
        this.setupGuide();
        this.updateCurrent();
    },

    // 设置分步操作引导
    setupGuide() {
        this.loader.setGuide([
            { text: '上下拖动左侧电池，改变电路电压 V', highlight: true },
            { text: '左右拖动右侧电阻，改变电阻值 R' },
            { text: '观察电流读数与灯泡亮度的变化', highlight: true },
            { text: '点击"▶️ 开始"，观察电子沿电路流动' },
            { text: '对比验证：电流 I = 电压 V ÷ 电阻 R' }
        ]);
    },

    // 设置电子粒子
    setupElectrons() {
        this.state.electrons = [];
        const electronCount = 8;
        for (let i = 0; i < electronCount; i++) {
            this.state.electrons.push({
                angle: (i / electronCount) * Math.PI * 2,
                speed: 0.02 + Math.random() * 0.01
            });
        }
    },

    // 更新电流计算
    updateCurrent() {
        // 欧姆定律: I = V / R
        this.state.current = this.state.voltage / this.state.resistance;
        
        // 更新实时数据显示
        this.loader.updateDataDisplay([
            { label: '电压 (V)', value: this.state.voltage.toFixed(1), unit: 'V', color: '#3498db' },
            { label: '电阻 (R)', value: this.state.resistance.toFixed(1), unit: 'Ω', color: '#e74c3c' },
            { label: '电流 (I)', value: this.state.current.toFixed(3), unit: 'A', color: '#2ecc71' },
            { label: '功率 (P)', value: (this.state.voltage * this.state.current).toFixed(2), unit: 'W', color: '#f39c12' }
        ]);
    },

    // 设置知识点
    setupKnowledge() {
        this.loader.setKnowledge(`
            <p><strong>欧姆定律</strong>是由德国物理学家格奥尔格·欧姆于1827年发现的，它描述了电压、电流和电阻之间的关系。</p>
            
            <h4 style="color: var(--primary-color); margin-top: 15px;">📐 核心公式</h4>
            <div class="formula">
                I = V / R
            </div>
            <p>其中：</p>
            <ul style="padding-left: 20px; margin-bottom: 15px;">
                <li><strong>I</strong> - 电流 (Current)，单位：安培 (A)</li>
                <li><strong>V</strong> - 电压 (Voltage)，单位：伏特 (V)</li>
                <li><strong>R</strong> - 电阻 (Resistance)，单位：欧姆 (Ω)</li>
            </ul>

            <h4 style="color: var(--primary-color); margin-top: 15px;">🔍 物理含义</h4>
            <p>在温度不变的条件下，通过导体的电流与导体两端的电压成正比，与导体的电阻成反比。</p>

            <h4 style="color: var(--primary-color); margin-top: 15px;">💡 实际应用</h4>
            <p>欧姆定律是电路分析的基础，广泛应用于：</p>
            <ul style="padding-left: 20px;">
                <li>电路设计和计算</li>
                <li>电器设备的安全使用</li>
                <li>电子元件的选型</li>
            </ul>
        `);
    },

    // 设置预设方案
    setupPresets() {
        const presets = [
            {
                name: '低电压低电阻',
                apply: () => {
                    this.state.voltage = 3;
                    this.state.resistance = 5;
                    this.syncControls();
                }
            },
            {
                name: '标准照明电路',
                apply: () => {
                    this.state.voltage = 220;
                    this.state.resistance = 484;
                    this.syncControls();
                }
            },
            {
                name: '高电压大电流',
                apply: () => {
                    this.state.voltage = 380;
                    this.state.resistance = 10;
                    this.syncControls();
                }
            },
            {
                name: '安全低电压',
                apply: () => {
                    this.state.voltage = 12;
                    this.state.resistance = 20;
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
                id: 'voltage',
                label: '电压 (V)',
                value: this.state.voltage,
                min: 0,
                max: 400,
                step: 1,
                unit: 'V',
                onChange: (val) => {
                    this.state.voltage = val;
                    this.updateCurrent();
                }
            },
            {
                type: 'slider',
                id: 'resistance',
                label: '电阻 (Ω)',
                value: this.state.resistance,
                min: 1,
                max: 1000,
                step: 1,
                unit: 'Ω',
                onChange: (val) => {
                    this.state.resistance = val;
                    this.updateCurrent();
                }
            }
        ];
    },

    // 同步控件状态
    syncControls() {
        const voltageSlider = document.getElementById('voltage');
        const resistanceSlider = document.getElementById('resistance');
        
        if (voltageSlider) {
            voltageSlider.value = this.state.voltage;
            document.getElementById('voltage_value').textContent = this.state.voltage + 'V';
        }
        if (resistanceSlider) {
            resistanceSlider.value = this.state.resistance;
            document.getElementById('resistance_value').textContent = this.state.resistance + 'Ω';
        }
        this.updateCurrent();
    },

    // 更新（每帧）
    update(deltaTime, time) {
        this.state.time = time;
        
        // 更新电子运动速度（与电流成正比）
        const speedFactor = Math.min(this.state.current * 0.5, 3);
        this.state.electrons.forEach(e => {
            e.angle += e.speed * speedFactor;
            if (e.angle > Math.PI * 2) e.angle -= Math.PI * 2;
        });
    },

    // 渲染
    render(ctx, width, height, time) {
        // 清空背景
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(width, height) / 400;

        // 绘制电路图
        this.drawCircuit(ctx, centerX, centerY, scale);
        
        // 绘制电池
        this.drawBattery(ctx, centerX, centerY - 120 * scale, scale);
        
        // 绘制电阻
        this.drawResistor(ctx, centerX + 120 * scale, centerY, scale);
        
        // 绘制电流方向箭头
        this.drawCurrentArrows(ctx, centerX, centerY, scale);
        
        // 绘制电子
        this.drawElectrons(ctx, centerX, centerY, scale);
        
        // 绘制电灯泡（亮度与电流相关）
        this.drawLightBulb(ctx, centerX - 120 * scale, centerY, scale);
        
        // 绘制拖拽提示
        this.drawDragHints(ctx, centerX, centerY, scale);
        
        // 显示信息
        this.drawInfo(ctx, width, height);
    },

    // 绘制可拖拽元素的提示标签
    drawDragHints(ctx, centerX, centerY, scale) {
        ctx.save();
        ctx.font = `bold ${13 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd54f';
        // 电池提示（位于电路上方）
        ctx.fillText('👆 拖动调电压', centerX, centerY - 175 * scale);
        // 电阻提示（位于电阻上方）
        ctx.fillText('👆 拖动调电阻', centerX + 120 * scale, centerY - 28 * scale);
        ctx.restore();
    },

    // 绘制电路
    drawCircuit(ctx, cx, cy, scale) {
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        
        // 完整的矩形电路
        const leftX = cx - 180 * scale;
        const rightX = cx + 180 * scale;
        const topY = cy - 120 * scale;
        const bottomY = cy + 120 * scale;
        
        ctx.moveTo(leftX, topY);
        ctx.lineTo(rightX, topY);
        ctx.lineTo(rightX, bottomY);
        ctx.lineTo(leftX, bottomY);
        ctx.closePath();
        ctx.stroke();
    },

    // 绘制电池
    drawBattery(ctx, x, y, scale) {
        const size = 30 * scale;
        
        // 电池主体
        ctx.fillStyle = '#f8f9fa';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2 * scale;
        
        ctx.beginPath();
        ctx.rect(x - size, y - size * 1.5, size * 2, size * 3);
        ctx.fill();
        ctx.stroke();
        
        // 电池标签
        ctx.fillStyle = '#333';
        ctx.font = `${14 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        
        // 正极
        ctx.fillText('+', x, y - size * 0.3);
        // 负极
        ctx.fillText('−', x, y + size * 1.2);
        
        // 电压值
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(this.state.voltage.toFixed(1) + 'V', x, y + size * 2.4);
    },

    // 绘制电阻
    drawResistor(ctx, x, y, scale) {
        const width = 80 * scale;
        const height = 30 * scale;
        
        // 电阻主体
        ctx.fillStyle = '#d4a574';
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2 * scale;
        
        ctx.beginPath();
        ctx.rect(x - width / 2, y - height / 2, width, height);
        ctx.fill();
        ctx.stroke();
        
        // 电阻条纹
        const stripeCount = Math.min(Math.floor(this.state.resistance / 100) + 3, 8);
        const stripeWidth = width / (stripeCount + 1);
        const colors = ['#800000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
        
        for (let i = 0; i < stripeCount; i++) {
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(
                x - width / 2 + stripeWidth * (i + 0.5),
                y - height / 2,
                stripeWidth * 0.6,
                height
            );
        }
        
        // 电阻值
        ctx.fillStyle = '#333';
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.state.resistance + 'Ω', x, y + height);
    },

    // 绘制电灯泡
    drawLightBulb(ctx, x, y, scale) {
        const brightness = Math.min(this.state.current / 5, 1);
        const glowRadius = 40 * scale + brightness * 20 * scale;
        
        // 光晕
        if (brightness > 0.1) {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
            gradient.addColorStop(0, `rgba(255, 255, 0, ${brightness * 0.6})`);
            gradient.addColorStop(0.5, `rgba(255, 200, 0, ${brightness * 0.3})`);
            gradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 灯泡主体
        ctx.fillStyle = brightness > 0.1 
            ? `rgb(${255}, ${255}, ${brightness > 0.5 ? 150 : 100})`
            : '#e0e0e0';
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2 * scale;
        
        ctx.beginPath();
        ctx.arc(x, y - 5 * scale, 25 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 灯丝
        ctx.strokeStyle = brightness > 0.1 ? '#ff6600' : '#999';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(x - 10 * scale, y);
        ctx.quadraticCurveTo(x, y - 15 * scale, x + 10 * scale, y);
        ctx.stroke();
        
        // 灯座
        ctx.fillStyle = '#666';
        ctx.fillRect(x - 15 * scale, y + 20 * scale, 30 * scale, 10 * scale);
    },

    // 绘制电流方向箭头
    drawCurrentArrows(ctx, cx, cy, scale) {
        const speed = Math.min(this.state.current * 2, 5);
        const positions = [0.25, 0.75]; // 在电路上的位置
        
        ctx.fillStyle = '#3498db';
        ctx.font = `${14 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        
        // 电流标签
        ctx.fillStyle = '#3498db';
        ctx.fillText(`电流: ${this.state.current.toFixed(2)} A`, cx, cy + 160 * scale);
    },

    // 绘制电子粒子
    drawElectrons(ctx, cx, cy, scale) {
        const leftX = cx - 180 * scale;
        const rightX = cx + 180 * scale;
        const topY = cy - 120 * scale;
        const bottomY = cy + 120 * scale;
        
        this.state.electrons.forEach(e => {
            // 沿电路运动
            let x, y;
            const t = e.angle % (Math.PI * 2);
            
            if (t < Math.PI / 2) {
                // 上边：左到右
                const p = t / (Math.PI / 2);
                x = leftX + p * (rightX - leftX);
                y = topY;
            } else if (t < Math.PI) {
                // 右边：上到下
                const p = (t - Math.PI / 2) / (Math.PI / 2);
                x = rightX;
                y = topY + p * (bottomY - topY);
            } else if (t < Math.PI * 1.5) {
                // 下边：右到左
                const p = (t - Math.PI) / (Math.PI / 2);
                x = rightX - p * (rightX - leftX);
                y = bottomY;
            } else {
                // 左边：下到上
                const p = (t - Math.PI * 1.5) / (Math.PI / 2);
                x = leftX;
                y = bottomY - p * (bottomY - topY);
            }
            
            // 绘制电子
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8 * scale);
            gradient.addColorStop(0, '#64b5f6');
            gradient.addColorStop(1, 'rgba(100, 181, 246, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#2196f3';
            ctx.beginPath();
            ctx.arc(x, y, 4 * scale, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    // 绘制信息
    drawInfo(ctx, width, height) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        
        // 说明
        ctx.fillText('🔋 调整电压和电阻，观察电流和灯泡亮度的变化', 20, 30);
    },

    // 重置
    reset() {
        this.state.voltage = 10;
        this.state.resistance = 10;
        this.state.time = 0;
        this.updateCurrent();
        this.syncControls();
        this.isDraggingVoltage = false;
        this.isDraggingResistance = false;
    },
    
    // 指针事件处理 - 实现拖拽交互
    onPointerDown(x, y, event) {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        const canvasX = x; // x is already canvas coords from loader
        const canvasY = y;
        const width = canvas._displayW || canvas.width;
        const height = canvas._displayH || canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(width, height) / 400;
        
        // 电池位置（drawBattery 绘制宽 60*scale、高 90*scale 的矩形，中心在 (x,y)）
        const batteryX = centerX;
        const batteryY = centerY - 120 * scale;
        const batteryHalfW = 30 * scale;
        const batteryHalfH = 45 * scale;
        // 电阻位置
        const resistorX = centerX + 120 * scale;
        const resistorY = centerY;
        const resistorWidth = 80 * scale;
        const resistorHeight = 30 * scale;
        
        // 检查是否点击电池区域
        if (Math.abs(canvasX - batteryX) < batteryHalfW && 
            Math.abs(canvasY - batteryY) < batteryHalfH) {
            this.isDraggingVoltage = true;
            this.dragStartY = canvasY;
            this.startVoltage = this.state.voltage;
            return true;
        }
        // 检查是否点击电阻区域
        if (Math.abs(canvasX - resistorX) < resistorWidth/2 && 
            Math.abs(canvasY - resistorY) < resistorHeight/2) {
            this.isDraggingResistance = true;
            this.dragStartX = canvasX;
            this.startResistance = this.state.resistance;
            return true;
        }
        return false;
    },
    
    onPointerMove(x, y, event) {
        if (!this.isDraggingVoltage && !this.isDraggingResistance) return;
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return;
        const width = canvas._displayW || canvas.width;
        const height = canvas._displayH || canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(width, height) / 400;
        
        if (this.isDraggingVoltage) {
            const deltaY = y - this.dragStartY;
            // 调整灵敏度：每像素改变0.1V
            const newVoltage = this.startVoltage - deltaY * 0.1; // 上移增加电压
            this.state.voltage = Math.min(Math.max(newVoltage, 0), 400);
            this.updateCurrent();
            this.syncControls();
        }
        if (this.isDraggingResistance) {
            const deltaX = x - this.dragStartX;
            // 每像素改变1欧姆
            const newResistance = this.startResistance + deltaX * 0.1; // 右移增加电阻
            this.state.resistance = Math.min(Math.max(newResistance, 1), 1000);
            this.updateCurrent();
            this.syncControls();
        }
    },
    
    onPointerUp(x, y, event) {
        this.isDraggingVoltage = false;
        this.isDraggingResistance = false;
    },

    // 命中检测：判断坐标是否落在可拖拽元素上（供 loader 显示抓手光标）
    hitTest(x, y) {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return false;
        const width = canvas._displayW || canvas.width;
        const height = canvas._displayH || canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(width, height) / 400;

        const batteryX = centerX;
        const batteryY = centerY - 120 * scale;
        const batteryHalfW = 30 * scale;
        const batteryHalfH = 45 * scale;

        const resistorX = centerX + 120 * scale;
        const resistorY = centerY;
        const resistorWidth = 80 * scale;
        const resistorHeight = 30 * scale;

        if (Math.abs(x - batteryX) < batteryHalfW && Math.abs(y - batteryY) < batteryHalfH) return true;
        if (Math.abs(x - resistorX) < resistorWidth / 2 && Math.abs(y - resistorY) < resistorHeight / 2) return true;
        return false;
    },

    // 画布大小改变
    onResize(w, h) {
        // 可以在这里调整自适应参数
    }
};

// 导出到全局
window.Experiment = Experiment;
