import assert from "node:assert/strict";
import test from "node:test";
import * as generator from "./storyboard-generator.mjs";

function plan() {
  return {
    title: "归还雨伞", synopsis: "女孩在公交站捡到雨伞，追上失主并归还。", styleGuide: "现代城市，自然阴天光，生活纪实摄影",
    characters: [{ id: "girl", name: "女孩", description: "短发年轻女性，米色外套，深蓝长裤" }],
    settings: [{ id: "stop", name: "公交站", description: "玻璃候车亭，左侧为道路，长椅位于右侧" }],
    shots: Array.from({ length: 4 }, (_, i) => ({ title: `镜头${i + 1}`, storyText: "女孩发现椅子上遗落的雨伞。", characterIds: ["girl"], settingId: "stop", framing: i % 2 ? "手部特写" : "中景侧拍", action: "手伸向雨伞", emotion: "注意到遗失物的迟疑", continuity: "承接她看向长椅的视线，雨伞仍在长椅右侧", prompt: "现代公交站的长椅旁，短发女孩俯身伸手拿起深蓝雨伞，视线落在伞柄上，阴天自然光，生活抓拍感。比例为16:9。" }))
  };
}
const options = { apiBase: "https://example.test/v1", apiKey: "test-key", model: "test-model", story: "女孩捡到雨伞，追上失主归还。" };
const provider = (value, inspect = () => {}) => async (_url, init) => {
  inspect(JSON.parse(init.body));
  return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
};

test("plans a four-shot modern story with named characters and continuity", async () => {
  const result = await generator.generateStoryPlan({ ...options, shotCount: 4, fetchImpl: provider(plan(), (request) => {
    assert.equal(request.model, "test-model");
    assert.match(request.messages[0].content, /单一瞬间/);
    assert.doesNotMatch(request.messages[0].content, /你是一名中国志怪/);
  }) });
  assert.equal(result.shots.length, 4);
  assert.equal(result.shots[0].id, "shot-1");
  assert.equal(result.characters[0].id, "girl");
  assert.equal(result.shots[0].settingId, "stop");
  assert.doesNotMatch(result.shots[0].prompt, /16:9/);
});
test("rejects unknown character references and missing transition information", async () => {
  const invalid = plan(); invalid.shots[0].characterIds = ["unknown"];
  await assert.rejects(() => generator.generateStoryPlan({ ...options, fetchImpl: provider(invalid) }), /人物/);
  const missing = plan(); missing.shots[1].continuity = "";
  await assert.rejects(() => generator.generateStoryPlan({ ...options, fetchImpl: provider(missing) }), /衔接/);
});
test("honors an explicit shot count and rejects invalid input before calling provider", async () => {
  await assert.rejects(() => generator.generateStoryPlan({ ...options, shotCount: 6, fetchImpl: provider(plan()) }), /6/);
  await assert.rejects(() => generator.generateStoryPlan({ ...options, shotCount: 50, fetchImpl: () => assert.fail("must not call provider") }), /镜头数/);
});
test("legacy series receives usable prompts with stable character descriptions", async () => {
  const result = await generator.generateStoryboard({ ...options, fetchImpl: provider(plan()) });
  assert.equal(result.length, 4);
  assert.equal(result[0].nodeOrder, 1);
  assert.match(result[0].prompt, /米色外套/);
  assert.match(result[0].prompt, /中景侧拍/);
  assert.doesNotMatch(result[0].prompt, /16:9/);
});
