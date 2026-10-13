import test from "node:test";
import assert from "node:assert/strict";
import { buildPoetryImagePrompt, canReferencePoetryImage } from "./poetry-image-prompt.mjs";

const scene = { sceneOrder: 3, sourceLine: "明月松间照", mood: "清幽", prompt: "月光落在松枝上，背景林间幽暗。" };
test("poetry prompts use only the current scene and explicit direction", () => {
  const prompt = buildPoetryImagePrompt({ scene, styleGuide: "水墨留白", supplement: "采用淡彩水墨", characterBible: "渔翁穿蓑衣", continuityGuide: "同一季节" });
  assert.ok(prompt.includes(scene.prompt));
  assert.ok(prompt.includes("采用淡彩水墨"));
  assert.ok(prompt.includes("清幽"));
  assert.ok(!prompt.includes("上一镜"));
  assert.ok(!prompt.includes("自然写实摄影"));
});
test("an absent style gets a natural default without invented character", () => {
  const prompt = buildPoetryImagePrompt({ scene });
  assert.match(prompt, /自然写实摄影/);
  assert.doesNotMatch(prompt, /文士|幞头|青色长袍/);
});
test("previous image requires explicit continuation and immediate matching collection", () => {
  const previous = { nodeOrder: 2, seriesId: 7 };
  assert.equal(canReferencePoetryImage(scene, previous, 7), false);
  assert.equal(canReferencePoetryImage({ ...scene, referenceMode: "independent" }, previous, 7), false);
  assert.equal(canReferencePoetryImage({ ...scene, referenceMode: "continuation" }, previous, 7), true);
  assert.equal(canReferencePoetryImage({ ...scene, referenceMode: "continuation" }, { ...previous, nodeOrder: 1 }, 7), false);
  assert.equal(canReferencePoetryImage({ ...scene, referenceMode: "continuation" }, previous, 8), false);
  assert.equal(canReferencePoetryImage({ ...scene, referenceMode: "continuation" }, null, 7), false);
});
