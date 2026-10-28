import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJourneyRoute } from './journey-route.mjs';
test('route handles empty and single-station paths',()=>{assert.deepEqual(buildJourneyRoute([]),{path:'',progress:[]});assert.deepEqual(buildJourneyRoute([{x:10,y:20,exitY:60}]),{path:'',progress:[0]});});
test('route leaves a picture below its bottom before crossing to the next pin',()=>{const route=buildJourneyRoute([{x:40,y:20,exitY:300},{x:200,y:400,exitY:700}]);assert.match(route.path,/M 40 20 L 40 300 C 40 350, 200 350, 200 400/);assert.deepEqual(route.progress,[0,1]);});
test('highlight distances follow unequal station heights',()=>{const route=buildJourneyRoute([{x:40,y:0,exitY:60},{x:40,y:100,exitY:360},{x:40,y:400,exitY:500}]);assert.ok(Math.abs(route.progress[1]-.25)<.0001);assert.equal(route.progress[2],1);});
