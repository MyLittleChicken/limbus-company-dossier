import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PrismaClient,type Prisma} from '../v2/generated/client.js';
import {applyCandidate} from './apply.js';
import type {Candidate} from './candidate.js';

const url=process.env['UPDATE_TEST_DATABASE_URL'];
const candidateFile=process.env['UPDATE_TEST_CANDIDATE'];
test('real update is idempotent, synchronizes only owner children, preserves app/gifts/packs and rolls back', {skip:!url||!candidateFile},async()=>{
 const target=new URL(url!);assert.ok(['127.0.0.1','localhost'].includes(target.hostname)&&target.port==='15439','isolated audit database required');
 const db=new PrismaClient({datasourceUrl:url!});
 const c=JSON.parse(await readFile(candidateFile!,'utf8')) as Candidate;
 async function protectedDigest(tx:PrismaClient|Prisma.TransactionClient){
  return tx.$queryRawUnsafe("SELECT 'gift' AS name,md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) AS digest FROM canonical.gift t UNION ALL SELECT 'pack',md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM canonical.pack t UNION ALL SELECT 'run',md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) FROM app.run t");
 }
 try{
  const before=await db.identity.findUnique({where:{id:'10616'}});const protectedBefore=await protectedDigest(db);
  await assert.rejects(db.$transaction(async tx=>{
   await applyCandidate(tx,c);assert.ok(await tx.identity.findUnique({where:{id:'10616'}}));
   assert.deepEqual(await applyCandidate(tx,c),{upserted:0,deletedChildren:0});
   const changed=structuredClone(c);const entity=changed.tables['identity']!.find(r=>r['id']==='10616')!;entity['hp']=Number(entity['hp'])+1;
   const removed=changed.tables['identityKeyword']!.find(r=>r['identityId']==='10616')!;
   changed.tables['identityKeyword']=changed.tables['identityKeyword']!.filter(r=>r!==removed);
   const delta=await applyCandidate(tx,changed);assert.ok(delta.upserted>=1);assert.equal(delta.deletedChildren,1);
   assert.equal((await tx.identity.findUnique({where:{id:'10616'}}))?.hp,entity['hp']);
   assert.equal(await tx.identityKeyword.count({where:{identityId:'10616',keywordId:String(removed['keywordId'])}}),0);
   assert.deepEqual(await protectedDigest(tx),protectedBefore);
   // A missing source root remains in storage with its direct children.
   const held=structuredClone(c);held.tables['identity']=held.tables['identity']!.filter(r=>r['id']!=='10616');held.identityIds=held.identityIds.filter(id=>id!=='10616');
   for(const key of Object.keys(held.tables))if(key.startsWith('identity')&&key!=='identity')held.tables[key]=held.tables[key]!.filter(r=>r['identityId']!=='10616');
   await applyCandidate(tx,held);assert.equal((await tx.identity.findUnique({where:{id:'10616'}}))?.hp,entity['hp']);
   throw Error('injected failure after successful writes');
  },{timeout:120000}),/injected failure/);
  assert.deepEqual(await db.identity.findUnique({where:{id:'10616'}}),before);
  assert.deepEqual(await protectedDigest(db),protectedBefore);
 }finally{await db.$disconnect();}
});
