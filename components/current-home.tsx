import Link from 'next/link';
import type {Locale} from '@/lib/locale';
import type {getCurrentHome} from '@/lib/queries/home';
type Data=Awaited<ReturnType<typeof getCurrentHome>>;
function Period({start,end}:{start:string;end:string|null}) {return <p className="current-period"><time dateTime={start}>{start}</time><span aria-hidden="true"> ~ </span>{end?<time dateTime={end}>{end}</time>:null}</p>}
export function CurrentHome({data,locale}:{data:Data;locale:Locale}) {
 const ko=locale==='ko';const [featured,...others]=data.pickups;
 return <>
 {!featured&&<h1 className="sr-only">{ko?'림버스 컴퍼니 도감':'Limbus Company Dossier'}</h1>}
 {featured&&<section className="current-pickup" aria-labelledby="pickup-title">
  <header className="pickup-heading"><div className="current-section-head"><span>{ko?'진행 중인 픽업':'Current extraction'}</span><Period start={featured.startDate} end={featured.endDate}/></div><h1 id="pickup-title">{featured.title[locale]}</h1><p className="pickup-subtitle">{featured.subtitle[locale]}</p></header>
  <div className="pickup-feature">
   <div className="mounted-art"><img src={featured.image} width={697} height={314} alt={featured.title[locale]} fetchPriority="high"/></div>
   <div className="pickup-copy"><h2>{ko?'픽업 대상':'Featured identities & E.G.O'}</h2>
    <ul className="pickup-targets">{featured.targets.map(target=><li key={target.id}><Link href={`/${locale}/${target.kind}/${target.id}`}>
     {target.image&&<img src={target.image} width={40} height={40} alt=""/>}<span>{target.name}</span><span className="target-kind">{target.kind==='identities'?(ko?'인격':'Identity'):'E.G.O'}</span>
    </Link></li>)}</ul>
   </div>
  </div>
  {others.map(p=><details className="pickup-rerun" key={p.id}><summary><span>{p.title[locale]}</span><span className="rerun-date">{p.startDate} ~ {p.endDate}</span><span className="disclosure-plus" aria-hidden="true">+</span></summary><div className="rerun-body"><img src={p.image} width={697} height={314} alt={p.title[locale]} loading="lazy"/><ul className="pickup-targets">{p.targets.map(t=><li key={t.id}><Link href={`/${locale}/${t.kind}/${t.id}`}>{t.image&&<img src={t.image} width={36} height={36} alt=""/>}<span>{t.name}</span></Link></li>)}</ul></div></details>)}
 </section>}
 {data.events.length>0&&<section className="current-events" aria-labelledby="events-title"><h2 id="events-title">{ko?'진행 중인 이벤트':'Current events'}</h2><div className="event-board">{data.events.map(e=><article className="event-row" key={e.id}><img src={e.image} width={697} height={314} alt="" loading="lazy"/><div><h3>{e.title[locale]}</h3><Period start={e.startDate} end={e.endDate}/></div></article>)}</div></section>}
 <section className="current-world" aria-label={ko?'현재 시즌과 거울 던전':'Current season and Mirror Dungeon'}>
  <article className="world-season"><header><h2>{ko?'현재 시즌':'Current season'}</h2><p>{ko?'시즌':'Season'} {data.season.number} · {data.season.name}</p></header><img src={data.season.image} width={697} height={314} alt={`${ko?'시즌':'Season'} ${data.season.number} ${data.season.name}`} loading="lazy"/></article>
  <article className="world-mirror"><header><h2>{ko?'거울 던전':'Mirror Dungeon'}</h2><p>{data.mirror[locale]}</p></header></article>
 </section>
 </>;
}
