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

test("provides zoom controls and a larger scrollable image preview", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /previewZoom/);
  assert.match(source, /function changePreviewZoom\(delta: number\)/);
  assert.match(source, /aria-label="缩小图片"/);
  assert.match(source, /aria-label="放大图片"/);
  assert.match(source, /aria-label="重置图片大小"/);
  assert.match(source, /style=\{\{ transform: `scale\(\$\{previewZoom\}\)` \}\}/);
  assert.match(styles, /\.image-preview-dialog \{[^}]*width: min\(1800px, 100%\)/);
  assert.match(styles, /\.image-preview-media \{[^}]*overflow: auto/);
  assert.match(source, /image-preview-media\$\{previewZoom > 1/);
  assert.match(styles, /\.image-preview-media\.is-zoomed img \{[^}]*transform-origin: top left/);
  assert.match(source, /function handlePreviewWheel\(event: WheelEvent\)/);
  assert.match(source, /event\.ctrlKey/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /media\.addEventListener\("wheel", handlePreviewWheel, \{ passive: false \}\)/);
  assert.match(source, /function handlePreviewPointerDown\(event: ReactPointerEvent<HTMLDivElement>\)/);
  assert.match(source, /onPointerMove=\{handlePreviewPointerMove\}/);
  assert.match(source, /onPointerUp=\{handlePreviewPointerUp\}/);
  assert.match(source, /draggable=\{false\}/);
  assert.match(styles, /\.image-preview-media\.is-zoomed \{[^}]*cursor: grab/);
});

test("provides a local API key configuration page without exposing the saved key", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /function openApiSettings\(\)/);
  assert.match(source, /\/api\/settings\/api-key/);
  assert.match(source, /type=\{apiKeyVisible \? "text" : "password"\}/);
  assert.match(source, /autoComplete="off"/);
  assert.match(source, /aria-label="打开 API 配置"/);
  assert.match(source, /setApiKeyInput\(""\)/);
  assert.match(styles, /\.api-settings-backdrop \{[^}]*place-items: stretch end/);
  assert.match(styles, /\.api-settings-dialog \{[^}]*width: 70vw; height: 100dvh/);
  assert.match(styles, /@keyframes api-settings-drawer-in/);
  assert.match(styles, /\.api-key-input-wrap input:focus/);
});

