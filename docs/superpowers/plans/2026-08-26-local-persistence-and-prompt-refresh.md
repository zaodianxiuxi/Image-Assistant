# 本地图片持久化与提示词热榜刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 将生成图片保存到当前 Windows 用户桌面，并为今日提示词热榜提供即时本地刷新和可选的文本模型新灵感生成。

**Architecture:** 服务端以独立存储模块处理桌面路径、图片落盘和安全 URL；现有图片 API 只负责 HTTP 编排。热榜保留内置集合，以日期和刷新次数稳定选取；文本模型调用、响应校验和桌面缓存独立封装，浏览器只访问本地服务。

**Tech Stack:** Node.js 22、Express 5、React 18、TypeScript、Vite、Node test runner。

## Global Constraints

- 生成图片目录是当前系统桌面的 Image-Assisant，不得写死 Windows 用户名。
- 文件名只由服务端生成；图片读取必须阻止路径穿越。
- b64_json 和 URL 上游图片结果都必须保存为本地 PNG；保存失败不得返回上游临时 URL。
- 普通热榜刷新不调用模型；模型生成仅由用户点击“生成新灵感”触发。
- 文本模型使用独立 SUDOCODE_TEXT_MODEL 配置；未配置时必须返回明确错误。
- 每批热榜恰有 6 条且无重复；允许画幅仅为 1024x1024、1536x864、864x1536。
- 模型提示词缓存到桌面 Image-Assisant\\prompt-cache.json，最多保留 120 条。
- 不增加数据库、MinIO、后台爬虫或跨重启图片历史。
- 不提交用户现有 package-lock.json 改动；所有 Git 提交信息使用中文。

---

## 文件结构

- Create: server/desktop-path.mjs - 使用 Windows 系统已知文件夹定位桌面并创建应用目录。
- Create: server/generated-image-store.mjs - 下载/解码、写 PNG、受控文件名和本地 URL。
- Create: server/generated-image-store.test.mjs - 图片存储及安全测试。
- Create: server/prompt-cache.mjs - 热榜候选校验、缓存读取和原子写入。
- Create: server/prompt-cache.test.mjs - 候选校验与缓存测试。
- Create: server/prompt-generator.mjs - OpenAI 兼容的文本模型请求。
- Create: server/prompt-generator.test.mjs - 模型配置和响应测试。
- Modify: server/index.mjs - 接入图片持久化、静态图片路由与提示词 API。
- Modify: server/image-sizes.mjs - 导出共享允许画幅。
- Modify: src/prompt-hotlist.mjs - 接收刷新次数和额外提示词。
- Modify: src/prompt-hotlist.test.mjs - 覆盖刷新和去重。
- Modify: src/App.tsx - 热榜刷新、新灵感状态和 API 调用。
- Modify: src/styles.css - 相关按钮与加载态样式。
- Modify: src/prompt-hotlist-ui.test.mjs - UI 结构测试。
- Modify: .env.example、HANDOFF.md - 配置与交接说明。

## Task 1: 桌面路径和图片落盘

**Files:**
- Create: server/desktop-path.mjs
- Create: server/generated-image-store.mjs
- Create: server/generated-image-store.test.mjs

**Interfaces:**
- Produces: getDesktopAppDirectory({ executeFileImpl, platform, homeDir }): Promise<string>
- Produces: saveProviderImage({ item, outputDirectory, fetchImpl, now, randomUuid }): Promise<{ fileName, imageUrl }>
- Produces: isSafeGeneratedImageFileName(fileName): boolean

- [x] **Step 1: 写入失败测试**

~~~js
test("writes both provider result types to a controlled local PNG URL", async () => {
  const fromBase64 = await saveProviderImage({ item: { b64_json: "aGVsbG8=" }, outputDirectory });
  const fromUrl = await saveProviderImage({ item: { url: "https://example.test/a.png" }, outputDirectory, fetchImpl });
  assert.match(fromBase64.imageUrl, /^\/generated-images\/.+\.png$/);
  assert.match(fromUrl.imageUrl, /^\/generated-images\/.+\.png$/);
});
~~~

- [x] **Step 2: 验证测试先失败**

Run: node --test server/generated-image-store.test.mjs

Expected: FAIL，模块及函数尚不存在。

- [x] **Step 3: 实现最小存储模块**

~~~js
export async function getDesktopAppDirectory(options = {}) {
  // Windows: powershell.exe -NoProfile [Environment]::GetFolderPath('Desktop')
  // 其他系统：os.homedir() 下的 Desktop；随后 mkdir(directory, { recursive: true })。
}

export async function saveProviderImage({ item, outputDirectory, fetchImpl = fetch }) {
  // b64_json 用 Buffer.from(value, "base64")；URL 用 fetch 后 arrayBuffer。
  // 使用服务端时间和 randomUUID 生成 PNG 文件名，以 wx 标志写入文件。
  // 返回 { fileName, imageUrl: "/generated-images/" + fileName }。
}
~~~

