import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkbenchStore, ConversionQueue, cleanName } from "./store.mjs";
async function setup(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "workbench-test-"));
  t.after(async () => {
    if (
      path.dirname(directory) === path.resolve(os.tmpdir()) &&
      path.basename(directory).startsWith("workbench-test-")
    )
      await rm(directory, { recursive: true, force: true });
  });
  return directory;
}
test("imported files use independent paths and preserve originals across reload", async (t) => {
  const dir = await setup(t);
  const source = path.join(dir, "original.txt");
  await writeFile(source, "原文");
  const store = new WorkbenchStore(path.join(dir, "data"));
  const file = await store.addFile(source, "../../资料.txt");
  assert.equal(file.name, "资料.txt");
  assert.equal(await readFile(source, "utf8"), "原文");
  assert.equal(await readFile(store.filePath(file), "utf8"), "原文");
  const loaded = new WorkbenchStore(path.join(dir, "data"));
  assert.equal((await loaded.list()).files[0].id, file.id);
  assert.equal(
    cleanName("folder" + String.fromCharCode(92) + "notes.txt"),
    "notes.txt",
  );
});
test("restarting marks unfinished tasks interrupted without touching files", async (t) => {
  const dir = await setup(t);
  const store = new WorkbenchStore(dir);
  await store.ready;
  await store.addTasks([{ id: "file", name: "notes.txt" }], "pdf", 85);
  const loaded = new WorkbenchStore(dir);
  assert.equal((await loaded.list()).tasks[0].status, "failed");
  assert.match(loaded.state.tasks[0].error, /重启/);
});
test("queue saves converted results and reports failed jobs separately", async (t) => {
  const dir = await setup(t);
  const input = path.join(dir, "input.txt");
  await writeFile(input, "hello");
  const store = new WorkbenchStore(path.join(dir, "data"));
  const file = await store.addFile(input, "notes.txt");
  await store.addTasks([file], "pdf", 85);
  await store.addTasks([file], "png", 85);
  const adapter = {
    async convert(source, output, target) {
      if (target === "png") throw Error("引擎不可用");
      const result = path.join(output, "result.pdf");
      await writeFile(result, "test result");
      return { outputs: [result], warning: "测试提示" };
    },
  };
  await new ConversionQueue(store, adapter).drain();
  const tasks = store.state.tasks;
  assert.equal(tasks.find((t) => t.target === "pdf").status, "completed");
  assert.equal(tasks.find((t) => t.target === "png").status, "failed");
  const resultFile = store.state.files.find((f) => f.sourceId === file.id);
  assert.equal(resultFile.name, "notes.pdf");
  assert.equal(await readFile(store.filePath(file), "utf8"), "hello");
});
