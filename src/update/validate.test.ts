import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Meta} from '../v2/canonical/meta.js';
import type {Candidate} from './candidate.js';
import {validateCandidate} from './validate.js';

function candidate():Candidate {
 return {tables:{identity:[],ego:[]},meta:new Meta(),identityIds:[],egoIds:[],newIdentityIds:[],newEgoIds:[],removed:{identities:[],egos:[]},rawFiles:[],rawObjects:[]};
}
test('a source identity dropped by the converter blocks publication',()=>{
 const c=candidate();c.rawObjects.push({source:'limbus-assets',srcPath:'identities/limbus-assets/identities.json',id:'99999',payload:{}});
 assert.ok(validateCandidate(c).errors.some(x=>x.includes('99999')));
});
test('invalid relation IDs and duplicate primary keys block publication',()=>{
 const c=candidate();c.tables['egoPassiveLink']=[{egoId:'99999',passiveId:'undefined'},{egoId:'99999',passiveId:'undefined'}];
 const errors=validateCandidate(c).errors;
 assert.ok(errors.some(x=>x.includes('undefined')));
 assert.ok(errors.some(x=>x.includes('duplicate')));
});
test('missing names are rejected instead of reporting a successfully added identity',()=>{
 const c=candidate();c.identityIds=['99999'];c.tables['identity']=[{id:'99999',sinnerId:1,star:3,teamCodeEligible:false,season:0,hp:80,hpLevel:2,stagger:[],defCorrection:0,releaseDate:null}];
 c.rawObjects.push({source:'limbus-assets',srcPath:'identities/limbus-assets/identities.json',id:'99999',payload:{}});
 assert.ok(validateCandidate(c).errors.some(x=>x.includes('99999')&&x.includes('name')));
});
test('source sentinels cannot enter a database enum as literal strings',()=>{
 const c=candidate();c.tables['skill']=[{id:'9999901',sin:'none',attackType:null,kind:'evade',skillTier:1}];
 assert.ok(validateCandidate(c).errors.some(x=>x.includes('sin')&&x.includes('none')));
});
test('new linked skill stages require ko/en names and source skill links cannot disappear',()=>{
 const c=candidate();c.newIdentityIds=['99999'];
 c.tables['identitySkill']=[{identityId:'99999',skillId:'9999901',role:'attack',ordinal:0,slot:1,copies:3}];
 c.tables['skillStage']=[{skillId:'9999901',uptie:1}];
 c.rawObjects.push({source:'limbus-assets',srcPath:'identities/limbus-assets/identities.json',id:'99999',payload:{skillTypes:[{id:'9999901'},{id:'9999902'}]}});
 const errors=validateCandidate(c).errors;
 assert.ok(errors.some(x=>x.includes('9999901')&&x.includes('name')));
 assert.ok(errors.some(x=>x.includes('9999902')&&x.includes('source')));
});
