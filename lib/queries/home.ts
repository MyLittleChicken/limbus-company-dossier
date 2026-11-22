import {cacheReference} from '@/lib/query-cache';
import snapshot from '@/content/current.json';
import {dayInSeoul,isActiveEntry} from '@/lib/home-content';
import {canonical} from '@/lib/db-canonical';
import {identityImage,egoImage} from '@/lib/assets';
import type {Locale} from '@/lib/locale';
export const getCurrentHome=cacheReference(async(locale:Locale)=>{
 const day=dayInSeoul();
 const active=snapshot.pickups.filter(p=>isActiveEntry(p,day));
 const [identities,egos]=await Promise.all([
  canonical.identity.findMany({where:{id:{in:active.flatMap(p=>p.identities)}},include:{texts:true}}),
  canonical.ego.findMany({where:{id:{in:active.flatMap(p=>p.egos)}},include:{texts:true,sinner:{include:{texts:true}}}}),
 ]);
 const pick=<T extends {locale:string}>(texts:T[])=>texts.find(t=>t.locale===locale)??texts.find(t=>t.locale==='ko')??texts.find(t=>t.locale==='en');
 return {...snapshot,pickups:active.flatMap(p=>{
  const targets=[...p.identities.map(id=>{const unit=identities.find(x=>x.id===id),text=unit&&pick(unit.texts);return text?{id,kind:'identities',name:[text.title,text.name].filter(Boolean).join(' ').replace(/\s+/g,' '),image:identityImage(Number(id),'profile')}:null}),
   ...p.egos.map(id=>{const unit=egos.find(x=>x.id===id),text=unit&&pick(unit.texts);return text?{id,kind:'egos',name:[text.name,unit&&pick(unit.sinner.texts)?.name].filter(Boolean).join(' · '),image:egoImage(Number(id),'awaken')}:null})];
  // A reviewed banner must not advertise missing canonical entities.
  return targets.every(t=>t!==null)?[{...p,targets:targets.filter(t=>t!==null)}]:[];
 }),events:snapshot.events.filter(e=>isActiveEntry(e,day))};
});
