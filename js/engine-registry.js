/**
 * Engine Registry —— 引擎注册表
 * 各引擎通过 register 注册工厂定义，平台经 build 创建实例并校验必需接口。
 */

window.EngineRegistry = (() => {
    const factories = {};
    return {
        register(name, def) { if (factories[name]) console.warn('[EngineRegistry] 引擎重复注册：' + name); factories[name] = def; },
        has(name) { return !!factories[name]; },
        build(cfg) {
            const f = factories[cfg.engine];
            if (!f || typeof f.create !== 'function') throw new Error('未知引擎：' + cfg.engine);
            const inst = f.create(Object.assign({}, cfg));
            ['init','getControls','update','render','reset'].forEach(k => {
                if (typeof inst[k] !== 'function') throw new Error(`引擎 ${cfg.engine}(${cfg.id||cfg.mode}) 缺少方法 ${k}`);
            });
            return inst;
        }
    };
})();
