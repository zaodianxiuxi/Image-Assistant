import assert from "node:assert/strict";
import test from "node:test";
import * as versions from "./story-shot-versions.mjs";

const fixture = () => ({ size: "1536x864", plan: { styleGuide: "纪实", characters: [{ id: "a", description: "蓝衣" }], settings: [{ id: "room", description: "窗在左侧" }], shots: ["s1", "s2", "s3"].map(id => ({ id, title: id, characterIds: ["a"], settingId: "room", action: "走路" })) }, references: [{ id: "ref", kind: "character", targetId: "a", confirmed: true }], results: { s1: { image: "/old.png" }, s2: { image: "/next.png" }, s3: { image: "/last.png" } } });

test("a retake retains the selected image and imports legacy output once", () => {
  const p = fixture();
  const before = structuredClone(p);
  const next = versions.addShotVersion(p, "s1", { image: "/new.png" }, { id: "v2", prompt: "prompt", instruction: "动作自然", createdAt: 1 }, false);
  assert.deepEqual(p, before);
  assert.equal(next.results.s1.image, "/old.png");
  assert.equal(next.results.s2.stale, undefined);
  assert.deepEqual(versions.getShotVersions(next, "s1").map(v => v.result.image), ["/old.png", "/new.png"]);
  const another = versions.addShotVersion(next, "s1", { image: "/newer.png" }, { id: "v3" }, false);
  assert.equal(versions.getShotVersions(another, "s1").length, 3);
});

test("adoption marks downstream results stale and repeated selection is a no-op", () => {
  const p = versions.addShotVersion(fixture(), "s1", { image: "/new.png" }, { id: "v2" }, false);
  const next = versions.adoptShotVersion(p, "s1", "v2");
  assert.equal(next.results.s1.image, "/new.png");
  assert.equal(next.results.s1.stale, false);
  assert.equal(next.results.s2.stale, true);
  assert.equal(next.results.s3.stale, true);
  assert.equal(versions.adoptShotVersion(next, "s1", "v2"), next);
  assert.equal(versions.getShotVersions(next, "s1").length, 2);
  const old = versions.adoptShotVersion(next, "s1", versions.getShotVersions(next, "s1")[0].id);
  assert.equal(old.results.s1.image, "/old.png");
  assert.equal(old.results.s1.stale, false);
});

test("old candidates cannot erase stale status after reference, shot, or canvas changes", () => {
  const p = versions.addShotVersion(fixture(), "s1", { image: "/new.png" }, { id: "v2" }, false);
  for (const mutate of [p => { p.size = "1024x1024"; }, p => { p.references[0].id = "new-ref"; }, p => { p.plan.shots[0].action = "坐下"; }, p => { p.plan.styleGuide = "水彩"; }]) {
    const changed = structuredClone(p); mutate(changed);
    assert.equal(versions.adoptShotVersion(changed, "s1", "v2").results.s1.stale, true);
  }
});

test("previous frame version and availability affect continuity of a candidate", () => {
  const p = versions.addShotVersion(fixture(), "s2", { image: "/candidate.png" }, { id: "v2" }, false);
  const changed = { ...p, results: { ...p.results, s1: { image: "/other.png" } } };
  assert.equal(versions.adoptShotVersion(changed, "s2", "v2").results.s2.stale, true);
  const stalePrevious = { ...p, results: { ...p.results, s1: { image: "/old.png", stale: true } } };
  assert.equal(versions.adoptShotVersion(stalePrevious, "s2", "v2").results.s2.stale, true);
});

test("batch generation adopts new image but preserves prior versions", () => {
  const p = versions.addShotVersion(fixture(), "s2", { image: "/batch.png" }, { id: "v2" }, true);
  assert.equal(p.results.s2.image, "/batch.png");
  assert.equal(p.results.s1.stale, undefined);
  assert.equal(versions.getShotVersions(p, "s2").length, 2);
});

test("missing outputs and invalid selections never lose stored images", () => {
  const p = fixture();
  assert.throws(() => versions.addShotVersion(p, "s1", { error: "failed" }, { id: "bad" }, false));
  assert.equal(versions.adoptShotVersion(p, "s1", "unknown"), p);
  assert.deepEqual(versions.getShotVersions(p, "missing"), []);
  assert.equal(p.results.s1.image, "/old.png");
});

test("legacy stale images stay stale, serialized candidates retain their generation context", () => {
  const original = fixture(); original.results.s1.stale = true;
  const p = versions.addShotVersion(original, "s1", { image: "/candidate.png" }, { id: "v2", prompt: "full prompt", instruction: "修正右手" }, false);
  const restored = JSON.parse(JSON.stringify(p));
  assert.equal(restored.shotVersions.s1[1].instruction, "修正右手");
  const selected = versions.adoptShotVersion(restored, "s1", "v2");
  const old = versions.adoptShotVersion(selected, "s1", restored.shotVersions.s1[0].id);
  assert.equal(old.results.s1.stale, true);
  assert.equal(old.shotVersions.s1[1].prompt, "full prompt");
});

test("generation correction includes selected issues and notes without dropping original prompt", () => {
  const correction = versions.buildRetakeInstruction(["action", "continuity", "unknown"], "  右手持伞  ");
  assert.match(correction, /重心/);
  assert.match(correction, /左右手/);
  assert.match(correction, /补充要求：右手持伞/);
  assert.doesNotMatch(correction, /年龄/);
  assert.ok(versions.appendRetakeInstruction("角色与场景设定", correction).startsWith("角色与场景设定\n"));
  assert.equal(versions.appendRetakeInstruction("原描述", "  "), "原描述");
});

test("new story input and reselecting an already-stale active image cannot clear warnings", () => {
  const p = versions.addShotVersion(fixture(), "s1", { image: "/new.png" }, { id: "v2" }, false);
  p.plannedInput = JSON.stringify(["original", "style", 6]); p.story = "changed"; p.style = "style"; p.shotCount = 6;
  const chosen = versions.adoptShotVersion(p, "s1", "v2");
  assert.equal(chosen.results.s1.stale, true);
  assert.equal(versions.adoptShotVersion(chosen, "s1", "v2"), chosen);
});
