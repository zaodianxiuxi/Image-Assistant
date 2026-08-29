import "dotenv/config";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import multer from "multer";
import { getDesktopAppDirectory } from "./desktop-path.mjs";
import { isSafeGeneratedImageFileName, saveProviderImage } from "./generated-image-store.mjs";
import { readPromptCache, validatePromptCandidates, writePromptCache } from "./prompt-cache.mjs";
import { generatePromptCandidates } from "./prompt-generator.mjs";
import { generateStoryboard } from "./storyboard-generator.mjs";
import { analyzeImageStyle } from "./style-analyzer.mjs";
import { composeStylePrompt } from "./style-composer.mjs";
import {
  MAX_FILE_BYTES,
  MAX_REFERENCE_IMAGES,
  MAX_UPLOAD_BYTES,
  hasUploadSizeWithinLimit
} from "./upload-limits.mjs";
import { DEFAULT_IMAGE_SIZE, isSupportedImageSize } from "./image-sizes.mjs";
import { saveApiKey } from "./local-config.mjs";
import { PROMPT_HOTLIST } from "../src/prompt-hotlist.mjs";
import {
  createSeries,
  createSeriesNode,
  createStoryboardNodes,
  deletePrompt,
  isDatabaseConfigured,
  listPrompts,
  listGeneratedImages,
  listSeries,
  listSeriesNodes,
  markImageVersionDelivered,
  saveGeneratedImage,
  saveImageVersion,
  updateSeriesNodeStatus,
  upsertPrompt
} from "./database.mjs";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES }
});
const port = Number(process.env.PORT || 3001);
const apiBase = (process.env.SUDOCODE_BASE_URL || "https://api.sudocode.chat/v1").replace(/\/$/, "");
const envFile = process.env.IMAGE_ASSISTANT_ENV_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
let generatedImageDirectoryPromise;

app.use(express.json({ limit: "1mb" }));

function log(event, details = {}) {
  console.log(`[image-api] ${JSON.stringify({ time: new Date().toISOString(), event, ...details })}`);
}

function errorDetails(error) {
  return {
    message: error instanceof Error ? error.message : String(error),
    name: error?.name,
    code: error?.code || error?.cause?.code,
    cause: error?.cause?.message,
    stack: error instanceof Error ? error.stack : undefined
  };
}

app.use((req, res, next) => {
  req.requestId = req.get("x-request-id") || randomUUID();
  req.requestStartedAt = Date.now();
  res.setHeader("x-request-id", req.requestId);
  res.on("finish", () => {
    log("local_response", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - req.requestStartedAt
    });
  });
  next();
});

function sendError(req, res, status, message, extra = {}) {
  log("request_error", { requestId: req.requestId, status, message, ...extra });
  res.status(status).json({ error: message, requestId: req.requestId });
}

function requireApiKey(req, res) {
  if (process.env.SUDOCODE_API_KEY) return true;
  sendError(req, res, 503, "未配置 SUDOCODE_API_KEY。请复制 .env.example 为 .env，然后填入你的 API Key。");
  return false;
}

function headers() {
  return { Authorization: `Bearer ${process.env.SUDOCODE_API_KEY}` };
}

function isLocalRequest(req) {
  return ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress || "");
}

async function updateNodeStatus(nodeId, status, requestId) {
  if (!Number.isInteger(Number(nodeId))) return;
  try {
    await updateSeriesNodeStatus(Number(nodeId), status);
  } catch (error) {
    log("database_node_status_failed", { requestId, nodeId: Number(nodeId), status, ...errorDetails(error) });
  }
}

function getGeneratedImageDirectory() {
  // Resolve once, on demand, so health and validation endpoints remain available if disk setup fails.
  generatedImageDirectoryPromise ??= getDesktopAppDirectory();
  return generatedImageDirectoryPromise;
}

async function getPromptCacheFile() {
  return path.join(await getGeneratedImageDirectory(), "prompt-cache.json");
}

