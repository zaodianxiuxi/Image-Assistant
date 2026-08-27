# 图片反推提示词与风格模板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 增加单图结构化风格分析、新内容提示词组合和浏览器本地风格模板，使用户确认完整提示词后再使用现有生图流程。

**Architecture:** 服务端将视觉分析和文本组合拆成独立纯接口模块，Express 路由只做上传、配置和错误转换。前端新增独立 StyleWorkbench 对话框，App 只管理打开入口和“应用到提示词”回调；本地模板由纯函数模块负责校验与变更，localStorage 只在组件边界读写。

**Tech Stack:** React 18、TypeScript、Express 5、Multer、OpenAI-compatible chat completions、Node Test Runner、CSS。

## Global Constraints

- 最终提示词必须先预览，绝不自动发起图片生成。
- 参考图不写入桌面图片目录、数据库或浏览器本地存储。
- 本阶段不实现 MySQL 表和系列绑定接口；只显示明确的未来能力占位状态。
- 未配置视觉模型时，现有生成、编辑、版本链和图库功能继续正常工作。
- 不新增第三方依赖，不提交用户已有的 package-lock.json 修改。

---

### Task 1: 结构化视觉分析服务

**Files:**
- Create: server/style-analyzer.mjs
- Create: server/style-analyzer.test.mjs

**Interfaces:**
- Produces: analyzeImageStyle({ apiBase, apiKey, model, image, fetchImpl }) -> Promise<StyleAnalysis>
- StyleAnalysis fields: sourceContent, composition, camera, lighting, color, material, style, negativePrompt

- [ ] **Step 1: Write the failing analyzer tests**

测试必须覆盖模型配置、图片消息格式、完整 JSON 解析和字段缺失：

    test("sends the image to the configured vision model", async () => {
      const analysis = await analyzeImageStyle({
        apiBase: "https://example.test/v1",
        apiKey: "key",
        model: "vision-test",
        image: { buffer: Buffer.from("image"), mimetype: "image/png" },
        fetchImpl: async (url, options) => {
          request = { url, body: JSON.parse(options.body) };
          return new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validAnalysis) } }]
          }), { status: 200 });
        }
      });
      assert.equal(request.url, "https://example.test/v1/chat/completions");
      assert.match(request.body.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
      assert.deepEqual(analysis, validAnalysis);
    });

    test("rejects incomplete model analysis", async () => {
      await assert.rejects(() => analyzeImageStyle(configReturning({ style: "摄影" })), /缺少字段/);
    });

- [ ] **Step 2: Run the analyzer tests and verify RED**

Run: node --test server/style-analyzer.test.mjs
Expected: FAIL because server/style-analyzer.mjs does not exist.

- [ ] **Step 3: Implement strict analysis parsing**

实现固定字段白名单、每字段 1 到 2000 字符、data URL 和上游错误转换：

    export const STYLE_ANALYSIS_FIELDS = [
      "sourceContent", "composition", "camera", "lighting",
      "color", "material", "style", "negativePrompt"
    ];

    export async function analyzeImageStyle({ apiBase, apiKey, model, image, fetchImpl = fetch }) {
      if (!model) throw new Error("未配置 SUDOCODE_VISION_MODEL，无法分析参考图。");
      if (!apiKey) throw new Error("未配置 SUDOCODE_API_KEY，无法分析参考图。");
      const imageUrl = "data:" + image.mimetype + ";base64," + image.buffer.toString("base64");
      const response = await fetchImpl(apiBase.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
            { role: "user", content: [
              { type: "text", text: "分析这张参考图，只返回要求的 JSON。" },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
            ] }
          ]
        })
      });
      return parseStyleAnalysis(await response.json(), response.ok, response.status);
    }

- [ ] **Step 4: Run the analyzer tests and verify GREEN**

Run: node --test server/style-analyzer.test.mjs
Expected: all analyzer tests pass.

