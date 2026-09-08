import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {publishAssets} from './publish.js';
import type {UpdateManifest} from './fetch.js';
test('publication adds, preserves unchanged revisions, replaces updates and rejects corruption',async()=>{
 const root=await mkdtemp(join(tmpdir(),'limbus-publish-'));const work=join(root,'staging');const path='assets/identities/limbus-assets/99999_normal.webp';
 await mkdir(join(work,'assets/identities/limbus-assets'),{recursive:true});
 const bytes=Buffer.from('image');await writeFile(join(work,path),bytes);
 const manifest:UpdateManifest={id:'test',collectedAt:new Date().toISOString(),heads:{},files:[{path,source:'limbus-assets',sourcePath:'assets/identities/99999_normal.webp',commit:'test',blob:'test',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length}]};
 try{
  assert.deepEqual(await publishAssets(root,work,manifest),{added:1,changed:0,unchanged:0});
  const dest=join(root,'data',path);const before=await stat(dest);
  assert.deepEqual(await publishAssets(root,work,manifest),{added:0,changed:0,unchanged:1});assert.equal((await stat(dest)).mtimeMs,before.mtimeMs);
  await writeFile(join(work,path),'replacement');
  await assert.rejects(()=>publishAssets(root,work,manifest),/checksum/);assert.equal(await readFile(dest,'utf8'),'image');
  manifest.files[0]!.sha256=createHash('sha256').update('replacement').digest('hex');manifest.files[0]!.bytes=11;
  assert.deepEqual(await publishAssets(root,work,manifest),{added:0,changed:1,unchanged:0});assert.equal(await readFile(dest,'utf8'),'replacement');
 }finally{await rm(root,{recursive:true,force:true});}
});
