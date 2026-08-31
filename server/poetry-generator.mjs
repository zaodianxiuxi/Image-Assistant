const ANALYSIS_SYSTEM_PROMPT = [
  "你是一名严谨的中国古典诗词研究者。",
  "只返回 JSON 对象，不要 Markdown 或额外解释。",
  "返回格式为 {\"title\":\"\",\"author\":\"\",\"dynasty\":\"\",\"theme\":\"\",\"overview\":\"\",\"timeAndPlace\":\"\",\"emotionalArc\":\"\",\"coreImagery\":[\"\"],\"lineReadings\":[{\"sourceLine\":\"\",\"meaning\":\"\",\"emotion\":\"\",\"visualFocus\":\"\"}],\"allusions\":[{\"sourceText\":\"\",\"explanation\":\"\",\"confidence\":\"high|medium|low\"}],\"uncertainties\":[\"\"]}。",
  "先辨认题目、作者和朝代，再解释诗句的字面场景、空间移动、季节时辰、叙述视角、核心意象和情绪变化。",
  "逐句理解要忠于原文，visualFocus 只说明可见主体与动作，不写摄影参数或完整出图提示词。",
  "典故和历史背景没有把握时必须降低 confidence，并把分歧写入 uncertainties；不要把推测写成确定事实。"
].join("");

const STORYBOARD_SYSTEM_PROMPT = [
  "你是一名中国古典诗词分镜导演和中文 AI 图像提示词编辑。",
  "只返回 JSON 对象，格式为 {\"styleGuide\":\"...\",\"scenes\":[...]}，不要 Markdown 或额外解释。",
  "必须依据用户提供的结构化诗意分析，把诗词拆成连续的画面段落，不得背离逐句释义、情绪线或存疑说明。",
  "每个 scene 必须有 title、sourceLine、mood、prompt 四个字段：title 不超过 16 个汉字；sourceLine 指出对应的诗句或意象；mood 用一句话说明这一段的情绪；prompt 是 80 到 600 个汉字、可以直接用于图像生成的完整中文画面提示词。",
  "prompt 要具体描述主体、人物外貌与动作、环境、空间层次、季节时辰、天气、色彩、材质、光线、镜头和构图，把抽象意境转成可视化画面；不要只复述诗句，不要出现画幅、比例、尺寸、分辨率等信息。",
  "所有画面要保持统一的时代背景、人物设定、服装、色彩基调和电影摄影质感。styleGuide 用一句话总结跨段落需要保持的视觉连续性。"
].join("");

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeList(value, limit, maxLength) {
  return (Array.isArray(value) ? value : [])
    .map((item) => normalize(item).slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

function stripAspectRatioText(value) {
  return value
    .replace(/(?:画幅|比例|宽高比|尺寸|分辨率)?(?:为|是|[:：])?\s*(?:1\s*:\s*1|16\s*:\s*9|9\s*:\s*16|1024\s*[x×]\s*1024|1536\s*[x×]\s*864|864\s*[x×]\s*1536)/giu, "")
    .replace(/([，、；])\s*([，、；])/gu, "$1")
    .replace(/^[，、；\s]+|[，、；\s]+$/gu, "")
    .trim();
}

function parseModelContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("文本模型未返回可解析的诗词内容。");
  const jsonText = content.trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    const parsed = JSON.parse(jsonText);
    return parsed && !Array.isArray(parsed) ? parsed : { scenes: parsed };
  } catch {
    throw new Error("文本模型返回的诗词内容不是有效 JSON。");
  }
}

