/**
 * 实验加载器 - 通用实验框架
 * 根据URL参数加载对应的实验模块
 */

const SimulationLoader = {
    // 当前实验状态
    state: {
        subject: null,
        simulationId: null,
        simulation: null,
        running: false,
        time: 0,
        lastFrameTime: 0,
        animationId: null
    },

    // 初始化
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        const subject = urlParams.get('subject');
        const simulationId = urlParams.get('id');

        if (!subject || !simulationId) {
            this.showError('缺少必要的参数（学科和实验ID）');
            return;
        }

        this.state.subject = subject;
        this.state.simulationId = simulationId;

        // 查找实验信息
        const simInfo = getSimulationInfo(subject, simulationId);
        if (!simInfo) {
            this.showError(`未找到实验：${simulationId}`);
            return;
        }

        if (!simInfo.available) {
            this.showError(`实验"${simInfo.name}"正在开发中，敬请期待！`);
            return;
        }

        this.state.simulation = simInfo;
        this.setupPage(simInfo);
        this.loadExperiment();
    },

    // 设置页面
    setupPage(simInfo) {
        const subjectConfig = subjectsConfig[this.state.subject];
        
        // 设置标题
        document.title = `${simInfo.name} | 中国互动模拟实验平台`;
        document.getElementById('simulationTitle').textContent = simInfo.name;
        document.getElementById('simulationDescription').textContent = 
            PhetUtils.getSimulationDescription(simInfo.id);

        // 设置面包屑
        document.getElementById('breadcrumb').innerHTML = PhetUtils.generateBreadcrumb([
            { text: '首页', url: 'index.html' },
            { text: `${subjectConfig.name}实验`, url: `browse.html?subject=${this.state.subject}` },
            { text: simInfo.name }
        ]);
    },

    // 加载实验
    loadExperiment() {
        const legacyMap = {
            'ohms-law': 'experiments/physics/ohms-law.js',
            'projectile-motion': 'experiments/physics/projectile-motion.js',
            'pendulum-lab': 'experiments/physics/pendulum-lab.js',
            'buoyancy': 'experiments/physics/buoyancy.js',
            'buoyancy-basics': 'experiments/physics/buoyancy.js'
        };

        const id = this.state.simulationId;

        // 新版：优先走通用引擎注册表（所有实验均可用）
        if (window.EngineRegistry && window.ExperimentMap && window.ExperimentMap[id]) {
            try {
                const entry = window.ExperimentMap[id];
                window.Experiment = EngineRegistry.build(Object.assign({ id }, entry));
                this.setupCanvas();
                window.Experiment.init(this);
                this.setupControls();
                this.setupEventListeners();
                this.reset();               // 立即渲染一帧初始画面
                this.showInteractionHint();
                return;
            } catch (err) {
                console.error('实验初始化失败', err);
                this.showError('实验初始化失败：' + err.message);
                return;
            }
        }

        // 旧版：4 个精调实验脚本
        const scriptPath = legacyMap[id];

        if (!scriptPath) {
            this.showError(`实验"${this.state.simulation.name}"的具体实现还在开发中`);
            return;
        }

        // 动态加载实验脚本（添加时间戳防止缓存）
        const script = document.createElement('script');
        script.src = scriptPath + '?t=' + Date.now();
        script.onload = () => {
            if (window.Experiment && window.Experiment.init) {
                window.Experiment.init(this);
                this.setupCanvas();
                this.setupControls();
                this.setupEventListeners();
                this.reset();               // 初始渲染
                this.showInteractionHint();
            } else {
                this.showError('实验模块加载失败');
            }
        };
        script.onerror = () => {
            this.showError('无法加载实验脚本');
        };
        document.body.appendChild(script);
    },

    // 设置画布（支持 DPR：高分屏下以更高内部分辨率绘制，外部 CSS 仍按显示尺寸）
    setupCanvas() {
        const canvas = document.getElementById('simulationCanvas');
        const wrapper = document.getElementById('canvasWrapper');
        const DPR = Math.min(window.devicePixelRatio || 1, window.Mobile ? window.Mobile.DPR : 2);
        const w = wrapper.clientWidth;
        const h = wrapper.clientHeight;

        // 内部像素 = 显示像素 × DPR；对外读取宽高统一走 canvas._display{W,H}（所有引擎接收的 W/H 保持 CSS 像素一致）
        canvas.width = Math.max(1, Math.round(w * DPR));
        canvas.height = Math.max(1, Math.round(h * DPR));
        canvas._displayW = w;
        canvas._displayH = h;
        canvas._dpr = DPR;

        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        window.addEventListener('resize', () => {
            const DPR2 = Math.min(window.devicePixelRatio || 1, window.Mobile ? window.Mobile.DPR : 2);
            const w2 = wrapper.clientWidth;
            const h2 = wrapper.clientHeight;
            canvas.width = Math.max(1, Math.round(w2 * DPR2));
            canvas.height = Math.max(1, Math.round(h2 * DPR2));
            canvas._displayW = w2;
            canvas._displayH = h2;
            canvas._dpr = DPR2;
            const ctx2 = canvas.getContext('2d');
            if (ctx2) ctx2.setTransform(DPR2, 0, 0, DPR2, 0, 0);
            if (window.Experiment && window.Experiment.onResize) {
                window.Experiment.onResize(w2, h2);
            }
            // 尺寸变化后立即重绘一帧，避免暂停态下画面消失
            requestAnimationFrame(() => this.render());
        });

        // 隐藏覆盖层提示
        document.getElementById('canvasOverlay').style.display = 'none';
    },

    // 设置控件
    setupControls() {
        if (!window.Experiment || !window.Experiment.getControls) return;

        const controls = window.Experiment.getControls();
        const container = document.getElementById('controlsContainer');

        container.innerHTML = controls.map(ctrl => {
            if (ctrl.type === 'slider') {
                return `
                    <div class="control-item">
                        <label>${ctrl.label}: <span class="value-display" id="${ctrl.id}_value">${ctrl.value}${ctrl.unit || ''}</span></label>
                        <div class="slider-row">
                            <input type="range"
                                   id="${ctrl.id}"
                                   min="${ctrl.min}"
                                   max="${ctrl.max}"
                                   step="${ctrl.step || 1}"
                                   value="${ctrl.value}">
                        </div>
                    </div>
                `;
            } else if (ctrl.type === 'select') {
                return `
                    <div class="control-item">
                        <label>${ctrl.label}</label>
                        <select id="${ctrl.id}">
                            ${ctrl.options.map(opt =>
                                `<option value="${opt.value}" ${opt.value === ctrl.value ? 'selected' : ''}>${opt.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                `;
            } else if (ctrl.type === 'checkbox') {
                return `
                    <div class="control-item">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" id="${ctrl.id}" ${ctrl.value ? 'checked' : ''} style="width:18px;height:18px;">
                            ${ctrl.label}
                        </label>
                    </div>
                `;
            } else if (ctrl.type === 'button') {
                return `
                    <div class="control-item">
                        <button id="${ctrl.id}" class="btn btn-secondary" style="width:100%;">${ctrl.label}</button>
                    </div>
                `;
            }
            return '';
        }).join('');

        // 绑定控件事件
        controls.forEach(ctrl => {
            const element = document.getElementById(ctrl.id);
            if (!element) return;

            // 统一的"变更后重绘"：暂停状态下参数变化也立即反映到画布
            const afterChange = () => {
                if (!this.state.running) requestAnimationFrame(() => this.render());
            };

            if (ctrl.onChange && ctrl.type !== 'button') {
                element.addEventListener('input', (e) => {
                    let value = e.target.value;
                    if (ctrl.type === 'slider') {
                        value = parseFloat(value);
                        const vd = document.getElementById(`${ctrl.id}_value`);
                        if (vd) vd.textContent = value + (ctrl.unit || '');
                    } else if (ctrl.type === 'checkbox') {
                        value = e.target.checked;
                    }
                    try { ctrl.onChange(value); } catch (err) { console.error('控件回调出错', err); }
                    afterChange();
                });
                if (ctrl.type === 'slider') {
                    const vd = document.getElementById(`${ctrl.id}_value`);
                    if (vd) vd.textContent = ctrl.value + (ctrl.unit || '');
                    // select 元素应监听 change；slider 已用 input，此处为旧浏览器兜底
                    element.addEventListener('change', () => {});
                }
                if (ctrl.type === 'select') {
                    element.addEventListener('change', (e) => {
                        let v = e.target.value;
                        const numV = parseFloat(v);
                        if (!isNaN(numV) && String(numV) === v.trim()) v = numV;
                        try { ctrl.onChange(v); } catch (err) { console.error('控件回调出错', err); }
                        afterChange();
                    });
                }
            }
            if (ctrl.type === 'button' && ctrl.action) {
                element.addEventListener('click', () => {
                    try { ctrl.action(); } catch (err) { console.error('按钮动作出错', err); }
                    afterChange();
                });
            }
        });
    },

    // 重新渲染控制面板（重置/预设后同步显示当前值）
    refreshControls() {
        this.setupControls();
    },

    // 初始化实时数据显示
    updateDataDisplay(data) {
        const container = document.getElementById('dataDisplay');
        container.innerHTML = data.map(item => `
            <div class="info-card">
                <div class="label">${item.label}</div>
                <div class="value" style="color: ${item.color || 'var(--primary-color)'}">
                    ${item.value} ${item.unit || ''}
                </div>
            </div>
        `).join('');
    },

    // 设置知识点
    setKnowledge(content) {
        document.getElementById('knowledgeContent').innerHTML = content;
    },

    // 设置分步操作引导（覆盖"使用说明"区域，指导用户一步步完成实验）
    setGuide(steps) {
        if (!steps || !steps.length) return;
        const el = document.getElementById('instructions');
        if (!el) return;
        el.innerHTML = steps.map((s, i) => {
            const text = typeof s === 'string' ? s : (s.text || '');
            const highlight = (typeof s === 'object' && s.highlight)
                ? ' style="font-weight:600;color:#a01830;"' : '';
            return `<span${highlight}>${i + 1}. ${text}</span>`;
        }).join('<br>');
    },

    // 显示"可交互/可拖拽"提示（实验 init 后调用；实验可用 getDragHint() 自定义文案）
    showInteractionHint() {
        const exp = window.Experiment;
        if (!exp || typeof exp.onPointerDown !== 'function') return;
        let text = '👆 可拖动画面中的元素进行操作';
        if (typeof exp.getDragHint === 'function') {
            try { const t = exp.getDragHint(); if (t) text = t; } catch (e) {}
        } else if (typeof exp.dragHint === 'string' && exp.dragHint) {
            text = exp.dragHint;
        }
        const overlay = document.getElementById('canvasOverlay');
        if (!overlay) return;
        overlay.innerHTML = text;
        overlay.style.display = 'block';
        overlay.style.opacity = '1';
        clearTimeout(this._hintTimer);
        this._hintTimer = setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 400);
        }, 4500);
    },

    // 设置预设方案
    setPresets(presets) {
        const container = document.getElementById('presetsContainer');
        container.innerHTML = presets.map((preset, index) => `
            <div class="button-group">
                <button class="btn btn-secondary" data-preset="${index}">
                    ${preset.name}
                </button>
            </div>
        `).join('');

        container.querySelectorAll('button').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                presets[index].apply();
                this.showToast(`已加载：${presets[index].name}`);
            });
        });
    },

    // 设置事件监听
    setupEventListeners() {
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());

        // 指针事件转发给实验（坐标换算为画布显示/CSS 像素空间，与 render 的 W/H 一致）
        if (window.Experiment) {
            const exp = window.Experiment;
            const hasPointer = ['onPointerDown', 'onPointerMove', 'onPointerUp']
                .some(k => typeof exp[k] === 'function');
            if (hasPointer) {
                const canvas = document.getElementById('simulationCanvas');
                const toCanvasXY = (e) => {
                    const rect = canvas.getBoundingClientRect();
                    return [
                        e.clientX - rect.left,    // CSS 像素，不乘 width/rect.width（rect.width 本身就是 CSS 像素）
                        e.clientY - rect.top
                    ];
                };
                let down = false;
                canvas.style.touchAction = 'none';
                // 无 hitTest 的可交互实验，光标默认 pointer；有 hitTest 的由 updateCursor 覆盖为 grab/default
                if (typeof exp.hitTest !== 'function') canvas.style.cursor = 'pointer';
                // 光标手势提示：实验实现 hitTest(x,y) 后，悬停可拖拽元素时显示"抓手"
                const updateCursor = (x, y) => {
                    if (!down && typeof exp.hitTest === 'function') {
                        let hover = false;
                        try { hover = !!exp.hitTest(x, y); } catch (err) {}
                        canvas.style.cursor = hover ? 'grab' : 'default';
                    }
                };
                canvas.addEventListener('pointerdown', e => {
                    down = true;
                    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
                    const [x, y] = toCanvasXY(e);
                    if (exp.onPointerDown) exp.onPointerDown(x, y, e);
                    canvas.style.cursor = 'grabbing';
                    if (!this.state.running) requestAnimationFrame(() => this.render());
                });
                canvas.addEventListener('pointermove', e => {
                    const [x, y] = toCanvasXY(e);
                    if (exp.onPointerMove) exp.onPointerMove(x, y, e);
                    if (down) {
                        canvas.style.cursor = 'grabbing';
                    } else {
                        updateCursor(x, y);
                    }
                    if (down && !this.state.running) requestAnimationFrame(() => this.render());
                });
                const endHandler = e => {
                    down = false;
                    const [x, y] = toCanvasXY(e);
                    if (exp.onPointerUp) exp.onPointerUp(x, y, e);
                    canvas.style.cursor = 'default';
                    if (!this.state.running) requestAnimationFrame(() => this.render());
                };
                canvas.addEventListener('pointerup', endHandler);
                canvas.addEventListener('pointercancel', endHandler);
            }
        }
    },

    // 播放/暂停
    togglePlay() {
        this.state.running = !this.state.running;
        const btn = document.getElementById('playBtn');
        btn.textContent = this.state.running ? '⏸️ 暂停' : '▶️ 开始';

        if (this.state.running) {
            this.state.lastFrameTime = performance.now();
            this.animate();
        } else {
            if (this.state.animationId) {
                cancelAnimationFrame(this.state.animationId);
            }
        }
    },

    // 重置
    reset() {
        this.state.running = false;
        this.state.time = 0;
        document.getElementById('playBtn').textContent = '▶️ 开始';
        document.getElementById('timeDisplay').textContent = 't = 0.00 s';
        
        if (this.state.animationId) {
            cancelAnimationFrame(this.state.animationId);
        }

        if (window.Experiment && window.Experiment.reset) {
            window.Experiment.reset();
        }
        // 重置后同步控制面板（滑块位置、勾选状态等）
        this.setupControls();

        // 重新开始动画以显示初始状态
        this.state.lastFrameTime = performance.now();
        this.render();
    },

    // 动画循环（含移动端按设备能力的步长缩放）
    animate() {
        const now = performance.now();
        let deltaTime = (now - this.state.lastFrameTime) / 1000;
        this.state.lastFrameTime = now;
        // 钳制 Δt：防止切换标签页后出现大步长导致物理穿越/爆炸
        if (!isFinite(deltaTime) || deltaTime < 0) deltaTime = 0;
        if (deltaTime > 0.05) deltaTime = 0.05;
        // 移动端：按 Mobile.frameScale 缩放（低端机 30fps 对应 2x 慢放，保证画面更新频率合理）
        if (window.Mobile && typeof window.Mobile.clampDeltaFrameStep === 'function') {
            deltaTime = window.Mobile.clampDeltaFrameStep(deltaTime);
        }
        this.state.time += deltaTime;

        document.getElementById('timeDisplay').textContent = `t = ${this.state.time.toFixed(2)} s`;

        if (window.Experiment && window.Experiment.update) {
            window.Experiment.update(deltaTime, this.state.time);
        }

        this.render();

        if (this.state.running) {
            this.state.animationId = requestAnimationFrame(() => this.animate());
        }
    },

    // 渲染
    render() {
        const canvas = document.getElementById('simulationCanvas');
        if (!canvas) return;
        const W = canvas._displayW || canvas.width;
        const H = canvas._displayH || canvas.height;
        if (W < 10 || H < 10) return;                  // 尺寸未就绪时跳过，防止引擎崩溃
        const ctx = canvas.getContext('2d');

        // 清空画布（DPR 矩阵已设，直接用 CSS 像素坐标操作）
        ctx.save();
        ctx.setTransform(canvas._dpr || 1, 0, 0, canvas._dpr || 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.restore();

        if (window.Experiment && window.Experiment.render) {
            window.Experiment.render(ctx, W, H, this.state.time);
        }
    },

    // 显示提示
    showToast(message) {
        PhetUtils.showToast(message);
    },

    // 显示错误
    showError(message) {
        const overlay = document.getElementById('canvasOverlay');
        overlay.style.display = 'flex';
        overlay.style.cssText = 'display: flex; align-items: center; justify-content: center; flex-direction: column; background: rgba(231, 76, 60, 0.9); padding: 30px; border-radius: 12px;';
        overlay.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 15px;">⚠️</div>
            <div style="font-size: 1.1rem; text-align: center;">${message}</div>
            <a href="browse.html" style="margin-top: 20px; color: white; background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 20px; text-decoration: none;">返回实验列表</a>
        `;
    }
};

// 导出到全局
window.SimulationLoader = SimulationLoader;
