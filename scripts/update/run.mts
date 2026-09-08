/** One manual/scheduled path: discover, validate, publish images, transactionally synchronize. */
import {resolve,join,sep} from 'node:path';
import {mkdir,writeFile,rename,appendFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../src/v2/generated/client.js';
import {collect,verifyDownload} from '../../src/update/fetch.js';
import {buildCandidate} from '../../src/update/candidate.js';
import {validateCandidate,validateCandidateReferences,validateCandidateAssets} from '../../src/update/validate.js';
import {applyCandidate} from '../../src/update/apply.js';
import {publishAssets} from '../../src/update/publish.js';

const args=process.argv.slice(2);
const switches=new Set(['--collect','--apply']);const values=new Set(['--staging','--database-url','--staging-url']);
const options=new Map<string,string>();
for(let i=0;i<args.length;i++){
 const arg=args[i]!;if(switches.has(arg))continue;
 if(!values.has(arg)||!args[i+1]||args[i+1]!.startsWith('--'))throw Error(`Unknown or incomplete option ${arg}`);
 options.set(arg,args[++i]!);
}
const root=process.cwd();const runId=`${new Date().toISOString().replaceAll(':','')}-${randomUUID().slice(0,8)}`;
const staging=resolve(options.get('--staging')??join(root,'var/updates',runId));
if(staging===root||['data','public','src','app'].some(p=>staging===join(root,p)||staging.startsWith(join(root,p)+sep)))throw Error('Use a separate staging directory, never product data/source directories');
const dbUrl=options.get('--database-url')??options.get('--staging-url')??process.env.DATABASE_URL;
if(!dbUrl)throw Error('DATABASE_URL is required');
process.env.DATABASE_URL=dbUrl;
const lockUrl=new URL(dbUrl);lockUrl.searchParams.set('connection_limit','1');
const lock=new PrismaClient({datasourceUrl:lockUrl.toString()});
const db=new PrismaClient();let locked=false;let committed=false;
const report:Record<string,unknown>={runId,startedAt:new Date().toISOString(),mode:args.includes('--apply')?'apply':'validate',staging,status:'running',committed:false};
async function saveReport(){const dest=join(staging,'result.json');const tmp=`${dest}.${runId}.tmp`;await writeFile(tmp,JSON.stringify(report,null,2)+'\n');await rename(tmp,dest);}
try{
 const rows=await lock.$queryRawUnsafe<Array<{locked:boolean}>>("SELECT pg_try_advisory_lock(hashtext('limbus-source-update-run')) AS locked");
 locked=rows[0]?.locked??false;if(!locked)throw Error('Another source update is running for this database');
 await mkdir(staging,{recursive:true});await saveReport();
 const manifest=args.includes('--collect')?await collect(root,staging):await verifyDownload(staging);
 // Re-read hashes even after collection; resumed/manual candidates use the same gate.
 await verifyDownload(staging);
 Object.assign(report,{snapshot:manifest.id,heads:manifest.heads,files:manifest.files.length});
 const candidate=await buildCandidate(db,root,staging,manifest);
 const checks=[validateCandidate(candidate),await validateCandidateReferences(candidate,db),await validateCandidateAssets(candidate,manifest,root,staging)];
 Object.assign(report,{newIdentityIds:candidate.newIdentityIds,newEgoIds:candidate.newEgoIds,removed:candidate.removed,counts:Object.fromEntries(Object.entries(candidate.tables).map(([k,v])=>[k,v.length])),warnings:checks.flatMap(c=>c.warnings),errors:checks.flatMap(c=>c.errors)});
 await writeFile(join(staging,'candidate.json'),JSON.stringify({tables:candidate.tables,identityIds:candidate.identityIds,egoIds:candidate.egoIds},null,2));
 await writeFile(join(staging,'provenance.json'),JSON.stringify({sources:candidate.meta.sources,gaps:candidate.meta.gaps},null,2));
 if(checks.some(c=>!c.ok))throw Error(checks.flatMap(c=>c.errors).join('; '));
 if(args.includes('--apply')){
  report['imageJournal']=join(staging,'asset-journal.jsonl');
  report['images']=await publishAssets(root,staging,manifest,async event=>{
   await appendFile(join(staging,'asset-journal.jsonl'),JSON.stringify({runId,at:new Date().toISOString(),...event})+'\n');
   report['images']={added:event['added'],changed:event['changed'],unchanged:event['unchanged'],lastState:event['state']};
  });
  report['rowsProcessed']=await db.$transaction(tx=>applyCandidate(tx,candidate),{timeout:120000,maxWait:10000});
  committed=true;report['committed']=true;
 }
 Object.assign(report,{status:committed?'applied':'validated',finishedAt:new Date().toISOString()});await saveReport();
 if(committed){const dir=join(root,'var/updates');await mkdir(dir,{recursive:true});const temp=join(dir,`last-success.${runId}.tmp`);await writeFile(temp,JSON.stringify(report,null,2)+'\n');await rename(temp,join(dir,'last-success.json'));}
 console.log(JSON.stringify(report,null,2));
}catch(error){
 Object.assign(report,{status:committed?'committed-report-failed':'failed',committed,finishedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error)});
 if(locked){try{await saveReport();}catch{/* Preserve the original failure in stderr. */}}
 console.error(JSON.stringify(report,null,2));process.exitCode=1;
}finally{
 try{if(locked)await lock.$executeRawUnsafe("SELECT pg_advisory_unlock(hashtext('limbus-source-update-run'))");}finally{await Promise.all([lock.$disconnect(),db.$disconnect()]);}
}
