/** Restore pinned game UI artwork; never silently accept changed upstream bytes. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const {assets}=JSON.parse(await readFile(new URL('../content/ui-assets.json',import.meta.url),'utf8'));
for(const asset of assets){
 const target=new URL('../'+asset.path,import.meta.url);
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const existing=await readFile(target).catch(()=>null);
 if(existing&&hash(existing)===asset.sha256){console.log('Verified '+asset.path);continue;}
 const response=await fetch(asset.url);if(!response.ok)throw Error(`${response.status} ${asset.url}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(hash(bytes)!==asset.sha256)throw Error('Source checksum changed: '+asset.path);
 await mkdir(dirname(target.pathname),{recursive:true});
 const temp=new URL(target.href+'.tmp');await writeFile(temp,bytes);await rename(temp,target);
 console.log('Restored '+asset.path);
}
