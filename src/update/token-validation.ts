import { stripMarkup } from '../v2/canonical/markup.js';
import type { Row } from './candidate.js';

interface TermText { termId: string; locale: string; name: string }
interface StatusText { statusId: string; locale: string; name: string }
export interface TokenIssue {
 table: string;
 key: Record<string, unknown>;
 locale: string;
 field: string;
 token: string;
 excerpt: string;
}
const TEXT_TABLES = ['giftStageText','identityText','egoText','skillStageText','egoSkillStageText','passiveText','egoPassiveText','statusText'] as const;
// Literal English headings verified in EGOgift files at loc-en
// 43d9f5de03ee53baa04d4d1575bc067979220d8e; not internal status identifiers.
const GIFT_HEADINGS=new Set(['Cannot Stack','Blade Lineage Mentor Meursault Only',
 'Dawn Office Identities Exclusive Effect','Effects apply only to the Identity with the earliest Deployment order',
 'La Manchaland Identities Only','The Index-faction Exclusive Effect','The Manager of La Manchaland Don Quixote Only',
 // EGOgift_MirrorDungeon_8 / EGOgift_walpu10 at loc-en 11d14d9653f8cf4c3570155d206ea92d317b1e1e.
 'Wedge Office Rep Outis Exclusive Effect','Wild Hunt Heathcliff exclusive effect',
 'Effect exclusive to Identities that have 2 or more Minus Coin Skills']);
const COIN_TABLES = ['skillCoin','egoSkillCoin'] as const;
const KEY_FIELDS = ['id','giftId','level','identityId','egoId','skillId','passiveId','statusId','uptie','index'] as const;
// Game references use ASCII identifiers; translated brackets and numeric notes are literals.
const TOKEN = /\[([A-Za-z][A-Za-z0-9_ -]*)\]/g;

/** Validate both source and display text, without modifying engine-facing raw effects. */
export function validateTextTokens(
 tables: Record<string, Row[]>, terms: readonly TermText[], statuses: readonly StatusText[],
) {
 const replacedTerms=new Set((tables['term']??[]).map(r=>r['id']));
 const replacedStatuses=new Set((tables['status']??[]).map(r=>r['id']));
 const termRows = new Map(terms.filter(r=>!replacedTerms.has(r.termId)).map(r=>[`${r.locale}:${r.termId}`,r]));
 const statusRows = new Map(statuses.filter(r=>!replacedStatuses.has(r.statusId)).map(r=>[`${r.locale}:${r.statusId}`,r]));
 for(const r of tables['termText']??[]) termRows.set(`${r['locale']}:${r['termId']}`,r as unknown as TermText);
 for(const r of tables['statusText']??[]) statusRows.set(`${r['locale']}:${r['statusId']}`,r as unknown as StatusText);
 const known = new Map<string,Set<string>>();
 for(const locale of ['ko','en']) {
  const keys=new Set<string>();
  for(const row of termRows.values()) if(row.locale===locale) {
   keys.add(row.termId);
   // E.g. [On Hit] is the rendered label, not another unresolved identifier.
   for(const match of stripMarkup(row.name).matchAll(TOKEN)) keys.add(match[1]!);
  }
  // Status display uses English only when the requested translation is absent.
  for(const row of statusRows.values()) if((row.locale===locale||row.locale==='en')&&row.name.trim()) {
   keys.add(row.statusId);
   for(const match of stripMarkup(row.name).matchAll(TOKEN)) keys.add(match[1]!);
  }
  known.set(locale,keys);
 }
 const issues:TokenIssue[]=[];
 let checkedTexts=0;
 function check(table:string,row:Row,field:string,value:unknown) {
  const locale=String(row['locale']);const dict=known.get(locale);
  if(!dict||typeof value!=='string')return;
  checkedTexts++;
  const seen=new Set<string>();
  for(const match of value.matchAll(TOKEN)) {
   const token=match[1]!;
   if(dict.has(token)||seen.has(token)||(table==='giftStageText'&&locale==='en'&&GIFT_HEADINGS.has(token)))continue;
   seen.add(token);
   issues.push({table,key:Object.fromEntries(KEY_FIELDS.filter(k=>row[k]!==undefined).map(k=>[k,row[k]])),locale,field,token,
    excerpt:value.slice(Math.max(0,match.index-60),match.index+match[0].length+100)});
  }
 }
 for(const table of TEXT_TABLES)for(const row of tables[table]??[]) {
  check(table,row,'desc',row['desc']);
  if(row['descRaw']!==row['desc'])check(table,row,'descRaw',row['descRaw']);
 }
 for(const table of COIN_TABLES)for(const row of tables[table]??[]) {
  if(Array.isArray(row['effects']))row['effects'].forEach((effect,index)=>check(table,row,`effects[${index}]`,effect));
 }
 return {ok:issues.length===0,checkedTexts,issues,
  errors:issues.map(i=>`unresolved token [${i.token}] at ${i.table}${JSON.stringify(i.key)} ${i.locale}.${i.field}`),warnings:[] as string[]};
}
