import assert from "node:assert/strict";
import test from "node:test";

test("stable references match the cast, previous frame is used only within the same scene", async () => {
  const { selectStoryReferences } = await import("./storyboard-continuity.mjs");
  const refs = [{ id: "r1", kind: "character", targetId: "girl" }, { id: "r2", kind: "character", targetId: "man" }, { id: "r3", kind: "setting", targetId: "stop" }];
  const shot = { characterIds: ["girl"], settingId: "stop" };
  const previous = { shot: { settingId: "stop" }, image: "/previous.png" };
  assert.deepEqual(selectStoryReferences(shot, refs, previous).map(r => r.id), ["r1", "r3", "previous"]);
  assert.deepEqual(selectStoryReferences({ ...shot, settingId: "street" }, refs, previous).map(r => r.id), ["r1"]);
  assert.equal(selectStoryReferences(shot, refs, null).length, 2);
});
test("trial renders at most the first four missing shots, continuation skips completed shots", async () => {
  const { selectStoryShots } = await import("./storyboard-continuity.mjs");
  const shots = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}` }));
  const results = { s0: { image: "/a.png" }, s2: { error: "failed" }, s5: { image: "/b.png" } };
  assert.deepEqual(selectStoryShots(shots, results, "trial").map(s => s.id), ["s1", "s2", "s3"]);
  assert.deepEqual(selectStoryShots(shots, results, "remaining").map(s => s.id), ["s1", "s2", "s3", "s4", "s6", "s7"]);
});
test("prompt separates reference identity from new shot composition", async () => {
  const { buildStoryImagePrompt } = await import("./storyboard-continuity.mjs");
  const plan = { styleGuide: "纪实摄影", characters: [{ id: "girl", name: "女孩", description: "米色外套" }], settings: [{ id: "stop", name: "车站", description: "长椅在右侧" }] };
  const shot = { title: "拾伞", characterIds: ["girl"], settingId: "stop", framing: "手部特写", action: "拾起雨伞", emotion: "犹豫", continuity: "接上一镜的视线", prompt: "手指触碰伞柄" };
  const text = buildStoryImagePrompt(plan, shot, [{ kind: "character", targetId: "girl" }]);
  assert.match(text, /参考图1/);
  assert.match(text, /米色外套/);
  assert.match(text, /手部特写/);
  assert.match(text, /不照搬.*姿势/);
  assert.doesNotMatch(text, /东方志怪/);
});
