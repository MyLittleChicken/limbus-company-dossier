/** Scoped mirror-dungeon import. Input: pinned source/ and manifest.json in WORK.
 * Builds a reviewable candidate; --apply requires --candidate-hash=<sha256>.
 * Run against a restored local candidate database before applying to the live DB.
 */
import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {PrismaClient,Prisma} from '../../src/v2/generated/client.js';
import {extractObjects} from '../../src/v2/scan.js';
import {buildPacks} from '../../src/v2/canonical/packs.js';
import {buildEncounters} from '../../src/v2/canonical/encounters.js';
import {buildStatuses} from '../../src/v2/canonical/statuses.js';
import {buildGifts} from '../../src/v2/canonical/gifts.js';
import {buildVocab,buildKeywordLookup} from '../../src/v2/canonical/vocab.js';
import {Meta} from '../../src/v2/canonical/meta.js';
import {descOf} from '../../src/v2/canonical/markup.js';
import {applyTextOverrides,applyColumnOverrides} from '../../src/v2/canonical/override.js';
import {validateTextTokens} from '../../src/update/token-validation.js';
const work=process.argv[2];if(!work)throw Error('Usage: mirror.mts WORK [--apply --candidate-hash=HASH]');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const idx=(p:string)=>new Map(extractObjects(read(p),basename(p,'.json')).objects.map(x=>[x.id,x.payload as Record<string,unknown>]));
const group=(s:string,prefix:string)=>{const dir=join(work,'source',s);const out=new Map<string,Record<string,unknown>>();for(const f of readdirSync(dir).filter(f=>f.startsWith(prefix)&&f.endsWith('.json')).sort())for(const [k,v] of idx(join(dir,f)))out.set(k,v);return out;};
const manifest=read(join(work,'manifest.json'));
for(const f of manifest.files){const b=readFileSync(join(work,'source',f.source,f.path));if(createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error(`Checksum mismatch ${f.path}`);}
const source=(s:string,f:string)=>idx(join(work,'source',s,f));
const old=(family:string,f:string)=>idx(join(work,'source','limbus-data-mj',f));
const db=new PrismaClient();
try {
 const meta=new Meta();
 let packs=buildPacks({mjPacks:old('packs','packs.json'),mjDetail:old('packs','packs_detail.json'),assets:source('limbus-assets','data/md_theme_packs.json'),floorTable:read(join(work,'source/limbus-assets/data/md_floor_packs.json')),locKo:group('loc-ko','MirrorDungeonTheme'),locEn:group('loc-en','MirrorDungeonTheme'),locJa:group('loc-ja','MirrorDungeonTheme')},meta);
 const encounterDir=join(work,'source/limbus-assets/data/encounters/md');
 const encounterInputs=new Map(readdirSync(encounterDir).filter(f=>f.endsWith('.json')).sort().map(f=>['md__'+basename(f,'.json'),read(join(encounterDir,f))]));
 const encounters=buildEncounters({encounters:encounterInputs,groups:source('limbus-assets','data/encounters.json'),enemyKo:group('loc-ko','Enemies'),enemyEn:group('loc-en','Enemies'),enemyJa:group('loc-ja','Enemies'),knownPacks:new Set(packs.pack.map(p=>p.id)),packs:source('limbus-assets','data/md_theme_packs.json')},meta);
 const parts=new Set(encounters.encounterTargetPart.map(p=>p.partId));
 const enemyIds=new Set(encounters.enemyPart.filter(p=>parts.has(p.id)).map(p=>p.enemyId));
 for(const t of encounters.encounterTarget)if(t.portrait!==null)enemyIds.add(String(t.portrait));
 encounters.enemy=encounters.enemy.filter(e=>enemyIds.has(e.id));
 encounters.enemyText=encounters.enemyText.filter(e=>enemyIds.has(e.enemyId));
 encounters.enemyPart=encounters.enemyPart.filter(e=>parts.has(e.id));
 encounters.enemyPartText=encounters.enemyPartText.filter(e=>parts.has(e.partId));
 const categoryKo=source('loc-ko','EgoGiftCategory.json'),categoryEn=source('loc-en','EgoGiftCategory.json'),categoryJa=source('loc-ja','EgoGiftCategory.json'),assets=source('limbus-assets','data/gifts.json');
 const vocab=buildVocab({categoryKo,categoryEn,categoryJa,assets},meta);
 const giftLoc=(s:string)=>{return group(s,'EGOgift');};
 let gifts=buildGifts({mj:old('gifts','gifts.json'),mjDetail:old('gifts','gifts_detail.json'),assets,locKo:giftLoc('loc-ko'),locEn:giftLoc('loc-en'),locJa:giftLoc('loc-ja'),lockedKo:source('loc-ko','MirrorDungeonEgoGiftLockedDesc.json'),lockedEn:source('loc-en','MirrorDungeonEgoGiftLockedDesc.json'),lockedJa:source('loc-ja','MirrorDungeonEgoGiftLockedDesc.json'),keywordDict:buildKeywordLookup(categoryEn),knownPacks:new Set(packs.pack.map(p=>p.id))},meta);
 let terms=await db.termText.findMany(),statuses=await db.statusText.findMany();
 const statusMeta=new Meta();
 const dep=buildStatuses({assets:source('limbus-assets','data/statuses.json'),
 bufsKo:group('loc-ko','Bufs'),bufsEn:group('loc-en','Bufs'),bufsJa:group('loc-ja','Bufs'),
 bkKo:group('loc-ko','BattleKeywords'),bkEn:group('loc-en','BattleKeywords'),bkJa:group('loc-ja','BattleKeywords'),
 mirrorKo:new Map(),mirrorEn:new Map(),mirrorJa:new Map(),terms:old('mechanics','terms.json'),sins:old('mechanics','sins.json')},statusMeta);
 const depPath=join(work,'dependencies.json');
 const needed=new Set<string>(existsSync(depPath)?read(depPath):gifts.giftStageText.flatMap(t=>[...(t.descRaw??t.desc??'').matchAll(/\[([A-Za-z][A-Za-z0-9_]*)\]/g)].map(m=>m[1]!)).filter(id=>!terms.some(t=>t.termId===id)&&dep.status.some(s=>s.id===id)));
 writeFileSync(depPath,JSON.stringify([...needed].sort()));
 const deps={status:dep.status.filter(s=>needed.has(s.id)),statusText:dep.statusText.filter(s=>needed.has(s.statusId)),statusCategory:dep.statusCategory.filter(s=>needed.has(s.statusId)),term:dep.term.filter(s=>needed.has(s.id)),termText:dep.termText.filter(s=>needed.has(s.termId))};
 terms=[...terms.filter(t=>!needed.has(t.termId)),...deps.termText];
 statuses=[...statuses.filter(t=>!needed.has(t.statusId)),...deps.statusText];
 const dicts=new Map(['ko','en','ja'].map(l=>[l,new Map(terms.filter(t=>t.locale===l).map(t=>[t.termId,t.name]))]));
 gifts.giftStageText=gifts.giftStageText.map(t=>({...t,...descOf(t.descRaw??t.desc,dicts.get(t.locale))}));
 const overrides=await db.fieldOverride.findMany();
 gifts.giftStageText=applyTextOverrides(gifts.giftStageText,overrides,{entity:'gift',idKey:'giftId',field:'name'},meta);
 gifts.gift=applyColumnOverrides(gifts.gift,overrides,{entity:'gift',idKey:'id',fields:['hardOnly']},meta);
 packs.packText=applyTextOverrides(packs.packText,overrides,{entity:'pack',idKey:'packId',field:'name'},meta);
 packs.pack=applyColumnOverrides(packs.pack,overrides,{entity:'pack',idKey:'id'},meta);
 // This job refreshes Mirror Dungeon gifts; story-dungeon gifts stay untouched.
 const mdIds=new Set(gifts.gift.filter(g=>g.domain==='mirror_dungeon').map(g=>g.id));
 for(const [name,rows] of Object.entries(gifts)) (gifts as any)[name]=rows.filter((r:any)=>mdIds.has(r.giftId??r.entityId??r.id));
 const tables:Record<string,any[]>={...deps,...vocab,...packs,...gifts,...encounters};
 const tokens=validateTextTokens(tables,terms,statuses);
 writeFileSync(join(work,'token-report.json'),JSON.stringify(tokens,null,2));
 const errors=[...tokens.errors];
 for(const g of gifts.giftStage)if(!gifts.giftStageText.some(t=>t.giftId===g.giftId&&t.level===g.level&&['ko','en'].includes(t.locale)&&t.name&&t.desc))errors.push(`Missing gift text: ${g.giftId}/${g.level}`);
 for(const p of packs.pack)if(!packs.packText.some(t=>t.packId===p.id&&['ko','en'].includes(t.locale)&&t.name))errors.push(`Missing pack text ${p.id}`);
 const giftIds=new Set(gifts.gift.map(g=>g.id));
 for(const r of [...gifts.fusionSlot,...gifts.fusionSlotOption])if(r.materialId&&!giftIds.has(r.materialId))errors.push(`Missing recipe material ${r.materialId}`);
 const currentGifts=await db.gift.findMany({where:{domain:'mirror_dungeon'},select:{id:true}}),currentPacks=await db.pack.findMany({select:{id:true}});
 for(const g of currentGifts)if(!giftIds.has(g.id))errors.push(`Unexpected gift removal ${g.id}`);
 const localInputs=Object.fromEntries(['packs/packs.json','packs/packs_detail.json','gifts/gifts.json','gifts/gifts_detail.json','mechanics/terms.json','mechanics/sins.json'].map(p=>{const [family,file]=p.split('/');const path=join(work,'source','limbus-data-mj',file!);return [path,read(path)];}));
 const candidate={manifest,localInputs,tables,gaps:meta.gaps.filter(g=>g.entity!=='gift'||mdIds.has(g.entityId)),sources:meta.sources.filter(g=>g.entity!=='gift'||mdIds.has(g.entityId))};
 const json=JSON.stringify(candidate,null,2),hash=createHash('sha256').update(json).digest('hex');
 writeFileSync(join(work,'candidate.json'),json);
 const report={hash,counts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),newGifts:gifts.gift.filter(g=>!currentGifts.some(o=>o.id===g.id)).map(g=>({id:g.id,name:gifts.giftStageText.find(t=>t.giftId===g.id&&t.level===0&&t.locale==='ko')?.name})),newPacks:packs.pack.filter(p=>!currentPacks.some(o=>o.id===p.id)).map(p=>({id:p.id,name:packs.packText.find(t=>t.packId===p.id&&t.locale==='ko')?.name})),errors};
 writeFileSync(join(work,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(errors.length)throw Error('Candidate validation failed');
 if(!process.argv.includes('--apply'))process.exitCode=0;
 else {
 if(!process.argv.includes(`--candidate-hash=${hash}`))throw Error('Candidate hash must match reviewed candidate');
 await db.$transaction(async tx=>{
 await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('limbus-source-update'))");
 await tx.$executeRawUnsafe('ALTER TABLE canonical.pack ALTER COLUMN floor_length DROP NOT NULL, ALTER COLUMN superposition DROP NOT NULL, ALTER COLUMN extreme DROP NOT NULL, ALTER COLUMN bokgak DROP NOT NULL');
 // Only owned child rows are replaced. Roots and unrelated domain tables survive.
 const packIds=packs.pack.map(p=>p.id),ids=[...giftIds];
 for(const name of ['packText','packTag','packCategoryPath','floorPack'])await (tx as any)[name].deleteMany({where:{packId:{in:packIds}}});
 for(const name of ['giftStageText','giftStage','giftEffect','giftTrigger','giftPack','giftExclusivePack','giftRequirement','fusionSlotOption','fusionSlot','fusionRecipe','giftLockedDesc'])await (tx as any)[name].deleteMany({where:{giftId:{in:ids}}});
 const encounterIds=encounters.encounter.map(e=>e.id);
 await tx.packBossEncounter.deleteMany({where:{packId:{in:packIds},encounterId:{in:encounterIds}}});
 for(const name of ['encounterPartResist','encounterTargetPart','encounterTarget'])await (tx as any)[name].deleteMany({where:{encounterId:{in:encounterIds}}});
 await tx.toolAnnotation.deleteMany({where:{entity:'gift',entityId:{in:ids}}});
 const models=new Map(Prisma.dmmf.datamodel.models.map(m=>[m.name[0]!.toLowerCase()+m.name.slice(1),m]));
 const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
 for(const [name,rows] of Object.entries(tables)){
 if(!rows.length)continue;const model=models.get(name)!;
 const fields=new Map(model.fields.filter(f=>f.kind!=='object').map(f=>[f.name,f.dbName??f.name]));
 const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))].map(f=>fields.get(f)!);
 const pk=(model.primaryKey?.fields??model.fields.filter(f=>f.isId).map(f=>f.name)).map(f=>fields.get(f)!);
 const rest=cols.filter(f=>!pk.includes(f));const table='canonical.'+quote(model.dbName??model.name);
 const payload=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[fields.get(k)!,v])));
 const conflict=rest.length?'DO UPDATE SET '+rest.map(c=>`${quote(c)}=EXCLUDED.${quote(c)}`).join(','):'DO NOTHING';
 await tx.$executeRawUnsafe(`INSERT INTO ${table} (${cols.map(quote)}) SELECT ${cols.map(quote)} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb) ON CONFLICT (${pk.map(quote)}) ${conflict}`,JSON.stringify(payload));
 }
 for(const entity of ['gift','pack']){
 const entityId={in:entity==='gift'?ids:packIds};
 await tx.fieldGap.deleteMany({where:{entity,entityId}});await tx.fieldSource.deleteMany({where:{entity,entityId}});
 }
 await tx.fieldGap.createMany({data:candidate.gaps,skipDuplicates:true});
 // The manifest is retained beside the immutable candidate, including source hashes.
 await tx.fieldSource.createMany({data:candidate.sources.map(s=>({...s,snapshotId:`md-${hash.slice(0,20)}`})),skipDuplicates:true});
 },{timeout:120000});
 writeFileSync(join(work,'applied.json'),JSON.stringify({hash,at:new Date().toISOString()},null,2));console.log('Applied',hash);
 }
} finally {await db.$disconnect();}
