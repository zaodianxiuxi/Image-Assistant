import test from 'node:test';
import assert from 'node:assert/strict';
import { exportFileStem, storyExportSnapshot, storyExportText, wrapExportText, paginateExport } from './story-export-data.mjs';

const project = () => ({ title: '草稿', plan: { title: '雨天/出门', synopsis: '一个雨天的故事', shots: [
  { id: 'b', title: '窗边', storyText: '看见下雨。' }, { id: 'a', title: '出门', storyText: '走进雨里。' }, { id: 'c', title: '远方', storyText: '' }
] }, results: { b: { image: '/selected.png' }, a: { image: '/old.png', stale: true } }, shotVersions: { b: [{ result: { image: '/candidate.png' } }] } });

test('snapshot preserves planned order and only the adopted images without mutating project', () => {
  const p=project(), before=structuredClone(p), s=storyExportSnapshot(p,false);
  assert.deepEqual(s.shots.map(x=>[x.number,x.image,x.status]), [[1,'/selected.png','已生成'],[2,'/old.png','需重拍 · 当前为旧画面'],[3,null,'待生成']]);
  assert.equal(s.incomplete,2); assert.deepEqual(p,before);
  p.results.b.image='/later.png'; assert.equal(s.shots[0].image,'/selected.png');
});
test('export text includes all captions, missing shots and input-change warning without prompts', () => {
  const s=storyExportSnapshot(project(),true), text=storyExportText(s);
  assert.match(text,/上次规划/); assert.match(text,/02 · 出门/); assert.match(text,/需重拍/); assert.match(text,/03 · 远方/); assert.match(text,/待生成/); assert.doesNotMatch(text,/candidate/);
});
test('filenames retain Chinese but cannot create paths, reserved names or excessive lengths', () => {
  assert.equal(exportFileStem('../雨天\\出门:*?'), '雨天-出门');
  assert.equal(exportFileStem('CON'),'故事-CON'); assert.equal(exportFileStem('...'),'故事');
  assert.ok(Array.from(exportFileStem('雨'.repeat(150))).length<=60);
});
test('empty or over-limit projects are rejected; image errors are reflected', () => {
  assert.throws(()=>storyExportSnapshot({results:{}},false),/分镜/);
  const p=project(); p.plan.shots=Array.from({length:13},(_,i)=>({id:String(i)})); assert.throws(()=>storyExportSnapshot(p,false),/12/);
  const failed=project(); failed.results.b.error='failed'; assert.equal(storyExportSnapshot(failed,false).shots[0].status,'生成失败 · 保留画面');
});
test('text wrapping preserves newlines and Unicode graphemes without splitting emoji', () => {
  assert.deepEqual(wrapExportText('春雨\n\n小路',2,s=>Array.from(s).length),['春雨','','小路']);
  const emoji='一家👨‍👩‍👧‍👦出门';
  const lines=wrapExportText(emoji,2,s=>[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(s)].length);
  assert.deepEqual(lines,['一家','👨‍👩‍👧‍👦出','门']);
  assert.equal(wrapExportText('abcdef',2,s=>s.length).join(''),'abcdef');
});
test('pagination never splits a shot or exceeds canvas limits, including introductory page', () => {
  const pages=paginateExport([400,500,300],300,150,1000);
  assert.deepEqual(pages,[{indices:[0],height:700},{indices:[1,2],height:950}]);
  assert.deepEqual(paginateExport([800],300,150,1000),[{indices:[],height:300},{indices:[0],height:950}]);
  assert.throws(()=>paginateExport([900],300,150,1000),/过长/);
  assert.throws(()=>paginateExport([100],1100,150,1000),/过长/);
});