async function requestPoetryModel({ apiBase, apiKey, model, systemPrompt, userPrompt, temperature, fetchImpl }) {
  const response = await fetchImpl(`${apiBase.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`诗词意境请求失败（HTTP ${response.status}）。`);
  }
  if (!response.ok) throw new Error(body?.error?.message || body?.message || `诗词意境请求失败（HTTP ${response.status}）。`);
  return parseModelContent(body);
}

export function validatePoetryAnalysis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("文本模型未返回完整的诗词意境分析。");
  }
  const lineReadings = (Array.isArray(value.lineReadings) ? value.lineReadings : []).map((item) => ({
    sourceLine: normalize(item?.sourceLine).slice(0, 160),
    meaning: normalize(item?.meaning).slice(0, 500),
    emotion: normalize(item?.emotion).slice(0, 240),
    visualFocus: normalize(item?.visualFocus).slice(0, 300)
  })).filter((item) => item.sourceLine && item.meaning).slice(0, 16);
  const allusions = (Array.isArray(value.allusions) ? value.allusions : []).map((item) => ({
    sourceText: normalize(item?.sourceText).slice(0, 120),
    explanation: normalize(item?.explanation).slice(0, 500),
    confidence: ["high", "medium", "low"].includes(item?.confidence) ? item.confidence : "low"
  })).filter((item) => item.sourceText && item.explanation).slice(0, 12);
  const analysis = {
    title: normalize(value.title).slice(0, 120),
    author: normalize(value.author).slice(0, 80),
    dynasty: normalize(value.dynasty).slice(0, 40),
    theme: normalize(value.theme).slice(0, 300),
    overview: normalize(value.overview).slice(0, 1200),
    timeAndPlace: normalize(value.timeAndPlace).slice(0, 500),
    emotionalArc: normalize(value.emotionalArc).slice(0, 500),
    coreImagery: normalizeList(value.coreImagery, 16, 80),
    lineReadings,
    allusions,
    uncertainties: normalizeList(value.uncertainties, 12, 400)
  };
  if (!analysis.theme || !analysis.overview || !analysis.timeAndPlace || !analysis.emotionalArc || !analysis.coreImagery.length || !analysis.lineReadings.length) {
    throw new Error("文本模型返回的诗词意境分析不完整。");
  }
  return analysis;
}

export function validatePoetryScenes(value, expectedCount) {
  const scenes = Array.isArray(value) ? value : [];
  if (scenes.length < 3 || scenes.length > 8) {
    throw new Error("文本模型需要返回 3 到 8 个诗词画面段落。");
  }
  const selectedScenes = scenes.length > expectedCount ? scenes.slice(0, expectedCount) : scenes;
  const seenTitles = new Set();
  return selectedScenes.map((item, index) => {
    const title = normalize(item?.title).slice(0, 16);
    const sourceLine = normalize(item?.sourceLine).slice(0, 120);
    const mood = normalize(item?.mood).slice(0, 160);
    const prompt = stripAspectRatioText(normalize(item?.prompt));
    if (!title || !sourceLine || !mood || prompt.length < 30 || seenTitles.has(title)) {
      throw new Error("文本模型返回了不完整或重复的诗词画面段落。");
    }
    seenTitles.add(title);
    return { sceneOrder: index + 1, title, sourceLine, mood, prompt };
  });
}

export async function analyzePoetry({ apiBase, apiKey, model, poem, fetchImpl = fetch }) {
  if (!model) throw new Error("未配置 SUDOCODE_TEXT_MODEL，无法解析诗词意境。");
  if (!apiKey) throw new Error("未配置 SUDOCODE_API_KEY，无法解析诗词意境。");
  const normalizedPoem = normalize(poem);
  if (!normalizedPoem) throw new Error("请输入诗词原文。");
  const parsed = await requestPoetryModel({
    apiBase,
    apiKey,
    model,
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    userPrompt: `请先分析下面的诗词，不要生成分镜或出图提示词。\n诗词原文：\n${normalizedPoem}`,
    temperature: 0.35,
    fetchImpl
  });
  return validatePoetryAnalysis(parsed);
}

export async function generatePoetryScenes({ apiBase, apiKey, model, poem, analysis, sceneCount = 6, fetchImpl = fetch }) {
  if (!model) throw new Error("未配置 SUDOCODE_TEXT_MODEL，无法解析诗词意境。");
  if (!apiKey) throw new Error("未配置 SUDOCODE_API_KEY，无法解析诗词意境。");
  const normalizedPoem = normalize(poem);
  if (!normalizedPoem) throw new Error("请输入诗词原文。");
  const validatedAnalysis = validatePoetryAnalysis(analysis);
  const count = Math.min(8, Math.max(3, Number(sceneCount) || 6));
  const parsed = await requestPoetryModel({
    apiBase,
    apiKey,
    model,
    systemPrompt: STORYBOARD_SYSTEM_PROMPT,
    userPrompt: `请根据下面经过确认的诗意分析，把原诗拆成恰好 ${count} 个连续画面段落。\n诗词原文：\n${normalizedPoem}\n诗意分析：\n${JSON.stringify(validatedAnalysis)}`,
    temperature: 0.7,
    fetchImpl
  });
  const scenes = validatePoetryScenes(parsed.scenes, count);
  return { styleGuide: normalize(parsed.styleGuide).slice(0, 240), scenes };
}
