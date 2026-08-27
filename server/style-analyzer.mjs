export const STYLE_ANALYSIS_FIELDS = [
  "sourceContent",
  "composition",
  "camera",
  "lighting",
  "color",
  "material",
  "style",
  "negativePrompt"
];

const ANALYSIS_SYSTEM_PROMPT = [
  "你是一名专业的图像视觉分析师和 AI 绘图提示词编辑。",
  "请分析参考图并只返回 JSON 对象，不要使用 Markdown 代码块。",
  "JSON 必须包含 sourceContent、composition、camera、lighting、color、material、style、negativePrompt 八个字符串字段。",
  "sourceContent 客观概括原图中的主体、动作和场景；其余字段只描述可迁移到其他内容的视觉特征。",
  "negativePrompt 写出应避免的视觉缺陷和不需要的元素，不要把原图主体写进其中。",
  "每个字段使用简洁、明确的中文，且不得包含图片尺寸或画幅比例。"
].join("");

function readModelContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("视觉模型未返回可解析的分析内容。");
  }
  return content.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
}

function parseStyleAnalysis(body) {
  let parsed;
  try {
    parsed = JSON.parse(readModelContent(body));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("视觉模型返回的分析不是有效 JSON。");
    throw error;
  }

  const analysis = {};
  for (const field of STYLE_ANALYSIS_FIELDS) {
    const value = typeof parsed?.[field] === "string" ? parsed[field].trim() : "";
    if (!value) throw new Error(`视觉模型分析缺少字段：${field}。`);
    if (value.length > 2000) throw new Error(`视觉模型分析字段过长：${field}。`);
    analysis[field] = value;
  }
  return analysis;
}

export async function analyzeImageStyle({
  apiBase,
  apiKey,
  model,
  image,
  fetchImpl = fetch
}) {
  if (!model) throw new Error("未配置 SUDOCODE_VISION_MODEL，无法分析参考图。");
  if (!apiKey) throw new Error("未配置 SUDOCODE_API_KEY，无法分析参考图。");
  if (!image?.buffer || !image?.mimetype) throw new Error("请上传一张有效的参考图片。");

  const imageUrl = `data:${image.mimetype};base64,${image.buffer.toString("base64")}`;
  const response = await fetchImpl(`${String(apiBase || "").replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "分析这张参考图，只返回要求的 JSON。" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ]
    })
  });

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`视觉模型请求失败（HTTP ${response.status}）。`);
  }
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `视觉模型请求失败（HTTP ${response.status}）。`);
  }
  return parseStyleAnalysis(body);
}
