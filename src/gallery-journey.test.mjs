import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGalleryJourney } from './gallery-journey.mjs';
const node = (key, order, items) => ({ key, title:key, nodeId:order, nodeOrder:order, items });
test('journey follows node order, not the time the pictures were generated', () => {
  const result = buildGalleryJourney({ nodes:[node('last', 3, [{id:'3'}]), node('first',1,[{id:'1'}]),node('middle',2,[{id:'2'}])] });
  assert.deepEqual(result.steps.map(s=>s.key),['first','middle','last']);
});
test('journey selects a delivery version and retains every alternative', () => {
  const latest={id:'new'}, delivered={id:'approved',isDelivery:true}, old={id:'old'};
  const result=buildGalleryJourney({nodes:[node('one',1,[latest,delivered,old])]});
  assert.equal(result.steps[0].item,delivered);
  assert.deepEqual(result.steps[0].alternatives,[latest,old]);
});
test('journey uses the newest grouped image when no delivery is designated', () => {
  const result=buildGalleryJourney({nodes:[node('one',1,[{id:'new'},{id:'old'}])]});
  assert.equal(result.steps[0].item.id,'new');
});
test('unsequenced pictures stay available without inventing a historical order', () => {
  const missing=node('unassigned',null,[{id:'a'},{id:'b'}]);
  const empty=node('empty',2,[]);
  const result=buildGalleryJourney({nodes:[missing,empty,node('valid',1,[{id:'c'}])]});
  assert.deepEqual(result.steps.map(s=>s.key),['valid']);
  assert.deepEqual(result.unsequenced.map(item=>item.id),['a','b']);
});
test('building a journey does not reorder or mutate gallery records', () => {
  const items=Object.freeze([Object.freeze({id:'1'})]);
  const nodes=Object.freeze([Object.freeze(node('later',2,items)),Object.freeze(node('earlier',1,items))]);
  buildGalleryJourney(Object.freeze({nodes}));
  assert.deepEqual(nodes.map(n=>n.key),['later','earlier']);
});
test('empty collections return an empty journey',()=>{
  assert.deepEqual(buildGalleryJourney({nodes:[]}),{steps:[],unsequenced:[]});
});
