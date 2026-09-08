import { resolve } from 'node:path';
import { collect } from '../../src/update/fetch.js';
const work=process.argv[2];
if(!work)throw Error('Usage: npm run update:collect -- /absolute/staging/directory');
if(!resolve(work).startsWith('/tmp/'))throw Error('Initial collection must use /tmp staging');
const m=await collect(process.cwd(),resolve(work));
console.log(JSON.stringify({id:m.id,heads:m.heads,files:m.files.length,work},null,2));
