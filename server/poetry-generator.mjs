const ANALYSIS_SYSTEM_PROMPT = [
  "你是一名严谨的中国古典诗词研究者。",
  "只返回 JSON 对象，不要 Markdown 或额外解释。",
  "返回格式为 {\"title\":\"\",\"author\":\"\",\"dynasty\":\"\",\"genre\":\"\",\"tags\":[\"\"],\"theme\":\"\",\"overview\":\"\",\"translation\":\"\",\"annotations\":[{\"term\":\"\",\"explanation\":\"\"}],\"creationBackground\":\"\",\"historicalContext\":\"\",\"structureAnalysis\":\"\",\"literaryDevices\":\"\",\"sensoryDetails\":{\"visual\":\"\",\"auditory\":\"\",\"spatial\":\"\",\"temporal\":\"\"},\"appreciation\":\"\",\"timeAndPlace\":\"\",\"emotionalArc\":\"\",\"coreImagery\":[\"\"],\"lineReadings\":[{\"sourceLine\":\"\",\"meaning\":\"\",\"emotion\":\"\",\"visualFocus\":\"\"}],\"allusions\":[{\"sourceText\":\"\",\"explanation\":\"\",\"confidence\":\"high|medium|low\"}],\"uncertainties\":[\"\"]}。",
  "先辨认题目、作者、时代、体裁和标签，再给出忠于原文的译文、重点词语注释、创作背景、历史语境、上下阕或段落结构、表现手法、视觉/听觉/空间/时间感受、整体赏析和情绪变化。",
  "译文只解释原文，不把赏析观点混入译文；创作背景和历史语境没有把握时必须标注不确定，不得编造史实。",
  "逐句理解要忠于原文，visualFocus 只说明可见主体与动作，不写摄影参数或完整出图提示词。",
  "典故和历史背景没有把握时必须降低 confidence，并把分歧写入 uncertainties；不要把推测写成确定事实。"
].join("");

const STORYBOARD_SYSTEM_PROMPT = [
  "你是一名中国古典诗词分镜导演和中文 AI 图像提示词编辑。",
  "只返回 JSON 对象，格式为 {\"styleGuide\":\"...\",\"characterBible\":\"...\",\"continuityGuide\":\"...\",\"scenes\":[...]}，不要 Markdown 或额外解释。",
  "必须依据用户提供的结构化诗意分析，把诗词拆成连续的画面段落，不得背离逐句释义、情绪线或存疑说明。",
  "每个 scene 必须有 title、sourceLine、mood、prompt 四个字段：title 不超过 16 个汉字；sourceLine 指出对应的诗句或意象；mood 用一句话说明这一段的情绪；prompt 是 80 到 600 个汉字、可以直接用于图像生成的完整中文画面提示词。",
  "prompt 要具体描述主体、人物外貌与动作、环境、空间层次、季节时辰、天气、色彩、材质、光线、镜头和构图，把抽象意境转成可视化画面；不要只复述诗句，不要出现画幅、比例、尺寸、分辨率等信息。",
  "先输出 characterBible，明确固定主角的身份、年龄、性别、脸型、发型、肤色、体型、服装颜色材质款式、配饰、固定道具、时代背景和不可改变项；如果诗中没有人物，也要明确主要主体和固定视觉锚点。",
  "再输出 continuityGuide，明确所有分镜必须继承的角色、服装、发型、道具、时代、画风、色彩、镜头和空间关系；时间推进只允许合理的光线或动作变化，禁止随意换装、换发型、改变年龄、道具、画风或摄影质感。",
  "每个 scene 的 prompt 都必须显式重复 characterBible 中的固定人物描述，不要只写‘同一人物’；第 2 段及之后还要明确承接上一段的空间、人物动作、服装、道具、光线和情绪，并把前序提示词中的关键连续性信息带入当前 prompt。styleGuide 用一句话总结统一视觉风格。"
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

function normalizeAnnotations(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    term: normalize(item?.term).slice(0, 120),
    explanation: normalize(item?.explanation).slice(0, 600)
  })).filter((item) => item.term && item.explanation).slice(0, 24);
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

function isRetryablePoetryStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504, 524].includes(status);
}

function waitForPoetryRetry(attempt) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(3000, 800 * 2 ** attempt)));
}

