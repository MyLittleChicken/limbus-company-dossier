export type ListState={limit:number;anchor:string|null;offset:number;y:number};
export function listStateKey(path:string,query:string):string {const p=new URLSearchParams(query);p.sort();return 'dossier:list:'+path.replace(/^\/(ko|en)(?=\/|$)/,'')+'?'+p.toString()}
export function validStage(value:string|null,available:number[]):number {const max=Math.max(...available,1);return value!==null&&available.includes(Number(value))?Number(value):max}
export function readListState(raw:string|null):ListState|null {
 try {const s=JSON.parse(raw??'null');if(!s||!Number.isInteger(s.limit)||s.limit<1||!Number.isFinite(s.y)||!Number.isFinite(s.offset)||(s.anchor!==null&&typeof s.anchor!=='string'))return null;return {...s,limit:Math.min(s.limit,10000),y:Math.max(0,s.y)};}catch{return null}
}