async function parseProviderResponse(response, requestId, operation, metadata = {}) {
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    log("provider_invalid_response", {
      requestId,
      operation,
      status: response.status,
      contentType: response.headers.get("content-type"),
      preview: raw.slice(0, 1000)
    });
    throw new Error(`上游服务返回了无法解析的响应（HTTP ${response.status}）。`);
  }

  log("provider_response", {
    requestId,
    operation,
    status: response.status,
    providerRequestId: response.headers.get("x-request-id") || response.headers.get("request-id"),
    error: response.ok ? undefined : body?.error?.message || body?.message || body?.error
  });

  if (!response.ok) {
    const message = body?.error?.message || body?.message || `上游服务请求失败（HTTP ${response.status}）。`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const item = body?.data?.[0];
  if (!item?.b64_json && !item?.url) {
    throw new Error("接口未返回图片数据，请检查模型权限或请求参数。");
  }

  const savedImage = await saveProviderImage({
    item,
    outputDirectory: await getGeneratedImageDirectory(),
    title: metadata.title,
    prompt: metadata.prompt,
    seriesName: metadata.seriesName,
    nodeOrder: metadata.nodeOrder
  });
  let databaseId = null;
  let versionInfo = null;
  try {
    databaseId = await saveGeneratedImage({
      title: metadata.title,
      seriesId: metadata.seriesId,
      nodeId: metadata.nodeId,
      fileName: savedImage.fileName,
      relativePath: savedImage.relativePath,
      filePath: path.join(await getGeneratedImageDirectory(), savedImage.relativePath),
      publicUrl: savedImage.imageUrl,
      prompt: metadata.prompt || item.revised_prompt || "",
      size: metadata.size,
      operation,
      model: "gpt-image-2",
      providerRequestId: response.headers.get("x-request-id") || response.headers.get("request-id")
    });
    versionInfo = await saveImageVersion({
      imageRecordId: databaseId,
      sourceImageRecordId: metadata.sourceImageRecordId,
      versionGroupId: metadata.versionGroupId,
      parentVersionId: metadata.parentVersionId,
      seriesId: metadata.seriesId,
      nodeId: metadata.nodeId,
      title: metadata.title,
      prompt: metadata.prompt || item.revised_prompt || "",
      operation
    });
    await updateNodeStatus(metadata.nodeId, "completed", requestId);
  } catch (error) {
    log("database_save_failed", { requestId, operation, ...errorDetails(error) });
  }
  return {
    image: savedImage.imageUrl,
    fileName: savedImage.fileName,
    relativePath: savedImage.relativePath,
    databaseId,
    versionId: versionInfo?.versionId || null,
    versionGroupId: versionInfo?.versionGroupId || null,
    parentVersionId: versionInfo?.parentVersionId || null,
    versionNumber: versionInfo?.versionNumber || null,
    isDelivery: Boolean(versionInfo?.isDelivery),
    revisedPrompt: item.revised_prompt || null
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    configured: Boolean(process.env.SUDOCODE_API_KEY),
    databaseConfigured: isDatabaseConfigured(),
    baseUrl: apiBase
  });
});

app.get("/api/settings", (_req, res) => {
  res.json({ apiKeyConfigured: Boolean(process.env.SUDOCODE_API_KEY) });
});

app.put("/api/settings/api-key", async (req, res) => {
  if (!isLocalRequest(req)) {
    sendError(req, res, 403, "密钥配置仅允许在本机操作。");
    return;
  }
  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (!apiKey || apiKey.length > 2048 || /[\r\n]/.test(apiKey)) {
    sendError(req, res, 400, "请输入有效的 API Key。");
    return;
  }
  try {
    await saveApiKey(envFile, apiKey);
    process.env.SUDOCODE_API_KEY = apiKey;
    log("api_key_configured", { requestId: req.requestId });
    res.json({ configured: true });
  } catch (error) {
    sendError(req, res, 500, "保存 API Key 失败。", { operation: "api_key_config", ...errorDetails(error) });
  }
});

app.get("/api/prompts", async (req, res) => {
  try {
    res.json({ prompts: await readPromptCache(await getPromptCacheFile()) });
  } catch (error) {
    sendError(req, res, 500, "读取本地提示词缓存失败。", { operation: "prompt_cache", ...errorDetails(error) });
  }
});

