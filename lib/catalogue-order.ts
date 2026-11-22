/** Base first; identities sort by rarity, E.G.O ignores slot rank; oldest release first. */
export function compareCatalogueUnits(a:{isBase?:boolean;grade:number;released?:string|null;name:string;id:string},b:typeof a,locale:string,gradeOrder:'asc'|'desc'|'none'='asc'):number {
 return Number(!!b.isBase)-Number(!!a.isBase)||(gradeOrder==='none'?0:gradeOrder==='asc'?a.grade-b.grade:b.grade-a.grade)||(a.released??'9999').localeCompare(b.released??'9999')||a.name.localeCompare(b.name,locale)||a.id.localeCompare(b.id);
}
export function catalogueSearchKey(value:string):string {return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');}
