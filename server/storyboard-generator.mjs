const SYSTEM_PROMPT = [
  "你是一名中国志怪故事分镜编剧和 AI 图像提示词编辑。",
  "只返回 JSON 对象，格式为 {\"nodes\":[...]}。",
  "将用户给出的故事拆分为 8 到 12 个连续、完整、有起承转合的画面节点。",
  "每个节点必须有 title、storyText、prompt 三个字段。",
  "title 是不超过 12 个汉字的节点名；storyText 是一句适合做字幕的简短叙述；prompt 只描述画面主体、人物、动作、环境、光影、材质、镜头和东方志怪风格。",
  "所有节点必须保持人物外貌、服装、时代和整体画风连续；整体采用写实、现实质感的电影摄影风格，人物和场景要可信，不要卡通、插画或游戏概念图；不要在 prompt 中写画幅、比例或尺寸信息。"
].join("");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function removeAspectRatios(value) {
  return value.replace(/(?:画幅|比例|宽高比)?(?:为|是)?\s*(?:1:1|16:9|9:16)/gu, "").trim();
}

function parseModelContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("文本模型未返回可解析的分镜内容。");
  const jsonText = content.trim().replace(/^\x60\x60\x60(?:json)?\s*/iu, "").replace(/\s*\x60\x60\x60$/u, "");
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : parsed.nodes;
  } catch {
    throw new Error("文本模型返回的分镜不是有效 JSON。");
  }
}

function validateNodes(value) {
  const nodes = Array.isArray(value) ? value : [];
  if (nodes.length < 8 || nodes.length > 12) {
    throw new Error("文本模型需要返回 8 到 12 个故事节点。");
  }
  const seenTitles = new Set();
  return nodes.map((item, index) => {
    const title = normalizeText(item?.title).slice(0, 12);
    const storyText = normalizeText(item?.storyText);
    const prompt = removeAspectRatios(normalizeText(item?.prompt));
    if (!title || !storyText || prompt.length < 30 || seenTitles.has(title)) {
      throw new Error("文本模型返回了不完整或重复的故事节点。");
    }
    seenTitles.add(title);
    return { nodeOrder: index + 1, title, storyText, prompt };
  });
}

export async function generateStoryboard({
  apiBase,
  apiKey,
  model,
  story,
  seriesName,
  fetchImpl = fetch
}) {
  if (!model) throw new Error("未配置 SUDOCODE_TEXT_MODEL，无法自动拆分故事。");
  if (!apiKey) throw new Error("未配置 SUDOCODE_API_KEY，无法自动拆分故事。");
  if (!normalizeText(story)) throw new Error("请输入要拆分的故事内容。");

  const response = await fetchImpl(apiBase.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "系列名称：" + normalizeText(seriesName || "未命名志怪故事") + "\n故事内容：\n" + normalizeText(story) }
      ]
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || body?.message || "故事分镜请求失败（HTTP " + response.status + "）。");
  return validateNodes(parseModelContent(body));
}
