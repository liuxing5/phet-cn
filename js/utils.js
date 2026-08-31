/**
 * 通用工具函数
 */

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeSearch();
    animateElements();
});

// 初始化导航
function initializeNavigation() {
    // 获取当前页面路径
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';
    
    // 高亮当前导航项
    document.querySelectorAll('.navbar-menu a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// 初始化搜索功能
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
}

// 执行搜索
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim().toLowerCase();
    
    if (query) {
        // 简单搜索：跳转到物理页面并显示提示
        alert('搜索功能正在开发中！\n您搜索的内容：' + query);
        // 实际实现时可以跳转到搜索结果页
        // window.location.href = 'search.html?q=' + encodeURIComponent(query);
    }
}

// 元素动画
function animateElements() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.subject-card, .simulation-card, .stat-item').forEach(el => {
        observer.observe(el);
    });
}

// 生成学科卡片HTML
function generateSubjectCard(key, config) {
    return `
        <a href="browse.html?subject=${key}" class="subject-card ${key}">
            <div class="subject-icon">${config.icon}</div>
            <h3>${config.name}</h3>
            <p>${config.description}</p>
            <span class="subject-count">${config.count} 个互动实验</span>
        </a>
    `;
}

// 生成实验卡片HTML
function generateSimulationCard(sim, subject) {
    const available = sim.available;
    const colorMap = {
        physics: ['#3498db', '#2980b9'],
        chemistry: ['#2ecc71', '#27ae60'],
        biology: ['#e74c3c', '#c0392b'],
        'earth-science': ['#f39c12', '#e67e22'],
        mathematics: ['#9b59b6', '#8e44ad']
    };
    
    const colors = colorMap[subject] || ['#667eea', '#764ba2'];
    const icon = getSubjectIcon(subject);
    
    return `
        <a href="${available ? `simulation.html?subject=${subject}&id=${sim.id}` : '#'}" 
           class="simulation-card"
           ${!available ? 'style="cursor: not-allowed; opacity: 0.7;"' : ''}>
            <div class="simulation-thumb" style="--thumb-color-1: ${colors[0]}; --thumb-color-2: ${colors[1]};">
                ${icon}
            </div>
            <div class="simulation-info">
                <h3>${sim.name}</h3>
                <p>${getSimulationDescription(sim.id)}</p>
                <div class="simulation-tags">
                    <span class="tag ${available ? 'available' : ''}">${available ? '✅ 可用' : '🔧 开发中'}</span>
                </div>
            </div>
        </a>
    `;
}

// 获取学科图标
function getSubjectIcon(subject) {
    const icons = {
        physics: '⚛️',
        chemistry: '🧪',
        biology: '🧬',
        'earth-science': '🌍',
        mathematics: '📐'
    };
    return icons[subject] || '🔬';
}

// 获取实验描述（简单版本）
function getSimulationDescription(id) {
    const descriptions = {
        'ohms-law': '探索电压、电流和电阻之间的关系',
        'projectile-motion': '研究抛体运动的轨迹和参数',
        'buoyancy': '理解浮力原理和物体浮沉条件',
        'pendulum-lab': '探索单摆运动的规律',
        'collision-lab': '研究动量守恒和碰撞过程',
        'waves-intro': '了解波的基本性质',
        'gas-properties': '探索理想气体的状态方程',
        'states-of-matter': '观察物质的三态变化',
        'energy-skate-park': '理解能量守恒定律',
        'circuit-dc': '搭建和分析直流电路',
        'magnets-electromagnets': '探索磁场和电磁感应',
        'gravity-force-lab': '研究万有引力定律',
        'projectile-data-lab': '抛体运动数据收集与分析',
        'vector-addition': '矢量加法的可视化演示'
    };
    return descriptions[id] || '互动模拟实验，探索科学原理';
}

// 面包屑导航
function generateBreadcrumb(items) {
    let html = '<div class="breadcrumb">';
    items.forEach((item, index) => {
        if (index > 0) html += ' &raquo; ';
        if (item.url && index < items.length - 1) {
            html += `<a href="${item.url}">${item.text}</a>`;
        } else {
            html += item.text;
        }
    });
    html += '</div>';
    return html;
}

// 获取URL参数
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// 创建画布
function createCanvas(containerId, width, height) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = width || container.clientWidth;
    canvas.height = height || container.clientHeight;
    canvas.className = 'simulation-canvas';
    canvas.id = containerId + '-canvas';
    container.appendChild(canvas);
    
    return canvas.getContext('2d');
}

// 简单的动画循环
function animate(canvas, renderFn) {
    if (!canvas) return;
    
    let animationId;
    const ctx = canvas.getContext('2d');
    
    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderFn(ctx, canvas);
        animationId = requestAnimationFrame(loop);
    }
    
    loop();
    
    // 返回停止函数
    return () => {
        if (animationId) cancelAnimationFrame(animationId);
    };
}

// 格式化数字
function formatNumber(num, decimals = 2) {
    if (Math.abs(num) >= 1000) {
        return num.toFixed(0);
    } else if (Math.abs(num) >= 1) {
        return num.toFixed(decimals);
    } else {
        return num.toFixed(decimals + 1);
    }
}

// 显示提示信息
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// 导出到全局
window.PhetUtils = {
    generateSubjectCard,
    generateSimulationCard,
    generateBreadcrumb,
    getSimulationDescription,
    getUrlParam,
    createCanvas,
    animate,
    formatNumber,
    showToast
};
