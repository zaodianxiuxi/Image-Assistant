# 全宽工作台与主题体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 让图片创作界面全宽展示，并提供明亮、深色和暖灰编辑室三种可持久化主题。

**Architecture:** 在 App.tsx 扩展主题状态和主题菜单，使用单个 data-theme 属性驱动 CSS 语义变量。styles.css 重构顶级布局为全宽工作台，并保留移动端断点。

**Tech Stack:** React 18、TypeScript、CSS 自定义属性、Lucide React、Node Test Runner、Vite。

## Global Constraints

- 保留现有 image-assistant-theme 本地存储键，并兼容历史的 light 与 dark 值。
- 不修改图片生成、编辑、版本链和图库数据接口。
- 不新增第三方依赖。

### Task 1: 主题状态与菜单

**Files:**
- Modify: src/App.tsx
- Modify: src/prompt-hotlist-ui.test.mjs

- [ ] 为三种主题值和主题菜单写失败的 UI 结构测试。
- [ ] 运行 node --test src/prompt-hotlist-ui.test.mjs，确认测试因缺少主题菜单失败。
- [ ] 扩展主题类型、初始化逻辑、图标菜单和 Escape 关闭行为。
- [ ] 重跑 UI 测试，确认通过。

### Task 2: 全宽布局与主题变量

**Files:**
- Modify: src/styles.css
- Modify: src/prompt-hotlist-ui.test.mjs

- [ ] 为全宽工作区和 CSS 主题变量写失败的结构测试。
- [ ] 运行 UI 测试，确认测试失败。
- [ ] 使用语义变量替换页面底色、面板、文字、边框和强调色；重写主工作区与图库网格规则。
- [ ] 重跑 UI 测试，确认通过。

### Task 3: 构建和视觉验证

**Files:**
- Verify: src/App.tsx
- Verify: src/styles.css

- [ ] 运行 npm test。
- [ ] 运行 npm run build。
- [ ] 在 1440px 和 390px 宽度下检查页面，确认工作区、主题菜单和图库无重叠。
- [ ] 提交仅包含本功能文件的变更，不包含用户现有的 package-lock.json 修改。
