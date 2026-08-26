import assert from "node:assert/strict";
import test from "node:test";
import { generateStoryboard } from "./storyboard-generator.mjs";

function nodes() {
  return Array.from({ length: 8 }, (_, index) => ({
    title: "分镜节点" + (index + 1),
    storyText: "故事推进到第 " + (index + 1) + " 个关键场景。",
    prompt: "东方志怪山村场景，少女主角穿着青色布衣，在薄雾山林与古老建筑之间行动，保持人物外貌和电影感写实画风连续，丰富的光影和环境细节，比例为16:9。"
  }));
}

test("splits a story into validated nodes without aspect-ratio text", async () => {
  const result = await generateStoryboard({
    apiBase: "https://example.test/v1",
    apiKey: "test-key",
    model: "test-model",
    seriesName: "李寄斩蛇",
    story: "少女李寄主动进入蛇穴，最终斩杀巨蛇并拯救山村。",
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ nodes: nodes() }) } }]
    }), { status: 200, headers: { "content-type": "application/json" } })
  });

  assert.equal(result.length, 8);
  assert.equal(result[0].nodeOrder, 1);
  assert.equal(/1:1|16:9|9:16/.test(result[0].prompt), false);
});
