import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { WorkbenchStore } from "./store.mjs";
import { ProjectStore } from "./projects.mjs";
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "workbench-project-"));
  t.after(async () => {
    if (
      path.dirname(dir) === path.resolve(os.tmpdir()) &&
      path.basename(dir).startsWith("workbench-project-")
    )
      await rm(dir, { recursive: true, force: true });
  });
  return dir;
}
test("legacy indexes retain files and tasks while projects, notes and reading survive reload", async (t) => {
  const dir = await fixture(t);
  await writeFile(
    path.join(dir, "index.json"),
    JSON.stringify({ files: [{ id: "sample", name: "notes.txt" }], tasks: [] }),
  );
  const store = new WorkbenchStore(dir),
    projects = new ProjectStore(store);
  assert.deepEqual((await store.list()).projects, []);
  const project = await projects.create("  阅读计划  ");
  await projects.addFiles(project.id, ["sample", "sample"]);
  assert.equal(store.state.projects[0].fileIds.length, 1);
  await projects.saveNotebook(project.id, "sample", {
    revision: 0,
    body: "第一份笔记",
    excerpts: [{ id: "quote", text: "原文", page: 3 }],
  });
  await projects.saveReading(project.id, "sample", {
    page: 3,
    offset: 0.4,
    zoom: 125,
  });
  const reload = new WorkbenchStore(dir);
  const data = await reload.list();
  assert.equal(data.files[0].id, "sample");
  assert.equal(data.projects[0].lastFileId, "sample");
  assert.equal(data.reading[0].page, 3);
  assert.equal(
    (await new ProjectStore(reload).notebook(project.id, "sample")).excerpts[0]
      .page,
    3,
  );
});
test("concurrent notebook edits cannot silently overwrite another saved revision", async (t) => {
  const store = new WorkbenchStore(await fixture(t)),
    projects = new ProjectStore(store);
  const project = await projects.create("草稿冲突");
  const results = await Promise.allSettled([
    projects.saveNotebook(project.id, "overview", {
      revision: 0,
      body: "窗口一",
      excerpts: [],
    }),
    projects.saveNotebook(project.id, "overview", {
      revision: 0,
      body: "窗口二",
      excerpts: [],
    }),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(results[1].reason.status, 409);
  assert.equal(
    (await projects.notebook(project.id, "overview")).body,
    "窗口一",
  );
});
test("one file can belong to several projects with independent notes and scope validation", async (t) => {
  const dir = await fixture(t),
    store = new WorkbenchStore(dir),
    projects = new ProjectStore(store);
  await store.ready;
  store.state.files.push({ id: "a", name: "a.pdf" });
  const first = await projects.create("A"),
    second = await projects.create("B");
  await projects.addFiles(first.id, ["a"]);
  await assert.rejects(
    projects.notebook(second.id, "a"),
    (e) => e.status === 404,
  );
  await projects.addFiles(second.id, ["a"]);
  await projects.saveNotebook(first.id, "a", {
    revision: 0,
    body: "A的理解",
    excerpts: [],
  });
  assert.equal((await projects.notebook(second.id, "a")).body, "");
  assert.throws(
    () =>
      projects.saveReading(first.id, "a", { page: 0, offset: 0, zoom: 100 }),
    /无效/,
  );
});
test("failed notebook disk writes roll back the in-memory revision for a safe retry", async (t) => {
  const store = new WorkbenchStore(await fixture(t)),
    projects = new ProjectStore(store);
  const project = await projects.create("保存失败");
  const persist = store.persist.bind(store);
  store.persist = async () => {
    throw new Error("disk full");
  };
  await assert.rejects(
    projects.saveNotebook(project.id, "overview", {
      revision: 0,
      body: "保留草稿",
      excerpts: [],
    }),
    /disk full/,
  );
  assert.equal((await projects.notebook(project.id, "overview")).revision, 0);
  store.persist = persist;
  assert.equal(
    (
      await projects.saveNotebook(project.id, "overview", {
        revision: 0,
        body: "保留草稿",
        excerpts: [],
      })
    ).revision,
    1,
  );
});
