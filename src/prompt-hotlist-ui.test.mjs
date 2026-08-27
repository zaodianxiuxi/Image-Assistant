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
  assert.match(source, /promptIdeasStatus/);
  assert.match(source, /role="status"/);
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

test("groups saved images by series and puts legacy records in 其他", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /const groupedHistory = useMemo\(\(\) => groupHistoryRecords\(history\), \[history\]\)/);
  assert.match(source, /className="gallery-groups"/);
  assert.match(source, /className="gallery-group"/);
  assert.match(styles, /\.gallery-groups \{[^}]*gap: 22px/);
  assert.match(styles, /\.gallery-group-heading/);
});

test("renders saved images in a series and node hierarchy", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /from "\.\/gallery-groups\.mjs"/);
  assert.match(source, /groupHistoryRecords\(history\)/);
  assert.match(source, /group\.nodes\.map/);
  assert.match(source, /className="gallery-node-groups"/);
  assert.match(source, /className="gallery-node-group"/);
  assert.match(source, /node\.items\.map\(renderHistoryItem\)/);
  assert.match(styles, /\.gallery-node-groups/);
  assert.match(styles, /\.gallery-node-heading/);
});

test("shows each gallery image prompt and supports collapsing nodes", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /collapsedGalleryNodes/);
  assert.match(source, /aria-expanded=\{!nodeCollapsed\}/);
  assert.match(source, /className="gallery-node-toggle"/);
  assert.match(source, /className="history-prompt"/);
  assert.match(source, /title=\{item\.prompt\}/);
  assert.match(styles, /\.gallery-node-toggle/);
  assert.match(styles, /\.history-prompt/);
});

test("connects history images to editing and delivery-version actions", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /from "\.\/image-version-session\.mjs"/);
  assert.match(source, /continueEditing\(item\)/);
  assert.match(source, /setDeliveryVersion\(item\)/);
  assert.match(source, new RegExp("/api/library/images/versions/"));
  assert.match(source, /versionNumber/);
  assert.match(source, /isDelivery/);
  assert.match(source, /继续编辑/);
  assert.match(source, /设为交付版本/);
  assert.match(styles, /\.history-edit-button/);
  assert.match(styles, /\.delivery-badge/);
});

test("provides a persistent three-theme menu for the full-width workspace", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /type Theme = "light" \| "dark" \| "studio"/);
  assert.match(source, /themeMenuOpen/);
  assert.match(source, /className="theme-menu"/);
  assert.match(source, /明亮工作台/);
  assert.match(source, /深色专业/);
  assert.match(source, /暖灰编辑室/);
  assert.match(styles, /--surface-page:/);
  assert.match(styles, /:root\[data-theme="studio"\]/);
  assert.match(styles, /\.app-shell \{[^}]*max-width: none/);
  assert.match(styles, /\.workspace \{[^}]*grid-template-columns: 360px/);
});

test("opens a structured image-to-prompt workbench without automatic generation", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const workbench = await readFile(new URL("./StyleWorkbench.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /从图片提取风格/);
  assert.match(source, /databaseConfigured/);
  assert.match(workbench, /\/api\/styles\/analyze/);
  assert.match(workbench, /\/api\/styles\/compose/);
  assert.match(workbench, /原图内容/);
  assert.match(workbench, /构图与画面组织/);
  assert.match(workbench, /新的画面内容/);
  assert.match(workbench, /优化组合/);
  assert.match(workbench, /应用到提示词/);
  assert.match(workbench, /保存为本地模板/);
  assert.match(workbench, /连接 MySQL 后可用/);
  assert.doesNotMatch(workbench, /\/api\/images\/(?:generate|edit)/);
  assert.match(styles, /\.style-workbench/);
});
