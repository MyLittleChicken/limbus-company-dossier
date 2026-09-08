import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';
import {targetPath} from './discovery.js';
import type {UpdateManifest} from './fetch.js';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

/** Publish before DB commit. Existing identical files retain URL revisions. Never delete assets. */
export async function publishAssets(root:string,work:string,manifest:UpdateManifest,onProgress?:(event:Record<string,unknown>)=>Promise<void>):Promise<{added:number;changed:number;unchanged:number}>{
 const counts={added:0,changed:0,unchanged:0};
 for(const file of manifest.files.filter(f=>f.path.startsWith('assets/'))){
  if(targetPath(file.source,file.sourcePath)!==file.path)throw Error(`invalid asset path ${file.path}`);
  const bytes=await readFile(join(work,file.path));if(sha(bytes)!==file.sha256||bytes.length!==file.bytes)throw Error(`asset checksum mismatch ${file.path}`);
  const dest=join(root,'data',file.path);let previous:Buffer|undefined;
  try{previous=await readFile(dest);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(previous&&sha(previous)===file.sha256){counts.unchanged++;continue;}
  // Retain changed originals for operational recovery if the DB transaction later fails.
  if(previous){const backup=join(work,'asset-backups',file.path);await mkdir(dirname(backup),{recursive:true});
   try{await writeFile(backup,previous,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  }
  await onProgress?.({state:'prepared',path:file.path,sha256:file.sha256,previousSha256:previous?sha(previous):null,...counts});
  await mkdir(dirname(dest),{recursive:true});const temp=`${dest}.${randomUUID()}.tmp`;
  try{await writeFile(temp,bytes,{flag:'wx'});await rename(temp,dest);}finally{await rm(temp,{force:true});}
  if(previous)counts.changed++;else counts.added++;
  await onProgress?.({state:'published',path:file.path,sha256:file.sha256,...counts});
 }
 return counts;
}
