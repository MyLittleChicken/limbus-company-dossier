import { readFile } from 'node:fs/promises';
import { join,basename } from 'node:path';
import type { PrismaClient } from '../v2/generated/client.js';
import { extractObjects } from '../v2/scan.js';
import { type RawIndex, mergeIndexes } from '../v2/source.js';
import { buildSkills } from '../v2/canonical/skills.js';
import { buildIdentities } from '../v2/canonical/identities.js';
import { buildEgos } from '../v2/canonical/egos.js';
import { buildStatuses } from '../v2/canonical/statuses.js';
import { buildSinners } from '../v2/canonical/sinners.js';
import { Meta } from '../v2/canonical/meta.js';
import { supplement,supplementEgos,obj } from './adapter.js';
import type { UpdateManifest } from './fetch.js';
export type Row=Record<string,unknown>;
export interface Candidate { tables:Record<string,Row[]>; meta:Meta; identityIds:string[]; egoIds:string[]; newIdentityIds:string[]; newEgoIds:string[]; removed:Record<string,string[]>; rawObjects:Row[]; rawFiles:Row[] }
/** Preserve DB dependencies of missing source identities, including dependencies shared with refreshed owners. */
export async function preserveMissingIdentityDependencies(
 db:Pick<PrismaClient,'identitySkill'|'identityPassive'>, tables:Record<string,Row[]>, existingIds:readonly string[], sourceIds:ReadonlySet<string>, meta:Meta,
):Promise<string[]> {
 const removed=existingIds.filter(id=>!sourceIds.has(id));if(!removed.length)return removed;
 const [skillLinks,passiveLinks]=await Promise.all([
  db.identitySkill.findMany({where:{identityId:{in:removed}},select:{identityId:true,skillId:true}}),
  db.identityPassive.findMany({where:{identityId:{in:removed}},select:{identityId:true,passiveId:true}}),
 ]);
 const heldSkills=new Set(skillLinks.map(r=>r.skillId));const heldPassives=new Set(passiveLinks.map(r=>r.passiveId));
 for(const [table,field,held] of [
  ['skill','id',heldSkills],['skillStage','skillId',heldSkills],['skillStageText','skillId',heldSkills],['skillCoin','skillId',heldSkills],
  ['passive','id',heldPassives],['passiveRequirement','passiveId',heldPassives],['passiveText','passiveId',heldPassives],
 ] as const)if(tables[table])tables[table]=tables[table].filter(row=>!held.has(String(row[field])));
 for(const id of removed)meta.gap('identity',id,'updateDependencies',
  'Source identity absent: DB skill/passive roots and descendants held, including shared references; new owners may fail candidate name validation',
  JSON.stringify({source:'limbus-assets/identities.json',identitySkill:skillLinks.filter(r=>r.identityId===id).map(r=>r.skillId),identityPassive:passiveLinks.filter(r=>r.identityId===id).map(r=>r.passiveId)}));
 for(const id of heldSkills)meta.source('skill',id,'updateScope','preserved-db',['canonical.identitySkill','canonical.skill']);
 for(const id of heldPassives)meta.source('passive',id,'updateScope','preserved-db',['canonical.identityPassive','canonical.passive']);
 return removed;
}
export async function buildCandidate(db:PrismaClient,root:string,work:string,manifest:UpdateManifest):Promise<Candidate>{
 const indexes=new Map<string,RawIndex>();const rawObjects:Row[]=[];const rawFiles:Row[]=[];
 for(const file of manifest.files.filter(f=>f.path.startsWith('entities/'))){
  const value=JSON.parse((await readFile(join(work,file.path),'utf8')).replace(/^\uFEFF/,''));
  const scanned=extractObjects(value,basename(file.path,'.json'));const index:RawIndex=new Map();
  for(const [ordinal,r] of scanned.objects.entries()){
   if(index.has(r.id))throw Error(`Duplicate source ID ${file.path}/${r.id}`);
   index.set(r.id,obj(r.payload));rawObjects.push({snapshotId:manifest.id,source:file.source,srcPath:file.path.slice(9),id:r.id,entity:file.path.split('/')[1],payload:r.payload,ordinal});
  }
  indexes.set(file.path,index);rawFiles.push({snapshotId:manifest.id,source:file.source,srcPath:file.path.slice(9),entity:file.path.split('/')[1],shape:scanned.shape,objectCount:scanned.objects.length});
 }
 const source=(entity:string,src:string,file:string):RawIndex=>{const v=indexes.get(`entities/${entity}/${src}/${file}`);if(!v)throw Error(`Required source missing ${entity}/${src}/${file}`);return v;};
 const group=(entity:string,src:string,prefix=''):RawIndex=>mergeIndexes([...indexes].filter(([p])=>p.startsWith(`entities/${entity}/${src}/`)&&basename(p).startsWith(prefix)).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v));
 const mj=source('identities','limbus-data-mj','identities.json');const mjDetail=source('identities','limbus-data-mj','identities_detail.json');const mjSkills=source('identities','limbus-data-mj','skills.json');const mjPassives=source('identities','limbus-data-mj','passives.json');
 const assets=source('identities','limbus-assets','identities.json');const details=group('identity-details','limbus-assets');
 const egoMj=source('egos','limbus-data-mj','egos.json');const egoDetail=source('egos','limbus-data-mj','egos_detail.json');const egoAssets=source('egos','limbus-assets','egos.json');const egoDetails=group('ego-details','limbus-assets');
 const assetsOnlyIdentities=[...assets.keys()].filter(id=>!mj.has(id));const assetsOnlyEgos=[...egoAssets.keys()].filter(id=>!egoMj.has(id));
 // Missing top-level assets rows are reported, not deleted or reconstructed from stale secondary rows.
 for(const id of mj.keys())if(!assets.has(id))mj.delete(id);
 for(const id of egoMj.keys())if(!egoAssets.has(id))egoMj.delete(id);
 const associationSource=source('identities','limbus-data-mj','associations.json');
 supplement(mj,mjDetail,mjSkills,mjPassives,assets,details,{associations:associationSource,unitKeywords:group('identities','loc-en','UnitKeyword')});
 supplementEgos(egoMj,egoDetail,egoAssets,egoDetails,group('egos','loc-en','Passive_Ego'));
 const meta=new Meta();const skills=buildSkills({mjSkills,details,mjIdentityDetail:mjDetail,locKo:group('identities','loc-ko','Skills'),locEn:group('identities','loc-en','Skills'),locJa:group('identities','loc-ja','Skills')},meta);
 const [statusRows,associationRows,keywordRows,sinners,existingIds,existingEgos]=await Promise.all([db.status.findMany(),db.association.findMany(),db.keyword.findMany({include:{texts:true}}),db.sinner.findMany(),db.identity.findMany({select:{id:true}}),db.ego.findMany({select:{id:true,presentationOnly:true}})]);
 const keywordDict=new Map(keywordRows.flatMap(k=>k.texts.filter(t=>t.locale==='en').map(t=>[t.name.toLowerCase(),k.id] as const)));
 const oldAssociations=new Set(associationRows.map(r=>r.id));
 const referencedAssociations=new Set([...mj.values()].flatMap(r=>Array.isArray(r['associations'])?r['associations'].map(String):[]));
 const associationTables=buildSinners({mjIdentities:new Map(),associations:new Map([...associationSource].filter(([id])=>!oldAssociations.has(id)&&referencedAssociations.has(id))),unitKeywordJa:group('identities','loc-ja','UnitKeyword')},meta);
 const newAssociations=new Set(associationTables.association.filter(r=>!oldAssociations.has(r.id)&&referencedAssociations.has(r.id)).map(r=>r.id));
 // New referenced status definitions only; no rewrite of shared historical status data.
 const oldStatus=new Set(statusRows.map(r=>r.id));const statusAssets=source('mechanics','limbus-assets','statuses.json');
 const baseline=async(path:string)=>{const value=JSON.parse(await readFile(join(root,'data/entities',path),'utf8'));return new Map(extractObjects(value,basename(path,'.json')).objects.map(r=>[r.id,obj(r.payload)]));};
 const statusTables=buildStatuses({assets:statusAssets,bufsKo:group('mechanics','loc-ko','Bufs'),bufsEn:group('mechanics','loc-en','Bufs'),bufsJa:group('mechanics','loc-ja','Bufs'),bkKo:group('mechanics','loc-ko','BattleKeywords'),bkEn:group('mechanics','loc-en','BattleKeywords'),bkJa:group('mechanics','loc-ja','BattleKeywords'),mirrorKo:new Map(),mirrorEn:new Map(),mirrorJa:new Map(),terms:await baseline('mechanics/limbus-data-mj/terms.json'),sins:await baseline('mechanics/limbus-data-mj/sins.json')},new Meta());
 const referencedStatuses=new Set([...assets.values(),...egoAssets.values()].flatMap(a=>Array.isArray(a['statuses'])?a['statuses'].map(String):[]));
 const newStatuses=new Set(statusTables.status.filter(r=>!oldStatus.has(r.id)&&referencedStatuses.has(r.id)).map(r=>r.id));
 const knownStatuses=new Set([...oldStatus,...newStatuses]);
 const identities=buildIdentities({mj,mjDetail,assets,details,mjPassives,locKo:group('identities','loc-ko','Personalities'),locEn:group('identities','loc-en','Personalities'),locJa:group('identities','loc-ja','Personalities'),passiveKo:group('identities','loc-ko','Passive'),passiveEn:group('identities','loc-en','Passive'),passiveJa:group('identities','loc-ja','Passive'),knownSkills:new Set(skills.skill.map(r=>r.id)),knownAssociations:new Set([...oldAssociations,...newAssociations]),knownKeywords:new Set(keywordRows.map(r=>r.id)),knownStatuses,keywordDict},meta);
 const egos=buildEgos({mj:egoMj,mjDetail:egoDetail,assets:egoAssets,details:egoDetails,locEgoKo:group('egos','loc-ko','Egos'),locEgoEn:group('egos','loc-en','Egos'),locEgoJa:group('egos','loc-ja','Egos'),locSkillKo:group('egos','loc-ko','Skills_Ego'),locSkillEn:group('egos','loc-en','Skills_Ego'),locSkillJa:group('egos','loc-ja','Skills_Ego'),locPassiveKo:group('egos','loc-ko','Passive_Ego'),locPassiveEn:group('egos','loc-en','Passive_Ego'),locPassiveJa:group('egos','loc-ja','Passive_Ego'),knownSinners:new Set(sinners.map(r=>r.id)),knownStatuses},meta);
 // A removed playable ego must not be reclassified as a cutscene by lingering locale rows.
 const heldEgos=new Set(existingEgos.filter(r=>!r.presentationOnly&&!egoAssets.has(r.id)).map(r=>r.id));
 for(const key of Object.keys(egos) as Array<keyof typeof egos>){const rows=egos[key] as unknown as Row[]; (egos as unknown as Record<string,Row[]>)[key]=rows.filter(r=>!heldEgos.has(String(r['egoId']??r['id'])));}
 for(const id of assetsOnlyIdentities){meta.source('identity',id,'core','assets-only',['limbus-assets']);meta.source('identity',id,'resists','assets-only',['limbus-assets']);meta.gap('identity',id,'teamCodeEligible','Secondary source lacks eligibility; conservatively disabled','limbus-assets');}
 for(const id of assetsOnlyEgos){meta.source('ego',id,'core','assets-only',['limbus-assets']);meta.source('ego',id,'resists','assets-only',['limbus-assets']);}
 const tables={association:associationTables.association.filter(r=>newAssociations.has(r.id)),associationText:associationTables.associationText.filter(r=>newAssociations.has(r.associationId)),status:statusTables.status.filter(r=>newStatuses.has(r.id)),statusText:statusTables.statusText.filter(r=>newStatuses.has(r.statusId)),statusCategory:statusTables.statusCategory.filter(r=>newStatuses.has(r.statusId)),...skills,...identities,...egos} as unknown as Record<string,Row[]>;
 delete tables['toolAnnotation'];
 const removedIdentities=await preserveMissingIdentityDependencies(db,tables,existingIds.map(r=>r.id),new Set(assets.keys()),meta);
 const oldIds=new Set(existingIds.map(r=>r.id));const oldEgos=new Set(existingEgos.map(r=>r.id));
 const identityIds=identities.identity.map(r=>r.id);const egoIds=egos.ego.filter(r=>!r.presentationOnly).map(r=>r.id);
 return {tables,meta,identityIds,egoIds,newIdentityIds:identityIds.filter(id=>!oldIds.has(id)),newEgoIds:egoIds.filter(id=>!oldEgos.has(id)),removed:{identities:removedIdentities,egos:existingEgos.filter(r=>!r.presentationOnly&&!egoAssets.has(r.id)).map(r=>r.id)},rawObjects,rawFiles};
}
