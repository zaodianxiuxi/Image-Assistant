import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the daily prompt hotlist and fills the selected prompt", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const declaration = await readFile(new URL("./prompt-hotlist.d.mts", import.meta.url), "utf8");

  assert.match(source, /from "\.\/prompt-hotlist\.mjs"/);
  assert.match(source, /今日提示词热榜/);
  assert.match(source, /getDailyPromptHotlist\(new Date\(\), 6, hotlistRefreshIndex, extraPrompts\)/);
  assert.match(source, /onClick=\{\(\) => setPrompt\(item\.prompt\)\}/);
  assert.match(declaration, /export function getDailyPromptHotlist/);
});

test("provides an icon-only local refresh action for the prompt hotlist", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /hotlistRefreshIndex/);
  assert.match(source, /aria-label="刷新今日提示词"/);
  assert.match(source, /setHotlistRefreshIndex\(\(value\) => value \+ 1\)/);
  assert.match(styles, /\.hotlist-refresh/);
});

test("provides a guarded action to generate and merge new prompt ideas", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /handleGeneratePromptIdeas/);
  assert.match(source, /promptIdeasLoading/);
  assert.match(source, /\/api\/prompts\/generate/);
  assert.match(source, /disabled=\{promptIdeasLoading\}/);
  assert.match(source, /\/api\/prompts/);
  assert.match(styles, /\.hotlist-generate/);
});

test("opens generated and history images in a resilient preview with a saved theme", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /function openPreview\(result: Result\)/);
  assert.match(source, /onClick=\{\(\) => openPreview\(current\)\}/);
  assert.match(source, /onClick=\{\(\) => \{ setCurrent\(item\); openPreview\(item\); \}\}/);
  assert.match(source, /onError=\{handleImageError\}/);
  assert.match(source, /图片加载失败/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /localStorage\.setItem\("image-assistant-theme"/);
  assert.match(source, /Moon/);
  assert.match(source, /Sun/);
  assert.match(styles, /\.result-preview-trigger img \{[^}]*object-fit: contain/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("keeps complete thumbnails visible and frames the result image inside the canvas", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.history-item img \{[^}]*object-fit: contain/);
  assert.match(styles, /\.result-preview-trigger \{[^}]*padding: clamp\(24px, 5vw, 72px\)/);
  assert.match(styles, /\.result-preview-trigger img \{[^}]*max-width: min\(100%, 900px\)[^}]*max-height: min\(100%, 620px\)/);
});
