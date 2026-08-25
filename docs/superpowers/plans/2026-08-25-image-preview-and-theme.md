# 图片预览与主题切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让生成结果和历史图片可靠地按原比例预览，并提供可记忆的浅深色主题与轻量动画。

**Architecture:** 预览状态保留在 `App.tsx`，主画布与历史记录调用同一打开函数。CSS 变量由根元素 `data-theme` 切换；图片容器以最大边界约束而非强制填满尺寸。

**Tech Stack:** React 18、TypeScript、CSS、Node 内置测试运行器、Lucide React。

## Global Constraints

- 不改变图片生成、编辑和画幅请求参数。
- 不增加新的依赖。
- 主题只提供浅色和深色，并保存到 `localStorage`。
- 新增用户可见文字使用中文；提交信息使用中文；不推送远程仓库。

---

### Task 1: 预览状态与行为测试

**Files:**
- Modify: `src/prompt-hotlist-ui.test.mjs`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `openPreview(result: Result): void`，供主图和历史图共用。

- [ ] 写入失败测试，断言 `openPreview`、主图点击、历史图点击和 `onError={handleImageError}` 存在。
- [ ] 运行 `npm test -- src/prompt-hotlist-ui.test.mjs`，确认预览函数不存在导致失败。
- [ ] 实现 `const [preview, setPreview] = useState<Result | null>(null)` 与 `openPreview(result: Result)`。
- [ ] 再次运行 focused 测试，确认通过。

### Task 2: 保比例弹层、错误状态和主题切换

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/prompt-hotlist-ui.test.mjs`

**Interfaces:**
- Consumes: `openPreview(result: Result): void`。
- Produces: 带关闭操作的预览弹层和 `Theme = "light" | "dark"`。

- [ ] 写入失败测试，断言 `role="dialog"`、图片加载失败文本、主题本地存储和太阳/月亮图标存在。
- [ ] 运行 focused 测试，确认弹层、主题和错误反馈不存在导致失败。
- [ ] 实现预览弹层、保比例图片规则、错误重试、浅深色主题按钮、CSS 变量和减少动态支持。
- [ ] 执行 `npm test`、`npm run build` 和浏览器交互检查；确认两处图片预览、动画与主题切换均正常。
- [ ] 使用中文提交信息 `功能：完善图片预览与主题切换` 提交本地分支，不推送远程。
