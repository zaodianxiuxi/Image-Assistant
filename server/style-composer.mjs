export const REUSABLE_STYLE_FIELDS = [
  "composition",
  "camera",
  "lighting",
  "color",
  "material",
  "style",
  "negativePrompt"
];

const COMPOSER_SYSTEM_PROMPT = [
  "你是一名专业的中文 AI 图像提示词编辑。",
  "根据用户的新画面内容和参考图的可复用视觉特征，组合成一条完整、自然、可直接用于图像生成的中文提示词。",
  "不得复用或提及参考图的原始人物、物体、动作、地点等内容。",
  "锁定字段必须忠实保留，其他字段可以为整体效果做适度润色。",
  "只返回最终提示词，不要解释，不要使用 Markdown，不要写画幅比例或图片尺寸。"
].join("");

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripAspectRatioText(value) {
  return value
    .replace(/(?:画幅|比例|宽高比)(?:为|是|[:：])?\s*(?:1\s*:\s*1|16\s*:\s*9|9\s*:\s*16)/giu, "")
    .replace(/(?:尺寸|分辨率)(?:为|是|[:：])?\s*(?:1024\s*[x×]\s*1024|1536\s*[x×]\s*864|864\s*[x×]\s*1536)/giu, "")
    .replace(/(?:1\s*:\s*1|16\s*:\s*9|9\s*:\s*16|1024\s*[x×]\s*1024|1536\s*[x×]\s*864|864\s*[x×]\s*1536)/giu, "")
    .replace(/([，、；])\s*([，、；])/gu, "$1")
    .replace(/^[，、；\s]+|[，、；\s]+$/gu, "")
    .trim();
}

function parsePrompt(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("文本模型未返回可用的完整提示词。");
  }
  const prompt = stripAspectRatioText(content.trim().replace(/^```(?:text)?\s*/iu, "").replace(/\s*```$/u, ""));
  if (!prompt) throw new Error("文本模型未返回可用的完整提示词。");
  return prompt;
}

export async function composeStylePrompt({
  apiBase,
  apiKey,
  model,
  fallbackModel,
  analysis,
  newContent,
  lockedFields = [],
  fetchImpl = fetch
}) {
  const normalizedContent = normalize(newContent);
  if (!normalizedContent) throw new Error("请输入新的画面内容。");
  if (!apiKey) throw new Error("未配置 SUDOCODE_API_KEY，无法优化组合提示词。");

  const selectedModel = normalize(model) || normalize(fallbackModel);
  if (!selectedModel) throw new Error("未配置 SUDOCODE_TEXT_MODEL 或可回退的视觉模型。");

  const styleFields = Object.fromEntries(REUSABLE_STYLE_FIELDS.map((field) => [
    field,
    normalize(analysis?.[field]).slice(0, 2000)
  ]));
  const validLockedFields = [...new Set(Array.isArray(lockedFields) ? lockedFields : [])]
    .filter((field) => REUSABLE_STYLE_FIELDS.includes(field));

  const response = await fetchImpl(`${String(apiBase || "").replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selectedModel,
      temperature: 0.5,
      messages: [
        { role: "system", content: COMPOSER_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `新的画面内容：${normalizedContent}`,
            `可复用视觉字段：${JSON.stringify(styleFields)}`,
            `必须忠实保留的锁定字段：${validLockedFields.length ? validLockedFields.join("、") : "无"}`
          ].join("\n")
        }
      ]
    })
  });

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`提示词组合请求失败（HTTP ${response.status}）。`);
  }
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `提示词组合请求失败（HTTP ${response.status}）。`);
  }
  return parsePrompt(body);
}