test("gives the image preview scrollbars a dedicated dark interactive style", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.image-preview-media \{[\s\S]*scrollbar-gutter: stable/);
  assert.match(styles, /\.image-preview-media \{[\s\S]*scrollbar-color: #667085 #171b24/);
  assert.match(styles, /\.image-preview-media::-webkit-scrollbar \{ width: 10px; height: 10px; \}/);
  assert.match(styles, /\.image-preview-media::-webkit-scrollbar-thumb:hover \{ background: #8cb0ff/);
  assert.match(styles, /\.image-preview-media::-webkit-scrollbar-corner \{ background: #0e1117; \}/);
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

test("supports collapsing gallery series groups independently from nodes", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /collapsedGalleryGroups/);
  assert.match(source, /function toggleGalleryGroup\(key: string\)/);
  assert.match(source, /className="gallery-group-toggle"/);
  assert.match(source, /aria-expanded=\{!groupCollapsed\}/);
  assert.match(source, /!groupCollapsed && <div className="gallery-node-groups"/);
  assert.match(styles, /\.gallery-group-toggle/);
  assert.match(styles, /\.gallery-group-toggle svg\.is-collapsed/);
});

test("starts saved gallery series groups collapsed", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");

  assert.match(source, /const galleryCollapseInitialized = useRef\(false\)/);
  assert.match(source, /if \(galleryCollapseInitialized\.current \|\| historyLoading \|\| !groupedHistory\.length\) return/);
  assert.match(source, /setCollapsedGalleryGroups\(new Set\(groupedHistory\.map\(\(group\) => group\.key\)\)\)/);
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

test("clears the carried prompt when canceling a continued history edit", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");

  assert.match(source, /const cancelingHistoryEdit = referenceImages\.length === 1 && Boolean\(versionParent\)/);
  assert.match(source, /if \(cancelingHistoryEdit\) \{[\s\S]*handlePromptChange\(""\);[\s\S]*setVersionParent\(null\);/);
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

test("keeps the desktop workbench fixed and uses a readable Chinese type scale", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /font-family: .*Microsoft YaHei UI.*Microsoft YaHei.*PingFang SC/);
  assert.doesNotMatch(styles, /@import url\("https:\/\/fonts\.googleapis\.com/);
  assert.match(styles, /\.topbar \{[^}]*position: sticky/);
  assert.match(styles, /\.control-panel \{[^}]*position: sticky/);
  assert.match(styles, /\.workspace \{[^}]*height: calc\(100dvh/);
  assert.match(styles, /\.workspace > \.canvas-panel \{[^}]*overflow: auto/);
  assert.match(styles, /\.field-label \{[^}]*font-size: 13px/);
  assert.match(styles, /\.prompt-box textarea \{[^}]*font-size: 14px/);
  assert.match(styles, /@media \(max-width: 850px\)[\s\S]*\.workspace \{[^}]*height: auto/);
});

test("keeps gallery thumbnails compact and gives scroll containers a visible scrollbar", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.history-grid \{[^}]*minmax\(180px, 1fr\)/);
  assert.match(styles, /\.workspace > \.canvas-panel::-webkit-scrollbar/);
  assert.match(styles, /\.control-panel::-webkit-scrollbar-thumb/);
  assert.match(styles, /\.history-prompt \{[^}]*font-size: 13px/);
  assert.match(styles, /\.history-actions button \{[^}]*font-size: 11px/);
  assert.match(styles, /\.workspace > \.canvas-panel::-webkit-scrollbar-thumb:hover/);
});

test("makes the style extraction workbench readable and less dense", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.style-workbench-toolbar strong \{[^}]*font-size: 15px/);
  assert.match(styles, /\.style-workbench-section \{[^}]*padding: 20px/);
  assert.match(styles, /\.style-section-heading strong \{[^}]*font-size: 13px/);
  assert.match(styles, /\.style-analysis-field strong, \.style-compose-field strong \{[^}]*font-size: 13px/);
  assert.match(styles, /\.style-analysis-field small, \.style-compose-field small \{[^}]*font-size: 11px/);
  assert.match(styles, /\.style-analysis-field textarea, \.style-compose-field textarea \{[^}]*font-size: 13px/);
  assert.match(styles, /\.style-inline-actions button, \.style-save-profile, \.style-compose-button, \.style-apply-button, \.style-series-placeholder button \{[^}]*font-size: 12px/);
});

test("presents the style extraction workbench as a larger right-side drawer", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.style-workbench-backdrop \{[^}]*place-items: stretch end/);
  assert.match(styles, /\.style-workbench \{[^}]*width: 70vw/);
  assert.doesNotMatch(styles, /\.style-workbench \{[^}]*1080px/);
  assert.match(styles, /\.style-workbench \{[^}]*height: 100%/);
  assert.match(styles, /\.style-workbench \{[^}]*border-radius: 14px 0 0 14px/);
  assert.match(styles, /@keyframes style-drawer-in/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.style-workbench \{[^}]*width: 100%[^}]*border-radius: 0/);
});

test("places style extraction in the right extension rail", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(source, /className="extension-rail"/);
  assert.match(source, /aria-label="扩展功能"/);
  assert.match(source, /className="extension-tool active"/);
  assert.match(source, /onClick=\{\(\) => setStyleWorkbenchOpen\(true\)\}/);
  assert.match(source, /从图片提取风格/);
  const promptLabelBlock = source.slice(source.indexOf('className="prompt-label-actions"'), source.indexOf('className="prompt-box"'));
  assert.doesNotMatch(promptLabelBlock, /从图片提取风格/);
  assert.match(source, /反推提示词/);
  assert.match(source, /画面变体/);
  assert.match(styles, /\.extension-rail \{/);
  assert.match(styles, /\.extension-tool \{/);
  assert.match(styles, /@media \(max-width: 850px\)[\s\S]*\.extension-rail/);
});

test("keeps the extension rail and workspace spacing compact", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.workspace \{ grid-template-columns: 360px minmax\(0, 1fr\) 50px; gap: clamp\(8px, 1vw, 14px\)/);
  assert.match(styles, /\.extension-tool \{[^}]*width: 44px; height: 44px/);
  assert.match(styles, /\.extension-rail \{[^}]*gap: 8px[^}]*padding-top: 28px/);
  assert.match(styles, /\.app-shell \{[^}]*padding: 0 clamp\(14px, 1\.8vw, 28px\)/);
});

test("keeps extension labels hidden until a tool is hovered or focused", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /className="extension-rail-heading"/);
  assert.match(source, /className="extension-tool-label"/);
  assert.match(source, /data-label="从图片提取风格"/);
  assert.match(styles, /\.extension-tool-label \{[^}]*position: absolute/);
  assert.match(styles, /\.extension-tool:hover::after/);
  assert.match(styles, /\.extension-tool:focus-visible::after/);
  assert.match(styles, /transform: scale\(1\.06\)/);
});

test("presents the prompt library and series manager as right-side drawers", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.manager-backdrop \{[^}]*place-items: stretch end[^}]*padding: 0/);
  assert.match(styles, /\.manager-dialog \{[^}]*width: 70vw; height: 100dvh/);
  assert.match(styles, /\.manager-dialog \{[^}]*max-height: none/);
  assert.match(styles, /\.manager-dialog \{[^}]*border-radius: 12px 0 0 12px/);
  assert.match(styles, /@keyframes manager-drawer-in/);
  assert.match(styles, /\.manager-dialog \{[^}]*animation: manager-drawer-in \.32s ease-out/);
  assert.match(styles, /\.manager-dialog \{[^}]*will-change: transform/);
  assert.match(styles, /from \{ opacity: \.72; transform: translateX\(100%\)/);
  assert.match(source, /managerClosing/);
  assert.match(source, /managerClosing === "library" \? " closing" : ""/);
  assert.match(source, /managerClosing === "series" \? " closing" : ""/);
  assert.match(styles, /\.manager-backdrop\.closing \.manager-dialog/);
  assert.match(styles, /@keyframes manager-drawer-out/);
  assert.match(styles, /animation: manager-drawer-out \.28s ease-in/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.manager-backdrop \{[^}]*place-items: stretch/);
});
