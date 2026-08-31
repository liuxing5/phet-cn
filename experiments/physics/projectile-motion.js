/**
 * 抛体运动实验
 * 研究抛体的运动轨迹和参数
 */

const Experiment = {
    // 实验状态
    state: {
        angle: 45,          // 发射角度 (度)
        velocity: 50,       // 初速度 (m/s)
        gravity: 9.8,       // 重力加速度 (m/s²)
        height: 50,         // 发射高度 (m)
        projectile: {       // 抛体状态
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            trail: []
        },
        groundY: 0,
        running: false,
        maxRange: 0,
        maxHeight: 0,
        flightTime: 0,
        currentTime: 0
    },

    // 初始化
    init(loader) {
        this.loader = loader;
        this.setupGround();
        this.setupProjectile();
        this.setupKnowledge();
        this.setupPresets();
        this.setupGuide();
        this.updateData();
    },

    // 设置分步操作引导
    setupGuide() {
        this.loader.setGuide([
            { text: '拖动发射管：上下调整发射角度（0°~90°）', highlight: true },
            { text: '拖动发射管远端：远近调整初速度' },
            { text: '点击"▶️ 开始"发射，观察抛物线轨迹', highlight: true },
            { text: '观察右侧实时数据：水平/垂直位置与速度' },
            { text: '验证结论：45° 发射角射程最远' }
        ]);
    },

    // 设置地面
    setupGround() {
        const canvas = document.getElementById('simulationCanvas');
        this.state.groundY = canvas.height - 60;
    },

    // 设置抛体初始状态
    setupProjectile() {
        const canvas = document.getElementById('simulationCanvas');

        // 物理状态统一使用"米"，绘制时再换算为屏幕像素
        this.state.projectile = {
            x: 0,                    // 水平位置（米）
            y: this.state.height,    // 垂直位置（米，向上为正）
            startX: 80,              // 发射点屏幕坐标
            startY: this.state.groundY - this.state.height * this.computeScale(),
            vx: 0,
            vy: 0,
            launched: false,
            trail: []
        };

        this.state.scale = this.computeScale();
        this.state.currentTime = 0;
        this.state.maxRange = 0;
        this.state.maxHeight = 0;
    },

    // 根据预测射程和最大高度计算像素/米比例，保证轨迹完整显示在画布内
    computeScale() {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return 2;

        const W = canvas.width - 130;   // 右侧留白
        const H = canvas.height - 120;  // 上方留白

        // 快速模拟一次落点
        const rad = this.state.angle * Math.PI / 180;
        let x = 0, y = this.state.height;
        let vx = this.state.velocity * Math.cos(rad);
        let vy = this.state.velocity * Math.sin(rad);
        let maxX = 0, maxY = this.state.height;
        const dt = 0.02;

        for (let i = 0; i < 1000; i++) {
            x += vx * dt;
            y += vy * dt;
            vy -= this.state.gravity * dt;
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            if (y <= 0 && vy < 0) break;
        }

        const sx = maxX > 0 ? W / maxX : 2;
        const sy = maxY > 0 ? H / maxY : 2;
        return Math.max(0.15, Math.min(2, sx, sy));
    },

    // 设置知识点
    setupKnowledge() {
        this.loader.setKnowledge(`
            <p><strong>抛体运动</strong>是指物体以一定初速度被抛出后，仅在重力作用下的运动。它是物理学中经典的运动模型之一。</p>
            
            <h4 style="color: var(--primary-color); margin-top: 15px;">📐 运动方程</h4>
            <p>水平方向（匀速运动）：</p>
            <div class="formula">x = v₀ × cos(θ) × t</div>
            
            <p>竖直方向（匀加速运动）：</p>
            <div class="formula">y = h + v₀ × sin(θ) × t − ½ × g × t²</div>

            <h4 style="color: var(--primary-color); margin-top: 15px;">🎯 关键参数</h4>
            <ul style="padding-left: 20px; margin-bottom: 15px;">
                <li><strong>v₀</strong> - 初速度 (Initial Velocity)</li>
                <li><strong>θ</strong> - 发射角度 (Launch Angle)</li>
                <li><strong>g</strong> - 重力加速度 (Gravity)</li>
                <li><strong>h</strong> - 发射高度 (Initial Height)</li>
            </ul>

            <h4 style="color: var(--primary-color); margin-top: 15px;">💡 有趣的事实</h4>
            <p>在无风阻力的情况下，当发射角度为45°时，抛体的射程最远！这就是为什么许多运动员（如铅球、标枪运动员）会选择接近45°的角度来获得最佳成绩。</p>
        `);
    },

    // 设置预设方案
    setupPresets() {
        const presets = [
            {
                name: '经典45度',
                apply: () => {
                    this.state.angle = 45;
                    this.state.velocity = 50;
                    this.syncControls();
                }
            },
            {
                name: '远程大炮',
                apply: () => {
                    this.state.angle = 30;
                    this.state.velocity = 80;
                    this.state.height = 0;
                    this.syncControls();
                }
            },
            {
                name: '高抛射击',
                apply: () => {
                    this.state.angle = 75;
                    this.state.velocity = 40;
                    this.state.height = 100;
                    this.syncControls();
                }
            },
            {
                name: '水平发射',
                apply: () => {
                    this.state.angle = 0;
                    this.state.velocity = 60;
                    this.state.height = 80;
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
                id: 'angle',
                label: '发射角度 (°)',
                value: this.state.angle,
                min: 0,
                max: 90,
                step: 1,
                unit: '°',
                onChange: (val) => {
                    this.state.angle = val;
                    this.setupProjectile();
                }
            },
            {
                type: 'slider',
                id: 'velocity',
                label: '初速度 (m/s)',
                value: this.state.velocity,
                min: 10,
                max: 100,
                step: 1,
                unit: 'm/s',
                onChange: (val) => {
                    this.state.velocity = val;
                    this.setupProjectile();
                }
            },
            {
                type: 'slider',
                id: 'gravity',
                label: '重力 (m/s²)',
                value: this.state.gravity,
                min: 1,
                max: 25,
                step: 0.1,
                unit: 'm/s²',
                onChange: (val) => {
                    this.state.gravity = val;
                }
            },
            {
                type: 'slider',
                id: 'height',
                label: '发射高度 (m)',
                value: this.state.height,
                min: 0,
                max: 200,
                step: 1,
                unit: 'm',
                onChange: (val) => {
                    this.state.height = val;
                    this.setupProjectile();
                }
            }
        ];
    },

    // 同步控件状态
    syncControls() {
        ['angle', 'velocity', 'gravity', 'height'].forEach(key => {
            const slider = document.getElementById(key);
            if (slider) {
                slider.value = this.state[key];
                document.getElementById(`${key}_value`).textContent = 
                    this.state[key] + (key === 'angle' ? '°' : key === 'velocity' ? 'm/s' : key === 'gravity' ? 'm/s²' : 'm');
            }
        });
        this.setupProjectile();
    },

    // 更新实时数据
    updateData() {
        const p = this.state.projectile;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        
        this.loader.updateDataDisplay([
            { label: '水平位置', value: p.x.toFixed(1), unit: 'm', color: '#3498db' },
            { label: '垂直位置', value: p.y.toFixed(1), unit: 'm', color: '#e74c3c' },
            { label: '水平速度', value: p.vx.toFixed(1), unit: 'm/s', color: '#2ecc71' },
            { label: '垂直速度', value: p.vy.toFixed(1), unit: 'm/s', color: '#f39c12' },
            { label: '合速度', value: speed.toFixed(1), unit: 'm/s', color: '#9b59b6' }
        ]);
    },

    // 更新（每帧）
    update(deltaTime, time) {
        this.state.currentTime = time;
        
        const p = this.state.projectile;
        const angleRad = this.state.angle * Math.PI / 180;
        
        // 发射：设置初速度（仅在未发射时执行一次）
        if (!p.launched) {
            p.vx = this.state.velocity * Math.cos(angleRad);
            p.vy = this.state.velocity * Math.sin(angleRad);  // 向上为正
            p.launched = true;
        }
        
        // 更新位置（米）
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.vy -= this.state.gravity * deltaTime;  // 重力向下
        
        // 记录轨迹（屏幕坐标）
        const scale = this.state.scale || 2;
        const sx = p.startX + p.x * scale;
        const sy = this.state.groundY - p.y * scale;
        p.trail.push({ screenX: sx, screenY: sy });
        
        // 限制轨迹长度
        if (p.trail.length > 500) {
            p.trail.shift();
        }
        
        // 记录最大高度和射程
        this.state.maxHeight = Math.max(this.state.maxHeight, p.y);
        this.state.maxRange = Math.max(this.state.maxRange, p.x);
        
        // 检查是否落地（下落阶段且到达地面）
        if (p.y <= 0 && p.vy < 0) {
            this.loader.togglePlay();
            this.state.flightTime = time;
            this.loader.showToast(
                `落地！射程: ${this.state.maxRange.toFixed(1)}m, 飞行时间: ${time.toFixed(2)}s`
            );
        }
        
        this.updateData();
    },

    // 渲染
    render(ctx, width, height, time) {
        // 清空背景
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#87CEEB');
        bgGradient.addColorStop(1, '#98D8E8');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        // 绘制地面
        this.drawGround(ctx, width);
        
        // 绘制网格
        this.drawGrid(ctx, width, height);
        
        // 绘制发射器
        this.drawLauncher(ctx);
        
        // 绘制拖拽提示
        this.drawDragHint(ctx);
        
        // 绘制轨迹
        this.drawTrajectory(ctx);
        
        // 绘制抛体
        this.drawProjectile(ctx);
        
        // 绘制轨迹预测（静止时）
        if (!this.state.running && this.state.projectile.trail.length === 0) {
            this.drawPredictedPath(ctx);
        }
        
        // 绘制信息
        this.drawInfo(ctx, width);
    },

    // 绘制发射管拖拽提示标签
    drawDragHint(ctx) {
        const p = this.state.projectile;
        if (!p) return;
        ctx.save();
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#c62828';
        ctx.fillText('👆 拖动发射管：调角度 / 速度', p.startX - 15, this.state.groundY - 75);
        ctx.restore();
    },

    // 绘制地面
    drawGround(ctx, width) {
        // 地面
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, this.state.groundY, width, 20);
        
        // 草地
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, this.state.groundY - 5, width, 8);
        
        // 刻度
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        
        for (let x = 0; x < width; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, this.state.groundY);
            ctx.lineTo(x, this.state.groundY + 10);
            ctx.stroke();
            
            const meters = Math.round((x - 80) / this.state.scale);
            if (meters >= 0) {
                ctx.fillText(meters + 'm', x, this.state.groundY + 25);
            }
        }
    },

    // 绘制网格
    drawGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 0.5;
        
        // 水平网格
        for (let y = 0; y < this.state.groundY; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 垂直网格
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.state.groundY);
            ctx.stroke();
        }
    },

    // 绘制发射器
    drawLauncher(ctx) {
        const p = this.state.projectile;
        const baseY = this.state.groundY;
        
        // 底座
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.moveTo(p.startX - 20, baseY);
        ctx.lineTo(p.startX + 20, baseY);
        ctx.lineTo(p.startX + 15, baseY - 10);
        ctx.lineTo(p.startX - 15, baseY - 10);
        ctx.closePath();
        ctx.fill();
        
        // 发射管
        const angleRad = this.state.angle * Math.PI / 180;
        ctx.save();
        ctx.translate(p.startX, baseY - 10);
        ctx.rotate(-angleRad);
        
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(0, -8, 40, 16);
        
        // 发射管内部
        ctx.fillStyle = '#718096';
        ctx.fillRect(5, -5, 30, 10);
        
        ctx.restore();
        
        // 高度显示
        if (this.state.height > 0) {
            const hPx = this.state.height * this.state.scale;
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(p.startX + 25, baseY);
            ctx.lineTo(p.startX + 25, baseY - hPx);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`h = ${this.state.height}m`, p.startX + 30, baseY - hPx);
        }
    },

    // 绘制轨迹
    drawTrajectory(ctx) {
        const p = this.state.projectile;
        
        if (p.trail.length < 2) return;
        
        // 轨迹线
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        ctx.moveTo(p.trail[0].screenX, p.trail[0].screenY);
        for (let i = 1; i < p.trail.length; i++) {
            ctx.lineTo(p.trail[i].screenX, p.trail[i].screenY);
        }
        ctx.stroke();
        
        // 轨迹点
        ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
        p.trail.forEach((point, i) => {
            if (i % 5 === 0) {
                ctx.beginPath();
                ctx.arc(point.screenX, point.screenY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    },

    // 绘制抛体
    drawProjectile(ctx) {
        const p = this.state.projectile;
        // 物理米坐标 → 屏幕像素坐标
        const sx = p.startX + p.x * this.state.scale;
        const sy = this.state.groundY - p.y * this.state.scale;
        
        // 球阴影
        const gradient = ctx.createRadialGradient(
            sx - 5, sy - 5, 0,
            sx, sy, 15
        );
        gradient.addColorStop(0, '#FF6B6B');
        gradient.addColorStop(1, '#c0392b');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // 高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(sx - 4, sy - 4, 5, 0, Math.PI * 2);
        ctx.fill();
    },

    // 绘制预测轨迹
    drawPredictedPath(ctx) {
        const p = this.state.projectile;
        const angleRad = this.state.angle * Math.PI / 180;
        const vx = this.state.velocity * Math.cos(angleRad);
        const vy = this.state.velocity * Math.sin(angleRad);   // 向上为正
        const scale = this.state.scale || 2;
        
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        let simX = 0;
        let simY = this.state.height;
        let simVx = vx;
        let simVy = vy;
        const dt = 0.05;
        
        ctx.moveTo(p.startX + simX * scale, this.state.groundY - simY * scale);
        
        for (let i = 0; i < 500; i++) {
            simX += simVx * dt;
            simY += simVy * dt;
            simVy -= this.state.gravity * dt;   // 重力向下
            
            const screenX = p.startX + simX * scale;
            const screenY = this.state.groundY - simY * scale;
            
            if (simY < 0 && simVy < 0 || screenX > ctx.canvas.width) break;
            
            ctx.lineTo(screenX, screenY);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    },

    // 绘制信息
    drawInfo(ctx, width) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(10, 10, 250, 90);
        
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`角度: ${this.state.angle}°`, 20, 35);
        ctx.fillText(`速度: ${this.state.velocity} m/s`, 20, 55);
        ctx.fillText(`射程: ${this.state.maxRange.toFixed(1)} m`, 20, 75);
        ctx.fillText(`飞行时间: ${this.state.flightTime.toFixed(2)} s`, 20, 95);
    },

    // 重置
    reset() {
        this.setupProjectile();
        this.updateData();
        this.isDraggingLauncher = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.startAngle = 0;
        this.startVelocity = 0;
    },
    
    // 指针事件处理 - 实现拖拽交互（调整发射角度和初速度）
    onPointerDown(x, y, event) {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        const canvasX = x; // 已经是画布坐标
        const canvasY = y;
        
        const p = this.state.projectile;
        if (!p) return false;
        const baseY = this.state.groundY;
        // 发射管起点（炮口底部）
        const launcherBaseX = p.startX;
        const launcherBaseY = baseY - 10; // 与drawLauncher中的translate一致
        const angleRad = this.state.angle * Math.PI / 180;
        // 发射管终点（炮口前端）
        const launcherTipX = launcherBaseX + 40 * Math.cos(angleRad);
        const launcherTipY = launcherBaseY - 40 * Math.sin(angleRad); // 注意y轴向下为正
        
        // 判断点击是否在发射管附近（线段到点的距离）
        const dx = launcherTipX - launcherBaseX;
        const dy = launcherTipY - launcherBaseY;
        const lenSq = dx * dx + dy * dy;
        let t = 0;
        if (lenSq !== 0) {
            t = ((canvasX - launcherBaseX) * dx + (canvasY - launcherBaseY) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
        }
        const projX = launcherBaseX + t * dx;
        const projY = launcherBaseY + t * dy;
        const dist = Math.sqrt((canvasX - projX) * (canvasX - projX) + (canvasY - projY) * (canvasY - projY));
        
        if (dist < 12) { // 命中阈值像素
            this.isDraggingLauncher = true;
            this.dragStartX = canvasX;
            this.dragStartY = canvasY;
            this.startAngle = this.state.angle;
            this.startVelocity = this.state.velocity;
            return true;
        }
        return false;
    },
    
    onPointerMove(x, y, event) {
        if (!this.isDraggingLauncher) return;
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = x;
        const canvasY = y;
        
        const p = this.state.projectile;
        if (!p) return;
        const baseY = this.state.groundY;
        const launcherBaseX = p.startX;
        const launcherBaseY = baseY - 10;
        
        // 计算从炮口底部到当前指针的向量
        const dx = canvasX - launcherBaseX;
        const dy = canvasY - launcherBaseY;
        // 角度：向量与水平方向的夹角（向上为负，但我们的角度定义向上为正）
        let angle = Math.atan2(-dy, dx) * 180 / Math.PI; // 因为y轴向下为正，所以取负
        // 限制角度范围
        angle = Math.max(0, Math.min(90, angle));
        // 速度：根据拖拽距离映射，基础速度加上距离因子
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 将距离映射到速度范围：0-200像素 对应 10-100 m/s
        const velocity = 10 + (dist / 200) * 90;
        const clampedVelocity = Math.min(Math.max(velocity, 10), 100);
        
        this.state.angle = angle;
        this.state.velocity = clampedVelocity;
        this.syncControls();    // 更新滑块显示并重新计算发射参数
    },
    
    onPointerUp(x, y, event) {
        this.isDraggingLauncher = false;
    },

    // 命中检测：判断坐标是否落在发射管上（供 loader 显示抓手光标）
    hitTest(x, y) {
        const p = this.state.projectile;
        if (!p) return false;
        const baseY = this.state.groundY;
        const launcherBaseX = p.startX;
        const launcherBaseY = baseY - 10;
        const angleRad = this.state.angle * Math.PI / 180;
        const launcherTipX = launcherBaseX + 40 * Math.cos(angleRad);
        const launcherTipY = launcherBaseY - 40 * Math.sin(angleRad);

        const dx = launcherTipX - launcherBaseX;
        const dy = launcherTipY - launcherBaseY;
        const lenSq = dx * dx + dy * dy;
        let t = 0;
        if (lenSq !== 0) {
            t = ((x - launcherBaseX) * dx + (y - launcherBaseY) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
        }
        const projX = launcherBaseX + t * dx;
        const projY = launcherBaseY + t * dy;
        const dist = Math.sqrt((x - projX) * (x - projX) + (y - projY) * (y - projY));
        return dist < 15;
    },

    // 画布大小改变
    onResize(w, h) {
        this.setupGround();
        this.setupProjectile();
    }
};

// 导出到全局
window.Experiment = Experiment;
