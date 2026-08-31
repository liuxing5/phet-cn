/**
 * 全量实验ID映射表
 * 将所有实验ID映射到通用引擎注册表中的引擎工厂与模式配置。
 * 由 simulation-loader.js 消费：ExperimentMap[id] -> EngineRegistry.build({id, ...entry})
 */
window.ExperimentMap = {
    /* ===== 物理 ===== */
    'quantum-coin-toss':            { engine: 'chem',      mode: 'quantumtoss' },
    'quantum-measurement':          { engine: 'chem',      mode: 'quantmeas' },
    'models-of-hydrogen-atom':      { engine: 'chem',      mode: 'hydrogenatom' },
    'generator':                    { engine: 'fields',    mode: 'generatorTurbine' },
    'magnets-electromagnets':       { engine: 'fields',    mode: 'magnetsA' },
    'magnet-compass':               { engine: 'fields',    mode: 'compassmode' },
    'faradays-electromagnetic-lab': { engine: 'fields',    mode: 'emlab' },
    'projectile-data-lab':          { engine: 'mechanics', mode: 'projdata' },
    'build-nucleus':                { engine: 'chem',      mode: 'nucleus' },
    'keplers-laws':                 { engine: 'astro',     mode: 'kepler' },
    'my-solar-system':              { engine: 'astro',     mode: 'solarsys' },
    'calculus-grapher':             { engine: 'graphs',    mode: 'calculus' },
    'geometric-optics-basics':      { engine: 'optics',    mode: 'lensBasics' },
    'geometric-optics':             { engine: 'optics',    mode: 'lens' },
    'density':                      { engine: 'mechanics', mode: 'densityBlock' },
    'circuit-ac':                   { engine: 'circuits',  mode: 'ac' },
    'circuit-ac-virtual-lab':       { engine: 'circuits',  mode: 'acvirt' },
    'fourier-making-waves':         { engine: 'waves',     mode: 'fourier' },
    'collision-lab':                { engine: 'mechanics', mode: 'collision' },
    'energy-skate-park':            { engine: 'mechanics', mode: 'skate' },
    'vector-addition':              { engine: 'algebra',   mode: 'vecadd' },
    'curve-fitting':                { engine: 'graphs',    mode: 'fitline' },
    'gravity-force-lab-basics':     { engine: 'fields',    mode: 'gravlab', basic: true },
    'waves-intro':                  { engine: 'waves',     mode: 'water' },
    'diffusion':                    { engine: 'particles', mode: 'diffuse' },
    'gases-intro':                  { engine: 'particles', mode: 'gasintro' },
    'gas-properties':               { engine: 'particles', mode: 'gasprops' },
    'blackbody-spectrum':           { engine: 'astro',     mode: 'blackbody' },
    'masses-springs-basics':        { engine: 'mechanics', mode: 'springs', basic: true },
    'energy-forms-changes':         { engine: 'mechanics', mode: 'energyforms' },
    'wave-interference':            { engine: 'waves',     mode: 'interference' },
    'coulombs-law':                 { engine: 'fields',    mode: 'coulomb' },
    'masses-springs':               { engine: 'mechanics', mode: 'springs' },
    'capacitor-lab-basics':         { engine: 'fields',    mode: 'capacitor' },
    'circuit-dc-virtual-lab':       { engine: 'circuits',  mode: 'dcvirt' },
    'circuit-dc':                   { engine: 'circuits',  mode: 'dc' },
    'states-of-matter-basics':      { engine: 'particles', mode: 'statesMatter', basic: true },
    'states-of-matter':             { engine: 'particles', mode: 'statesMatter' },
    'gravity-orbits':               { engine: 'astro',     mode: 'orbits' },
    'plinko-probability':           { engine: 'stats',     mode: 'plinko' },
    'atomic-interactions':          { engine: 'particles', mode: 'atomicpair' },
    'charges-fields':               { engine: 'fields',    mode: 'charges' },
    'rutherford-scattering':        { engine: 'chem',      mode: 'rutherford' },
    'bending-light':                { engine: 'optics',    mode: 'bending' },
    'hookes-law':                   { engine: 'mechanics', mode: 'hooke' },
    'molecules-light':              { engine: 'chem',      mode: 'molight' },
    'energy-skate-park-basics':     { engine: 'mechanics', mode: 'skate', basic: true },
    'faradays-law':                 { engine: 'fields',    mode: 'faradaybulb' },
    'wave-on-string':               { engine: 'waves',     mode: 'string' },
    'color-vision':                 { engine: 'optics',    mode: 'vision' },
    'balancing-act':                { engine: 'mechanics', mode: 'seesaw' },
    'under-pressure':               { engine: 'mechanics', mode: 'pressurePool' },
    'friction':                     { engine: 'mechanics', mode: 'frictionbox' },
    'forces-motion-basics':         { engine: 'mechanics', mode: 'pushcart' },
    'john-travoltage':              { engine: 'fields',    mode: 'travoltage' },
    'gravity-force-lab':            { engine: 'fields',    mode: 'gravlab' },
    'balloons-static-electricity':  { engine: 'fields',    mode: 'balloonstatic' },
    'resistance-wire':              { engine: 'circuits',  mode: 'reswire' },
    'build-atom':                   { engine: 'chem',      mode: 'buildatom' },

    /* ===== 化学（新增部分） ===== */
    'build-molecule':               { engine: 'chem',      mode: 'buildmol' },
    'molecule-polarity':            { engine: 'chem',      mode: 'molpolarity' },
    'isotopes-atomic-mass':         { engine: 'chem',      mode: 'isotopes' },
    'molecule-shapes':              { engine: 'chem',      mode: 'molshapes' },
    'molecule-shapes-basics':       { engine: 'chem',      mode: 'molshapes', basic: true },
    'reactants-products-leftovers': { engine: 'chem',      mode: 'leftovers' },
    'ph-scale-basics':              { engine: 'chem',      mode: 'phscaleBasics' },
    'ph-scale':                     { engine: 'chem',      mode: 'phscale' },
    'balancing-chemical-equations': { engine: 'chem',      mode: 'eqbalance' },
    'acid-base-solutions':          { engine: 'chem',      mode: 'acidbase' },
    'concentration':                { engine: 'chem',      mode: 'concentration' },
    'beers-law-lab':                { engine: 'chem',      mode: 'beers' },
    'molarity':                     { engine: 'chem',      mode: 'molarity' },

    /* ===== 生物 / 物理（膜运输等跨学科） ===== */
    'membrane-transport':           { engine: 'bio',       mode: 'membrane' },
    'natural-selection':            { engine: 'bio',       mode: 'naturalselection' },
    'gene-expression-essentials':   { engine: 'bio',       mode: 'genexp' },
    'neuron':                       { engine: 'bio',       mode: 'neuron' },

    /* ===== 地球与空间 ===== */
    'greenhouse-effect':            { engine: 'astro',     mode: 'greenhouse' },

    /* ===== 数学 ===== */
    'number-pairs':                 { engine: 'numbers',   mode: 'numpairs' },
    'mean-share-balance':           { engine: 'stats',     mode: 'meanshare' },
    'projectile-sampling-distributions': { engine: 'stats', mode: 'sampling' },
    'center-variability':           { engine: 'stats',     mode: 'center' },
    'quadrilateral':                { engine: 'numbers',   mode: 'quadshape' },
    'number-compare':               { engine: 'numbers',   mode: 'numcompare' },
    'number-play':                  { engine: 'numbers',   mode: 'numplay' },
    'number-line-distance':         { engine: 'numbers',   mode: 'nldist' },
    'ratio-proportion':             { engine: 'numbers',   mode: 'ratioxy' },
    'number-line-operations':       { engine: 'numbers',   mode: 'nlops' },
    'number-line-integers':         { engine: 'numbers',   mode: 'nlint' },
    'vector-addition-equations':    { engine: 'algebra',   mode: 'veceq' },
    'fractions-mixed-numbers':      { engine: 'numbers',   mode: 'fracmixed' },
    'fractions-intro':              { engine: 'numbers',   mode: 'fracintro' },
    'build-fraction':               { engine: 'numbers',   mode: 'buildfrac' },
    'fractions-equality':           { engine: 'numbers',   mode: 'fraceq' },
    'graphing-quadratics':          { engine: 'graphs',    mode: 'quad' },
    'equality-explorer-two-variables': { engine: 'algebra', mode: 'eqexplor2v' },
    'equality-explorer-basics':     { engine: 'algebra',   mode: 'eqexplorB' },
    'equality-explorer':            { engine: 'algebra',   mode: 'eqexplor' },
    'area-model-algebra':           { engine: 'algebra',   mode: 'areaalg' },
    'area-model-decimals':          { engine: 'algebra',   mode: 'areadec' },
    'area-model-multiplication':    { engine: 'algebra',   mode: 'areamult' },
    'area-model-introduction':      { engine: 'algebra',   mode: 'areaintro' },
    'expression-exchange':          { engine: 'algebra',   mode: 'exprxn' },
    'graphing-slope-intercept':     { engine: 'graphs',    mode: 'slopeint' },
    'function-builder-basics':      { engine: 'algebra',   mode: 'funcbuild', basic: true },
    'proportion-playground':        { engine: 'numbers',   mode: 'proppl' },
    'unit-rates':                   { engine: 'numbers',   mode: 'unitrate' },
    'make-ten':                     { engine: 'numbers',   mode: 'maketen' },
    'function-builder':             { engine: 'algebra',   mode: 'funcbuild' },
    'trig-tour':                    { engine: 'graphs',    mode: 'trig' },
    'arithmetic':                   { engine: 'numbers',   mode: 'arithmetic' },
    'least-squares-regression':     { engine: 'graphs',    mode: 'regression' },
    'area-builder':                 { engine: 'numbers',   mode: 'areabuild' },
    'graphing-lines':               { engine: 'graphs',    mode: 'lines' },
    'fraction-matcher':             { engine: 'numbers',   mode: 'fracmatch' },
    'alpha-decay':                  { engine: 'generic',   mode: 'demo' },
    'beta-decay':                   { engine: 'generic',   mode: 'demo' },
    'battery-resistor-circuit':     { engine: 'generic',   mode: 'demo' },
    'battery-voltage':              { engine: 'generic',   mode: 'demo' },
    'capacitor-lab':                { engine: 'generic',   mode: 'demo' },
    'electric-hockey':              { engine: 'generic',   mode: 'demo' },
    'nuclear-fission':              { engine: 'generic',   mode: 'demo' },
    'photoelectric':                { engine: 'generic',   mode: 'demo' },
    'radioactive-dating-game':      { engine: 'generic',   mode: 'demo' },
    'resonance':                    { engine: 'generic',   mode: 'demo' },
    'sound':                        { engine: 'generic',   mode: 'demo' },
    'moving-man':                   { engine: 'generic',   mode: 'demo' },
    'motion-2d':                    { engine: 'generic',   mode: 'demo' },
    'quantum-tunneling':            { engine: 'generic',   mode: 'demo' },
    'quantum-wave-interference':    { engine: 'generic',   mode: 'demo' },
    'radiating-charge':             { engine: 'generic',   mode: 'demo' },
    'reversible-reactions':         { engine: 'generic',   mode: 'demo' },
    'salts-solubility':             { engine: 'generic',   mode: 'demo' },
    'reactions-rates':              { engine: 'generic',   mode: 'demo' },
    'sugar-salt-solutions':         { engine: 'generic',   mode: 'demo' },
    'molecular-motors':             { engine: 'generic',   mode: 'demo' },
    'membrane-channels':            { engine: 'generic',   mode: 'demo' },
    'gene-machine-lac-operon':      { engine: 'generic',   mode: 'demo' },
    'gene-expression-basics':       { engine: 'generic',   mode: 'demo' },
    'plate-tectonics':              { engine: 'generic',   mode: 'demo' },
    'glaciers':                     { engine: 'generic',   mode: 'demo' },
    'estimation':                   { engine: 'generic',   mode: 'demo' },
    'equation-grapher':             { engine: 'generic',   mode: 'demo' }
};

/* ===== 自检：确认所有映射到的引擎已注册 ===== */
(function () {
    if (!window.EngineRegistry) {
        console.error('[ExperimentMap] EngineRegistry 未加载！');
        return;
    }
    const missing = [];
    Object.keys(window.ExperimentMap).forEach(id => {
        const eng = window.ExperimentMap[id].engine;
        if (!window.EngineRegistry.has(eng)) {
            missing.push(eng + '(' + id + ')');
        }
    });
    const total = Object.keys(window.ExperimentMap).length;
    if (missing.length) {
        console.warn('[ExperimentMap] 有 ' + missing.length + ' 个实验缺少引擎：' + missing.join(', '));
    } else {
        console.info('[ExperimentMap] 自检通过：' + total + ' 个实验全部有可用引擎');
    }
})();