app.get("/api/library/prompts", async (req, res) => {
  try {
    const prompts = await listPrompts({
      search: typeof req.query.search === "string" ? req.query.search : "",
      favorite: req.query.favorite === "true"
    });
    res.json({ prompts, databaseConfigured: isDatabaseConfigured() });
  } catch (error) {
    sendError(req, res, 503, error instanceof Error ? error.message : "读取提示词失败。", { operation: "prompt_library", ...errorDetails(error) });
  }
});

app.get("/api/library/images", async (req, res) => {
  try {
    const images = await listGeneratedImages(req.query.limit);
    res.json({ images, databaseConfigured: isDatabaseConfigured() });
  } catch (error) {
    sendError(req, res, 503, error instanceof Error ? error.message : "读取图片合集失败。", { operation: "image_library", ...errorDetails(error) });
  }
});

app.post("/api/library/images/versions/:id/deliver", async (req, res) => {
  const versionId = Number(req.params.id);
  if (!Number.isInteger(versionId) || versionId <= 0) {
    sendError(req, res, 400, "无效的图片版本 ID。", { operation: "version_delivery" });
    return;
  }
  try {
    res.json(await markImageVersionDelivered(versionId));
  } catch (error) {
    sendError(req, res, 503, error instanceof Error ? error.message : "设置交付版本失败。", { operation: "version_delivery", ...errorDetails(error) });
  }
});

app.post("/api/library/prompts", async (req, res) => {
  try {
    const prompt = await upsertPrompt(req.body || {});
    res.status(201).json({ prompt });
  } catch (error) {
    sendError(req, res, 400, error instanceof Error ? error.message : "保存提示词失败。", { operation: "prompt_library", ...errorDetails(error) });
  }
});

app.patch("/api/library/prompts/:id", async (req, res) => {
  try {
    const prompt = await upsertPrompt(req.body || {}, Number(req.params.id));
    if (!prompt) {
      sendError(req, res, 404, "提示词不存在。", { operation: "prompt_library" });
      return;
    }
    res.json({ prompt });
  } catch (error) {
    sendError(req, res, 400, error instanceof Error ? error.message : "更新提示词失败。", { operation: "prompt_library", ...errorDetails(error) });
  }
});

app.delete("/api/library/prompts/:id", async (req, res) => {
  try {
    await deletePrompt(Number(req.params.id));
    res.status(204).end();
  } catch (error) {
    sendError(req, res, 400, error instanceof Error ? error.message : "删除提示词失败。", { operation: "prompt_library", ...errorDetails(error) });
  }
});

app.get("/api/series", async (req, res) => {
  try {
    res.json({ series: await listSeries(), databaseConfigured: isDatabaseConfigured() });
  } catch (error) {
    sendError(req, res, 503, error instanceof Error ? error.message : "读取系列失败。", { operation: "series", ...errorDetails(error) });
  }
});

app.post("/api/series", async (req, res) => {
  try {
    const series = await createSeries(req.body || {});
    res.status(201).json({ series });
  } catch (error) {
    sendError(req, res, 400, error instanceof Error ? error.message : "保存系列失败。", { operation: "series", ...errorDetails(error) });
  }
});

app.get("/api/series/:id/nodes", async (req, res) => {
  try {
    res.json({ nodes: await listSeriesNodes(Number(req.params.id)) });
  } catch (error) {
    sendError(req, res, 503, error instanceof Error ? error.message : "读取故事节点失败。", { operation: "series", ...errorDetails(error) });
  }
});

app.post("/api/series/:id/nodes", async (req, res) => {
  try {
    const node = await createSeriesNode(Number(req.params.id), req.body || {});
    res.status(201).json({ node });
  } catch (error) {
    sendError(req, res, 400, error instanceof Error ? error.message : "保存故事节点失败。", { operation: "series", ...errorDetails(error) });
  }
});

