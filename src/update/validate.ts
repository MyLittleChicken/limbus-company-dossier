import { readdir, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { Prisma, type PrismaClient } from '../v2/generated/client.js';
import type { Candidate, Row } from './candidate.js';
import type { UpdateManifest } from './fetch.js';

export interface ValidationResult { ok: boolean; errors: string[]; warnings: string[] }
const models = new Map(Prisma.dmmf.datamodel.models.map(m => [m.name[0]!.toLowerCase()+m.name.slice(1),m]));
const enums = new Map(Prisma.dmmf.datamodel.enums.map(e => [e.name,new Set(e.values.map(v=>v.name))]));
const keyOf = (row:Row, fields:readonly string[]) => JSON.stringify(fields.map(f=>row[f]));
const result = (errors:string[],warnings:string[]=[]):ValidationResult => ({ok:errors.length===0,errors,warnings});

/** Check source completeness and actual schema keys; no release-specific ID allowlist. */
export function validateCandidate(candidate:Candidate):ValidationResult {
 const errors:string[]=[];const warnings:string[]=[];
 for(const [table,rows] of Object.entries(candidate.tables)) {
  const model=models.get(table);if(!model){errors.push(`unknown table ${table}`);continue;}
  const pk=model.primaryKey?.fields??model.fields.filter(f=>f.isId).map(f=>f.name);
  const seen=new Set<string>();
  for(const row of rows){
   const key=keyOf(row,pk);if(seen.has(key))errors.push(`${table} duplicate primary key ${key}`);seen.add(key);
   for(const f of model.fields.filter(f=>f.kind!=='object')) {
    const value=row[f.name];
    if(f.isRequired&&!f.hasDefaultValue&&(value===null||value===undefined))errors.push(`${table}${key}.${f.name} required`);
    if(value==='undefined'||value==='null'||(typeof value==='number'&&!Number.isFinite(value)))errors.push(`${table}${key}.${f.name} invalid ${String(value)}`);
    if(f.kind==='enum'&&value!==null&&value!==undefined&&!enums.get(f.type)?.has(String(value)))errors.push(`${table}${key}.${f.name} invalid enum ${String(value)}`);
   }
  }
 }
 for(const [kind,table,ids] of [['identities','identity',candidate.identityIds],['egos','ego',candidate.egoIds]] as const){
  const source=candidate.rawObjects.filter(r=>r['source']==='limbus-assets'&&r['srcPath']===`${kind}/limbus-assets/${kind}.json`);
  if(!source.length)errors.push(`${kind} required source is empty`);
  const expected=new Set(source.map(r=>String(r['id'])));const actual=new Set(ids);
  const tableIds=new Set((candidate.tables[table]??[]).filter(r=>table!=='ego'||!r['presentationOnly']).map(r=>String(r['id'])));
  for(const id of new Set([...actual,...tableIds]))if(actual.has(id)!==tableIds.has(id))errors.push(`${table} ${id} core table/id list disagree`);
  for(const id of expected)if(!actual.has(id))errors.push(`${table} ${id} dropped from source`);
  for(const id of actual)if(!expected.has(id))errors.push(`${table} ${id} not in source`);
  for(const id of ids)for(const locale of ['ko','en']){
   if(!(candidate.tables[`${table}Text`]??[]).some(r=>r[`${table}Id`]===id&&r['locale']===locale&&typeof r['name']==='string'&&r['name'].trim()))errors.push(`${table} ${id} ${locale} name missing`);
  }
 }
 for(const id of candidate.newIdentityIds){
  for(const [table,field,min] of [['identityResist','identityId',3],['identitySpeed','identityId',1],['identitySkill','identityId',1]] as const)if((candidate.tables[table]??[]).filter(r=>r[field]===id).length<min)errors.push(`identity ${id} incomplete ${table}`);
 }
 for(const id of candidate.newEgoIds){
  if(!(candidate.tables['egoSkill']??[]).some(r=>r['egoId']===id))errors.push(`ego ${id} skills missing`);
  const raw=candidate.rawObjects.find(r=>r['source']==='limbus-assets'&&r['srcPath']===`ego-details/limbus-assets/${id}.json`);
  const payload=raw?.['payload'] as Record<string,unknown>|undefined;
  if(Array.isArray(payload?.['passiveList'])&&payload['passiveList'].length&&!(candidate.tables['egoPassiveLink']??[]).some(r=>r['egoId']===id))errors.push(`ego ${id} source passive missing`);
 }
 const arrayField=(row:Record<string,unknown>|undefined,key:string):unknown[]=>Array.isArray(row?.[key])?row[key] as unknown[]:[];
 const payloadFor=(path:string,id?:string)=>candidate.rawObjects.find(r=>r['source']==='limbus-assets'&&r['srcPath']===path&&(id===undefined||r['id']===id))?.['payload'] as Record<string,unknown>|undefined;
 const rowsFor=(table:string,key:string,id:string)=>(candidate.tables[table]??[]).filter(r=>r[key]===id);
 const namesFor=(table:string,key:string,id:string,uptie?:unknown)=>{
  for(const locale of ['ko','en'])if(!rowsFor(table,key,id).some(r=>r['locale']===locale&&(uptie===undefined||r['uptie']===uptie)&&typeof r['name']==='string'&&r['name'].trim()))errors.push(`${table} ${id} ${String(uptie??'')} ${locale} name missing`);
 };
 const skillNames=(ids:string[],ego=false)=>{for(const id of ids){const prefix=ego?'egoSkill':'skill';const stages=rowsFor(`${prefix}Stage`,'skillId',id);if(!stages.length)errors.push(`${prefix} ${id} stages missing`);for(const stage of stages)namesFor(`${prefix}StageText`,'skillId',id,stage['uptie']);}};
 for(const id of candidate.newIdentityIds){
  const core=payloadFor('identities/limbus-assets/identities.json',id);
  const links=rowsFor('identitySkill','identityId',id);const linked=new Set(links.map(r=>String(r['skillId'])));
  for(const field of ['skillTypes','defenseSkillTypes'])for(const item of Array.isArray(core?.[field])?core[field]:[]){const sid=String((item as Row)['id']);if(!linked.has(sid))errors.push(`identity ${id} source skill ${sid} missing`);}
  skillNames([...linked]);
  for(const link of rowsFor('identityPassive','identityId',id))namesFor('passiveText','passiveId',String(link['passiveId']));
  const detail=payloadFor(`identity-details/limbus-assets/${id}.json`);
  for(const [field,role] of [['combatPassives','battle'],['supportPassives','supporter']]){
   for(const group of arrayField(detail,field!)){const g=group as Row;for(const pid of Array.isArray(g['passives'])?g['passives']:[])if(!rowsFor('identityPassive','identityId',id).some(r=>r['passiveId']===String(pid)&&r['level']===g['uptie']&&r['role']===role))errors.push(`identity ${id} source passive ${String(pid)} stage ${String(g['uptie'])} missing`);}
  }
 }
 for(const id of candidate.newEgoIds){
  const links=rowsFor('egoSkill','egoId',id);skillNames(links.map(r=>String(r['id'])),true);
  const detail=payloadFor(`ego-details/limbus-assets/${id}.json`);
  for(const [field,role] of [['awakeningSkills','awakening'],['corrosionSkills','corrosion']]){const expected=arrayField(detail,field!).length;if(links.filter(r=>r['role']===role).length<expected)errors.push(`ego ${id} source ${field} incomplete`);}
  const passiveLinks=rowsFor('egoPassiveLink','egoId',id);
  if(Array.isArray(detail?.['passiveList'])&&passiveLinks.length<detail['passiveList'].length)errors.push(`ego ${id} source passive links incomplete`);
  for(const link of passiveLinks)namesFor('egoPassiveText','passiveId',String(link['passiveId']));
 }
 for(const [kind,ids] of Object.entries(candidate.removed))if(ids.length)warnings.push(`${kind} removed upstream; retained: ${ids.join(',')}`);
 if(candidate.meta.gaps.length)warnings.push(`field gaps: ${candidate.meta.gaps.length}`);
 return result(errors,warnings);
}

/** Existing shared references and candidate parents together must satisfy every FK. */
export async function validateCandidateReferences(candidate:Candidate,db:PrismaClient):Promise<ValidationResult>{
 const errors:string[]=[];const cache=new Map<string,Set<string>>();
 for(const [table,rows] of Object.entries(candidate.tables)){
  for(const relation of models.get(table)?.fields.filter(f=>f.kind==='object'&&f.relationFromFields?.length)??[]){
   const target=relation.type[0]!.toLowerCase()+relation.type.slice(1);const fields=relation.relationToFields??[];const cacheKey=target+fields.join(',');
   let known=cache.get(cacheKey);
   if(!known){
    const delegate=(db as unknown as Record<string,{findMany(args:{select:Record<string,boolean>}):Promise<Row[]>}>)[target];
    if(!delegate){errors.push(`missing reference model ${target}`);continue;}
    const existing=await delegate.findMany({select:Object.fromEntries(fields.map(f=>[f,true]))});
    known=new Set([...existing,...candidate.tables[target]??[]].map(r=>keyOf(r,fields)));cache.set(cacheKey,known);
   }
   const from=relation.relationFromFields??[];
   for(const row of rows){if(from.some(f=>row[f]===null||row[f]===undefined))continue;const key=keyOf(row,from);if(!known.has(key))errors.push(`${table}.${relation.name} orphan ${key}`);}
  }
 }
 // Preserve known localized names whenever the owning stage/passive remains in the update.
 for(const table of ['skillStageText','egoSkillStageText','passiveText','egoPassiveText']){
  const model=models.get(table)!;const pk=model.primaryKey!.fields;
  const relation=model.fields.find(f=>f.relationFromFields?.length)!;
  const target=relation.type[0]!.toLowerCase()+relation.type.slice(1);
  const activeParents=new Set((candidate.tables[target]??[]).map(r=>keyOf(r,relation.relationToFields??[])));
  const incoming=new Map((candidate.tables[table]??[]).map(r=>[keyOf(r,pk),r]));
  const delegate=(db as unknown as Record<string,{findMany(args:{where:{locale:{in:string[]}}}):Promise<Row[]>}>)[table]!;
  for(const before of await delegate.findMany({where:{locale:{in:['ko','en']}}})){
   if(!activeParents.has(keyOf(before,relation.relationFromFields??[])))continue;
   const after=incoming.get(keyOf(before,pk));
   if(typeof before['name']==='string'&&before['name'].trim()&&!(typeof after?.['name']==='string'&&after['name'].trim()))errors.push(`${table}${keyOf(before,pk)} known name would be lost`);
  }
 }
 // A temporarily incomplete upstream source must not erase known core numbers/classification.
 for(const table of ['identity','ego','skill','skillStage','egoSkillStage']){
  const rows=candidate.tables[table]??[];if(!rows.length)continue;const model=models.get(table)!;
  const pk=model.primaryKey?.fields??model.fields.filter(f=>f.isId).map(f=>f.name);
  const delegate=(db as unknown as Record<string,{findMany():Promise<Row[]>}>)[table]!;
  const previous=new Map((await delegate.findMany()).map(r=>[keyOf(r,pk),r]));
  for(const row of rows){const before=previous.get(keyOf(row,pk));if(!before)continue;
   for(const [field,value] of Object.entries(row)){
    const old=before[field];
    if(old!==null&&old!==undefined&&value===null)errors.push(`${table}${keyOf(row,pk)} known ${field} would become null; hold incomplete source`);
    if(Array.isArray(old)&&old.length&&Array.isArray(value)&&!value.length)errors.push(`${table}${keyOf(row,pk)} known ${field} would become empty; review source`);
   }
   if(table==='identity'&&before['teamCodeEligible']===true&&row['teamCodeEligible']===false){
    const source=candidate.rawObjects.find(r=>r['source']==='limbus-data-mj'&&r['srcPath']==='identities/limbus-data-mj/identities.json'&&r['id']===row['id'])?.['payload'] as Row|undefined;
    if(source?.['teamCodeEligible']!==false)errors.push(`identity ${String(row['id'])} eligibility would be lost without source evidence`);
   }
  }
 }
 return result(errors);
}

/** Required portraits plus every collected asset must exist before DB publication. */
async function validImage(path:string):Promise<boolean>{
 try{
  const info=await stat(path);if(!info.isFile()||info.size<12)return false;
  const file=await open(path,'r');try{const bytes=Buffer.alloc(12);await file.read(bytes,0,12,0);
   return (bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(bytes[0]===255&&bytes[1]===216&&bytes[2]===255);
  }finally{await file.close();}
 }catch(e){if(['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))return false;throw e;}
}
export async function validateCandidateAssets(candidate:Candidate,manifest:UpdateManifest,root:string,work:string):Promise<ValidationResult>{
 const errors:string[]=[];const staged=new Map<string,string>();
 for(const file of manifest.files.filter(f=>f.path.startsWith('assets/'))){
  const path=join(work,file.path);if(!await validImage(path))errors.push(`invalid or missing image ${file.path}`);
  staged.set(file.path,path);
 }
 for(const [category,ids,suffixes] of [['identities',candidate.identityIds,['_gacksung_profile','_normal']],['egos',candidate.egoIds,['_awaken_profile','_cg']]] as const){
  const base=join(root,'data/assets',category);let sources:string[]=[];
  try{sources=(await readdir(base,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  for(const id of ids)for(const suffix of suffixes){
   const key=id+suffix;let found=false;
   for(const [path] of staged)if(path.startsWith(`assets/${category}/`)&&path.split('/').at(-1)?.replace(/\.(webp|png|jpg|jpeg)$/i,'')===key){found=true;break;}
   if(!found)for(const source of sources){for(const ext of ['webp','png','jpg','jpeg'])if(await validImage(join(base,source,`${key}.${ext}`))){found=true;break;}if(found)break;}
   if(!found)errors.push(`required image missing ${category}/${key}`);
  }
 }
 return result(errors);
}

// Retained only for compatibility with the earlier caller; transaction ownership belongs to apply.
export function applyTransaction<T>(transaction:()=>Promise<T>):Promise<T>{return transaction();}
