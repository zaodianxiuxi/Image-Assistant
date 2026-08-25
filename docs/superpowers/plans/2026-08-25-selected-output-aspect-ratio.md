# 所选输出画幅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为纯文本生成和参考图编辑提供统一的正方形、电脑横屏和手机竖屏输出画幅，并确保服务端强制执行所选尺寸。

**Architecture:** 服务端新增独立画幅模块，集中定义三个允许值与校验函数；生成和编辑路由都调用它，编辑路由再将画幅加入 multipart 请求。前端保留自己的展示元数据，但始终展示选择器，并将同一 `size` 传给两类请求。

**Tech Stack:** React 18、TypeScript、Vite、Express 5、Multer 2、Node.js 原生 `node:test`。

## Global Constraints

- 只支持 `1024x1024`、`1536x864` 和 `864x1536` 三种输出尺寸。
- 参考图仅用于内容、构图、材质和风格参考；输出尺寸始终采用用户选择。
- 未列入白名单的画幅必须在调用 SudoCode 前返回 HTTP `400`。
- 不增加自定义宽高输入，不对参考图进行服务端裁剪或缩放。
- 不发起会消耗 SudoCode 额度的真实图片请求。
- 新增本地提交的 `git commit -m` 信息必须使用中文。

---

### Task 1: 定义并测试服务端画幅白名单

**Files:**
- Create: `server/image-sizes.mjs`
- Create: `server/image-sizes.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_IMAGE_SIZE`，值为 `"1024x1024"`。
- Produces: `IMAGE_SIZES`，值为 `new Set(["1024x1024", "1536x864", "864x1536"])`。
- Produces: `isSupportedImageSize(size: unknown): boolean`，仅在 `size` 为白名单成员时返回 `true`。

- [ ] **Step 1: 写入失败测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedImageSize } from "./image-sizes.mjs";

test("accepts the three supported output sizes", () => {
  assert.equal(isSupportedImageSize("1024x1024"), true);
  assert.equal(isSupportedImageSize("1536x864"), true);
  assert.equal(isSupportedImageSize("864x1536"), true);
});

test("rejects an unsupported output size", () => {
  assert.equal(isSupportedImageSize("1920x1080"), false);
});
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `node --test server/image-sizes.test.mjs`

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND` 和 `image-sizes.mjs`。

- [ ] **Step 3: 实现最小画幅白名单模块**

```js
export const DEFAULT_IMAGE_SIZE = "1024x1024";
export const IMAGE_SIZES = new Set(["1024x1024", "1536x864", "864x1536"]);