- [x] **Step 4: 验证目录、Base64、URL、目录复用和文件名安全**

Run: node --test server/generated-image-store.test.mjs

Expected: PASS。

- [x] **Step 5: 提交**

~~~bash
git add server/desktop-path.mjs server/generated-image-store.mjs server/generated-image-store.test.mjs
git commit -m "功能：保存生成图片到桌面"
~~~

## Task 2: 图片 API 和受控读取路由

**Files:**
- Modify: server/index.mjs
- Modify: server/generated-image-store.test.mjs

**Interfaces:**
- Consumes: Task 1 的 getDesktopAppDirectory、saveProviderImage、isSafeGeneratedImageFileName。
- Produces: 图片 API 的 image 字段为 /generated-images/<server-file>.png。
- Produces: GET /generated-images/:fileName，仅响应服务端规则生成的 PNG。

- [x] **Step 1: 写入失败测试**

~~~js
test("rejects traversal and non-PNG generated-image paths", () => {
  assert.equal(isSafeGeneratedImageFileName("..%2F.env"), false);
  assert.equal(isSafeGeneratedImageFileName("source.jpg"), false);
  assert.equal(isSafeGeneratedImageFileName("20260826-080000-a1b2.png"), true);
});
~~~

- [x] **Step 2: 验证新增断言失败**

Run: node --test server/generated-image-store.test.mjs

Expected: FAIL，直到文件名白名单实现。

- [x] **Step 3: 让 generate/edit 统一保存结果并提供受控路由**

~~~js
const generatedImageDirectory = await getDesktopAppDirectory();
// parseProviderResponse 在成功解析 item 后调用 saveProviderImage。
// 路由先校验 isSafeGeneratedImageFileName，再使用 res.sendFile(fileName, { root: generatedImageDirectory, dotfiles: "deny" })。
~~~

- [x] **Step 4: 运行服务端回归测试**

