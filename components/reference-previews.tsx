'use client';
import {useLayoutEffect,useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {previewPosition} from '@/lib/preview-position';
import type {Locale} from '@/lib/locale';
import type {ReferencePreview} from '@/lib/reference-preview';
type OpenPreview={key:string;data:ReferencePreview|null;position:{left:number;top:number;maxHeight?:number};keyword:boolean;trigger:HTMLAnchorElement};
export function ReferencePreviews({children,locale}:{children:ReactNode;locale:Locale}) {
 const [view,setView]=useState<OpenPreview|null>(null),[failed,setFailed]=useState(false);
 const panel=useRef<HTMLElement>(null),origin=useRef<HTMLElement|null>(null),active=useRef<OpenPreview|null>(null),hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const closing=useRef<Animation|null>(null);
 const pathname=usePathname();active.current=view;
 const close=(focus=false)=>{
  const finish=()=>{setView(null);if(focus&&origin.current?.isConnected)origin.current.focus({preventScroll:true})};
  closing.current?.cancel();
  if(!panel.current||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  closing.current=panel.current.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(4px)'}],{duration:120,easing:'ease-out'});
  closing.current.onfinish=finish;
 };
 useEffect(()=>{setView(null)},[pathname,locale]);
 useEffect(()=>{
  const match=(target:EventTarget|null)=>target instanceof Element?target.closest<HTMLAnchorElement>('a[data-preview],a.inline-gift,a.fx-st'):null;
  const open=(link:HTMLAnchorElement,keyword=false)=>{
   closing.current?.cancel();
   const trigger=panel.current?.contains(link)&&origin.current instanceof HTMLAnchorElement?origin.current:link;
   const rect=trigger.getBoundingClientRect();
   let data:ReferencePreview|null=null;
   if(keyword){const id=link.hash.slice(1);const article=document.getElementById(id);if(!article)return;data={title:article.querySelector('strong')?.textContent??link.textContent??'',image:article.querySelector('img')?.src??null,meta:locale==='ko'?'키워드':'Keyword',description:Array.from(article.querySelectorAll('.st-body p'),p=>p.textContent).join('\n')||article.querySelector('.st-body')?.textContent||null,href:null,related:[]};}
   else if(!new RegExp(`^/${locale}/(gifts|packs)/\\d+$`).test(link.pathname))return;
   if(!panel.current?.contains(link))origin.current=link;
   setFailed(false);setView({key:keyword?link.hash:link.pathname,data,keyword,trigger,position:{left:Math.min(Math.max(16,rect.left),Math.max(16,innerWidth-408)),top:rect.bottom+8}});
  };
  const click=(event:MouseEvent)=>{
   const link=match(event.target);if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const keyword=link.classList.contains('fx-st');
   if(!keyword && (!/^\/(ko|en)\/(gifts|packs)\/\d+$/.test(link.pathname)||link.origin!==location.origin))return;
   if(keyword&&matchMedia('(hover: hover) and (pointer: fine)').matches){setView(null);return;}
   event.preventDefault();if(active.current?.trigger===link){close(true);return;}open(link,keyword);requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
  };
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!match(event.target))close()};
  const over=(event:PointerEvent)=>{
   if(event.pointerType!=='mouse'||!matchMedia('(hover: hover)').matches)return;
   if(panel.current?.contains(event.target as Node)){if(hoverTimer.current)clearTimeout(hoverTimer.current);return;}
   const link=match(event.target);if(link?.classList.contains('fx-st')){if(hoverTimer.current)clearTimeout(hoverTimer.current);if(active.current?.trigger!==link)open(link,true);}
  };
  const out=(event:PointerEvent)=>{if(active.current?.keyword){const next=event.relatedTarget as Node|null;if(next&&(panel.current?.contains(next)||active.current.trigger.contains(next)))return;hoverTimer.current=setTimeout(()=>setView(v=>v?.keyword?null:v),180)}};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&active.current){event.preventDefault();close(true)}if(event.key===' '&&match(event.target)){event.preventDefault();match(event.target)?.click()}};
  document.addEventListener('click',click,true);document.addEventListener('pointerdown',outside);document.addEventListener('pointerover',over);document.addEventListener('pointerout',out);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('click',click,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('pointerover',over);document.removeEventListener('pointerout',out);document.removeEventListener('keydown',key);if(hoverTimer.current)clearTimeout(hoverTimer.current)};
 },[locale]);
 useLayoutEffect(()=>{
  if(!view||!panel.current)return;
  const place=()=>{
   if(innerWidth<=700||!panel.current||!view.trigger.isConnected)return;
   const el=panel.current;
   const next=previewPosition(view.trigger.getBoundingClientRect(),{width:el.offsetWidth,height:el.scrollHeight+2},{width:innerWidth,height:innerHeight});
   setView(v=>v&&v.trigger===view.trigger&&(Math.abs(v.position.top-next.top)>1||Math.abs(v.position.left-next.left)>1||v.position.maxHeight!==next.maxHeight)?{...v,position:next}:v);
  };
  place();const observer=new ResizeObserver(place);observer.observe(panel.current);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)};
 },[view?.trigger,view?.data]);
 useEffect(()=>{
  if(!view)return;view.trigger.setAttribute('aria-expanded','true');view.trigger.setAttribute('aria-controls','reference-preview');
  return()=>{view.trigger.removeAttribute('aria-expanded');view.trigger.removeAttribute('aria-controls')};
 },[view?.trigger]);
 useEffect(()=>{
  if(!view||view.keyword)return;
  const abort=new AbortController();const parts=view.key.split('/');
  fetch(`/api/preview/${parts[2]}/${parts[3]}?locale=${locale}`,{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then((data:ReferencePreview)=>setView(v=>v?.key===view.key?{...v,data}:v)).catch(e=>{if(e.name!=='AbortError')setFailed(true)});
  return()=>abort.abort();
 },[view?.key,locale]);
 return <>{children}{view&&createPortal(<aside id="reference-preview" ref={panel} className="reference-preview" role="dialog" aria-modal="false" aria-labelledby="preview-title" style={{left:view.position.left,top:view.position.top,maxHeight:view.position.maxHeight??520}}>
  <div className="preview-heading"><div>{view.data?.image&&<img src={view.data.image} alt="" width={40} height={40}/>}<h2 id="preview-title">{view.data?.title??(locale==='ko'?'정보 미리보기':'Information preview')}</h2></div><button type="button" onClick={()=>close(true)} aria-label={locale==='ko'?'닫기':'Close'}>×</button></div>
  {!view.data&&!failed?<div className="preview-loading" role="status">{locale==='ko'?'불러오는 중':'Loading'}</div>:failed?<><p role="status">{locale==='ko'?'해당 정보를 불러오지 못했습니다.':'This information could not be loaded.'}</p><Link className="preview-detail-link" href={view.key}>{locale==='ko'?'상세 정보 보기':'View full details'}</Link></>:view.data&&<><p className="preview-meta">{view.data.meta}</p><div className="preview-description">{view.data.description??(locale==='ko'?'설명 없음':'No description')}</div>{view.data.related.length>0&&<div className="preview-related"><h3>{locale==='ko'?'관련 정보':'Related information'}</h3>{view.data.related.map(r=><Link key={r.href} href={r.href} data-preview>{r.name}</Link>)}</div>}{view.data.href&&<Link className="preview-detail-link" href={view.data.href}>{locale==='ko'?'상세 정보 보기':'View full details'}</Link>}</>}
 </aside>,document.body)}</>;
}
