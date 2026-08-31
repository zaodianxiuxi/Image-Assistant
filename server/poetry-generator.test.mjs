import assert from "node:assert/strict";
import test from "node:test";
import { analyzePoetry, generatePoetryScenes, validatePoetryAnalysis } from "./poetry-generator.mjs";

const VALID_ANALYSIS = {
  title: "江雪",
  author: "柳宗元",
  dynasty: "唐",
  theme: "天地寂静中的孤高与坚守",
  overview: "诗人以极寒、空寂的江雪景象，衬托孤舟独钓者的孤绝姿态。",
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
      assert.match(body.messages[1].content, /经过确认的诗意分析/);
      assert.match(body.messages[1].content, /天地寂静中的孤高与坚守/);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ styleGuide: "统一冷青灰冬日电影质感。", scenes: scenes(4) }) } }] }), { status: 200 });
    }
  });
  assert.equal(result.scenes.length, 4);
  assert.equal(result.scenes[0].sceneOrder, 1);
  assert.equal(result.styleGuide, "统一冷青灰冬日电影质感。");
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
  assert.throws(() => validatePoetryAnalysis({ ...VALID_ANALYSIS, lineReadings: [] }), /分析不完整/);
});

test("requires a poem and text model", async () => {
  await assert.rejects(() => analyzePoetry({ apiBase: "x", apiKey: "k", model: "", poem: "春江花月夜" }), /未配置 SUDOCODE_TEXT_MODEL/);
  await assert.rejects(() => generatePoetryScenes({ apiBase: "x", apiKey: "k", model: "m", poem: "", analysis: VALID_ANALYSIS }), /请输入诗词原文/);
  await assert.rejects(() => generatePoetryScenes({ apiBase: "x", apiKey: "k", model: "m", poem: "春江花月夜", analysis: null }), /分析/);
});
