import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { targetPath, snapshotId } from './discovery.js';

export interface UpdateFile { path:string; source:string; sourcePath:string; commit:string; blob:string; sha256:string; bytes:number }
export interface UpdateManifest { id:string; collectedAt:string; heads:Record<string,string>; files:UpdateFile[] }
interface Source { id:string; repo:string; branch:string; commit:string }
interface Tree { truncated:boolean; tree:Array<{path:string;type:string;sha:string}> }
const sha = (b:Buffer) => createHash('sha256').update(b).digest('hex');
async function request(url:string):Promise<Buffer> {
 for(let attempt=0;attempt<4;attempt++) {
  try {
   const response=await fetch(url,{headers:{'User-Agent':'limbus-source-update',...(process.env['GITHUB_TOKEN']?{Authorization:`Bearer ${process.env['GITHUB_TOKEN']}`}:{})},signal:AbortSignal.timeout(45000)});
   if(!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
   return Buffer.from(await response.arrayBuffer());
  } catch(error) {if(attempt===3) throw error; await new Promise(r=>setTimeout(r,500*(attempt+1)));}
 }
 throw Error('request exhausted');
}
export async function collect(root:string, work:string):Promise<UpdateManifest> {
 const baseline=JSON.parse(await readFile(join(root,'data/manifest.json'),'utf8')) as {sources:Source[]};
 const sources=baseline.sources.filter(s=>['limbus-assets','limbus-data-mj','loc-ko','loc-en','loc-ja'].includes(s.id));
 const heads:Record<string,string>={};const jobs:Array<{source:Source;path:string;blob:string;target:string}>=[];
 for(const source of sources) {
  const repo=source.repo.replace('github.com/','');
  const head=JSON.parse((await request(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(source.branch)}`)).toString()) as {sha:string};
  heads[source.id]=head.sha;
  const tree=JSON.parse((await request(`https://api.github.com/repos/${repo}/git/trees/${head.sha}?recursive=1`)).toString()) as Tree;
  if(tree.truncated) throw Error(`Incomplete source tree: ${source.id}`);
  for(const entry of tree.tree) {
   const target=targetPath(source.id,entry.path);
   if(entry.type==='blob'&&target)jobs.push({source,path:entry.path,blob:entry.sha,target});
  }
 }
 if(sources.length!==5||jobs.length===0)throw Error('Missing source configuration or files');
 const manifest:UpdateManifest={id:snapshotId(heads),collectedAt:new Date().toISOString(),heads,files:[]};
 await mkdir(work,{recursive:true});
 let cursor=0;
 await Promise.all(Array.from({length:8},async()=>{
  while(cursor<jobs.length){
   const job=jobs[cursor++];if(!job)break;
   const repo=job.source.repo.replace('github.com/','');
   const body=await request(`https://raw.githubusercontent.com/${repo}/${heads[job.source.id]}/${job.path.split('/').map(encodeURIComponent).join('/')}`);
   const gitHash=createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
   if(gitHash!==job.blob)throw Error(`Git blob checksum mismatch: ${job.path}`);
   const data=job.target.endsWith('.json')?Buffer.from(body.toString('utf8').replace(/\r\n/g,'\n')):body;
   if(job.target.endsWith('.json')) JSON.parse(data.toString('utf8').replace(/^\uFEFF/,''));
   const dest=resolve(work,job.target);if(!dest.startsWith(resolve(work)+'/'))throw Error('Unsafe output path');
   await mkdir(dirname(dest),{recursive:true});await writeFile(dest+'.tmp',data);await rename(dest+'.tmp',dest);
   manifest.files.push({path:job.target,source:job.source.id,sourcePath:job.path,commit:heads[job.source.id]??'',blob:job.blob,sha256:sha(data),bytes:data.length});
  }
 }));
 manifest.files.sort((a,b)=>a.path.localeCompare(b.path));
 await writeFile(join(work,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
export async function verifyDownload(work:string):Promise<UpdateManifest>{
 const manifest=JSON.parse(await readFile(join(work,'manifest.json'),'utf8')) as UpdateManifest;
 if(!manifest.id||!Array.isArray(manifest.files))throw Error('Invalid update manifest');
 const paths=new Set<string>();
 for(const file of manifest.files){
  if(targetPath(file.source,file.sourcePath)!==file.path||paths.has(file.path))throw Error(`Unexpected/duplicate file ${file.path}`);
  paths.add(file.path);const b=await readFile(join(work,file.path));if(sha(b)!==file.sha256)throw Error(`Staging checksum mismatch ${file.path}`);
 }
 return manifest;
}
