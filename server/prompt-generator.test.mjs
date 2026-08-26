import assert from "node:assert/strict";
import test from "node:test";
import { generatePromptCandidates } from "./prompt-generator.mjs";

const promptText = "未来港口的中文复杂图像提示词，包含主体、环境、光影、镜头、材质和构图控制。".repeat(4);

function generatedPrompts() {
  return Array.from({ length: 6 }, (_, index) => ({
    title: `生成灵感 ${index + 1}`,
    category: "未来城市",
    size: index % 2 ? "1024x1024" : "1536x864",
    prompt: `${promptText}${index}`
  }));
}

test("requires an explicitly configured text model", async () => {
  await assert.rejects(
    () => generatePromptCandidates({ apiBase: "https://example.test/v1", apiKey: "test-key", model: "" }),
    /SUDOCODE_TEXT_MODEL/
  );
});

test("requests six validated Chinese prompt ideas from the configured text model", async () => {
  let request;
  const prompts = await generatePromptCandidates({
    apiBase: "https://example.test/v1",
    apiKey: "test-key",
    model: "gpt-test",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ prompts: generatedPrompts() }) } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  assert.equal(request.url, "https://example.test/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(JSON.parse(request.options.body).model, "gpt-test");
  assert.equal(prompts.length, 6);
  assert.ok(prompts.every((item) => item.id.startsWith("generated-")));
});
