import {test} from 'node:test';import assert from 'node:assert/strict';
import {cacheReference} from './query-cache';
test('reference reads share one in-flight request and subsequent cached data',async()=>{
 let count=0;const load=cacheReference(async()=>{count++;return ['corpus']});
 const [a,b]=await Promise.all([load(),load()]);assert.equal(count,1);assert.strictEqual(a,b);await load();assert.equal(count,1);
});
test('expired or failed reference reads retry without caching errors',async()=>{
 let count=0;const load=cacheReference(async()=>++count,0);await load();await load();assert.equal(count,2);
 let tries=0;const retry=cacheReference(async()=>{if(++tries===1)throw Error('offline');return 'ok'});await assert.rejects(retry());assert.equal(await retry(),'ok');assert.equal(tries,2);
});
