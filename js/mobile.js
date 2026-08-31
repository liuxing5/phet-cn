/**
 * 移动端适配模块
 * 在 DOMContentLoaded 前就写入，尽早为 <html> 打标记
 *   .is-mobile        — 移动 UA（iOS/Android/微信/QQ…）
 *   .is-touch         — 支持触控
 *   .is-lowend        — 低端机：物理核<4 或 内存<3GB 或 屏幕DPR>3 但 CPU 慢
 *   .orientation-portrait / .orientation-landscape
 *
 * 同时挂 window.Mobile：
 *   Mobile.isMobile / isTouch / isLowEnd / DPR / particleScale / frameScale
 *   Mobile.reduceParticleCount(n)    —— 对 n 做降级缩放（粒子/网格/采样）
 *   Mobile.clampDeltaFrameStep       —— 计算动画子步长时的低帧缩放（按 FPS 自适应）
 */
(function () {
    var ua = (navigator && navigator.userAgent) || '';
    var uaLow = ua.toLowerCase();
    var isMobile = /(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|harmonyos|mqqbrowser|micromessenger|weibo|qq\/)/i.test(uaLow)
        || (navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform));
    /* iPadOS 13+ 伪造为 Mac，这里用 maxTouchPoints 反推 */
    try {
        if (!isMobile && navigator.platform && /mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1) {
            isMobile = true;
        }
    } catch (e) {}
    var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

    /* DPR：>=3 为高分屏（需 Canvas 补偿） */
    var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 2.5 : 2);

    /* 低端机判定：核数<2 或 内存<2GB 或 小屏(<5")高DPR叠加计算压力 */
    var cores = (navigator.hardwareConcurrency || 2);
    var mem = (navigator.deviceMemory || 4);
    var isLowEnd = (cores <= 2 && mem <= 2) || (dpr >= 3 && mem <= 3 && cores <= 4 && isMobile);

    /* 粒子/渲染降级系数：移动端整体 0.6×，低端机 0.35× */
    var particleScale = isMobile ? (isLowEnd ? 0.35 : 0.6) : 1;
    /* 帧率目标：移动端 45fps，低端机 30fps 对应 60fps 基准下的步长 */
    var frameScale = isMobile ? (isLowEnd ? 0.5 : 0.75) : 1;

    /* 把类别加到 <html> 以便 CSS 分支生效 */
    var html = document.documentElement;
    if (isMobile) html.classList.add('is-mobile');
    if (isTouch) html.classList.add('is-touch');
    if (isLowEnd) html.classList.add('is-lowend');

    /* 方向切换：同步 class + 派发 Mobile:orientationchange 可选监听 */
    function updateOrientation() {
        var isPortrait = window.innerHeight >= window.innerWidth;
        html.classList.toggle('orientation-portrait', isPortrait);
        html.classList.toggle('orientation-landscape', !isPortrait);
        try {
            window.dispatchEvent(new CustomEvent('Mobile:orientationchange', {
                detail: { portrait: isPortrait, w: window.innerWidth, h: window.innerHeight }
            }));
        } catch (e) {}
    }
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    /* 添加"横屏体验更佳"提示条（移动端竖屏进入实验页时） */
    function ensureHint() {
        if (!document.body) { return; }
        if (document.getElementById('orientationHint')) { return; }
        var div = document.createElement('div');
        div.id = 'orientationHint';
        div.innerHTML =
            '💡 横屏查看实验画面更清晰、操作更顺手。' +
            '<button onclick="this.parentNode.style.display=\'none\';window.Mobile.dismissHint=true;">我知道了</button>';
        document.body.appendChild(div);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureHint);
    } else {
        ensureHint();
    }

    /* 注入汉堡菜单按钮（导航菜单里不存在时，响应式断点 .navbar-toggle 显示） */
    function ensureNavbarToggle() {
        var c = document.querySelector('.navbar-container');
        if (!c) return;
        if (c.querySelector('.navbar-toggle')) return;
        var btn = document.createElement('button');
        btn.className = 'navbar-toggle';
        btn.setAttribute('aria-label', '展开菜单');
        btn.innerHTML = '☰';
        btn.addEventListener('click', function () {
            var m = document.querySelector('.navbar-menu');
            if (m) m.classList.toggle('open');
        });
        c.appendChild(btn);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureNavbarToggle);
    } else {
        ensureNavbarToggle();
    }

    window.Mobile = {
        isMobile: isMobile,
        isTouch: isTouch,
        isLowEnd: isLowEnd,
        DPR: dpr,
        cores: cores,
        memGB: mem,
        particleScale: particleScale,
        frameScale: frameScale,
        /** 对粒子/采样/网格的目标数量按设备能力缩放，保证最小值不被归零 */
        reduceParticleCount: function (n) {
            var out = Math.max(1, Math.round(n * particleScale));
            return out;
        },
        /** 按 60FPS 基准的步长 / 低帧自适应缩放 dt */
        clampDeltaFrameStep: function (dt, fpsTargetOrNull) {
            var target = fpsTargetOrNull || (isLowEnd ? 30 : (isMobile ? 45 : 60));
            var dtMax = 1 / target;
            return isFinite(dt) && dt > 0 ? Math.min(dt, dtMax) : dtMax;
        },
        dismissHint: false
    };
})();
