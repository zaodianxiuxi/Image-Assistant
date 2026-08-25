# 支持十张参考图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许图片生成与编辑流程上传最多十张参考图，并在本地代理拒绝总量超过 50 MB 的请求。

**Architecture:** 将上传总量校验提取到独立的服务端模块，使其可通过 Node 原生测试直接验证。前端与 Multer 使用共享语义的一致上限：前端负责选择体验，服务端负责强制限制和在转发上游前保护内存。

**Tech Stack:** React 18、TypeScript、Vite、Express 5、Multer 2、Node.js 原生 `node:test`。

## Global Constraints

- 参考图数量上限为 10 张。
- 单文件最大为 20 MB。
- 单次 `image[]` 与可选 `mask` 合计最大为 50 MB。
- 超过总量时必须在调用 SudoCode 前返回 HTTP `413` 和中文错误说明。
- 不修改上游模型、接口字段、输出格式或自动重试行为。
- 不发起会消耗 SudoCode 额度的真实 API 请求。

---

### Task 1: 提取并测试上传总量限制

**Files:**
- Create: `server/upload-limits.mjs`
- Create: `server/upload-limits.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `MAX_REFERENCE_IMAGES` (number, `10`)、`MAX_FILE_BYTES` (number, `20 * 1024 * 1024`)、`MAX_UPLOAD_BYTES` (number, `50 * 1024 * 1024`)。
- Produces: `hasUploadSizeWithinLimit(files: Array<{ size: number }>): boolean`，当文件大小总和不超过 `MAX_UPLOAD_BYTES` 时返回 `true`。
- Consumes: Node.js 内置 `node:test` 和 `node:assert/strict`，不新增测试依赖。

- [ ] **Step 1: 写入失败测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { MAX_UPLOAD_BYTES, hasUploadSizeWithinLimit } from "./upload-limits.mjs";

test("accepts uploads exactly at the 50 MB total limit", () => {
  assert.equal(hasUploadSizeWithinLimit([{ size: MAX_UPLOAD_BYTES }]), true);
});

test("rejects uploads larger than the 50 MB total limit", () => {
  assert.equal(hasUploadSizeWithinLimit([{ size: MAX_UPLOAD_BYTES + 1 }]), false);
});
```

- [ ] **Step 2: 运行测试并确认失败原因是模块尚不存在**

Run: `node --test server/upload-limits.test.mjs`

Expected: FAIL，错误包含 `Cannot find module` 或等价的 `upload-limits.mjs` 模块不存在提示。

- [ ] **Step 3: 实现最小上传限制模块，并增加测试脚本**

```js
// server/upload-limits.mjs
export const MAX_REFERENCE_IMAGES = 10;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function hasUploadSizeWithinLimit(files) {
  return files.reduce((total, file) => total + file.size, 0) <= MAX_UPLOAD_BYTES;
}
```

```json
// package.json scripts addition
"test": "node --test"
```

- [ ] **Step 4: 运行新增测试并确认通过**

Run: `npm test -- server/upload-limits.test.mjs`

Expected: PASS，2 tests，0 failures。

- [ ] **Step 5: 提交测试和上传限制模块**

```bash
git add package.json server/upload-limits.mjs server/upload-limits.test.mjs
git commit -m "test: cover total image upload limit"
```

### Task 2: 在 Express 代理强制执行十张与总量限制

**Files:**
- Modify: `server/index.mjs:1-10`
- Modify: `server/index.mjs:169-219`
- Test: `server/upload-limits.test.mjs`

**Interfaces:**
- Consumes: `MAX_REFERENCE_IMAGES`、`MAX_FILE_BYTES`、`MAX_UPLOAD_BYTES` 和 `hasUploadSizeWithinLimit`，均从 `./upload-limits.mjs` 导入。
- Produces: 编辑接口最多接受十个 `image[]` 文件；超出 50 MB 总量时返回 `413`。

- [ ] **Step 1: 先运行已有上传限制测试，确认其在当前基线通过**

Run: `npm test -- server/upload-limits.test.mjs`

Expected: PASS，2 tests，0 failures。

- [ ] **Step 2: 修改代理的 Multer 配置和编辑路由**

