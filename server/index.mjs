import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import express from "express";
import multer from "multer";
import { getDesktopAppDirectory } from "./desktop-path.mjs";
import { isSafeGeneratedImageFileName, saveProviderImage } from "./generated-image-store.mjs";
import { readPromptCache, validatePromptCandidates, writePromptCache } from "./prompt-cache.mjs";
import { generatePromptCandidates } from "./prompt-generator.mjs";
import {
  MAX_FILE_BYTES,
  MAX_REFERENCE_IMAGES,
  MAX_UPLOAD_BYTES,
  hasUploadSizeWithinLimit
} from "./upload-limits.mjs";
import { DEFAULT_IMAGE_SIZE, isSupportedImageSize } from "./image-sizes.mjs";
import { PROMPT_HOTLIST } from "../src/prompt-hotlist.mjs";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES }
});
const port = Number(process.env.PORT || 3001);
const apiBase = (process.env.SUDOCODE_BASE_URL || "https://api.sudocode.chat/v1").replace(/\/$/, "");
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

function getGeneratedImageDirectory() {
  // Resolve once, on demand, so health and validation endpoints remain available if disk setup fails.
  generatedImageDirectoryPromise ??= getDesktopAppDirectory();
  return generatedImageDirectoryPromise;
}

async function getPromptCacheFile() {
  return path.join(await getGeneratedImageDirectory(), "prompt-cache.json");
}

async function parseProviderResponse(response, requestId, operation) {
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
    outputDirectory: await getGeneratedImageDirectory()
  });
  return { image: savedImage.imageUrl, revisedPrompt: item.revised_prompt || null };
}

app.get("/api/health", (_req, res) => {
  res.json({ configured: Boolean(process.env.SUDOCODE_API_KEY), baseUrl: apiBase });
});

app.get("/api/prompts", async (req, res) => {
  try {
    res.json({ prompts: await readPromptCache(await getPromptCacheFile()) });
  } catch (error) {
    sendError(req, res, 500, "读取本地提示词缓存失败。", { operation: "prompt_cache", ...errorDetails(error) });
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
    res.json({ prompts: generatedPrompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成新灵感失败。";
    sendError(req, res, 502, message, { operation: "prompt_generate", ...errorDetails(error) });
  }
});

app.get("/generated-images/:fileName", async (req, res, next) => {
  if (!isSafeGeneratedImageFileName(req.params.fileName)) {
    res.sendStatus(404);
    return;
  }
  try {
    const root = await getGeneratedImageDirectory();
    res.sendFile(req.params.fileName, { root, dotfiles: "deny" }, (error) => {
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
    res.json(await parseProviderResponse(response, req.requestId, "generate"));
  } catch (error) {
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
      res.json(await parseProviderResponse(response, req.requestId, "edit"));
    } catch (error) {
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
