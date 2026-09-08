/** Assets-only records adapted to existing builder inputs; never fabricate missing lore. */
import { arr, str, type RawIndex } from '../v2/source.js';
export const obj = (v:unknown):Record<string,unknown> => typeof v==='object'&&v!==null&&!Array.isArray(v)?v as Record<string,unknown>:{};
/** Exact source names only; a duplicate name is not evidence for either ID. */
function namedIds(rows:RawIndex, field:string):Map<string,string[]> {
 const names=new Map<string,string[]>();
 for(const [id,row] of rows){const name=str(row,field);if(name)names.set(name,[...(names.get(name)??[]),id]);}
 return names;
}
function tagIds(tags:unknown[], names:Map<string,string[]>, entity:string):string[] {
 return [...new Set(tags.flatMap(tag=>{
  if(typeof tag!=='string')return [];
  const ids=names.get(tag)??[];
  if(ids.length>1)throw Error(`Ambiguous identity tag ${entity}: ${tag}`);
  return ids;
 }))];
}
export function supplement(identities:RawIndex, details:RawIndex, skills:RawIndex, passives:RawIndex, assets:RawIndex, assetDetails:RawIndex,
 vocabulary:{associations:RawIndex;unitKeywords:RawIndex}={associations:new Map(),unitKeywords:new Map()}):void {
 const associations=namedIds(vocabulary.associations,'name');
 const units=namedIds(new Map([...vocabulary.unitKeywords].filter(([id])=>id.startsWith('UnitKeyword_'))),'content');
 for(const [id,a] of assets){
  const d=assetDetails.get(id);if(!d)throw Error(`Missing identity detail ${id}`);
  if(!identities.has(id)) identities.set(id,{
   sinnerId:a['sinnerId'],star:a['rank'],hp:obj(a['hp'])['base'],season:a['season'],stagger:a['breakSection'],resists:a['resists'],
   keywords:arr(a,'skillKeywordList'),
   associations:arr(a,'associations').length ? arr(a,'associations') : arr(d,'associations').length ? arr(d,'associations') : tagIds(arr(a,'tags'),associations,id),
   // eligibility cannot be inferred from an asset record. Remains false, explicitly reported.
  });
  if(!details.has(id))details.set(id,{
   attackSkills:arr(a,'skillTypes').map((v,i)=>({skillId:obj(v)['id'],slot:i+1,copies:obj(v)['num']})),
   unitKeywords:arr(a,'unitKeywords').length ? arr(a,'unitKeywords') : arr(d,'unitKeywords').length ? arr(d,'unitKeywords') : tagIds(arr(a,'tags').filter(tag=>typeof tag==='string'&&!associations.has(tag)),units,id).map(key=>key.slice('UnitKeyword_'.length)), panicSkill:a['panicSkill'] ?? d['panicSkill'],
   defenseSkills:arr(a,'defenseSkillTypes').map(v=>obj(v)['id']),
   battlePassives:arr(d,'combatPassives').map(v=>({level:obj(v)['uptie'],passives:obj(v)['passives']})),
   supporterPassives:arr(d,'supportPassives').map(v=>({level:obj(v)['uptie'],passives:obj(v)['passives']})),
  });
  for(const [pid,p] of Object.entries(obj(d['passiveData'])))if(!passives.has(pid))passives.set(pid,obj(p));
  for(const [sid,s] of Object.entries(obj(d['skills']))){
   if(skills.has(sid))continue;
   const rows=arr(obj(s),'data');const first=obj(rows[0]);
   // Assets 'none' means no affinity; canonical Skill.sin is nullable (Sin has seven values).
   skills.set(sid,{sin:first['affinity']==='none'?null:first['affinity'],attackType:first['atkType'],defType:first['defType'],skillTier:obj(s)['tier'] ?? first['skillTier'],levels:rows.map(v=>({...obj(v),level:obj(v)['uptie']}))});
  }
 }
}
export function supplementEgos(mj:RawIndex,details:RawIndex,assets:RawIndex,assetDetails:RawIndex,passiveLocEn:RawIndex=new Map()):void {
 const names=namedIds(passiveLocEn,'name');
 for(const [id,a] of assets){
  const d=assetDetails.get(id);if(!d)throw Error(`Missing ego detail ${id}`);
  if(!mj.has(id))mj.set(id,{sinnerId:a['sinnerId'],name:a['name'],rarity:str(a,'rank')?.toLowerCase(),sin:obj(a['awakeningType'])['affinity'],attackType:obj(a['awakeningType'])['type'],resourceCost:a['cost'],season:a['season']});
  if(!details.has(id))details.set(id,{attributeResists:a['resists'],awakeningPassives:[...new Set(arr(d,'passiveList').map(v=>{
   const explicit=typeof v==='string'||typeof v==='number'?v:obj(v)['id'];
   if(typeof explicit==='number'&&Number.isFinite(explicit))return String(explicit);
   if(typeof explicit==='string'&&explicit.length)return explicit;
   const name=str(obj(v),'name');const matches=name?names.get(name)??[]:[];
   if(matches.length!==1)throw Error(`Unresolved ego passive ${id}: ${name??'(missing name)'} (${matches.length} matches)`);
   return matches[0]!;
  }))]});
 }
}
