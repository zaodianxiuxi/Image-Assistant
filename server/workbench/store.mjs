import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
const imageTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};
const textExtensions = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".log",
  ".xml",
  ".yaml",
  ".yml",
]);
export function fileKind(name) {
  const ext = path.extname(name).toLowerCase();
  return imageTypes[ext]
    ? "image"
    : ext === ".pdf"
      ? "pdf"
      : textExtensions.has(ext)
        ? "text"
        : "document";
}
export function fileMime(name) {
  const ext = path.extname(name).toLowerCase();
  return (
    imageTypes[ext] ||
    (ext === ".pdf"
      ? "application/pdf"
      : textExtensions.has(ext)
        ? "text/plain; charset=utf-8"
        : "application/octet-stream")
  );
}
export function cleanName(value) {
  let name = String(value || "未命名文件");
  if ([...name].every((c) => c.charCodeAt(0) <= 255)) {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    if (!decoded.includes("�")) name = decoded;
  }
  return (
    name
      .replaceAll(String.fromCharCode(92), "/")
      .split("/")
      .pop()
      .replace(/[\x00-\x1f<>:"|?*]/g, "_")
      .slice(0, 180) || "未命名文件"
  );
}
export class WorkbenchStore {
  constructor(directory) {
    this.directory = directory;
    this.state = {
      files: [],
      tasks: [],
      projects: [],
      notebooks: {},
      reading: {},
    };
    this.writes = Promise.resolve();
    this.ready = this.load();
  }
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      const parsed = JSON.parse(
        await readFile(path.join(this.directory, "index.json"), "utf8"),
      );
      if (!Array.isArray(parsed.files) || !Array.isArray(parsed.tasks))
        throw new Error("文件索引格式不正确。");
      this.state = {
        ...parsed,
        projects: parsed.projects || [],
        notebooks: parsed.notebooks || {},
        reading: parsed.reading || {},
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    let changed = false;
    for (const task of this.state.tasks) {
      if (task.status === "running" || task.status === "queued") {
        task.status = "failed";
        task.error = "服务重启，任务已中断。原文件保留，可重新转换。";
        task.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) await this.persist();
  }
  persist() {
    const next = this.writes
      .catch(() => {})
      .then(async () => {
        const temp = path.join(this.directory, "index.json.tmp");
        await writeFile(temp, JSON.stringify(this.state, null, 2));
        await rename(temp, path.join(this.directory, "index.json"));
      });
    this.writes = next;
    return next;
  }
  filePath(file) {
    return path.join(
      this.directory,
      "files",
      file.id,
      "asset" + path.extname(file.name).toLowerCase(),
    );
  }
  async addFile(source, name, extra = {}) {
    await this.ready;
    const safeName = cleanName(name);
    const metadata = {
      id: randomUUID(),
      name: safeName,
      size: (await stat(source)).size,
      kind: fileKind(safeName),
      createdAt: new Date().toISOString(),
      ...extra,
    };
    const destination = this.filePath(metadata);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    this.state.files.unshift(metadata);
    try {
      await this.persist();
    } catch (error) {
      this.state.files = this.state.files.filter((f) => f.id !== metadata.id);
      throw error;
    }
    return metadata;
  }
  async getFile(id) {
    await this.ready;
    return this.state.files.find((file) => file.id === id);
  }
  async list() {
    await this.ready;
    return {
      files: this.state.files,
      tasks: this.state.tasks,
      projects: this.state.projects,
      reading: Object.values(this.state.reading),
    };
  }
  async addTasks(files, target, quality) {
    await this.ready;
    const tasks = files.map((file) => ({
      id: randomUUID(),
      fileId: file.id,
      fileName: file.name,
      target,
      quality,
      status: "queued",
      outputIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    this.state.tasks.unshift(...tasks);
    await this.persist();
    return tasks;
  }
  async updateTask(id, patch) {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) return;
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return task;
  }
}
export class ConversionQueue {
  constructor(store, adapter) {
    this.store = store;
    this.adapter = adapter;
    this.busy = false;
  }
  kick() {
    if (!this.busy)
      void this.drain().catch((error) =>
        console.error("[workbench] queue persistence error:", error.message),
      );
  }
  async drain() {
    this.busy = true;
    try {
      await this.store.ready;
      let task;
      while (
        (task = this.store.state.tasks
          .filter((t) => t.status === "queued")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0])
      ) {
        await this.store.updateTask(task.id, {
          status: "running",
          error: undefined,
        });
        try {
          const file = await this.store.getFile(task.fileId);
          if (!file) throw new Error("找不到原文件。");
          const output = path.join(this.store.directory, "jobs", task.id);
          await mkdir(output, { recursive: true });
          const result = await this.adapter.convert(
            this.store.filePath(file),
            output,
            task.target,
            task.quality,
          );
          const records = [];
          for (const item of result.outputs) {
            const outputName =
              path.basename(file.name, path.extname(file.name)) +
              (result.outputs.length > 1 ? "-" + (records.length + 1) : "") +
              path.extname(item);
            records.push(
              await this.store.addFile(item, outputName, {
                sourceId: file.id,
                taskId: task.id,
              }),
            );
          }
          await this.store.updateTask(task.id, {
            status: "completed",
            outputIds: records.map((f) => f.id),
            warning: result.warning,
          });
        } catch (error) {
          await this.store.updateTask(task.id, {
            status: "failed",
            error: error.message || "转换失败。",
          });
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
