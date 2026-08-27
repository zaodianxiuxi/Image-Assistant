import assert from "node:assert/strict";
import test from "node:test";
import {
  STYLE_PROFILE_STORAGE_KEY,
  createStyleProfile,
  parseStyleProfiles,
  removeStyleProfile,
  updateStyleProfile
} from "./style-profiles.mjs";

const validAnalysis = {
  sourceContent: "一位骑士站在城门前",
  composition: "主体位于左侧三分线",
  camera: "中远景，平视",
  lighting: "阴天柔光",
  color: "低饱和青灰色",
  material: "潮湿石墙与粗糙织物",
  style: "写实电影摄影",
  negativePrompt: "卡通，文字，水印"
};

test("creates a reusable profile without source image content", () => {
  const profile = createStyleProfile({ name: "电影冷光", analysis: validAnalysis, lockedFields: ["lighting"] });
  assert.equal(STYLE_PROFILE_STORAGE_KEY, "image-assistant-style-profiles");
  assert.match(profile.id, /^local-style-/);
  assert.equal(profile.name, "电影冷光");
  assert.equal(profile.lighting, validAnalysis.lighting);
  assert.equal("sourceContent" in profile, false);
});

test("recovers from invalid local storage data", () => {
  assert.deepEqual(parseStyleProfiles("{bad json"), []);
  assert.deepEqual(parseStyleProfiles(JSON.stringify([{ id: "" }])), []);
});

test("updates and removes profiles without mutation", () => {
  const profile = createStyleProfile({ name: "电影冷光", analysis: validAnalysis, lockedFields: ["lighting"] });
  const updated = updateStyleProfile([profile], profile.id, { name: "新名称" });
  assert.equal(updated[0].name, "新名称");
  assert.equal(profile.name, "电影冷光");
  assert.deepEqual(removeStyleProfile(updated, profile.id), []);
});

test("keeps only reusable fields and valid locks when parsing", () => {
  const profile = createStyleProfile({ name: "电影冷光", analysis: validAnalysis, lockedFields: ["lighting"] });
  const [parsed] = parseStyleProfiles(JSON.stringify([{ ...profile, sourceContent: "不应保存", lockedFields: ["lighting", "sourceContent", "bad"] }]));
  assert.equal("sourceContent" in parsed, false);
  assert.deepEqual(parsed.lockedFields, ["lighting"]);
});