app.post("/api/series/:id/storyboard", async (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!process.env.SUDOCODE_TEXT_MODEL) {
    sendError(req, res, 503, "未配置 SUDOCODE_TEXT_MODEL，无法自动拆分故事。", { operation: "storyboard" });
    return;
  }
  try {
    const seriesId = Number(req.params.id);
    const allSeries = await listSeries();
    const series = allSeries.find((item) => Number(item.id) === seriesId);
    if (!series) {
      sendError(req, res, 404, "系列不存在。", { operation: "storyboard" });
      return;
    }
    const nodes = await generateStoryboard({
      apiBase,
      apiKey: process.env.SUDOCODE_API_KEY,
      model: process.env.SUDOCODE_TEXT_MODEL,
      story: req.body?.story,
      seriesName: series.name
    });
    const savedNodes = await createStoryboardNodes(seriesId, nodes);
    res.status(201).json({ nodes: savedNodes });
  } catch (error) {
    sendError(req, res, 502, error instanceof Error ? error.message : "自动拆分故事失败。", { operation: "storyboard", ...errorDetails(error) });
  }
});

app.post("/api/prompts/generate", async (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!process.env.SUDOCODE_TEXT_MODEL) {
    sendError(req, res, 503, "未配置 SUDOCODE_TEXT_MODEL，无法生成新灵感。", { operation: "prompt_generate" });
    return;
  }

  try {
    const cacheFile = await getPromptCacheFile();
    const cachedPrompts = await readPromptCache(cacheFile);
    const generatedPrompts = await generatePromptCandidates({
      apiBase,
      apiKey: process.env.SUDOCODE_API_KEY,
      model: process.env.SUDOCODE_TEXT_MODEL,
      existingPrompts: [...PROMPT_HOTLIST, ...cachedPrompts]
    });
    const updatedCache = validatePromptCandidates([...generatedPrompts, ...cachedPrompts], PROMPT_HOTLIST);
    await writePromptCache(cacheFile, updatedCache);
    if (isDatabaseConfigured()) {
      try {
        await Promise.all(generatedPrompts.map((item) => upsertPrompt({
          title: item.title,
          category: item.category,
          content: item.prompt,
          source: "ai"
        })));
      } catch (error) {
        log("database_prompt_save_failed", { requestId: req.requestId, ...errorDetails(error) });
      }
    }
    res.json({ prompts: generatedPrompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成新灵感失败。";
    sendError(req, res, 502, message, { operation: "prompt_generate", ...errorDetails(error) });
  }
});

app.post("/api/styles/analyze", upload.single("image"), async (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!process.env.SUDOCODE_VISION_MODEL) {
    sendError(req, res, 503, "未配置 SUDOCODE_VISION_MODEL，无法分析参考图。", { operation: "style_analyze" });
    return;
  }
  if (!req.file || !req.file.mimetype.startsWith("image/")) {
    sendError(req, res, 400, "请上传一张有效的参考图片。", { operation: "style_analyze" });
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
    sendError(req, res, 502, error instanceof Error ? error.message : "参考图分析失败。", {
      operation: "style_analyze",
      ...errorDetails(error)
    });
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
      analysis: req.body?.analysis,
      newContent: req.body?.newContent,
      lockedFields: req.body?.lockedFields
    });
    res.json({ prompt });
  } catch (error) {
    sendError(req, res, 400, error instanceof Error ? error.message : "提示词组合失败。", {
      operation: "style_compose",
      ...errorDetails(error)
    });
  }
});

app.get(/^\/generated-images\/(.+)$/, async (req, res, next) => {
  try {
    const rawParts = String(req.params[0] || "").split("/");
    let parts;
    try {
      parts = rawParts.map((part) => decodeURIComponent(part));
    } catch {
      res.sendStatus(404);
      return;
    }
    if (!parts.length || parts.some((part) => !part || part === "." || part === ".." || part.includes("/") || part.includes("\\") || part.includes("\u0000"))) {
      res.sendStatus(404);
      return;
    }
    const fileName = parts.at(-1);
    if (!isSafeGeneratedImageFileName(fileName) || !/^\d{4}-\d{2}-\d{2}$/u.test(parts[0])) {
      res.sendStatus(404);
      return;
    }
    const root = await getGeneratedImageDirectory();
    const filePath = path.resolve(root, ...parts);
    const normalizedRoot = path.resolve(root) + path.sep;
    if (!filePath.startsWith(normalizedRoot)) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(filePath, { dotfiles: "deny" }, (error) => {
      if (!error) return;
      if (error.code === "ENOENT" || error.status === 404) {
        res.sendStatus(404);
        return;
      }
      next(error);
    });
  } catch (error) {
    next(error);
  }
});