- [ ] **Step 5: Commit the analyzer**

    git add server/style-analyzer.mjs server/style-analyzer.test.mjs
    git commit -m "实现参考图结构化风格分析"

---

### Task 2: 提示词组合服务与 HTTP 接口

**Files:**
- Create: server/style-composer.mjs
- Create: server/style-composer.test.mjs
- Create: server/style-routes.test.mjs
- Modify: server/index.mjs
- Modify: .env.example
- Modify: README.md

**Interfaces:**
- Consumes: analyzeImageStyle from Task 1
- Produces: composeStylePrompt({ apiBase, apiKey, model, analysis, newContent, lockedFields, fetchImpl }) -> Promise<string>
- Produces: POST /api/styles/analyze and POST /api/styles/compose

- [ ] **Step 1: Write failing composition and route tests**

组合测试验证新内容、结构字段和锁定字段传给模型，并清除画幅文字：

    test("composes new content with selected style fields", async () => {
      const prompt = await composeStylePrompt({
        apiBase: "https://example.test/v1",
        apiKey: "key",
        model: "text-test",
        analysis: validAnalysis,
        newContent: "白衣剑客站在雪山顶",
        lockedFields: ["lighting", "color", "style"],
        fetchImpl
      });
      assert.match(prompt, /白衣剑客/);
      assert.doesNotMatch(prompt, /16:9|1:1|1536x864/);
    });

路由测试启动无 MySQL 子进程，验证未配置视觉模型返回 503、非图片返回 400、compose 缺少 newContent 返回 400。

- [ ] **Step 2: Run focused tests and verify RED**

Run: node --test server/style-composer.test.mjs server/style-routes.test.mjs
Expected: FAIL because composer and routes do not exist.

- [ ] **Step 3: Implement prompt composition**

组合器只接受七个可复用风格字段，不把 sourceContent 写入模型上下文：

    const REUSABLE_FIELDS = [
      "composition", "camera", "lighting", "color",
      "material", "style", "negativePrompt"
    ];

    export async function composeStylePrompt(input) {
      const newContent = String(input.newContent || "").trim();
      if (!newContent) throw new Error("请输入新的画面内容。");
      const styleFields = Object.fromEntries(REUSABLE_FIELDS.map((field) => [
        field, String(input.analysis?.[field] || "").trim()
      ]));
      const model = input.model || input.fallbackModel;
      if (!model) throw new Error("未配置 SUDOCODE_TEXT_MODEL 或可回退的视觉模型。");
      const content = await requestComposedPrompt({ ...input, model, newContent, styleFields });
      return stripAspectRatioText(content).trim();
    }

- [ ] **Step 4: Add routes and configuration**

在 server/index.mjs 注册：

    app.post("/api/styles/analyze", upload.single("image"), async (req, res) => {
      if (!requireApiKey(req, res)) return;
      if (!process.env.SUDOCODE_VISION_MODEL) {
        sendError(req, res, 503, "未配置 SUDOCODE_VISION_MODEL，无法分析参考图。");
        return;
      }
      if (!req.file || !req.file.mimetype.startsWith("image/")) {
        sendError(req, res, 400, "请上传一张有效的参考图片。");
        return;
      }
      try {
        const analysis = await analyzeImageStyle({
          apiBase,
          apiKey: process.env.SUDOCODE_API_KEY,
          model: process.env.SUDOCODE_VISION_MODEL,
          image: req.file
        });
        res.json({ analysis });
      } catch (error) {
        sendError(req, res, 502, error.message, { operation: "style_analyze" });
      }
    });

    app.post("/api/styles/compose", async (req, res) => {
      if (!requireApiKey(req, res)) return;
      try {
        const prompt = await composeStylePrompt({
          apiBase,
          apiKey: process.env.SUDOCODE_API_KEY,
          model: process.env.SUDOCODE_TEXT_MODEL,
          fallbackModel: process.env.SUDOCODE_VISION_MODEL,
          ...req.body
        });
        res.json({ prompt });
      } catch (error) {
        sendError(req, res, 400, error.message, { operation: "style_compose" });
      }
    });

