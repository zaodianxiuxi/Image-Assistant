import test from "node:test";
import assert from "node:assert/strict";
import { applyImageQuality, normalizeImageQuality } from "./image-quality.mjs";
import { buildPoetryImagePrompt } from "./poetry-image-prompt.mjs";

test("missing or invalid saved preferences fall back to balanced", () => {
  for (const value of [null, undefined, "", "corrupt", {}, "toString"]) {
    assert.equal(normalizeImageQuality(value), "balanced");
  }
  for (const value of ["balanced", "bright", "original"]) assert.equal(normalizeImageQuality(value), value);
});

test("original and edit preserve the user's exact text", () => {
  const prompt = "  深夜水墨剪影\n留白，保留笔触。  ";
  assert.equal(applyImageQuality(prompt, "original"), prompt);
  assert.equal(applyImageQuality(prompt, "bright", "edit"), prompt);
});

test("gentle rendering retains explicit style and night intent with readable midtones", () => {
  const prompt = "深夜水墨，窗前剪影，保留笔触。";
  const result = applyImageQuality(prompt, "balanced");
  assert.ok(result.startsWith(prompt));
  assert.match(result, /中间调/);
  assert.match(result, /不.*压暗/);
  assert.match(result, /夜景.*白天/);
  assert.match(result, /明确.*优先/);
  assert.doesNotMatch(result, /自然写实摄影/);
});

test("reusing history replaces a previous preset instead of stacking directions", () => {
  const source = "  雨后树林，天空微亮。\n";
  const balanced = applyImageQuality(source, "balanced");
  assert.equal(applyImageQuality(balanced, "balanced"), balanced);
  assert.equal(applyImageQuality(balanced, "bright"), applyImageQuality(source, "bright"));
  assert.equal(applyImageQuality(balanced, "original"), source);
  assert.equal(applyImageQuality(balanced, "bright", "edit"), balanced);
});

test("poetry output and planning supplement use the same selected direction", () => {
  const scene = { sceneOrder: 1, sourceLine: "明月松间照", mood: "清幽", prompt: "深夜松林，水墨留白。" };
  for (const quality of ["balanced", "bright"]) {
    const result = buildPoetryImagePrompt({ scene, quality, styleGuide: "水墨" });
    const direction = applyImageQuality("", quality);
    assert.ok(result.endsWith(direction));
    assert.ok(result.includes(scene.prompt));
    assert.doesNotMatch(result, /自然写实摄影/);
  }
  const original = buildPoetryImagePrompt({ scene, quality: "original" });
  assert.doesNotMatch(original, /默认视觉|出图偏好|不为看清人脸强行补光/);
});
