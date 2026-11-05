# PhET-CN · 中文互动科学实验平台

> 灵感来自 [PhET Interactive Simulations](https://phet.colorado.edu/) 的全中文开源互动实验平台。
> 纯前端实现（HTML + Canvas 2D + 原生 JavaScript），零依赖、零构建、免登录，打开即用。

**🌐 在线体验：<https://phet-cn.onrender.com>**（Render） · <https://liuxing5.github.io/phet-cn/>（GitHub Pages）

---

## ✨ 特性

- **147 个互动实验**，覆盖 **5 大学科**：物理、化学、生物、地球与空间、数学
- **年级筛选**：小学 / 初中 / 高中 / 大学，一键过滤适合的实验
- **全中文界面**，核心实验提供中英双语对照标签
- **真实交互**：滑块、下拉框、开关、拖拽画布元素、分步操作引导，不是"看视频"
- **高保真复刻**：抛体采样分布、发电机等实验逐帧还原 PhET 原版交互与 UI
- **免费开源**：无需安装、无广告、无使用门槛

## 🚀 快速开始

### 方式一：直接访问（推荐）

打开在线站点 <https://liuxing5.github.io/phet-cn/>，选择学科进入任意实验即可。

### 方式二：本地运行

本项目为纯静态站点，任意静态文件服务器均可托管：

```bash
git clone https://github.com/liuxing5/phet-cn.git
cd phet-cn
python -m http.server 8666
# 浏览器打开 http://localhost:8666/
```

> 💡 也可以用 VS Code Live Server、`npx serve` 等任意方式托管，无需构建步骤。

## 📖 页面导航

| 页面 | 说明 |
|---|---|
| `index.html` | 首页：学科入口 + 精选实验 |
| `browse.html` | 浏览页：全部实验列表，支持学科 + 年级双重筛选 |
| `simulation.html?subject=物理学科&id=实验ID` | 实验页：单个互动实验 |
| `experiment-drag.html` | 拖拽式欧姆定律实验台（分步搭建电路） |
| `smoke-test.html` | 自动化冒烟测试：跑通全部实验的生命周期 |

## 🏗️ 架构

采用 **"引擎家族工厂 + 全量 ID 映射"** 设计：所有实验由 14 个引擎工厂按配置（`mode`）派生，新增实验通常只需在映射表中加一行。

```
浏览器
 └─ simulation.html
     └─ js/simulation-loader.js      实验加载器：控件面板、播放控制、指针转发、引导提示
         ├─ js/experiment-map.js     实验 ID → { engine, mode } 映射 + 启动自检
         │    └─ js/engine-registry.js   引擎注册表：register / build（契约校验）
         │         ├─ js/engines/*.js   14 个引擎工厂（waves/optics/mechanics/...）
         │         └─ js/engines/generic.js  通用演示引擎（新实验的兜底底座）
         ├─ js/engine-kit.js             绘图工具箱：panel/circle/arrow/label/axes/...
         └─ js/data.js                   学科、实验元数据、年级标签
```

### 引擎实例契约

每个引擎实例必须实现 5 个核心方法（可选实现指针交互）：

```js
{
  init(loader),              // 初始化，注册控件
  getControls(),             // 返回 slider/select/checkbox/button 控件定义
  update(dt, t),             // 物理推进（dt ≤ 0.05s）
  render(ctx, W, H, t),      // Canvas 绘制
  reset(),                   // 重置状态
  // 可选：onPointerDown/Move/Up(x, y, e)  画布拖拽交互
  // 可选：hitTest(x, y)                   悬停光标反馈
}
```

### 目录结构

```
phet-cn/
├── index.html / browse.html / simulation.html / experiment-drag.html / smoke-test.html
├── css/                 # 样式（含移动端适配）
├── js/
│   ├── data.js          # 5 学科实验元数据 + 年级映射
│   ├── engine-kit.js    # Canvas 绘图工具箱
│   ├── engine-registry.js  # 引擎注册与契约校验
│   ├── experiment-map.js   # 142 个实验 ID 映射 + 自检
│   ├── simulation-loader.js # 实验加载器
│   └── engines/         # 14 个引擎工厂（按 mode 分支派生实验）
└── experiments/physics/ # 5 个经典精修实验独立脚本
```

## ➕ 如何新增实验

1. **找引擎**：确认实验适合哪个引擎家族（如波动类 → `waves`），或直接使用 `generic` 通用引擎。
2. **加映射**：在 `js/experiment-map.js` 中添加一行：

```js
'my-experiment': { engine: 'waves', mode: 'interference' },
```

3. **加元数据**：在 `js/data.js` 对应学科数组中补充名称、简介、年级等信息。
4. 刷新页面即可访问：`simulation.html?subject=physics&id=my-experiment`（映射表自带启动自检）。

## ✅ 质量保障

- `smoke-test.html` 一键自动化测试：对全部实验执行 **init → 控件回调 → 60 帧 update → render → 指针事件 → reset** 全生命周期，汇总 ✅/❌ 结果，可单独重跑失败项。
- 引擎注册时校验必需方法，映射表加载即自检，配置错误在启动瞬间暴露。

## 📦 部署

站点是纯静态文件，可同时托管在 **GitHub Pages** 和 **Render**，两者共用同一份代码，不需要任何构建步骤。

### Render（推荐）

**已上线：<https://phet-cn.onrender.com>**（静态站点，免费额度，`main` 分支根目录，无构建步骤）。

仓库根目录内置 [`render.yaml`](render.yaml) 蓝图，换账号或重新关联时一次性完成：

1. 用 GitHub 账号登录 <https://dashboard.render.com>，打开 **New → Blueprint**。
2. 选择仓库 `liuxing5/phet-cn`，Render 会自动读取 `render.yaml`。
3. 点击 **Apply**，约 1 分钟后站点上线。

也可以直接点下面的按钮，跳转到 Render 的蓝图部署页：

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/liuxing5/phet-cn)

之后每次推送 `main`，Render 都会自动重新发布（`autoDeploy: true`）。想用自己的域名，在服务页 **Settings → Custom Domains** 里添加即可。

### GitHub Pages

站点同时托管于 **GitHub Pages**（`main` 分支根目录，强制 HTTPS）：

```bash
git add . && git commit -m "update" && git push origin main
# 推送后 Pages 自动重新构建，约 1 分钟内生效
```

## 🙏 致谢与声明

- 交互设计与实验创意灵感来自 [PhET Interactive Simulations](https://phet.colorado.edu/)（科罗拉多大学博尔德分校），本项目为**独立的中文教学复刻实现**，与 PhET 官方无隶属关系。
- 所有代码为原创实现，采用纯 Canvas 2D 绘制，不依赖任何第三方库。

---

⭐ 如果这个项目对你有帮助，欢迎 Star 支持！