在 .env.example 和 README.md 记录 SUDOCODE_VISION_MODEL、图片会上送到模型提供方、未配置时不影响现有功能。

- [ ] **Step 5: Run focused server tests and verify GREEN**

Run: node --test server/style-analyzer.test.mjs server/style-composer.test.mjs server/style-routes.test.mjs
Expected: all style service and route tests pass.

- [ ] **Step 6: Commit service routes**

    git add server/style-composer.mjs server/style-composer.test.mjs server/style-routes.test.mjs server/index.mjs .env.example README.md
    git commit -m "增加图片风格分析与提示词组合接口"

---

### Task 3: 浏览器本地风格模板

**Files:**
- Create: src/style-profiles.mjs
- Create: src/style-profiles.d.mts
- Create: src/style-profiles.test.mjs

**Interfaces:**
- Produces: parseStyleProfiles(raw), createStyleProfile(input), updateStyleProfile(items, id, patch), removeStyleProfile(items, id)
- Produces: STYLE_PROFILE_STORAGE_KEY = "image-assistant-style-profiles"

- [ ] **Step 1: Write failing pure-function tests**

    test("creates a reusable profile without source image content", () => {
      const profile = createStyleProfile({ name: "电影冷光", analysis: validAnalysis, lockedFields: ["lighting"] });
      assert.equal(profile.name, "电影冷光");
      assert.equal(profile.lighting, validAnalysis.lighting);
      assert.equal("sourceContent" in profile, false);
    });

    test("recovers from invalid local storage data", () => {
      assert.deepEqual(parseStyleProfiles("{bad json"), []);
      assert.deepEqual(parseStyleProfiles(JSON.stringify([{ id: "" }])), []);
    });

    test("updates and removes profiles without mutation", () => {
      const updated = updateStyleProfile([profile], profile.id, { name: "新名称" });
      assert.equal(updated[0].name, "新名称");
      assert.equal(profile.name, "电影冷光");
      assert.deepEqual(removeStyleProfile(updated, profile.id), []);
    });

- [ ] **Step 2: Run profile tests and verify RED**

Run: node --test src/style-profiles.test.mjs
Expected: FAIL because src/style-profiles.mjs does not exist.

- [ ] **Step 3: Implement validated immutable profile operations**

使用 crypto.randomUUID 生成 local-style 前缀 ID，限制最多 100 个模板，字段字符串最大 2000 字符，lockedFields 只保留七个合法字段。声明文件导出匹配的 StyleProfile 和 StyleAnalysis 类型。

- [ ] **Step 4: Run profile tests and verify GREEN**

Run: node --test src/style-profiles.test.mjs
Expected: all local profile tests pass.

- [ ] **Step 5: Commit local profile storage logic**

    git add src/style-profiles.mjs src/style-profiles.d.mts src/style-profiles.test.mjs
    git commit -m "实现本地风格模板管理"

---

### Task 4: 风格提取工作台组件

**Files:**
- Create: src/StyleWorkbench.tsx
- Modify: src/App.tsx
- Modify: src/styles.css
- Modify: src/prompt-hotlist-ui.test.mjs

**Interfaces:**
- Consumes: style profile functions and types from Task 3
- Produces: StyleWorkbench({ open, onClose, onApplyPrompt, databaseConfigured })
- App callback: onApplyPrompt(prompt) sets the existing prompt and closes the dialog

- [ ] **Step 1: Write failing UI structure tests**

在 prompt-hotlist-ui.test.mjs 增加断言：

    assert.match(source, /从图片提取风格/);
    assert.match(workbench, /\/api\/styles\/analyze/);
    assert.match(workbench, /\/api\/styles\/compose/);
    assert.match(workbench, /原图内容/);
    assert.match(workbench, /构图与画面组织/);
    assert.match(workbench, /新的画面内容/);
    assert.match(workbench, /优化组合/);
    assert.match(workbench, /应用到提示词/);
    assert.match(workbench, /保存为本地模板/);
    assert.match(workbench, /连接 MySQL 后可用/);
    assert.match(styles, /\.style-workbench/);