```js
import {
  MAX_FILE_BYTES,
  MAX_REFERENCE_IMAGES,
  MAX_UPLOAD_BYTES,
  hasUploadSizeWithinLimit
} from "./upload-limits.mjs";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES }
});
```

```js
upload.fields([
  { name: "image[]", maxCount: MAX_REFERENCE_IMAGES },
  { name: "mask", maxCount: 1 }
]);

const uploadFiles = [...images, ...(mask ? [mask] : [])];
if (!hasUploadSizeWithinLimit(uploadFiles)) {
  sendError(req, res, 413, `图片和遮罩总大小不能超过 ${MAX_UPLOAD_BYTES / 1024 / 1024} MB。`, { operation: "upload" });
  return;
}
```

将所有现有的硬编码 `4`、`20 * 1024 * 1024` 改为导入常量；`clientEvents` 的 `referenceCount` 日志上限改为 `MAX_REFERENCE_IMAGES`。

- [ ] **Step 3: 再次运行测试并确认通过**

Run: `npm test -- server/upload-limits.test.mjs`

Expected: PASS，2 tests，0 failures。

- [ ] **Step 4: 构建项目以检查服务端改动未破坏前端构建**

Run: `npm run build`

Expected: exit code `0`，输出包含 `built in`。

- [ ] **Step 5: 提交代理限制改动**

```bash
git add server/index.mjs server/upload-limits.mjs server/upload-limits.test.mjs
git commit -m "feat: allow ten reference images"
```

### Task 3: 更新 React 选择上限与说明

**Files:**
- Modify: `src/App.tsx:46`
- Modify: `src/App.tsx:331`

**Interfaces:**
- Consumes: 前端常量 `MAX_REFERENCE_IMAGES`，值为 `10`。
- Produces: 选择、计数、截断与容量提示一致按十张参考图工作。

- [ ] **Step 1: 写入失败的静态前端限制测试**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("frontend exposes a ten-image reference limit", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /const MAX_REFERENCE_IMAGES = 10;/);
});
```

将此测试追加到 `server/upload-limits.test.mjs`，避免为单个常量引入额外测试运行器。

- [ ] **Step 2: 运行测试并确认失败原因是当前 UI 限制仍为 4**

Run: `npm test -- server/upload-limits.test.mjs`

Expected: FAIL，断言显示未找到 `const MAX_REFERENCE_IMAGES = 10;`。

- [ ] **Step 3: 以最小改动更新界面上限与说明**

```ts
const MAX_REFERENCE_IMAGES = 10;
```

将上传区域说明从“每张最大 20 MB”调整为“每张最大 20 MB，总计最大 50 MB”，其余截断、计数与错误信息继续复用 `MAX_REFERENCE_IMAGES`。

- [ ] **Step 4: 运行测试和完整构建**

Run: `npm test`

Expected: PASS，3 tests，0 failures。

Run: `npm run build`

Expected: exit code `0`，输出包含 `built in`。

- [ ] **Step 5: 检查变更范围并提交**

Run: `git diff --check`

Expected: 无输出且 exit code `0`。

```bash
git add src/App.tsx server/upload-limits.test.mjs
git commit -m "feat: show ten reference image limit"
```

### Task 4: 本地开发验证与交接

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: 使用说明明确十张参考图、单图 20 MB 与总量 50 MB 的限制。

- [ ] **Step 1: 更新 README 能力说明**

将“最多 4 张参考图”改为“最多 10 张参考图”，并补充“单张最大 20 MB、单次图片和遮罩总量最大 50 MB”。

- [ ] **Step 2: 执行全部本地验证**

Run: `npm test`

Expected: PASS，3 tests，0 failures。

Run: `npm run build`

Expected: exit code `0`，输出包含 `built in`。

Run: `git status --short`

Expected: 除用户预先存在的 `package-lock.json` 改动外，没有未提交的本次功能文件。

- [ ] **Step 3: 提交文档更新**

```bash
git add README.md
git commit -m "docs: document reference image upload limits"
```

- [ ] **Step 4: 可选的真实 API 验证**

在用户明确允许消耗 SudoCode 额度后，分别使用 5、8、10 张小体积图片提交 `/api/images/edit`，记录每次的状态码、请求 ID 和耗时。任何一次上游拒绝后停止后续测试，并保留前端上限为 10 但向用户报告实际兼容上限。