async function requestPoetryModel({ apiBase, apiKey, model, systemPrompt, userPrompt, temperature, fetchImpl }) {
  const endpoint = `${apiBase.replace(/\/$/, "")}/chat/completions`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: 6000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });
      let body = null;
      try {
        const raw = await response.text();
        body = raw ? JSON.parse(raw) : null;
      } catch {
        if (!response.ok && isRetryablePoetryStatus(response.status) && attempt < 2) {
          await waitForPoetryRetry(attempt);
          continue;
        }
        throw new Error(response.status === 524
          ? "上游文本模型网关超时（HTTP 524），模型暂时没有在网关时限内返回结果。请稍后重试，或检查 SUDOCODE_BASE_URL 与 SUDOCODE_TEXT_MODEL 是否可用。"
          : `诗词意境请求失败（HTTP ${response.status}）。`);
      }
      if (!response.ok) {
        const upstreamMessage = body?.error?.message || body?.message;
        const message = response.status === 524
          ? "上游文本模型网关超时（HTTP 524），模型暂时没有在网关时限内返回结果。"
          : upstreamMessage || `诗词意境请求失败（HTTP ${response.status}）。`;
        if (isRetryablePoetryStatus(response.status) && attempt < 2) {
          lastError = new Error(message);
          await waitForPoetryRetry(attempt);
          continue;
        }
        throw new Error(message + (response.status === 524 ? "请稍后重试，或检查 SUDOCODE_BASE_URL 与 SUDOCODE_TEXT_MODEL 是否可用。" : ""));
      }
      return parseModelContent(body);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= 2) break;
      // Network disconnects and gateway failures are often transient.
      await waitForPoetryRetry(attempt);
    }
  }
  throw lastError || new Error("诗词意境请求失败，请稍后重试。");
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
  const sensoryDetails = {
    visual: normalize(value.sensoryDetails?.visual).slice(0, 600),
    auditory: normalize(value.sensoryDetails?.auditory).slice(0, 600),
    spatial: normalize(value.sensoryDetails?.spatial).slice(0, 600),
    temporal: normalize(value.sensoryDetails?.temporal).slice(0, 600)
  };
  const analysis = {
    title: normalize(value.title).slice(0, 120),
    author: normalize(value.author).slice(0, 80),
    dynasty: normalize(value.dynasty).slice(0, 40),
    genre: normalize(value.genre).slice(0, 80),
    tags: normalizeList(value.tags, 12, 40),
    theme: normalize(value.theme).slice(0, 300),
    overview: normalize(value.overview).slice(0, 1200),
    translation: normalize(value.translation).slice(0, 3000),
    annotations: normalizeAnnotations(value.annotations),
    creationBackground: normalize(value.creationBackground).slice(0, 1800),
    historicalContext: normalize(value.historicalContext).slice(0, 1200),
    structureAnalysis: normalize(value.structureAnalysis).slice(0, 1200),
    literaryDevices: normalize(value.literaryDevices).slice(0, 1200),
    sensoryDetails,
    appreciation: normalize(value.appreciation).slice(0, 2400),
    timeAndPlace: normalize(value.timeAndPlace).slice(0, 500),
    emotionalArc: normalize(value.emotionalArc).slice(0, 500),
    coreImagery: normalizeList(value.coreImagery, 16, 80),
    lineReadings,
    allusions,
    uncertainties: normalizeList(value.uncertainties, 12, 400)
  };
  // Models occasionally omit one optional section when returning a long JSON object.
  // Keep the usable sections and let the editor fill the rest instead of rejecting the whole analysis.
  const hasUsableContent = analysis.theme || analysis.overview || analysis.translation || analysis.lineReadings.length;
  if (!hasUsableContent) {
    throw new Error("文本模型返回的诗词意境分析不完整。");
  }
  return analysis;
}

export function validatePoetryScenes(value, expectedCount) {
  const rawScenes = Array.isArray(value) ? value : [];
  if (rawScenes.length < 3) {
    throw new Error("文本模型返回了 " + rawScenes.length + " 个画面段落，至少需要 3 段；请重试或降低提示词复杂度。");
  }
  // Models occasionally add an extra scene despite the requested count. Keep the
  // first eight valid candidates, then trim again to the user's requested count.
  const scenes = rawScenes.slice(0, 8);
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
    userPrompt: `请根据下面经过确认的完整诗意分析，把原诗拆成恰好 ${count} 个连续画面段落。必须同时参考译文、注释、创作背景、历史语境、结构分析、表现手法、感官线索和逐句理解，不得只根据主题或表面关键词联想。\n诗词原文：\n${normalizedPoem}\n完整诗意分析：\n${JSON.stringify(validatedAnalysis)}`,
    temperature: 0.7,
    fetchImpl
  });
  const scenes = validatePoetryScenes(parsed.scenes, count);
  return {
    styleGuide: normalize(parsed.styleGuide).slice(0, 1000),
    characterBible: normalize(parsed.characterBible).slice(0, 2000),
    continuityGuide: normalize(parsed.continuityGuide).slice(0, 2000),
    scenes
  };
}