Run: node --test server/*.test.mjs

Expected: PASS，包含尺寸、上传限制和图片落盘测试。

- [x] **Step 5: 提交**

~~~bash
git add server/index.mjs server/generated-image-store.test.mjs
git commit -m "功能：通过本地路由访问生成图片"
~~~

## Task 3: 即时本地热榜刷新

**Files:**
- Modify: src/prompt-hotlist.mjs
- Modify: src/prompt-hotlist.test.mjs
- Modify: src/App.tsx
- Modify: src/styles.css
- Modify: src/prompt-hotlist-ui.test.mjs

**Interfaces:**
- Produces: getDailyPromptHotlist(date, count, refreshIndex, extraPrompts)。
- Produces: handleHotlistRefresh(): void。

- [ ] **Step 1: 写入失败测试**

~~~js
test("changes the unique six-item selection when refresh index changes", () => {
  const date = new Date("2026-08-26T08:00:00.000Z");
  const first = getDailyPromptHotlist(date, 6, 0).map(({ id }) => id);
  const next = getDailyPromptHotlist(date, 6, 1).map(({ id }) => id);
  assert.equal(new Set(next).size, 6);
  assert.notDeepEqual(next, first);
});
~~~

- [ ] **Step 2: 验证测试失败**

Run: node --test src/prompt-hotlist.test.mjs

Expected: FAIL，刷新索引尚未影响洗牌种子。

- [ ] **Step 3: 实现刷新种子和图标按钮**

~~~tsx
const [hotlistRefreshIndex, setHotlistRefreshIndex] = useState(0);
const dailyPrompts = useMemo(
  () => getDailyPromptHotlist(new Date(), 6, hotlistRefreshIndex, extraPrompts),
  [hotlistRefreshIndex, extraPrompts]
);
// 使用 RefreshCw 图标按钮；点击时递增刷新索引，不修改 size。
~~~

- [ ] **Step 4: 验证前端逻辑与构建**

Run: node --test src/prompt-hotlist.test.mjs src/prompt-hotlist-ui.test.mjs
Run: npm run build

Expected: 两条命令均成功。

- [ ] **Step 5: 提交**

~~~bash
git add src/prompt-hotlist.mjs src/prompt-hotlist.test.mjs src/App.tsx src/styles.css src/prompt-hotlist-ui.test.mjs
git commit -m "功能：支持刷新今日提示词"
~~~

## Task 4: 文本模型候选、校验和桌面缓存

**Files:**
- Create: server/prompt-cache.mjs
- Create: server/prompt-cache.test.mjs
- Create: server/prompt-generator.mjs
- Create: server/prompt-generator.test.mjs
- Modify: server/image-sizes.mjs
- Modify: server/index.mjs
- Modify: .env.example

**Interfaces:**
- Produces: validatePromptCandidates(value, existingPrompts): PromptItem[]
- Produces: readPromptCache(cacheFile): Promise<PromptItem[]>
- Produces: writePromptCache(cacheFile, prompts): Promise<void>
- Produces: generatePromptCandidates({ apiBase, apiKey, model, fetchImpl }): Promise<PromptItem[]>
- Produces: POST /api/prompts/generate -> { prompts: PromptItem[] }

- [ ] **Step 1: 写入失败测试**

~~~js
test("rejects invalid prompt entries and limits persistent cache entries", async () => {
  const valid = { title: "云港气象厅", category: "未来建筑", size: "1536x864", prompt: "复杂中文图像提示词".repeat(20) };
  assert.equal(validatePromptCandidates([valid, { ...valid, size: "100x100" }], []).length, 1);
  await writePromptCache(cacheFile, Array.from({ length: 125 }, (_, index) => ({ ...valid, id: "item-" + index })));
  assert.equal((await readPromptCache(cacheFile)).length, 120);
});
~~~

- [ ] **Step 2: 验证测试失败**

Run: node --test server/prompt-cache.test.mjs server/prompt-generator.test.mjs

Expected: FAIL，新增模块不存在。

- [ ] **Step 3: 实现严格校验和原子缓存**

~~~js
// 接受 title、category、size、prompt、id；要求中文、非空、80-500 字、允许画幅和内容去重。
// 写入时先写同目录随机 .tmp 文件，再 rename 到 prompt-cache.json；保留最近 120 条。
// 未配置 model 时抛出“未配置 SUDOCODE_TEXT_MODEL，无法生成新灵感。”。
~~~

- [ ] **Step 4: 实现 OpenAI 兼容服务端接口**

~~~js
app.post("/api/prompts/generate", async (req, res) => {
  // POST apiBase + "/chat/completions"，Bearer 密钥仅在服务端。
  // 要求模型返回严格 JSON 的 6 项 prompts 数组；校验后合并桌面缓存并返回生成项。
  // 任何错误只影响此接口，普通本地刷新不受影响。
});
~~~

- [ ] **Step 5: 更新配置并运行服务端测试**

Run: node --test server/*.test.mjs

Expected: PASS，覆盖未配置模型、合法 JSON、非法字段、缓存容量和图片测试。

- [ ] **Step 6: 提交**

~~~bash
git add server/prompt-cache.mjs server/prompt-cache.test.mjs server/prompt-generator.mjs server/prompt-generator.test.mjs server/image-sizes.mjs server/index.mjs .env.example
git commit -m "功能：支持生成热榜新灵感"
~~~

## Task 5: 前端新灵感交互和文档收尾

**Files:**
- Modify: src/App.tsx
- Modify: src/styles.css
- Modify: src/prompt-hotlist-ui.test.mjs
- Modify: HANDOFF.md

**Interfaces:**
- Consumes: POST /api/prompts/generate 的 { prompts }。
- Produces: handleGeneratePromptIdeas(): Promise<void>。

- [ ] **Step 1: 写入失败测试**

~~~js
test("renders the model ideas action with a duplicate-request guard", () => {
  const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  assert.match(source, /handleGeneratePromptIdeas/);
  assert.match(source, /promptIdeasLoading/);
  assert.match(source, /\/api\/prompts\/generate/);
});
~~~

- [ ] **Step 2: 验证测试失败**

Run: node --test src/prompt-hotlist-ui.test.mjs

Expected: FAIL，生成处理函数与加载状态尚不存在。

- [ ] **Step 3: 实现按钮、加载态、成功合并和失败反馈**

~~~tsx
async function handleGeneratePromptIdeas() {
  setPromptIdeasLoading(true);
  try {
    // 请求本地接口；失败显示服务端 message。
    // 成功后去重合并 extraPrompts，并增加 hotlistRefreshIndex。
  } finally {
    setPromptIdeasLoading(false);
  }
}
// “生成新灵感”在 loading 时 disabled；普通刷新仍保持可用。
~~~

- [ ] **Step 4: 更新 HANDOFF.md 并运行全量验证**

Run: npm test
Run: npm run build

Expected: 两条命令退出码为 0。

- [ ] **Step 5: 提交**

~~~bash
git add src/App.tsx src/styles.css src/prompt-hotlist-ui.test.mjs HANDOFF.md
git commit -m "功能：接入热榜新灵感生成"
~~~

## 计划自检

- 本计划覆盖图片落盘与访问安全、两类上游图片返回、普通热榜刷新、文本模型生成、桌面缓存及错误隔离。
- 真实模型调用以供应商确认的 SUDOCODE_TEXT_MODEL 名称和 chat/completions 兼容性为前提；配置缺失时仍完整支持本地热榜刷新。
- MinIO、实时抓取、数据库和图片持久化历史均不在本期实现范围内。
