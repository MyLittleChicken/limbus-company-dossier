import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supplement,supplementEgos} from './adapter.js';
import type {RawIndex} from '../v2/source.js';
import { buildIdentities } from '../v2/canonical/identities.js';
import { buildEgos } from '../v2/canonical/egos.js';
import { buildSkills } from '../v2/canonical/skills.js';
import { Meta } from '../v2/canonical/meta.js';
test('assets-only identity gains input and dependencies while authoritative existing values survive',()=>{
 const ids:RawIndex=new Map([['old',{star:2}]]);const details:RawIndex=new Map();const skills:RawIndex=new Map();const passives:RawIndex=new Map();
 supplement(ids,details,skills,passives,new Map([['10616',{sinnerId:6,rank:3,associations:['CINQ'],unitKeywords:['CINQ_UNIT'],panicSkill:'1061604',skillTypes:[{id:'1061601',num:3}]}]]),new Map([['10616',{skills:{'1061601':{data:[{uptie:1,baseValue:3}]}},passiveData:{p:{name:'passive'}}}]]));
 assert.equal(ids.get('10616')?.['star'],3);assert.equal(ids.get('old')?.['star'],2);assert.ok(skills.has('1061601'));assert.ok(passives.has('p'));
 assert.deepEqual(ids.get('10616')?.['associations'],['CINQ']);assert.deepEqual(details.get('10616')?.['unitKeywords'],['CINQ_UNIT']);assert.equal(details.get('10616')?.['panicSkill'],'1061604');
});
test('assets-only playable ego is present in builder enumeration',()=>{
 const mj:RawIndex=new Map();const details:RawIndex=new Map();supplementEgos(mj,details,new Map([['20310',{sinnerId:3,rank:'HE',name:'Scissors'}]]),new Map([['20310',{passiveList:['2031001']}]]));
 assert.equal(mj.get('20310')?.['sinnerId'],3);assert.deepEqual(details.get('20310')?.['awakeningPassives'],['2031001']);
});

test('assets keywords and named tags reach the identity builder without inventing skill slots', () => {
 const mj:RawIndex=new Map(), details:RawIndex=new Map(), skills:RawIndex=new Map(), passives:RawIndex=new Map();
 const assets:RawIndex=new Map([['10616',{sinnerId:6,rank:3,skillKeywordList:['Burn','Poise'],tags:['Cinq Association','Fixer'],skillTypes:[{id:'1061601',num:3}]}]]);
 const assetDetails:RawIndex=new Map([['10616',{}]]);
 supplement(mj,details,skills,passives,assets,assetDetails,{
  associations:new Map([['CINQ',{name:'Cinq Association'}]]),
  unitKeywords:new Map([['UnitKeyword_CINQ',{content:'Cinq Association'}],['UnitKeyword_FIXER',{content:'Fixer'}]]),
 });
 const result=buildIdentities({mj,mjDetail:details,assets,details:assetDetails,mjPassives:passives,
  locKo:new Map(),locEn:new Map(),locJa:new Map(),passiveKo:new Map(),passiveEn:new Map(),passiveJa:new Map(),
  knownSkills:new Set(['1061601']),knownAssociations:new Set(['CINQ']),knownKeywords:new Set(['Combustion','Breath']),knownStatuses:new Set(),
  keywordDict:new Map([['burn','Combustion'],['poise','Breath']]),
 },new Meta());
 assert.deepEqual(result.identityKeyword,[{identityId:'10616',keywordId:'Combustion',skillSlots:[]},{identityId:'10616',keywordId:'Breath',skillSlots:[]}]);
 assert.deepEqual(result.identityAssociation,[{identityId:'10616',associationId:'CINQ'}]);
 assert.deepEqual(result.identityUnitKeyword,[{identityId:'10616',keyword:'FIXER'}]);
 assert.equal(mj.get('10616')?.['keywordSkills'],undefined);
});

test('asset skill tier is read from its source field, not inferred from a slot or identifier', () => {
 const skills:RawIndex=new Map();const assetDetails:RawIndex=new Map([['10616',{skills:{'1061601':{tier:1,data:[{uptie:1,defType:'attack'}]},'1061604':{data:[{uptie:1,defType:'evade'}]}}}]]);
 supplement(new Map(),new Map(),skills,new Map(),new Map([['10616',{}]]),assetDetails);
 const result=buildSkills({mjSkills:skills,details:assetDetails,mjIdentityDetail:new Map(),locKo:new Map(),locEn:new Map(),locJa:new Map()},new Meta());
 assert.equal(result.skill.find(r=>r.id==='1061601')?.skillTier,1);
 assert.equal(result.skill.find(r=>r.id==='1061604')?.skillTier,null);
});

test('named ego passives resolve before builder input and retain translated descriptions', () => {
 const mj:RawIndex=new Map(), detail:RawIndex=new Map();
 const assets:RawIndex=new Map([['20310',{sinnerId:3,rank:'ZAYIN',name:'Scissors'}],['21210',{sinnerId:12,rank:'TETH',name:'Move-in Reg.'}]]);
 const assetDetails:RawIndex=new Map([['20310',{passiveList:[{name:"'Tis Thy Turn to Swallow the Needle!",desc:'asset wording'}]}],['21210',{passiveList:[{name:'Processing Transfer Reg'}]}]]);
 const loc:RawIndex=new Map([['2031011',{name:"'Tis Thy Turn to Swallow the Needle!",desc:'English needle'}],['2121011',{name:'Processing Transfer Reg',desc:'English transfer'}]]);
 supplementEgos(mj,detail,assets,assetDetails,loc);
 assert.deepEqual(detail.get('20310')?.['awakeningPassives'],['2031011']);
 assert.deepEqual(detail.get('21210')?.['awakeningPassives'],['2121011']);
 assert.deepEqual(assetDetails.get('21210')?.['passiveList'],[{name:'Processing Transfer Reg'}]);
 const result=buildEgos({mj,mjDetail:detail,assets,details:assetDetails,locEgoKo:new Map(),locEgoEn:new Map(),locEgoJa:new Map(),
  locSkillKo:new Map(),locSkillEn:new Map(),locSkillJa:new Map(),locPassiveKo:new Map([['2121011',{name:'전입 처리',desc:'한국어 설명'}]]),locPassiveEn:loc,locPassiveJa:new Map(),knownSinners:new Set([3,12]),knownStatuses:new Set(),},new Meta());
 assert.deepEqual(result.egoPassiveLink,[{egoId:'20310',passiveId:'2031011'},{egoId:'21210',passiveId:'2121011'}]);
 assert.ok(result.egoPassiveText.some(r=>r.passiveId==='2121011'&&r.locale==='ko'&&r.desc==='한국어 설명'));
});

