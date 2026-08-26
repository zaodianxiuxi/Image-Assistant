import { validatePromptCandidates } from "./prompt-cache.mjs";

const SYSTEM_PROMPT = [
  "你是一名中文 AI 图像提示词编辑。",
  "只返回 JSON 对象，格式为 {\\\"prompts\\\":[...] }。",
  "生成恰好 6 条复杂且互不重复的中文图像提示词。",
  "每项必须有 title、category、size、prompt；size 只能是 1024x1024、1536x864 或 864x1536，prompt 长度为 80 到 500 个字符。"
].join("");

function parseModelContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("文本模型未返回可解析的提示词内容。");
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.prompts;
  } catch {
    throw new Error("文本模型返回的提示词不是有效 JSON。");
  }
}

export async function generatePromptCandidates({
  apiBase,
  apiKey,
  model,
  fetchImpl = fetch,
  existingPrompts = []
}) {
  if (!model) throw new Error("未配置 SUDOCODE_TEXT_MODEL，无法生成新灵感。");
  if (!apiKey) throw new Error("未配置 SUDOCODE_API_KEY，无法生成新灵感。");

  const response = await fetchImpl(`${apiBase.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    // The schema remains in the text prompt for compatibility with providers that omit response_format support.
    body: JSON.stringify({ model, temperature: 1, messages: [{ role: "system", content: SYSTEM_PROMPT }] })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || body?.message || `文本模型请求失败（HTTP ${response.status}）。`);

  const prompts = validatePromptCandidates(parseModelContent(body), existingPrompts);
  if (prompts.length !== 6) throw new Error("文本模型未返回 6 条符合要求的中文提示词。");
  return prompts;
}
