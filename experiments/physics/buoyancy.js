/**
 * 浮力实验
 * 理解阿基米德原理和物体浮沉条件
 */

const Experiment = {
    // 实验状态
    state: {
        objectDensity: 500,    // 物体密度 (kg/m³)
        fluidDensity: 1000,   // 液体密度 (kg/m³)
        objectVolume: 1000,   // 物体体积 (cm³)
        gravity: 9.8,         // 重力加速度
        objectY: 0,           // 物体Y位置
        waterLevel: 0,        // 水面位置
        floating: true,       // 是否漂浮
        submergedFraction: 0 // 浸没比例
    },

    // 初始化
    init(loader) {
        this.loader = loader;
        this.setupWaterLevel();
        this.setupKnowledge();
        this.setupPresets();
        this.setupGuide();
        this.updatePhysics();
    },

    // 设置分步操作引导
    setupGuide() {
        this.loader.setGuide([
            { text: '上下拖动方块，观察浮沉位置变化', highlight: true },
            { text: '调整"物体密度"滑块，改变物体的轻重' },
            { text: '调整"液体密度"滑块，观察浮力变化', highlight: true },
            { text: '观察右侧数据：浮力、重力与浸没比例' },
            { text: '验证阿基米德原理：F浮 = ρ × g × V排' }
        ]);
    },

    // 设置水面高度
    setupWaterLevel() {
        const canvas = document.getElementById('simulationCanvas');
        this.state.waterLevel = canvas.height * 0.35;
        this.state.objectY = 100;
    },

    // 设置知识点
    setupKnowledge() {
        this.loader.setKnowledge(`
            <p><strong>浮力</strong>是指浸入液体或气体中的物体受到的向上的托力。这是由古希腊科学家<strong>阿基米德</strong>在公元前250年左右发现的。</p>
            
            <h4 style="color: var(--primary-color); margin-top: 15px;">📐 阿基米德原理</h4>
            <div class="formula">F浮 = ρ × g × V排</div>
            <p>其中：</p>
            <ul style="padding-left: 20px; margin-bottom: 15px;">
                <li><strong>F浮</strong> - 浮力 (N)</li>
                <li><strong>ρ</strong> - 液体密度 (kg/m³)</li>
                <li><strong>g</strong> - 重力加速度 (m/s²)</li>
                <li><strong>V排</strong> - 排开液体的体积 (m³)</li>
            </ul>

            <h4 style="color: var(--primary-color); margin-top: 15px;">🎯 浮沉条件</h4>
            <ul style="padding-left: 20px; margin-bottom: 15px;">
                <li>ρ物 < ρ液 → <strong>漂浮</strong>（物体浮在水面上）</li>
                <li>ρ物 = ρ液 → <strong>悬浮</strong>（物体可在任意位置静止）</li>
                <li>ρ物 > ρ液 → <strong>下沉</strong>（物体沉入水底）</li>
            </ul>

            <h4 style="color: var(--primary-color); margin-top: 15px;">💡 生活实例</h4>
            <ul style="padding-left: 20px;">
                <li>轮船能浮在海面上，因为船的平均密度小于海水</li>
                <li>热气球通过加热空气使其密度变小而升空</li>
                <li>潜水艇通过调整水箱水量改变密度来控制沉浮</li>
            </ul>
        `);
    },

    // 设置预设方案
    setupPresets() {
        const presets = [
            {
                name: '木块漂浮',
                apply: () => {
                    this.state.objectDensity = 500;
                    this.state.fluidDensity = 1000;
                    this.syncControls();
                }
            },
            {
                name: '铁块下沉',
                apply: () => {
                    this.state.objectDensity = 7800;
                    this.state.fluidDensity = 1000;
                    this.syncControls();
                }
            },
            {
                name: '盐水浮蛋',
                apply: () => {
                    this.state.objectDensity = 1050;
                    this.state.fluidDensity = 1100;
                    this.syncControls();
                }
            },
            {
                name: '橡皮泥变形',
                apply: () => {
                    this.state.objectDensity = 1200;
                    this.state.fluidDensity = 1000;
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
                id: 'objectDensity',
                label: '物体密度 (kg/m³)',
                value: this.state.objectDensity,
                min: 100,
                max: 10000,
                step: 50,
                unit: 'kg/m³',
                onChange: (val) => {
                    this.state.objectDensity = val;
                    this.updatePhysics();
                }
            },
            {
                type: 'slider',
                id: 'fluidDensity',
                label: '液体密度 (kg/m³)',
                value: this.state.fluidDensity,
                min: 500,
                max: 1400,
                step: 10,
                unit: 'kg/m³',
                onChange: (val) => {
                    this.state.fluidDensity = val;
                    this.updatePhysics();
                }
            },
            {
                type: 'slider',
                id: 'objectVolume',
                label: '物体体积 (cm³)',
                value: this.state.objectVolume,
                min: 100,
                max: 5000,
                step: 100,
                unit: 'cm³',
                onChange: (val) => {
                    this.state.objectVolume = val;
                    this.updatePhysics();
                }
            }
        ];
    },

    // 同步控件状态
    syncControls() {
        ['objectDensity', 'fluidDensity', 'objectVolume'].forEach(key => {
            const slider = document.getElementById(key);
            if (slider) {
                slider.value = this.state[key];
                const unit = key === 'objectVolume' ? 'cm³' : 'kg/m³';
                document.getElementById(`${key}_value`).textContent = this.state[key] + unit;
            }
        });
        this.state.objectY = 100;
        this.updatePhysics();
    },

    // 更新物理计算
    updatePhysics() {
        // 计算物体重力
        const volumeM3 = this.state.objectVolume / 1e6; // cm³ 转 m³
        const weight = this.state.objectDensity * volumeM3 * this.state.gravity;
        
        // 计算浮力（完全浸没时）
        const maxBuoyantForce = this.state.fluidDensity * volumeM3 * this.state.gravity;
        
        // 计算浸没比例
        let submergedFraction;
        if (this.state.objectDensity <= this.state.fluidDensity) {
            // 漂浮：部分浸没
            submergedFraction = this.state.objectDensity / this.state.fluidDensity;
            this.state.floating = true;
        } else {
            // 下沉：完全浸没
            submergedFraction = 1;
            this.state.floating = false;
        }
        
        // 实际浮力
        const buoyantForce = maxBuoyantForce * submergedFraction;
        
        this.state.submergedFraction = submergedFraction;
        
        // 更新数据显示
        this.loader.updateDataDisplay([
            { label: '物体重力', value: weight.toFixed(3), unit: 'N', color: '#e74c3c' },
            { label: '浮力大小', value: buoyantForce.toFixed(3), unit: 'N', color: '#3498db' },
            { label: '浸没比例', value: (submergedFraction * 100).toFixed(1), unit: '%', color: '#2ecc71' },
            { label: '状态', value: this.state.floating ? '漂浮' : '下沉', unit: '', color: this.state.floating ? '#2ecc71' : '#e74c3c' }
        ]);
    },

    // 更新（每帧）
    update(deltaTime, time) {
        if (this.isDraggingObject) {
            // 拖拽时跳过自动定位
            return;
        }
        // 计算物体最终位置
        const canvas = document.getElementById('simulationCanvas');
        const objectSize = Math.sqrt(this.state.objectVolume) * 2;
        
        if (this.state.floating) {
            // 漂浮：物体浸没部分在水下
            const submergedHeight = objectSize * this.state.submergedFraction;
            this.state.objectY = this.state.waterLevel - objectSize + submergedHeight;
        } else {
            // 下沉：物体沉底
            this.state.objectY = canvas.height - 80 - objectSize / 2;
        }
    },

    // 渲染
    render(ctx, width, height, time) {
        // 清空背景
        const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#E0F6FF');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, width, height);
        
        // 绘制容器
        this.drawContainer(ctx, width, height);
        
        // 绘制液体
        this.drawFluid(ctx, width, height, time);
        
        // 绘制物体
        this.drawObject(ctx, width);
        
        // 绘制拖拽提示
        this.drawDragHint(ctx, width);
        
        // 绘制力的箭头
        this.drawForces(ctx, width);
        
        // 绘制信息
        this.drawInfo(ctx, width, height);
    },

    // 绘制方块拖拽提示标签
    drawDragHint(ctx, width) {
        const objectSize = Math.sqrt(this.state.objectVolume) * 2;
        const objectX = width / 2;
        const objectY = this.state.objectY + objectSize / 2;
        ctx.save();
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#c62828';
        ctx.fillText('👆 上下拖动方块', objectX + objectSize / 2 + 12, objectY);
        ctx.restore();
    },

    // 绘制容器
    drawContainer(ctx, width, height) {
        const containerLeft = 50;
        const containerRight = width - 50;
        const containerTop = 80;
        const containerBottom = height - 30;
        
        // 容器边框
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 4;
        ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
        
        // 左壁
        ctx.beginPath();
        ctx.moveTo(containerLeft, containerTop);
        ctx.lineTo(containerLeft, containerBottom);
        ctx.stroke();
        
        // 右壁
        ctx.beginPath();
        ctx.moveTo(containerRight, containerTop);
        ctx.lineTo(containerRight, containerBottom);
        ctx.stroke();
        
        // 底部
        ctx.beginPath();
        ctx.moveTo(containerLeft, containerBottom);
        ctx.lineTo(containerRight, containerBottom);
        ctx.stroke();
        
        // 标注
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('容器', width / 2, containerBottom + 20);
    },

    // 绘制液体
    drawFluid(ctx, width, height, time) {
        const containerLeft = 50;
        const containerRight = width - 50;
        const currentTime = time || this.state.time || 0;
        
        // 液体颜色根据密度变化
        const densityRatio = (this.state.fluidDensity - 500) / 900;
        const r = Math.round(100 + densityRatio * 100);
        const g = Math.round(150 + densityRatio * 50);
        const b = Math.round(200 - densityRatio * 50);
        
        const fluidGradient = ctx.createLinearGradient(0, this.state.waterLevel, 0, height - 30);
        fluidGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.7)`);
        fluidGradient.addColorStop(1, `rgba(${r - 30}, ${g - 30}, ${b - 20}, 0.9)`);
        
        ctx.fillStyle = fluidGradient;
        ctx.fillRect(containerLeft + 2, this.state.waterLevel, containerRight - containerLeft - 4, height - 30 - this.state.waterLevel);
        
        // 水面波纹
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = containerLeft; x <= containerRight; x += 5) {
            const y = this.state.waterLevel + Math.sin((x + currentTime * 30) * 0.05) * 3;
            if (x === containerLeft) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // 标注液体密度
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`液体: ${this.state.fluidDensity} kg/m³`, containerLeft + 10, this.state.waterLevel + 25);
    },

    // 绘制物体
    drawObject(ctx, width) {
        const objectSize = Math.sqrt(this.state.objectVolume) * 2;
        const objectX = width / 2;
        const objectY = this.state.objectY + objectSize / 2;
        
        // 物体颜色根据密度变化
        const densityRatio = this.state.objectDensity / 10000;
        let color;
        if (this.state.objectDensity < 1000) {
            color = '#8B4513'; // 木材色
        } else if (this.state.objectDensity < 3000) {
            color = '#FFA500'; // 橙色
        } else if (this.state.objectDensity < 6000) {
            color = '#C0C0C0'; // 银灰色
        } else {
            color = '#4A4A4A'; // 深灰色
        }
        
        // 绘制长方体
        ctx.fillStyle = color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        
        const halfW = objectSize / 2;
        const halfH = objectSize / 2;
        
        // 主体
        ctx.beginPath();
        ctx.rect(objectX - halfW, objectY - halfH, objectSize, objectSize);
        ctx.fill();
        ctx.stroke();
        
        // 浸没部分用不同颜色
        const submergedHeight = objectSize * this.state.submergedFraction;
        if (this.state.submergedFraction > 0 && this.state.submergedFraction < 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(
                objectX - halfW,
                objectY + halfH - submergedHeight,
                objectSize,
                submergedHeight
            );
        }
        
        // 高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(objectX - halfW + 5, objectY - halfH + 5, 10, objectSize - 10);
        
        // 标注
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.state.objectDensity} kg/m³`, objectX, objectY);
    },

    // 绘制力的箭头
    drawForces(ctx, width) {
        const objectSize = Math.sqrt(this.state.objectVolume) * 2;
        const objectX = width / 2;
        const objectY = this.state.objectY + objectSize / 2;
        
        const volumeM3 = this.state.objectVolume / 1e6;
        const weight = this.state.objectDensity * volumeM3 * this.state.gravity;
        const buoyantForce = this.state.fluidDensity * volumeM3 * this.state.gravity * this.state.submergedFraction;
        
        const maxForce = Math.max(weight, buoyantForce);
        const scale = 80 / maxForce;
        
        // 重力（向下）
        this.drawArrow(ctx, objectX, objectY + objectSize / 2 + 10, 
                       objectX, objectY + objectSize / 2 + 10 + weight * scale, 
                       '#e74c3c', 'G');
        
        // 浮力（向上）
        this.drawArrow(ctx, objectX - 20, objectY - objectSize / 2 - 10, 
                       objectX - 20, objectY - objectSize / 2 - 10 - buoyantForce * scale, 
                       '#3498db', 'F');
    },

    // 绘制箭头
    drawArrow(ctx, fromX, fromY, toX, toY, color, label) {
        const headLength = 10;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        
        // 线
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        // 箭头头
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), 
                  toY - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), 
                  toY - headLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        
        // 标签
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        const midX = (fromX + toX) / 2 + (fromX < toX ? 15 : -15);
        const midY = (fromY + toY) / 2;
        ctx.fillText(label, midX, midY);
    },

    // 绘制信息
    drawInfo(ctx, width, height) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(10, 10, 220, 70);
        
        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('💧 调整密度，观察浮沉变化', 20, 30);
        ctx.fillText(`状态: ${this.state.floating ? '✨ 漂浮' : '⬇️ 下沉'}`, 20, 55);
        ctx.fillText(`浸没: ${(this.state.submergedFraction * 100).toFixed(1)}%`, 20, 75);
    },

    // 重置
    reset() {
        this.state.objectDensity = 500;
        this.state.fluidDensity = 1000;
        this.state.objectVolume = 1000;
        this.state.objectY = 100;
        this.updatePhysics();
        this.syncControls();
        this.isDraggingObject = false;
        this.dragStartY = 0;
        this.startObjectY = 0;
        this.dragOffsetY = 0;
    },
    
    // 指针事件处理 - 实现拖拽交互（拖动物体上下移动）
    onPointerDown(x, y, event) {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return false;
        const canvasX = x; // 已经是画布坐标（CSS 像素，与 render 的 width/height 一致）
        const canvasY = y;
        
        // 计算物体中心位置（drawObject 使用 width/2 和 objectY+objectSize/2）
        const objectSize = Math.sqrt(this.state.objectVolume) * 2;
        const objectX = (canvas._displayW || canvas.width) / 2;
        const objectY = this.state.objectY + objectSize / 2;
        
        // 判断是否点击物体（矩形碰撞，加上容忍度）
        const halfSize = objectSize / 2;
        const hitRadius = halfSize + 10; // 增大触发区域
        if (Math.abs(canvasX - objectX) < hitRadius && 
            Math.abs(canvasY - objectY) < hitRadius) {
            this.isDraggingObject = true;
            this.dragStartY = canvasY;
            this.startObjectY = this.state.objectY;
            // 记录鼠标相对物体中心的垂直偏移
            this.dragOffsetY = canvasY - objectY;
            return true;
        }
        return false;
    },
    
    onPointerMove(x, y, event) {
        if (!this.isDraggingObject) return;
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return;
        const canvasY = y;
        
        // state.objectY 表示物体顶部 Y 坐标，物体中心 = objectY + objectSize/2
        const objectSize = Math.sqrt(this.state.objectVolume) * 2;
        const containerTop = 80;
        const containerBottom = (canvas._displayH || canvas.height) - 30;
        
        // 保持指针与物体中心的相对偏移，反推出物体顶部新位置
        const newCenterY = canvasY - this.dragOffsetY;
        const newTopY = newCenterY - objectSize / 2;
        const minY = containerTop;
        const maxY = containerBottom - objectSize;
        this.state.objectY = Math.min(Math.max(newTopY, minY), maxY);
    },
    
    onPointerUp(x, y, event) {
        this.isDraggingObject = false;
        // 松开后让物理系统重新计算平衡位置
        this.updatePhysics();
    },

    // 命中检测：判断坐标是否落在可拖拽方块上（供 loader 显示抓手光标）
    hitTest(x, y) {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return false;
        const objectSize = Math.sqrt(this.state.objectVolume) * 2;
        const objectX = (canvas._displayW || canvas.width) / 2;
        const objectY = this.state.objectY + objectSize / 2;
        const halfSize = objectSize / 2;
        return Math.abs(x - objectX) < halfSize + 12 && Math.abs(y - objectY) < halfSize + 12;
    },

    // 画布大小改变
    onResize(w, h) {
        this.setupWaterLevel();
    }
};

// 导出到全局
window.Experiment = Experiment;