test('ambiguous or missing passive names fail closed, while authoritative detail is preserved', () => {
 const assets:RawIndex=new Map([['20310',{sinnerId:3,rank:'ZAYIN'}]]);
 const assetDetails:RawIndex=new Map([['20310',{passiveList:[{name:'Same'}]}]]);
 for(const loc of [new Map(),new Map([['one',{name:'Same'}],['two',{name:'Same'}]])]) {
  assert.throws(()=>supplementEgos(new Map(),new Map(),assets,assetDetails,loc),/20310.*Same/);
 }
 const original={awakeningPassives:['canonical-source-id']};const detail:RawIndex=new Map([['20310',original]]);
 supplementEgos(new Map([['20310',{name:'primary'}]]),detail,assets,assetDetails,new Map());
 assert.equal(detail.get('20310'),original);
});


test('source no-affinity sentinel becomes nullable canonical sin without losing real affinities', () => {
 const skills:RawIndex=new Map([['existing',{sin:'wrath'}]]);
 const assetDetails:RawIndex=new Map([['10616',{skills:{
  '1061604':{tier:1,data:[{uptie:1,affinity:'none',defType:'evade'}]},
  '1061601':{tier:1,data:[{uptie:1,affinity:'gloom',defType:'attack'}]},
  'existing':{data:[{uptie:1,affinity:'none'}]},
 }}]]);
 supplement(new Map(),new Map(),skills,new Map(),new Map([['10616',{}]]),assetDetails);
 const result=buildSkills({mjSkills:skills,details:assetDetails,mjIdentityDetail:new Map(),locKo:new Map(),locEn:new Map(),locJa:new Map()},new Meta());
 assert.equal(result.skill.find(r=>r.id==='1061604')?.sin,null);
 assert.equal(result.skill.find(r=>r.id==='1061604')?.skillTier,1);
 assert.equal(result.skill.find(r=>r.id==='1061601')?.sin,'gloom');
 assert.equal(skills.get('existing')?.['sin'],'wrath');
 assert.equal(((assetDetails.get('10616')?.['skills'] as Record<string,{data:{affinity:string}[]}> )['1061604']?.data[0])?.affinity,'none');
});


test('removed source identity holds shared skill/passive roots and every descendant out of the candidate', async () => {
 const {preserveMissingIdentityDependencies}=await import('./candidate.js');
 const calls:unknown[]=[];
 const db={identitySkill:{findMany:async (args:unknown)=>{calls.push(args);return [{identityId:'held',skillId:'shared-s'}];}},identityPassive:{findMany:async (args:unknown)=>{calls.push(args);return [{identityId:'held',passiveId:'shared-p'}];}}};
 const tables:Record<string,Record<string,unknown>[]>={
  skill:[{id:'shared-s'},{id:'fresh-s'}],passive:[{id:'shared-p'},{id:'fresh-p'}],
  identitySkill:[{identityId:'fresh',skillId:'shared-s'}],identityPassive:[{identityId:'fresh',passiveId:'shared-p'}],
  egoSkill:[{id:'shared-s',egoId:'ego'}],
 };
 for(const name of ['skillStage','skillStageText','skillCoin'])tables[name]=[{skillId:'shared-s'},{skillId:'fresh-s'}];
 for(const name of ['passiveRequirement','passiveText'])tables[name]=[{passiveId:'shared-p'},{passiveId:'fresh-p'}];
 const meta=new Meta();
 const removed=await preserveMissingIdentityDependencies(db as never,tables,['held','fresh'],new Set(['fresh']),meta);
 assert.deepEqual(removed,['held']);
 for(const args of calls)assert.deepEqual((args as {where:unknown}).where,{identityId:{in:['held']}});
 assert.deepEqual(tables.skill,[{id:'fresh-s'}]);assert.deepEqual(tables.passive,[{id:'fresh-p'}]);
 for(const name of ['skillStage','skillStageText','skillCoin'])assert.deepEqual(tables[name],[{skillId:'fresh-s'}]);
 for(const name of ['passiveRequirement','passiveText'])assert.deepEqual(tables[name],[{passiveId:'fresh-p'}]);
 assert.equal(tables.identitySkill?.length,1);assert.equal(tables.identityPassive?.length,1);assert.equal(tables.egoSkill?.length,1);
 assert.ok(meta.gaps.some(g=>g.entityId==='held'&&g.evidence.includes('shared-s')&&g.evidence.includes('shared-p')));
 assert.ok(meta.sources.some(s=>s.entity==='skill'&&s.entityId==='shared-s'&&s.rule==='preserved-db'));
 const unchanged=structuredClone(tables);
 await preserveMissingIdentityDependencies({} as never,tables,['fresh'],new Set(['fresh']),new Meta());
 assert.deepEqual(tables,unchanged);
});
