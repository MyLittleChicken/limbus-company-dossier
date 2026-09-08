import {Prisma} from '../v2/generated/client.js';
import type {Candidate,Row} from './candidate.js';

// The updater may synchronize only these models; app, gifts, packs and root deletions are excluded.
const ALLOW=new Set(['association','associationText','status','statusText','statusCategory','skill','skillStage','skillStageText','skillCoin','passive','passiveRequirement','passiveText','identity','identityText','identityResist','identitySpeed','identitySkill','identityPassive','identityAssociation','identityKeyword','identityUnitKeyword','identityStatus','ego','egoText','egoResist','egoCost','egoCorrosion','egoRequirement','egoSkill','egoSkillStage','egoSkillStageText','egoSkillCoin','egoPassive','egoPassiveText','egoPassiveLink','egoStatus']);
const models=new Map(Prisma.dmmf.datamodel.models.map(m=>[m.name[0]!.toLowerCase()+m.name.slice(1),m]));
const roots=new Set(['association','status','skill','passive','identity','ego','egoPassive']);
const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';

export function validateCandidateShape(c:Candidate):string[]{
 const errors:string[]=[];
 for(const [table,rows] of Object.entries(c.tables)){
  if(!ALLOW.has(table))errors.push(`table not allowlisted: ${table}`);
  for(const row of rows)for(const [key,value] of Object.entries(row))if(value===undefined||value==='undefined')errors.push(`${table}.${key} undefined`);
 }
 return errors;
}

export async function applyCandidate(tx:Prisma.TransactionClient,c:Candidate):Promise<{upserted:number;deletedChildren:number}>{
 const errors=validateCandidateShape(c);if(errors.length)throw Error(errors.join('; '));
 await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','limbus-source-update');
 // Derive FK order from the installed schema rather than maintaining a second schema by hand.
 const order:string[]=[];const visiting=new Set<string>();
 function visit(key:string){
  if(order.includes(key))return;if(visiting.has(key))throw Error(`cyclic update relation ${key}`);visiting.add(key);
  const model=models.get(key);if(!model)throw Error(`missing model ${key}`);
  for(const field of model.fields.filter(f=>f.relationFromFields?.length)){
   const parent=field.type[0]!.toLowerCase()+field.type.slice(1);if(parent in c.tables)visit(parent);
  }
  visiting.delete(key);order.push(key);
 }
 for(const key of Object.keys(c.tables))visit(key);
 const ids=(key:string)=>(c.tables[key]??[]).map(r=>String(r['id']));
 const egoIds=ids('ego');
 const oldEgoSkills=egoIds.length?await tx.egoSkill.findMany({where:{egoId:{in:egoIds}},select:{id:true}}):[];
 const egoSkillIds=[...new Set([...oldEgoSkills.map(r=>r.id),...ids('egoSkill')])];
 const mapped=new Map<string,{table:string;pk:string[];columns:string[];payload:Record<string,unknown>[]}>();
 let upserted=0;let deletedChildren=0;
 for(const key of order){
  const model=models.get(key)!;const rows=c.tables[key]??[];
  const scalar=new Map(model.fields.filter(f=>f.kind!=='object').map(f=>[f.name,f.dbName??f.name]));
  for(const row of rows)for(const field of Object.keys(row))if(!scalar.has(field))throw Error(`unknown field ${key}.${field}`);
  const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))].map(f=>scalar.get(f)!);
  const pk=(model.primaryKey?.fields??model.fields.filter(f=>f.isId).map(f=>f.name)).map(f=>scalar.get(f)!);
  if(!pk.length)throw Error(`missing primary key ${key}`);
  const table=`canonical.${quote(model.dbName??model.name)}`;
  const payload=rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[scalar.get(k)!,v])));
  mapped.set(key,{table,pk,columns,payload});if(!rows.length)continue;
  const updates=columns.filter(f=>!pk.includes(f));
  const conflict=updates.length?`DO UPDATE SET ${updates.map(f=>`${quote(f)}=EXCLUDED.${quote(f)}`).join(',')} WHERE (${updates.map(f=>`current.${quote(f)}`).join(',')}) IS DISTINCT FROM (${updates.map(f=>`EXCLUDED.${quote(f)}`).join(',')})`:'DO NOTHING';
  const sql=`INSERT INTO ${table} AS current (${columns.map(quote).join(',')}) SELECT ${columns.map(f=>`incoming.${quote(f)}`).join(',')} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb) incoming ON CONFLICT (${pk.map(quote).join(',')}) ${conflict}`;
  upserted+=await tx.$executeRawUnsafe(sql,JSON.stringify(payload));
 }
 // Remove only absent child keys of refreshed owners, from leaves towards parents.
 // Omitted upstream root IDs retain their existing rows and relations.
 for(const key of [...order].reverse()){
  if(roots.has(key))continue;
  let field:string;let owners:string[];
  if(key.startsWith('identity')){field='identityId';owners=ids('identity');}
  else if(key==='egoSkill'){field='egoId';owners=egoIds;}
  else if(key.startsWith('egoSkill')){field='skillId';owners=egoSkillIds;}
  else if(key==='egoPassiveText'){field='passiveId';owners=ids('egoPassive');}
  else if(key.startsWith('ego')){field='egoId';owners=egoIds;}
  else if(key.startsWith('skill')){field='skillId';owners=ids('skill');}
  else if(key.startsWith('passive')){field='passiveId';owners=ids('passive');}
  else if(key.startsWith('status')){field='statusId';owners=ids('status');}
  else if(key.startsWith('association')){field='associationId';owners=ids('association');}
  else throw Error(`missing owner scope ${key}`);
  if(!owners.length)continue;
  const model=models.get(key)!;const column=model.fields.find(f=>f.name===field);if(!column)throw Error(`invalid owner ${key}.${field}`);
  const {table,pk,payload}=mapped.get(key)!;
  const sql=`DELETE FROM ${table} AS current WHERE current.${quote(column.dbName??column.name)}=ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::${table},$2::jsonb) incoming WHERE ${pk.map(f=>`incoming.${quote(f)}=current.${quote(f)}`).join(' AND ')})`;
  deletedChildren+=await tx.$executeRawUnsafe(sql,owners,JSON.stringify(payload));
 }
 return {upserted,deletedChildren};
}
