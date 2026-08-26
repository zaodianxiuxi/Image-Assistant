import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readPromptCache, validatePromptCandidates, writePromptCache } from "./prompt-cache.mjs";

const promptText = "未来城市的中文复杂图像提示词，包含主体、环境、光影、镜头、材质和构图控制。".repeat(4);

function candidate(index = 1) {
  return { title: `云港实验室 ${index}`, category: "未来建筑", size: "1536x864", prompt: `${promptText}${index}` };
}

test("keeps only valid Chinese prompt candidates and removes existing prompts", () => {
  const valid = candidate();
  const output = validatePromptCandidates([
    valid,
    { ...valid, size: "100x100" },
    { ...valid, title: "English title", category: "English", prompt: "English prompt ".repeat(20) }
  ], [valid]);

  assert.deepEqual(output, []);
  assert.equal(validatePromptCandidates([valid], []).length, 1);
});

test("writes only the newest 120 valid prompt cache entries", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "image-assistant-prompts-"));
  const cacheFile = path.join(directory, "prompt-cache.json");
  try {
    await writePromptCache(cacheFile, Array.from({ length: 125 }, (_, index) => candidate(index)));
    const cached = await readPromptCache(cacheFile);

    assert.equal(cached.length, 120);
    assert.equal(cached[0].title, "云港实验室 0");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
