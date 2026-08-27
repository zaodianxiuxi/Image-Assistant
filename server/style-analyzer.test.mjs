import assert from "node:assert/strict";
import test from "node:test";
import { analyzeImageStyle } from "./style-analyzer.mjs";

const validAnalysis = {
  sourceContent: "一名旅人站在山谷入口",
  composition: "人物位于画面左侧三分线，山谷形成纵深引导线",
  camera: "中远景，平视视角，35mm 镜头感",
  lighting: "阴天柔光，人物边缘有轻微轮廓光",
  color: "低饱和青绿色与灰色为主",
  material: "潮湿岩石、粗糙布料和薄雾质感",
  style: "写实电影摄影，克制而安静",
  negativePrompt: "卡通，过度锐化，文字，水印"
};

function responseWithAnalysis(analysis = validAnalysis) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(analysis) } }]
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function baseInput(overrides = {}) {
  return {
    apiBase: "https://example.test/v1/",
    apiKey: "test-key",
    model: "vision-test",
    image: { buffer: Buffer.from("image"), mimetype: "image/png" },
    fetchImpl: async () => responseWithAnalysis(),
    ...overrides
  };
}

test("requires a configured vision model", async () => {
  await assert.rejects(
    () => analyzeImageStyle(baseInput({ model: "" })),
    /SUDOCODE_VISION_MODEL/
  );
});

test("requires an API key", async () => {
  await assert.rejects(
    () => analyzeImageStyle(baseInput({ apiKey: "" })),
    /SUDOCODE_API_KEY/
  );
});

test("sends the image to the configured vision model and parses all fields", async () => {
  let request;
  const analysis = await analyzeImageStyle(baseInput({
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return responseWithAnalysis();
    }
  }));

  assert.equal(request.url, "https://example.test/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(request.body.model, "vision-test");
  assert.equal(request.body.messages[1].content[1].type, "image_url");
  assert.equal(request.body.messages[1].content[1].image_url.detail, "high");
  assert.match(request.body.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
  assert.deepEqual(analysis, validAnalysis);
});

test("rejects incomplete model analysis", async () => {
  await assert.rejects(
    () => analyzeImageStyle(baseInput({ fetchImpl: async () => responseWithAnalysis({ style: "摄影" }) })),
    /缺少字段/
  );
});

test("rejects invalid model JSON", async () => {
  await assert.rejects(
    () => analyzeImageStyle(baseInput({
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: "not-json" } }]
      }), { status: 200, headers: { "content-type": "application/json" } })
    })),
    /不是有效 JSON/
  );
});

test("reports upstream API errors", async () => {
  await assert.rejects(
    () => analyzeImageStyle(baseInput({
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: "model unavailable" } }), {
        status: 503,
        headers: { "content-type": "application/json" }
      })
    })),
    /model unavailable/
  );
});