const clientEvents = new Set([
  "prompt_input_started",
  "reference_images_selected",
  "mask_selected",
  "reference_image_removed",
  "generate_clicked",
  "client_validation_failed"
]);

app.post("/api/events", (req, res) => {
  const { event, mode, promptChars, file, referenceCount } = req.body || {};
  if (!clientEvents.has(event)) {
    sendError(req, res, 400, "未知的客户端日志事件。");
    return;
  }

  log("client_event", {
    requestId: req.requestId,
    event,
    mode: mode === "edit" ? "edit" : "generate",
    promptChars: Number.isFinite(promptChars) ? Math.min(Math.max(promptChars, 0), 4000) : undefined,
    referenceCount: Number.isFinite(referenceCount) ? Math.min(Math.max(referenceCount, 0), MAX_REFERENCE_IMAGES) : undefined,
    file: file && typeof file === "object"
      ? {
          mimeType: typeof file.mimeType === "string" ? file.mimeType : undefined,
          bytes: Number.isFinite(file.bytes) ? Math.min(Math.max(file.bytes, 0), 20 * 1024 * 1024) : undefined
        }
      : undefined
  });
  res.status(204).end();
});

app.post("/api/images/generate", async (req, res) => {
  const { prompt, size } = req.body || {};
  const imageSize = size ?? DEFAULT_IMAGE_SIZE;
  if (!isSupportedImageSize(imageSize)) {
    sendError(req, res, 400, "不支持的输出画幅。请选择正方形、电脑横屏或手机竖屏。", { operation: "generate" });
    return;
  }
  if (!requireApiKey(req, res)) return;
  if (typeof prompt !== "string" || !prompt.trim()) {
    sendError(req, res, 400, "请输入图片提示词。");
    return;
  }
  await updateNodeStatus(req.body?.nodeId, "generating", req.requestId);

  log("provider_request", {
    requestId: req.requestId,
    operation: "generate",
    endpoint: `${apiBase}/images/generations`,
    model: "gpt-image-2",
    promptChars: prompt.trim().length,
    size: imageSize
  });
  try {
    const response = await fetch(`${apiBase}/images/generations`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt: prompt.trim(), size: imageSize })
    });
    res.json(await parseProviderResponse(response, req.requestId, "generate", {
      prompt: prompt.trim(),
      size: imageSize,
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
      seriesName: typeof req.body?.seriesName === "string" ? req.body.seriesName : undefined,
      seriesId: Number.isInteger(Number(req.body?.seriesId)) ? Number(req.body.seriesId) : null,
      nodeId: Number.isInteger(Number(req.body?.nodeId)) ? Number(req.body.nodeId) : null,
      nodeOrder: Number.isInteger(Number(req.body?.nodeOrder)) ? Number(req.body.nodeOrder) : undefined,
      versionGroupId: Number.isInteger(Number(req.body?.versionGroupId)) ? Number(req.body.versionGroupId) : null,
      parentVersionId: Number.isInteger(Number(req.body?.parentVersionId)) ? Number(req.body.parentVersionId) : null,
      sourceImageRecordId: Number.isInteger(Number(req.body?.sourceImageRecordId)) ? Number(req.body.sourceImageRecordId) : null
    }));
  } catch (error) {
    await updateNodeStatus(req.body?.nodeId, "failed", req.requestId);
    const status = Number.isInteger(error?.status) ? error.status : 502;
    const message = error instanceof Error ? error.message : "图片生成失败。";
    sendError(req, res, status, message, { operation: "generate", ...errorDetails(error) });
  }
});

