import { randomUUID } from "node:crypto";
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const now = () => new Date().toISOString();
export class ProjectStore {
  constructor(store) {
    this.store = store;
    this.writes = Promise.resolve();
  }
  async scope(id, fileId) {
    await this.store.ready;
    const project =
      id === "library"
        ? null
        : this.store.state.projects.find((p) => p.id === id);
    if (id !== "library" && !project) throw fail("项目不存在。", 404);
    if (
      fileId !== "overview" &&
      (!this.store.state.files.some((f) => f.id === fileId) ||
        (project && !project.fileIds.includes(fileId)))
    )
      throw fail("这份文件不在当前项目中。", 404);
    return project;
  }
  mutate(action) {
    const next = this.writes
      .catch(() => {})
      .then(async () => {
        await this.store.ready;
        const before = structuredClone({
          projects: this.store.state.projects,
          notebooks: this.store.state.notebooks,
          reading: this.store.state.reading,
        });
        try {
          const result = await action();
          await this.store.persist();
          return structuredClone(result);
        } catch (error) {
          Object.assign(this.store.state, before);
          throw error;
        }
      });
    this.writes = next;
    return next;
  }
  name(value) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 80)
      throw fail("项目名称需为 1–80 个字符。");
    return value.trim();
  }
  create(name) {
    const clean = this.name(name);
    return this.mutate(() => {
      const project = {
        id: randomUUID(),
        name: clean,
        fileIds: [],
        createdAt: now(),
        updatedAt: now(),
      };
      this.store.state.projects.unshift(project);
      return project;
    });
  }
  rename(id, name) {
    const clean = this.name(name);
    return this.mutate(async () => {
      const p = await this.scope(id, "overview");
      if (!p) throw fail("不能修改文件库名称。");
      p.name = clean;
      p.updatedAt = now();
      return p;
    });
  }
  addFiles(id, fileIds) {
    if (
      !Array.isArray(fileIds) ||
      !fileIds.length ||
      fileIds.length > 100 ||
      fileIds.some((x) => typeof x !== "string")
    )
      throw fail("每次请选择 1–100 个文件。");
    return this.mutate(async () => {
      const p = await this.scope(id, "overview");
      if (!p) throw fail("请选择项目。");
      if (
        fileIds.some((id) => !this.store.state.files.some((f) => f.id === id))
      )
        throw fail("部分文件不存在。", 404);
      p.fileIds = [...new Set([...p.fileIds, ...fileIds])];
      p.updatedAt = now();
      return p;
    });
  }
  async notebook(scope, fileId) {
    await this.scope(scope, fileId);
    return structuredClone(
      this.store.state.notebooks[scope + ":" + fileId] || {
        scope,
        fileId,
        body: "",
        excerpts: [],
        revision: 0,
        updatedAt: null,
      },
    );
  }
  saveNotebook(scope, fileId, input) {
    if (
      !Number.isInteger(input.revision) ||
      input.revision < 0 ||
      typeof input.body !== "string" ||
      input.body.length > 100000 ||
      !Array.isArray(input.excerpts) ||
      input.excerpts.length > 200
    )
      throw fail("笔记最多 10 万字、200 条摘录，请缩小内容后保存。");
    const excerpts = input.excerpts.map((item) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        item.id.length > 80 ||
        typeof item.text !== "string" ||
        !item.text.trim() ||
        item.text.length > 10000 ||
        (item.page !== undefined &&
          (!Number.isInteger(item.page) ||
            item.page < 1 ||
            item.page > 100000)) ||
        (item.offset !== undefined &&
          (!Number.isFinite(item.offset) || item.offset < 0 || item.offset > 1))
      )
        throw fail("摘录内容或来源位置无效。");
      return {
        id: item.id,
        text: item.text,
        ...(item.page ? { page: item.page } : {}),
        ...(item.offset !== undefined ? { offset: item.offset } : {}),
      };
    });
    return this.mutate(async () => {
      await this.scope(scope, fileId);
      const key = scope + ":" + fileId;
      const revision = this.store.state.notebooks[key]?.revision || 0;
      if (revision !== input.revision)
        throw fail(
          "笔记已在另一窗口更新。当前草稿已保留，请先合并最新版本。",
          409,
        );
      const note = {
        scope,
        fileId,
        body: input.body,
        excerpts,
        revision: revision + 1,
        updatedAt: now(),
      };
      this.store.state.notebooks[key] = note;
      return note;
    });
  }
  saveReading(scope, fileId, input) {
    if (
      !Number.isInteger(input.page) ||
      input.page < 1 ||
      input.page > 100000 ||
      !Number.isFinite(input.offset) ||
      input.offset < 0 ||
      input.offset > 1 ||
      !Number.isFinite(input.zoom) ||
      input.zoom < 25 ||
      input.zoom > 200
    )
      throw fail("阅读位置无效。");
    return this.mutate(async () => {
      const p = await this.scope(scope, fileId);
      if (fileId === "overview") throw fail("请选择文件。");
      const record = {
        scope,
        fileId,
        page: input.page,
        offset: input.offset,
        zoom: input.zoom,
        updatedAt: now(),
      };
      this.store.state.reading[scope + ":" + fileId] = record;
      if (p) {
        p.lastFileId = fileId;
        p.updatedAt = record.updatedAt;
      }
      return record;
    });
  }
}
export function registerProjectRoutes(router, store) {
  const projects = new ProjectStore(store);
  router.post("/projects", async (req, res) =>
    res.status(201).json(await projects.create(req.body?.name)),
  );
  router.patch("/projects/:id", async (req, res) =>
    res.json(await projects.rename(req.params.id, req.body?.name)),
  );
  router.post("/projects/:id/files", async (req, res) =>
    res.json(await projects.addFiles(req.params.id, req.body?.fileIds)),
  );
  router.get("/notebooks/:scope/:fileId", async (req, res) =>
    res.json(await projects.notebook(req.params.scope, req.params.fileId)),
  );
  router.put("/notebooks/:scope/:fileId", async (req, res) =>
    res.json(
      await projects.saveNotebook(
        req.params.scope,
        req.params.fileId,
        req.body || {},
      ),
    ),
  );
  router.put("/reading/:scope/:fileId", async (req, res) =>
    res.json(
      await projects.saveReading(
        req.params.scope,
        req.params.fileId,
        req.body || {},
      ),
    ),
  );
}
