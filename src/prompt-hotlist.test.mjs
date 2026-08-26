import assert from "node:assert/strict";
import test from "node:test";
import { PROMPT_HOTLIST, getDailyPromptHotlist } from "./prompt-hotlist.mjs";

test("provides a substantial Chinese prompt collection across all supported aspect ratios", () => {
  assert.ok(PROMPT_HOTLIST.length >= 16);
  assert.deepEqual(
    new Set(PROMPT_HOTLIST.map((item) => item.size)),
    new Set(["1024x1024", "1536x864", "864x1536"])
  );
  assert.ok(PROMPT_HOTLIST.every((item) => item.prompt.length >= 80));
});

test("keeps the daily hotlist stable for the same day and limits visible entries", () => {
  const date = new Date("2026-08-25T12:00:00.000Z");
  const first = getDailyPromptHotlist(date, 6).map((item) => item.id);
  const second = getDailyPromptHotlist(date, 6).map((item) => item.id);

  assert.equal(first.length, 6);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 6);
});

test("changes the unique hotlist selection when the refresh index changes", () => {
  const date = new Date("2026-08-26T08:00:00.000Z");
  const first = getDailyPromptHotlist(date, 6, 0).map((item) => item.id);
  const next = getDailyPromptHotlist(date, 6, 1).map((item) => item.id);

  assert.equal(new Set(next).size, 6);
  assert.notDeepEqual(next, first);
});

test("shows generated prompts first and removes aspect-ratio text", () => {
  const generated = {
    id: "generated-example",
    title: "新生成灵感",
    category: "场景设计",
    size: "1536x864",
    prompt: PROMPT_HOTLIST[0].prompt + "，16:9。"
  };
  const visible = getDailyPromptHotlist(new Date("2026-08-26T08:00:00.000Z"), 6, 0, [generated]);

  assert.equal(visible[0].id, generated.id);
  assert.equal(/1:1|16:9|9:16/.test(visible[0].prompt), false);
});
