import assert from 'node:assert/strict';
import test from 'node:test';
import * as generator from './story-inspiration.mjs';

const options = { apiBase: 'https://example.test/v1', apiKey: 'test', model: 'text-model' };
const ideas = ['夜班车', '纸船', '旧相机'].map(title => ({ title, premise: '一个人想归还遗失物，却发现主人已离开。', turn: '他用一个小动作留下归还的线索。', ending: '两个人在原处相遇，完成归还。', visualHook: '雨中长椅上的小纸船' }));
const provider = (value, inspect = () => {}) => async (url, init) => {
  inspect(url, JSON.parse(init.body));
  return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
};
test('returns three complete ideas using preferences and excluding previous titles', async () => {
  const result = await generator.generateStoryIdeas({ ...options, genre: '现代生活', mood: '温暖治愈', keywords: '夜班', previousTitles: ['旧雨伞'], fetchImpl: provider({ ideas }, (url, body) => {
    assert.equal(url, 'https://example.test/v1/chat/completions');
    assert.equal(body.model, options.model);
    assert.match(body.messages[1].content, /夜班/);
    assert.match(body.messages[1].content, /旧雨伞/);
  }) });
  assert.equal(result.length, 3);
  assert.equal(result[0].title, '夜班车');
});
test('rejects incomplete or repeated cards and overlong input', async () => {
  await assert.rejects(() => generator.generateStoryIdeas({ ...options, fetchImpl: provider({ ideas: ideas.slice(0, 2) }) }), /三个/);
  await assert.rejects(() => generator.generateStoryIdeas({ ...options, fetchImpl: provider({ ideas: [ideas[0], ideas[0], ideas[2]] }) }), /重复/);
  await assert.rejects(() => generator.generateStoryIdeas({ ...options, keywords: '字'.repeat(501), fetchImpl: () => assert.fail('no request') }), /关键词/);
});
test('expands the selected idea into editable prose and rejects empty prose', async () => {
  const draft = { title: '夜班车', story: '夜班结束后，她在车站发现一封没有寄出的信。'.repeat(12) };
  assert.deepEqual(await generator.expandStoryIdea({ ...options, idea: ideas[0], fetchImpl: provider(draft) }), draft);
  await assert.rejects(() => generator.expandStoryIdea({ ...options, idea: ideas[0], fetchImpl: provider({ title: '夜班车', story: '' }) }), /正文/);
});
test('reports upstream and malformed responses without returning partial content', async () => {
  await assert.rejects(() => generator.generateStoryIdeas({ ...options, fetchImpl: async () => new Response('bad gateway', { status: 502 }) }), /502/);
  await assert.rejects(() => generator.generateStoryIdeas({ ...options, fetchImpl: async () => Response.json({ choices: [{ message: { content: 'not json' } }] }) }), /JSON/);
});
