import {canonical} from '@/lib/db-canonical';
import {PACK_DIFFICULTY} from '@/lib/ui-text';
import {isLocale} from '@/lib/locale';
import {getGift} from '@/lib/queries/canonical/gifts';
import {getPack} from '@/lib/queries/canonical/detail';
import type {ReferencePreview} from '@/lib/reference-preview';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{kind:string;id:string}>}) {
 const {kind,id}=await params;const locale=new URL(request.url).searchParams.get('locale')??'ko';
 if(!isLocale(locale)||!/^\d{1,10}$/.test(id)||!['gifts','packs'].includes(kind))return Response.json({error:'Not found'},{status:404});
 const ko=locale==='ko';let result:ReferencePreview;
 if(kind==='gifts'){
  const gift=await getGift(Number(id),locale);if(!gift)return Response.json({error:'Not found'},{status:404});
  const stage=gift.stages.at(-1);
  result={title:stage?.text?.name??id,image:gift.icon,meta:[`${ko?'성위':'Tier'} ${gift.tier}`,gift.keyword?.name,stage&&stage.level>0?`${ko?'강화':'Enhancement'} +${stage.level}`:null].filter(Boolean).join(' · '),description:stage?.text?.desc??null,href:`/${locale}/gifts/${id}`,related:gift.exclusivePacks.map(p=>({name:p.text?.name??p.id,href:`/${locale}/packs/${p.id}`}))};
 }else{
  const pack=await getPack(id,locale);if(!pack)return Response.json({error:'Not found'},{status:404});
  result={title:pack.text?.name??id,image:pack.icon,meta:ko?'테마 팩':'Theme pack',description:pack.floors.map(f=>`${PACK_DIFFICULTY[locale][f.difficulty]??f.difficulty} ${f.range}${ko?'층':'F'}`).join(' / ')||null,href:`/${locale}/packs/${id}`,related:pack.exclusiveGifts.map(g=>({name:g.text?.name??String(g.id),href:`/${locale}/gifts/${g.id}`}))};
 }
 if(result.description){
  const ids=[...result.description.matchAll(/\[([A-Za-z][A-Za-z0-9_]*)\]/g)].map(m=>m[1]!);
  if(ids.length){const texts=await canonical.statusText.findMany({where:{statusId:{in:ids}}});
   result.description=result.description.replace(/\[([A-Za-z][A-Za-z0-9_]*)\]/g,(whole,id)=>{const rows=texts.filter(t=>t.statusId===id);return (rows.find(t=>t.locale===locale)??rows.find(t=>t.locale==='ko')??rows.find(t=>t.locale==='en'))?.name??whole});}
 }
 return Response.json(result);
}
