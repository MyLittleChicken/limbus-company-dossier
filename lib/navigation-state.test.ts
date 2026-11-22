import {test} from 'node:test';import assert from 'node:assert/strict';
import {listStateKey,validStage,readListState} from './navigation-state';
test('list session keys preserve filters but work across languages and parameter order',()=>{
 assert.equal(listStateKey('/ko/identities','sinner=3&keyword=Poise'),listStateKey('/en/identities','keyword=Poise&sinner=3'));
 assert.notEqual(listStateKey('/ko/gifts','tier=3'),listStateKey('/ko/gifts','tier=4'));
});
test('detail stage defaults to highest for absent or invalid shared values',()=>{
 assert.equal(validStage(null,[1,3,5]),5);assert.equal(validStage('2',[1,3,5]),5);assert.equal(validStage('3',[1,3,5]),3);
});
test('session snapshots reject malformed storage and clamp excessive list count',()=>{
 assert.equal(readListState('broken'),null);assert.equal(readListState('{"limit":-4}'),null);
 assert.equal(readListState(JSON.stringify({limit:144,anchor:'10103',offset:90,y:800}))?.limit,144);
});