- [ ] **Step 2: Run UI tests and verify RED**

Run: node --test src/prompt-hotlist-ui.test.mjs
Expected: FAIL because StyleWorkbench and its entry point do not exist.

- [ ] **Step 3: Implement the modal state machine**

组件状态包括 referenceFile、referencePreview、analysis、lockedFields、newContent、composedPrompt、analyzing、composing、error、profiles 和 selectedProfileId。

分析动作发送 FormData：

    const form = new FormData();
    form.append("image", referenceFile);
    const response = await fetch("/api/styles/analyze", { method: "POST", body: form });
    if (!response.ok) throw new Error(await readStyleApiError(response));
    setAnalysis((await response.json()).analysis);

组合动作发送 JSON：

    const response = await fetch("/api/styles/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis, newContent, lockedFields: [...lockedFields] })
    });

应用动作只执行 onApplyPrompt(composedPrompt)，不得调用 /api/images/generate 或 /api/images/edit。

- [ ] **Step 4: Implement local template persistence and future DB affordance**

首次打开时从 STYLE_PROFILE_STORAGE_KEY 解析模板。新建、更新、重命名和删除后同步写 localStorage；写入异常时保留 React 状态并显示“当前模板仅保留在本页面”。

模板加载只覆盖七个风格字段和锁定字段，不覆盖 newContent。绑定系列按钮保持 disabled，标题和可见说明均为“连接 MySQL 后可用”。

- [ ] **Step 5: Integrate the entry point and responsive styles**

在 App.tsx 提示词标签行增加 WandSparkles 图标入口。新增 databaseConfigured 状态，从现有 /api/health 响应的 databaseConfigured 字段读取并传给组件；本阶段按钮即使数据库已配置也保持占位说明，因为数据库 CRUD 不在范围内，但状态边界必须独立于 apiReady。

样式要求：

- 对话框桌面宽度 min(1040px, 100%)，左右两栏分别为参考图/模板与结构字段/组合结果。
- 所有固定格式控件设置 min-width: 0，文本区域允许换行。
- 600px 以下改为单列，不出现水平滚动。
- 三套主题都使用现有 CSS 语义变量，不新增一套独立硬编码配色。

- [ ] **Step 6: Run UI tests and build**

Run: node --test src/prompt-hotlist-ui.test.mjs src/style-profiles.test.mjs
Expected: all focused frontend tests pass.

Run: npm run build
Expected: TypeScript and Vite build exit with code 0.

- [ ] **Step 7: Commit the workbench**

    git add src/StyleWorkbench.tsx src/App.tsx src/styles.css src/prompt-hotlist-ui.test.mjs
    git commit -m "增加图片反推提示词工作台"

---

### Task 5: Full verification and handoff

**Files:**
- Verify: all files changed in Tasks 1 through 4

- [ ] **Step 1: Run the full test suite**

Run: npm test
Expected: zero failed tests, including existing generation, editing, gallery, versioning and theme tests.

- [ ] **Step 2: Run the production build**

Run: npm run build
Expected: TypeScript and Vite build exit with code 0.

- [ ] **Step 3: Verify desktop and mobile UI**

At 1440 x 1000:
- Open the style extraction entry.
- Seed one valid StyleProfile into image-assistant-style-profiles through the local browser test context and reload.
- Verify the two-column dialog, editable fields, lock controls, seeded local template and disabled series binding do not overlap.

At 390 x 844:
- Verify the dialog becomes one column.
- Verify document scroll width is no greater than viewport width.
- Verify long Chinese analysis text wraps inside its field.

- [ ] **Step 4: Review repository scope**

Run: git status --short and git diff --check
Expected: package-lock.json remains unstaged; no whitespace errors; only planned source, test and documentation files are included.
