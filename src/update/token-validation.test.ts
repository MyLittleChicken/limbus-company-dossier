import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTextTokens } from './token-validation.js';

test('unknown tokens in descriptions and coin effects report exact locations', () => {
 const report = validateTextTokens({
  egoSkillStageText: [{skillId:'2021111',uptie:4,locale:'ko',desc:'[NewTiming] 효과'}],
  skillCoin: [{skillId:'1031501',uptie:4,index:1,locale:'en',effects:['[NewBuff] 2','[NewBuff] 3']}],
 }, [], []);
 assert.equal(report.ok, false);
 assert.deepEqual(report.issues.map(i=>[i.table,i.key,i.locale,i.field,i.token]), [
  ['egoSkillStageText',{skillId:'2021111',uptie:4},'ko','desc','NewTiming'],
  ['skillCoin',{skillId:'1031501',uptie:4,index:1},'en','effects[0]','NewBuff'],
  ['skillCoin',{skillId:'1031501',uptie:4,index:1},'en','effects[1]','NewBuff'],
 ]);
});

test('known source tokens, translated labels, statuses and numeric notes are accepted', () => {
 const report=validateTextTokens({egoPassiveText:[{passiveId:'p',locale:'en',desc:'[OnSucceedAttack] [On Hit] [Charge] [+0.2] [3] [상시 효과]'}]},
 [{termId:'OnSucceedAttack',locale:'en',name:'[On Hit]'}], [{statusId:'Charge',locale:'en',name:'Charge'}]);
 assert.equal(report.ok,true);
});

test('candidate dictionaries override stored rows, and another locale cannot hide a missing translation', () => {
 const report=validateTextTokens({termText:[{termId:'NewTiming',locale:'ko',name:'[새 조건]'}],
 egoSkillStageText:[{skillId:'s',uptie:1,locale:'ko',desc:'[NewTiming] [OnlyEnglish]'}]},
 [{termId:'OnlyEnglish',locale:'en',name:'[English only]'}], []);
 assert.deepEqual(report.issues.map(i=>i.token),['OnlyEnglish']);
});

test('unknown raw tokens are checked even if display text was silently stripped', () => {
 const report=validateTextTokens({passiveText:[{passiveId:'p',locale:'ko',desc:'효과',descRaw:'[Missing] 효과'}]},[],[]);
 assert.equal(report.issues[0]?.token,'Missing');
});

test('bracketed labels inside Unity-marked names are not mistaken for missing tokens', () => {
 const report=validateTextTokens({skillStageText:[{skillId:'s',uptie:4,locale:'en',desc:'The Middle - Vengeance Tattoo [Great Sister]'}]},
 [{termId:'Tattoo',locale:'en',name:'The Middle - Vengeance Tattoo [<s>Great Sister</s>]'}],[]);
 assert.equal(report.ok,true);
});

test('removed localized dictionary rows cannot pass using stale DB translations', () => {
 const report=validateTextTokens({term:[{id:'Timing'}],termText:[{termId:'Timing',locale:'en',name:'[On Hit]'}],
 egoPassiveText:[{passiveId:'p',locale:'ko',desc:'[Timing] 효과'}]},
 [{termId:'Timing',locale:'ko',name:'[적중시]'}],[]);
 assert.deepEqual(report.issues.map(i=>i.token),['Timing']);
});

test('gift text validates internal tokens while allowing reviewed English bracket headings',()=>{
 const r=validateTextTokens({giftStageText:[{giftId:'9288',level:0,locale:'en',desc:'[Cannot Stack] [SewingKingMark]'}]},[],[]);
 assert.deepEqual(r.issues.map(i=>[i.key,i.token]),[[{giftId:'9288',level:0},'SewingKingMark']]);
});

 test('reviewed Walpurgis 10 gift headings do not exempt missing status tokens',()=>{
 const r=validateTextTokens({giftStageText:[{giftId:'9297',level:0,locale:'en',desc:'[Wedge Office Rep Outis Exclusive Effect] [Wild Hunt Heathcliff exclusive effect] [Effect exclusive to Identities that have 2 or more Minus Coin Skills] [UnknownWalpuToken]'}]},[],[]);
 assert.deepEqual(r.issues.map(i=>i.token),['UnknownWalpuToken']);
 });
