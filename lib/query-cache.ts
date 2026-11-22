/** Small per-process cache for public reference data; never key this by user search text. */
export function cacheReference<A extends unknown[],T>(load:(...args:A)=>Promise<T>,ttl=30_000){
 const entries=new Map<string,{expires:number;value:Promise<T>}>();
 return (...args:A):Promise<T>=>{
  const key=JSON.stringify(args),now=Date.now(),old=entries.get(key);
  if(old&&old.expires>now)return old.value;
  const value=Promise.resolve().then(()=>load(...args));
  const entry={expires:Infinity,value};entries.set(key,entry);
  value.then(()=>{entry.expires=Date.now()+ttl},()=>{if(entries.get(key)===entry)entries.delete(key)});
  return value;
 };
}
