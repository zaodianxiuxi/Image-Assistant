# 3D Creation and Series Journey Implementation Plan

> **For agentic workers:** Use the approved design in the matching spec and execute tasks in order; keep review and verification evidence. Work in the existing feature checkout, preserving earlier Impeccable setup changes.

**Goal:** 实现 3D 创作首页与可沿路径浏览的系列图片。

**Architecture:** ExplodedCreation 管理首页的四层场景；JourneyTimeline 是可复用的展映结构；SeriesJourney 在原生 dialog 中展示图库节点，StoryReader 复用同一路径组件。独立纯函数选择图库节点主图与其余版本。

**Tech Stack:** React 18、TypeScript、CSS 3D transforms、原生 dialog/ResizeObserver、node:test；不加依赖。

## Global Constraints

- 保留四主题、完整图片比例、现有预览下载编辑和版本动作。
- 不改后端、模型调用、数据库结构；本轮只做网页内展映。
- 减少动态效果关闭动画和平滑滚动；不默认自动播放。

## Tasks

- [x] 1. 新增 src/gallery-journey.test.mjs，先验证失败；实现 gallery-journey.mjs 与声明文件；覆盖顺序、交付版本、未排序节点与输入不变。
- [x] 2. 新增 ExplodedCreation.tsx、creation-space.css，替换 CreativeWelcome 视觉；保留三个工作入口，完成窄屏和主题适配。
- [x] 3. 新增 JourneyTimeline.tsx、SeriesJourney.tsx、journey.css；在 App.tsx 合集头接入，在 StoryReader.tsx 增加路径模式。
- [x] 4. 浏览器用独立本地 fixture 服务注入测试图库/故事数据，检查交互、图片比例、键盘、主题、手机、播放停止。模拟测试数据不进入产品。
- [x] 5. 执行 npm test、npm run build、git diff --check 和设计检测，代码复查；更新 README、DESIGN.md 和设计数据，保存验证记录。

## 验证范围调整

用户要求避免重度测试。已完成的浏览器与完整回归保留；最后的路径绕行调整仅验证 3 个相关逻辑测试和 TypeScript 编译，不重复全量。故事验证使用隔离组件页，测试素材不进入产品数据。详见验收记录。
