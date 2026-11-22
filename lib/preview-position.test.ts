import {test} from 'node:test';import assert from 'node:assert/strict';import {previewPosition} from './preview-position';
test('short keyword popup above anchor uses measured height rather than a fixed estimate',()=>{
 const p=previewPosition({left:400,top:700,bottom:720},{width:392,height:180},{width:1440,height:800});assert.equal(p.top,512);assert.equal(700-(p.top+180),8);
});
test('popup fits below when possible and clamps horizontal edge',()=>{const p=previewPosition({left:1390,top:100,bottom:120},{width:392,height:180},{width:1440,height:900});assert.equal(p.top,128);assert.equal(p.left,1032)});
