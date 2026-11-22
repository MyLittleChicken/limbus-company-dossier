'use client';
import {usePathname} from 'next/navigation';
import {CatalogueToolbar} from './catalogue-toolbar';
import {UI} from '@/lib/ui-text';

export function CatalogueLoading(){
 const path=usePathname().split('/'),locale=path[1]==='en'?'en':'ko',section=path[2];
 if(path[3]){
  const unit=section==='identities'||section==='egos';
  return <div className="route-loading" role="status" aria-label={locale==='ko'?'불러오는 중':'Loading'} aria-busy="true">
   <div className="detail-navigation"><span className="skeleton-placeholder loading-count"/></div>
   {unit?<section className={`f-card f-card--${section==='identities'?'identity':'ego'}`}>
    <div className="f-art-stage"><div className={`f-art loading-art-${section}`}><span className="f-art-none skeleton-placeholder" style={{aspectRatio:section==='identities'?'16/9':'1'}}/></div></div>
    <div className="f-head loading-unit-heading"><span className="skeleton-placeholder loading-name"/><span className="skeleton-placeholder loading-count"/></div><div className="f-body loading-unit-body"><div className="skeleton-placeholder loading-controls"/><div className="skeleton-placeholder loading-unit-facts"/><span className="skeleton-placeholder loading-count"/></div>
   </section>:<>
    <div className="seclabel"><h1 className="skeleton-placeholder loading-reference-title"/></div>
    <div className="reference-summary"><section className="panel"><div className="panel-h"><h3>{locale==='ko'?'속성':'Attributes'}</h3></div><div className="panel-b">
     <div className={`hero-icon ${section==='packs'?'pack-arts':''}`}><span className={`skeleton-placeholder ${section==='packs'?'loading-pack-art':'loading-gift-art'}`}/></div>
     <div className="facts">{Array.from({length:6},(_,i)=><div key={i}><span className="skeleton-placeholder loading-count"/><span className="skeleton-placeholder loading-count"/></div>)}</div>
    </div></section></div>
   </>}
   <section className="panel loading-detail-section"><div className="panel-h"><span className="skeleton-placeholder loading-count"/></div><div className="panel-b"><div className="skeleton-placeholder loading-detail-body"/></div></section>
  </div>;
 }
 const title=UI[locale].nav[section as keyof typeof UI.ko.nav]??'';
 return <div className="route-loading" role="status" aria-label={locale==='ko'?'불러오는 중':'Loading'} aria-busy="true">
  <CatalogueToolbar title={title} query="" onQuery={()=>{}} onApply={()=>{}} onReset={()=>{}} placeholder="" ko={locale==='ko'} pending hasFilters/>
  <div className="catalogue-results"><span className="skeleton-placeholder loading-count"/></div>
  {section==='packs'?<ul className="cardgrid cardgrid-wide pack-catalogue" aria-hidden="true">{Array.from({length:12},(_,i)=><li key={i}><div className="card unit"><strong className="unit-name"><span className="skeleton-placeholder loading-name"/></strong><span className="packart skeleton-placeholder loading-pack-card"/><span className="card-meta"><span className="skeleton-placeholder loading-count"/></span></div></li>)}</ul>:<section className="catalogue-group">
   {<div className="catalogue-group-heading"><span className="skeleton-placeholder loading-group"/></div>}
   <ul className="catalogue-grid" aria-hidden="true">
    {Array.from({length:12},(_,i)=><li key={i}><div className="catalogue-card loading-catalogue-card"><h3><span className="skeleton-placeholder loading-name"/></h3><span className="catalogue-art skeleton-placeholder"/><span className="catalogue-meta"><span className="skeleton-placeholder loading-count"/></span></div></li>)}
   </ul>
  </section>}
 </div>;
}