app.post(
  "/api/images/edit",
  upload.fields([
    { name: "image[]", maxCount: MAX_REFERENCE_IMAGES },
    { name: "mask", maxCount: 1 }
  ]),
  async (req, res) => {
    const imageSize = req.body?.size ?? DEFAULT_IMAGE_SIZE;
    if (!isSupportedImageSize(imageSize)) {
      sendError(req, res, 400, "不支持的输出画幅。请选择正方形、电脑横屏或手机竖屏。", { operation: "edit" });
      return;
    }
    if (!requireApiKey(req, res)) return;
    const images = req.files?.["image[]"] || [];
    const mask = req.files?.mask?.[0];
    const prompt = req.body?.prompt;
    if (!images.length) {
      sendError(req, res, 400, "请至少上传一张待编辑的图片。");
      return;
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      sendError(req, res, 400, "请输入编辑提示词。");
      return;
    }
    await updateNodeStatus(req.body?.nodeId, "generating", req.requestId);
    const uploadFiles = [...images, ...(mask ? [mask] : [])];
    if (!hasUploadSizeWithinLimit(uploadFiles)) {
      sendError(req, res, 413, `图片和遮罩总大小不能超过 ${MAX_UPLOAD_BYTES / 1024 / 1024} MB。`, { operation: "upload" });
      return;
    }

    log("provider_request", {
      requestId: req.requestId,
      operation: "edit",
      endpoint: `${apiBase}/images/edits`,
      model: "gpt-image-2",
      promptChars: prompt.trim().length,
      size: imageSize,
      imageCount: images.length,
      images: images.map((image) => ({ name: image.originalname, mimeType: image.mimetype, bytes: image.size })),
      mask: mask ? { name: mask.originalname, mimeType: mask.mimetype, bytes: mask.size } : null
    });
    try {
      const form = new FormData();
      form.append("model", "gpt-image-2");
      form.append("prompt", prompt.trim());
      form.append("size", imageSize);
      images.forEach((image) => {
        form.append("image[]", new Blob([image.buffer], { type: image.mimetype }), image.originalname);
      });
      if (mask) form.append("mask", new Blob([mask.buffer], { type: mask.mimetype }), mask.originalname);

      const response = await fetch(`${apiBase}/images/edits`, {
        method: "POST",
        headers: headers(),
        body: form
      });
      res.json(await parseProviderResponse(response, req.requestId, "edit", {
        prompt: prompt.trim(),
        size: imageSize,
        title: typeof req.body?.title === "string" ? req.body.title : undefined,
        seriesName: typeof req.body?.seriesName === "string" ? req.body.seriesName : undefined,
        seriesId: Number.isInteger(Number(req.body?.seriesId)) ? Number(req.body.seriesId) : null,
        nodeId: Number.isInteger(Number(req.body?.nodeId)) ? Number(req.body.nodeId) : null,
        nodeOrder: Number.isInteger(Number(req.body?.nodeOrder)) ? Number(req.body.nodeOrder) : undefined,
        versionGroupId: Number.isInteger(Number(req.body?.versionGroupId)) ? Number(req.body.versionGroupId) : null,
        parentVersionId: Number.isInteger(Number(req.body?.parentVersionId)) ? Number(req.body.parentVersionId) : null,
        sourceImageRecordId: Number.isInteger(Number(req.body?.sourceImageRecordId)) ? Number(req.body.sourceImageRecordId) : null
      }));
    } catch (error) {
      await updateNodeStatus(req.body?.nodeId, "failed", req.requestId);
      const status = Number.isInteger(error?.status) ? error.status : 502;
      const message = error instanceof Error ? error.message : "图片编辑失败。";
      sendError(req, res, status, message, { operation: "edit", ...errorDetails(error) });
    }
  }
);

app.use((error, req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    sendError(req, res, 413, "单张图片最大支持 20 MB。", { operation: "upload" });
    return;
  }
  sendError(req, res, 400, error.message || "请求无法处理。", { operation: "upload", ...errorDetails(error) });
});

app.listen(port, () => {
  log("server_started", {
    address: `http://localhost:${port}`,
    apiBase,
    apiKeyConfigured: Boolean(process.env.SUDOCODE_API_KEY)
  });
});
