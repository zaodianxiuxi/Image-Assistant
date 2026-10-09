import { buildStoryImagePrompt } from "../src/storyboard-continuity.mjs";

const SYSTEM_PROMPT = [
  '你是一名擅长自然表演、空间调度与连续叙事的分镜导演。根据故事本身判断时代和类型，尊重用户风格偏好，默认自然写实摄影，不给所有故事套用同一种题材。',
  '先梳理人物动机、起因、发展、转折和结果，再规划人物、场景和连续镜头。只返回 JSON 对象，不要 Markdown。',
  '格式：{"title":"故事名","synopsis":"因果梗概","styleGuide":"统一视觉风格","characters":[{"id":"c1","name":"姓名","description":"固定年龄外貌、发型、服装配饰、关键道具"}],"settings":[{"id":"l1","name":"地点","description":"时代时段、布局、出入口、光源和固定物件"}],"shots":[{"title":"镜头名","storyText":"这一镜推进了什么","characterIds":["c1"],"settingId":"l1","framing":"景别、机位、主体在画面中的位置","action":"一个可见动作","emotion":"克制的表情及明确视线目标","continuity":"上一镜如何引出此镜，人物行进方向、道具状态、时间变化；首镜交代起点","prompt":"这一镜的具体画面细节"}]}。',
  '角色不超过4个，场景1到6个。角色/场景id唯一，每镜仅引用已声明且真正出场的角色和场景。无人镜头的characterIds为空数组。不得为了保持一致而让主角出现在所有镜头。',
  '未指定镜头数时按情节需要选择4到12镜，不填充重复镜头。每镜只能描述单一瞬间，禁止在一张静态图片中写镜头推进、先后动作或多处场景切换。',
  '用建立镜头、动作镜头、细节、反应镜头组织因果与节奏，不机械轮换景别。动作中间态要清楚，目光、手脚接触和重心可信；人物不对镜头摆姿势。',
  '相邻镜头保持时间、服装、空间轴线和道具状态；变化必须有故事依据。换地点需建立新空间，不继承旧背景。固定人物身份不等于固定姿势和构图。',
  'prompt写80到350字的可见画面，不堆砌电影感或高清等空泛词语，不出现画幅、尺寸、比例。title简短；所有自然语言字段用中文。'
].join('\n');
const text = (value, max = 1600) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const stripRatio = value => text(value).replace(/(?:画幅|比例|宽高比)?(?:为|是)?\s*(?:1:1|16:9|9:16)/gu, '').trim();

function entities(value, name, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${name}数量不正确。`);
  const seen = new Set();
  return value.map(item => {
    const entity = { id: text(item?.id, 40), name: text(item?.name, 80), description: text(item?.description, 1600) };
    if (!/^[a-zA-Z0-9_-]+$/.test(entity.id) || seen.has(entity.id) || !entity.name || !entity.description) throw new Error(`${name}设定不完整或ID重复。`);
    seen.add(entity.id);
    return entity;
  });
}

export function validateStoryPlan(value, shotCount = 0) {
  const characters = entities(value?.characters, '人物', 0, 4);
  const settings = entities(value?.settings, '场景', 1, 6);
  const raw = value?.shots;
  if (!Array.isArray(raw) || raw.length < 4 || raw.length > 12 || (shotCount && raw.length !== shotCount)) throw new Error(shotCount ? `需要恰好 ${shotCount} 个镜头，请重新规划。` : '故事需要4到12个镜头。');
  const shots = raw.map((item, index) => {
    if (!Array.isArray(item?.characterIds) || item.characterIds.some(id => !characters.some(c => c.id === id))) throw new Error(`第${index + 1}镜引用了未定义的人物。`);
    if (!settings.some(s => s.id === item.settingId)) throw new Error(`第${index + 1}镜引用了未定义的场景。`);
    const shot = { id: `shot-${index + 1}`, title: text(item.title, 40), storyText: text(item.storyText, 500), characterIds: [...new Set(item.characterIds)], settingId: item.settingId, framing: text(item.framing, 500), action: text(item.action, 500), emotion: text(item.emotion, 500), continuity: text(item.continuity, 900), prompt: stripRatio(item.prompt) };
    if (!shot.continuity) throw new Error(`第${index + 1}镜缺少衔接说明。`);
    if (![shot.title, shot.storyText, shot.framing, shot.action, shot.emotion].every(Boolean) || shot.prompt.length < 30) throw new Error(`第${index + 1}镜的分镜信息不完整。`);
    return shot;
  });
  const result = { title: text(value.title, 120), synopsis: text(value.synopsis, 2000), styleGuide: text(value.styleGuide, 1600), characters, settings, shots };
  if (!result.title || !result.synopsis || !result.styleGuide) throw new Error('缺少故事梗概或视觉风格。');
  return result;
}

export async function generateStoryPlan({ apiBase, apiKey, model, story, seriesName, shotCount = 0, style = '', fetchImpl = fetch }) {
  if (!model) throw new Error('未配置 SUDOCODE_TEXT_MODEL，无法规划故事分镜。');
  if (!apiKey) throw new Error('未配置 SUDOCODE_API_KEY，无法规划故事分镜。');
  if (typeof story !== 'string' || !story.trim() || story.length > 20000) throw new Error('请输入1到20000字的故事。');
  const count = Number(shotCount);
  if (!Number.isInteger(count) || (count !== 0 && (count < 4 || count > 12))) throw new Error('镜头数需为4到12，或0表示自动。');
  const response = await fetchImpl(apiBase.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({ model, messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `系列名：${text(seriesName, 120) || '未命名故事'}\n镜头数量：${count ? `恰好${count}镜` : '按情节自动选择4到12镜'}\n风格偏好：${text(style, 1500) || '根据故事设定，自然写实'}\n故事原文：\n${story.trim()}` }
    ] })
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { throw new Error(`故事规划服务返回异常（HTTP ${response.status}），请稍后重试。`); }
  if (!response.ok) throw new Error(body?.error?.message || `故事规划失败（HTTP ${response.status}）。`);
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('文本模型未返回可解析的分镜内容。');
  let parsed;
  try { parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')); }
  catch { throw new Error('文本模型返回的分镜不是有效 JSON。'); }
  return validateStoryPlan(parsed, count);
}

export async function generateStoryboard(options) {
  const plan = await generateStoryPlan(options);
  return plan.shots.map((shot, index) => ({ nodeOrder: index + 1, title: shot.title, storyText: shot.storyText, prompt: buildStoryImagePrompt(plan, shot) }));
}
