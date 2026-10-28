# 3D 工作台实施计划

依据已批准方案，保留现有 feature checkout。

- [x] 1. 依赖：安装 Three.js 与类型；下载并校验官方 Filee portable，隔离保存。
- [x] 2. server/workbench/：文件保存、Filee CLI 适配、持久任务、Express 路由；覆盖路径边界、格式解析、队列结果。
- [x] 3. src/workbench/：工作台壳、三维桌面、文件区、阅读器、转换面板、任务中心；原 App 懒加载并保留挂载状态。
- [x] 4. 接入 main.tsx、server/index.mjs、忽略本地数据，更新说明。
- [x] 5. 编译与关键检查，一个实际转换，一次浏览器交互；修复发现的具体问题。


验证记录：`npm run build` 成功；Filee/存储定向检查 6/6 通过；真实 PNG → WebP 输出可下载且尺寸正确。浏览器确认旋转、物件导航、文本阅读、可用格式选择及图片创作入口，检查了桌面与 390px 窄屏并修复窄屏裁切。未做模型调用、Office 编辑或全量格式兼容性测试。Three.js 独立懒加载包约 561 KB，构建保留体积提示。
