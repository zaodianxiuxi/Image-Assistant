import assert from "node:assert/strict";
import test from "node:test";
import { analyzePoetry, generatePoetryScenes, validatePoetryAnalysis, validatePoetryScenes } from "./poetry-generator.mjs";

const VALID_ANALYSIS = {
  title: "江雪",
  author: "柳宗元",
  dynasty: "唐",
  genre: "五言绝句",
  tags: ["写景", "抒情"],
  theme: "天地寂静中的孤高与坚守",
  overview: "诗人以极寒、空寂的江雪景象，衬托孤舟独钓者的孤绝姿态。",
  translation: "群山中的飞鸟已经绝迹，所有道路都不见行人。一叶孤舟上坐着披蓑戴笠的老人，独自在寒江上垂钓。",
  annotations: [{ term: "蓑笠翁", explanation: "披着蓑衣、戴着斗笠的老人。" }],
  creationBackground: "柳宗元被贬永州期间所作，具体年份存在不同说法。",
  historicalContext: "作品常被置于诗人贬谪后的精神处境中理解。",
  structureAnalysis: "前两句铺陈天地空寂，后两句聚焦孤舟独钓的人物形象。",
  literaryDevices: "以夸张和对比写空寂，以景结情。",
  sensoryDetails: { visual: "群山、飞雪、孤舟与蓑笠翁。", auditory: "万籁俱寂。", spatial: "由群山道路推向江心孤舟。", temporal: "寒冬大雪之中。" },
  appreciation: "全诗以极简笔墨营造空旷寒寂的境界，孤舟独钓成为孤高清峻精神的象征。",
  timeAndPlace: "冬日雪后的江面，天地开阔而寂静。",
  emotionalArc: "由万物绝迹的空寂，收束到独钓者沉静而坚定的孤独。",
  coreImagery: ["群山", "飞雪", "孤舟", "蓑笠翁", "寒江"],
  lineReadings: [
    { sourceLine: "千山鸟飞绝，万径人踪灭", meaning: "群山不见飞鸟，所有道路也没有行人。", emotion: "极度空寂", visualFocus: "雪山、空路与无人的天地" },
    { sourceLine: "孤舟蓑笠翁，独钓寒江雪", meaning: "一位披蓑戴笠的老人独自在寒江垂钓。", emotion: "孤独而坚守", visualFocus: "江心小舟、老人和钓竿" }
  ],
  allusions: [],
  uncertainties: []
};

function scenes(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    title: "江南暮色" + (index + 1),
    sourceLine: "烟雨与归舟的意象段落 " + (index + 1),
    mood: "空濛而含蓄，情绪随着远景逐渐沉静。",
    prompt: "中国古代江南水乡，暮春薄雾中的青石桥和乌篷船，身着素色长衫的旅人站在岸边回望，远处层叠屋檐隐入烟雨，水面倒映微弱天光，前景芦苇、中景人物、远景山影形成纵深，冷青灰与一线暖金色调，写实电影摄影，细腻材质，克制留白。"
  }));
}

test("turns a poem into validated visual scenes", async () => {
  const result = await generatePoetryScenes({
    apiBase: "https://example.test/v1",
    apiKey: "test-key",
    model: "test-model",
    poem: "孤舟蓑笠翁，独钓寒江雪。",
    analysis: VALID_ANALYSIS,
    sceneCount: 4,
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.match(body.messages[1].content, /恰好 4 个/);
      assert.match(body.messages[1].content, /经过确认的完整诗意分析/);
      assert.match(body.messages[1].content, /天地寂静中的孤高与坚守/);
      assert.match(body.messages[0].content, /禁止随意换装/);
      assert.match(body.messages[0].content, /重复 characterBible/);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ styleGuide: "统一冷青灰冬日电影质感。", characterBible: "固定中年文士，青色长袍、黑色幞头。", continuityGuide: "后续分镜禁止换装。", scenes: scenes(4) }) } }] }), { status: 200 });
    }
  });
  assert.equal(result.scenes.length, 4);
  assert.equal(result.scenes[0].sceneOrder, 1);
  assert.equal(result.styleGuide, "统一冷青灰冬日电影质感。");
  assert.equal(result.characterBible, "固定中年文士，青色长袍、黑色幞头。");
  assert.equal(result.continuityGuide, "后续分镜禁止换装。");
  assert.equal(/16:9|9:16|1:1/.test(result.scenes[0].prompt), false);
});

test("analyzes a poem before generating storyboard prompts", async () => {
  const analysis = await analyzePoetry({
    apiBase: "https://example.test/v1",
    apiKey: "test-key",
    model: "test-model",
    poem: "千山鸟飞绝，万径人踪灭。",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.match(body.messages[1].content, /不要生成分镜或出图提示词/);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(VALID_ANALYSIS) } }] }), { status: 200 });
    }
  });
  assert.deepEqual(analysis, VALID_ANALYSIS);
});

test("validates confirmed poetry analysis", () => {
  assert.deepEqual(validatePoetryAnalysis(VALID_ANALYSIS), VALID_ANALYSIS);
  assert.throws(() => validatePoetryAnalysis({}), /分析不完整/);
  const partial = validatePoetryAnalysis({ title: "江雪", overview: "天地空寂。", lineReadings: [] });
  assert.equal(partial.overview, "天地空寂。");
  assert.deepEqual(partial.tags, []);
});

test("trims an occasional extra storyboard scene instead of failing", () => {
  assert.equal(validatePoetryScenes(scenes(9), 8).length, 8);
  assert.throws(() => validatePoetryScenes(scenes(2), 6), /返回了 2 个画面段落/);
});

test("requires a poem and text model", async () => {
  await assert.rejects(() => analyzePoetry({ apiBase: "x", apiKey: "k", model: "", poem: "春江花月夜" }), /未配置 SUDOCODE_TEXT_MODEL/);
  await assert.rejects(() => generatePoetryScenes({ apiBase: "x", apiKey: "k", model: "m", poem: "", analysis: VALID_ANALYSIS }), /请输入诗词原文/);
  await assert.rejects(() => generatePoetryScenes({ apiBase: "x", apiKey: "k", model: "m", poem: "春江花月夜", analysis: null }), /分析/);
});

test("retries transient poetry gateway timeouts", async () => {
  let attempts = 0;
  const result = await analyzePoetry({
    apiBase: "https://example.test/v1",
    apiKey: "test-key",
    model: "test-model",
    poem: "千山鸟飞绝，万径人踪灭。",
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 2) return new Response("gateway timeout", { status: 524 });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(VALID_ANALYSIS) } }] }), { status: 200 });
    }
  });
  assert.equal(result.title, VALID_ANALYSIS.title);
  assert.equal(attempts, 2);
});
