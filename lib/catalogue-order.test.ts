import {test} from 'node:test';import assert from 'node:assert/strict';
import {compareCatalogueUnits,catalogueSearchKey} from './catalogue-order';
test('base first, rarity ascending, release ascending; unknown dates last',()=>{
 const row=(id:string,grade:number,released:string|null,isBase=false)=>({id,name:id,grade,released,isBase});
 const rows=[row('recent',3,'2026-11-12'),row('two',2,'2023-01-01'),row('base',1,'2023-02-27',true),row('old',3,'2023-02-27'),row('unknown',3,null)];
 assert.deepEqual(rows.sort((a,b)=>compareCatalogueUnits(a,b,'ko')).map(x=>x.id),['base','two','old','recent','unknown']);
});
test('catalogue search tolerates spaces and case',()=>{assert(catalogueSearchKey('쐐기 사무소 해결사').includes(catalogueSearchKey('쐐기사무소')));assert.equal(catalogueSearchKey('WEDGE Office'),'wedgeoffice')});

test('gift rarity remains descending independently of identity and EGO rules',()=>{
 const a={id:'1',name:'A',grade:1},b={id:'2',name:'B',grade:4};
 assert(compareCatalogueUnits(a,b,'ko','desc')>0);
});


test('EGO slot rank does not override release date; newest HE follows older WAW',()=>{
 const rows=[
  {id:'new',name:'눈물로 벼려낸 검',grade:3,released:'2026-11-12'},
  {id:'old',name:'오혈읍루',grade:4,released:'2025-04-24'},
  {id:'base',name:'허환경',grade:1,released:'2023-02-27',isBase:true},
  {id:'unknown',name:'Unknown',grade:1,released:null},
 ];
 assert.deepEqual(rows.sort((a,b)=>compareCatalogueUnits(a,b,'ko','none')).map(x=>x.id),['base','old','new','unknown']);
});
