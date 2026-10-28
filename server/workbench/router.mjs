import express from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FileeAdapter } from "./filee.mjs";
import { WorkbenchStore, ConversionQueue, fileMime } from "./store.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
export function createWorkbenchRouter({
  directory = path.join(root, ".local", "workbench"),
  adapter = new FileeAdapter(),
} = {}) {
  const router = express.Router();
  const store = new WorkbenchStore(directory);
  store.ready.catch(() => {});
  const queue = new ConversionQueue(store, adapter);
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, done) {
        const dir = path.join(directory, "incoming");
        mkdir(dir, { recursive: true }).then(() => done(null, dir), done);
      },
      filename(req, file, done) {
        done(null, randomUUID());
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024, files: 10, fields: 0 },
  });
  router.get("/state", async (req, res) => {
    const state = await store.list();
    res.json(state);
  });
  router.get("/engine", async (req, res) => res.json(await adapter.status()));
  router.post("/files", upload.array("files", 10), async (req, res) => {
    const received = req.files || [];
    if (!received.length)
      return res.status(400).json({ error: "请先选择文件。" });
    const saved = [];
    try {
      for (const file of received)
        saved.push(await store.addFile(file.path, file.originalname));
      res.status(201).json({ files: saved });
    } catch (error) {
      error.message = "已保存 " + saved.length + " 个文件；" + error.message;
      throw error;
    } finally {
      await Promise.all(
        received.map((file) => unlink(file.path).catch(() => {})),
      );
    }
  });
  router.get("/files/:id/targets", async (req, res) => {
    const file = await store.getFile(req.params.id);
    if (!file) return res.status(404).json({ error: "文件不存在。" });
    res.json(await adapter.targets(file.name));
  });
  router.get("/files/:id/text", async (req, res) => {
    const file = await store.getFile(req.params.id);
    if (!file) return res.status(404).json({ error: "文件不存在。" });
    if (file.kind !== "text")
      return res.status(400).json({ error: "此文件不是文本。" });
    const handle = await open(store.filePath(file), "r");
    try {
      const limit = 1024 * 1024;
      const buffer = Buffer.alloc(Math.min(file.size, limit));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      let bytes = buffer.subarray(0, bytesRead);
      const encoding =
        bytes[0] === 255 && bytes[1] === 254
          ? "utf-16le"
          : bytes[0] === 254 && bytes[1] === 255
            ? "utf-16be"
            : "utf-8";
      let text = new TextDecoder(encoding).decode(bytes);
      if (encoding === "utf-8" && text.includes("�"))
        text = new TextDecoder("gb18030").decode(bytes);
      res.json({ text, truncated: file.size > limit });
    } finally {
      await handle.close();
    }
  });
  router.get("/files/:id/content", async (req, res) => {
    const file = await store.getFile(req.params.id);
    if (!file) return res.status(404).json({ error: "文件不存在。" });
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "private, no-store");
    if (req.query.download === "1" || file.kind === "document")
      return res.download(store.filePath(file), file.name, {
        dotfiles: "allow",
      });
    res.set("Content-Type", fileMime(file.name));
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'self'",
    );
    res.set(
      "Content-Disposition",
      "inline; filename*=UTF-8''" + encodeURIComponent(file.name),
    );
    res.sendFile(store.filePath(file), { dotfiles: "allow" });
  });
  router.post("/tasks", async (req, res) => {
    const { fileIds, target, quality = 85 } = req.body || {};
    if (
      !Array.isArray(fileIds) ||
      !fileIds.length ||
      fileIds.length > 20 ||
      fileIds.some((id) => typeof id !== "string") ||
      typeof target !== "string" ||
      !Number.isInteger(quality) ||
      quality < 1 ||
      quality > 100
    )
      return res
        .status(400)
        .json({ error: "请选择 1–20 个文件、目标格式和有效质量。" });
    await store.ready;
    if (
      store.state.tasks.filter((t) => ["queued", "running"].includes(t.status))
        .length +
        fileIds.length >
      40
    )
      return res
        .status(429)
        .json({ error: "当前排队任务较多，请等部分任务完成后再试。" });
    const files = await Promise.all(
      [...new Set(fileIds)].map((id) => store.getFile(id)),
    );
    if (files.some((f) => !f))
      return res.status(404).json({ error: "部分原文件已不存在。" });
    for (const file of files) {
      const capability = await adapter.targets(file.name);
      if (!capability.targets.some((t) => t.id === target))
        return res
          .status(400)
          .json({
            error:
              file.name + "：" + (capability.message || "此格式不可转换。"),
          });
    }
    const tasks = await store.addTasks(files, target, quality);
    queue.kick();
    res.status(202).json({ tasks });
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "单个文件最大 50 MB。"
        : error.code === "LIMIT_FILE_COUNT" ||
            error.code === "LIMIT_UNEXPECTED_FILE"
          ? "每次最多上传 10 个文件。"
          : error.message || "文件工作区暂时不可用。";
    res
      .type("application/json")
      .status(error instanceof multer.MulterError ? 413 : 500)
      .json({ error: message });
  });
  return router;
}
