import assert from "node:assert/strict";
import test from "node:test";
import { composeStylePrompt } from "./style-composer.mjs";

const validAnalysis = {
  sourceContent: "原图是一名红衣女子站在古城门前",
  composition: "主体位于左侧三分线，背景形成纵深",
  camera: "中远景，35mm 镜头，平视",
  lighting: "阴天柔光与轻微轮廓光",
  color: "低饱和青灰色",
  material: "潮湿石墙与粗糙织物",
  style: "写实电影摄影",
  negativePrompt: "卡通，文字，水印"
};

function baseInput(overrides = {}) {
  return {
    apiBase: "https://example.test/v1/",
    apiKey: "test-key",
    model: "text-test",
    analysis: validAnalysis,
    newContent: "白衣剑客站在雪山顶",
    lockedFields: ["lighting", "color", "style"],
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: "白衣剑客站在雪山顶，低饱和青灰色，写实电影摄影，16:9，1536x864" } }]
    }), { status: 200, headers: { "content-type": "application/json" } }),
    ...overrides
  };
}

test("requires new picture content", async () => {
  await assert.rejects(
    () => composeStylePrompt(baseInput({ newContent: "  " })),
    /请输入新的画面内容/
  );
});

test("falls back to the vision model when no text model is configured", async () => {
  let requestedModel;
  await composeStylePrompt(baseInput({
    model: "",
    fallbackModel: "vision-fallback",
    fetchImpl: async (_url, options) => {
      requestedModel = JSON.parse(options.body).model;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "白衣剑客站在雪山顶，电影光影" } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  }));
  assert.equal(requestedModel, "vision-fallback");
});

test("composes new content with reusable style fields and strips size text", async () => {
  let request;
  const prompt = await composeStylePrompt(baseInput({
    fetchImpl: async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({
        choices: [{ message: { content: "白衣剑客站在雪山顶，低饱和青灰色，写实电影摄影，比例为 16:9，尺寸 1536x864" } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  }));

  const userContent = request.body.messages[1].content;
  assert.equal(request.url, "https://example.test/v1/chat/completions");
  assert.match(userContent, /白衣剑客站在雪山顶/);
  assert.match(userContent, /写实电影摄影/);
  assert.match(userContent, /lighting、color、style/);
  assert.doesNotMatch(userContent, /红衣女子/);
  assert.doesNotMatch(prompt, /16:9|1:1|9:16|1536x864/);
  assert.match(prompt, /白衣剑客/);
});

test("reports composition API errors", async () => {
  await assert.rejects(
    () => composeStylePrompt(baseInput({
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
        status: 429,
        headers: { "content-type": "application/json" }
      })
    })),
    /quota exceeded/
  );
});
