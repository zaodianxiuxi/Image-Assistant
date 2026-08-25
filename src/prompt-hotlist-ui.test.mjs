import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the daily prompt hotlist and fills the selected prompt", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const declaration = await readFile(new URL("./prompt-hotlist.d.mts", import.meta.url), "utf8");

  assert.match(source, /from "\.\/prompt-hotlist\.mjs"/);
  assert.match(source, /今日提示词热榜/);
  assert.match(source, /getDailyPromptHotlist\(\)/);
  assert.match(source, /onClick=\{\(\) => setPrompt\(item\.prompt\)\}/);
  assert.match(declaration, /export function getDailyPromptHotlist/);
});