export function isSupportedImageSize(size) {
  return typeof size === "string" && IMAGE_SIZES.has(size);
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- server/image-sizes.test.mjs`

Expected: PASS，2 tests，0 failures。

- [ ] **Step 5: 使用中文信息提交独立模块与测试**

```bash
git add server/image-sizes.mjs server/image-sizes.test.mjs
git commit -m "测试：覆盖输出画幅白名单"
```

### Task 2: 在生成和编辑代理中强制并转发画幅

**Files:**
- Modify: `server/index.mjs:1-12`
- Modify: `server/index.mjs:145-167`
- Modify: `server/index.mjs:175-219`
- Test: `server/image-sizes.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_IMAGE_SIZE` 和 `isSupportedImageSize`，从 `./image-sizes.mjs` 导入。
- Produces: 两个图片接口均只接收白名单尺寸，并把合法值传给上游。

- [ ] **Step 1: 运行画幅白名单测试以确认基线通过**

Run: `npm test -- server/image-sizes.test.mjs`

Expected: PASS，2 tests，0 failures。

- [ ] **Step 2: 修改生成接口的尺寸处理**

```js
const { prompt, size } = req.body || {};
const imageSize = size ?? DEFAULT_IMAGE_SIZE;
if (!isSupportedImageSize(imageSize)) {
  sendError(req, res, 400, "不支持的输出画幅。请选择正方形、电脑横屏或手机竖屏。", { operation: "generate" });
  return;
}
```

将日志字段改为 `size: imageSize`，并将上游 JSON 请求固定为：

```js
body: JSON.stringify({ model: "gpt-image-2", prompt: prompt.trim(), size: imageSize })
```

- [ ] **Step 3: 修改编辑接口的尺寸处理和 multipart 转发**

在读取 `prompt` 后增加：

```js
const imageSize = req.body?.size ?? DEFAULT_IMAGE_SIZE;
if (!isSupportedImageSize(imageSize)) {
  sendError(req, res, 400, "不支持的输出画幅。请选择正方形、电脑横屏或手机竖屏。", { operation: "edit" });
  return;
}
```

将 `size: imageSize` 写入编辑请求日志，并在创建上游 `FormData` 时加入：

```js
form.append("size", imageSize);
```

- [ ] **Step 4: 运行全部本地测试与构建**

Run: `npm test`

Expected: PASS，至少 5 tests，0 failures。

Run: `npm run build`

Expected: exit code `0`，输出包含 `built in`。

- [ ] **Step 5: 使用中文信息提交代理改动**

```bash
git add server/index.mjs server/image-sizes.mjs server/image-sizes.test.mjs
git commit -m "功能：统一转发所选输出画幅"
```

### Task 3: 更新前端常用比例与参考图请求

**Files:**
- Modify: `src/App.tsx:34-38`
- Modify: `src/App.tsx:241-249`
- Modify: `src/App.tsx:356-368`
- Modify: `src/styles.css:36`
- Modify: `server/upload-limits.test.mjs`

**Interfaces:**
- Consumes: 前端 `SIZES`，依次为正方形 `1024x1024`、电脑横屏 `1536x864` 和手机竖屏 `864x1536`。
- Produces: 选择器始终可见；编辑表单将所选值作为 `size` 字段提交。

- [ ] **Step 1: 为前端画幅行为追加失败测试**

在 `server/upload-limits.test.mjs` 增加：

```js
test("frontend exposes common output ratios for every creation mode", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /value: "1536x864", name: "电脑横屏", detail: "16:9"/);
  assert.match(source, /value: "864x1536", name: "手机竖屏", detail: "9:16"/);
  assert.match(source, /form\.append\("size", size\)/);
  assert.doesNotMatch(source, /mode === "generate" && !referenceImages\.length/);
});
```

- [ ] **Step 2: 运行测试并确认它因旧画幅与缺少编辑 `size` 字段而失败**

Run: `npm test -- server/upload-limits.test.mjs`

Expected: FAIL，断言显示未找到 `1536x864`、`864x1536` 或 `form.append("size", size)`。

- [ ] **Step 3: 以最小改动更新前端选项和提交内容**

```ts
const SIZES = [
  { value: "1024x1024", name: "正方形", detail: "1:1" },
  { value: "1536x864", name: "电脑横屏", detail: "16:9" },
  { value: "864x1536", name: "手机竖屏", detail: "9:16" }
];
```

在编辑 `FormData` 中加入：

```ts
form.append("size", size);
```

移除限制选择器显示范围的 `mode === "generate" && !referenceImages.length` 条件，使选择器始终显示。将参考图提示替换为“参考图仅提供内容和风格参考，输出将按所选画幅生成。”并增加 `.ratio-1536-864` 和 `.ratio-864-1536` 的预览样式。

- [ ] **Step 4: 运行完整测试与构建**

Run: `npm test`

Expected: PASS，至少 6 tests，0 failures。

Run: `npm run build`

Expected: exit code `0`，输出包含 `built in`。

- [ ] **Step 5: 使用中文信息提交前端改动**

```bash
git add src/App.tsx src/styles.css server/upload-limits.test.mjs
git commit -m "功能：提供常用输出画幅选择"
```

### Task 4: 更新项目说明并完成验证

**Files:**
- Modify: `README.md:38`

**Interfaces:**
- Produces: README 明确三个常用比例，且说明参考图只用于内容与风格参考。

- [ ] **Step 1: 更新 README 画幅说明**

将模型能力说明替换为：

```md
- `gpt-image-2` 模型支持正方形 1:1、电脑横屏 16:9 和手机竖屏 9:16 输出；参考图仅提供内容和风格参考，输出始终按所选画幅生成
```

- [ ] **Step 2: 完成最终本地验证**

Run: `npm test`

Expected: PASS，至少 6 tests，0 failures。

Run: `npm run build`

Expected: exit code `0`，输出包含 `built in`。

Run: `git diff --check`

Expected: 无输出且 exit code `0`。

- [ ] **Step 3: 使用中文信息提交文档更新**

```bash
git add README.md
git commit -m "文档：说明常用输出画幅"
```
