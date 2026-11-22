'use client';

import {useEffect,useRef} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';

/** Surface transitions only: no remounts, scroll reveals or layout transforms on lists. */
export function SiteMotion() {
 const path=usePathname(),query=useSearchParams().toString();
 const previous=useRef<{path:string;query:string}|null>(null),back=useRef(false);
 useEffect(()=>{
  const pop=()=>{back.current=true};window.addEventListener('popstate',pop);
  return()=>window.removeEventListener('popstate',pop);
 },[]);
 useEffect(()=>{
  const old=previous.current;previous.current={path,query};
  if(back.current){back.current=false;return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const changedPage=!old||old.path!==path;
  const detail=/\/(identities|egos)\/\d+$/.test(path);
  const stageChanged=new URLSearchParams(old?.query).get('uptie')!==new URLSearchParams(query).get('uptie');
  const selector=changedPage?'main':old?.query!==query?(detail?(stageChanged?'.f-stats,.f-skills,.f-passives':null):'.catalogue-grid,.pack-catalogue'):null;
  if(!selector)return;
  const animations=Array.from(document.querySelectorAll(selector),el=>el.animate([{opacity:.65},{opacity:1}],{duration:changedPage?220:180,easing:'cubic-bezier(.2,.8,.2,1)'}));
  return()=>animations.forEach(a=>a.cancel());
 },[path,query]);
 useEffect(()=>{
  const running=new Map<HTMLDetailsElement,{animation:Animation;opening:boolean}>();
  const click=(event:MouseEvent)=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
   const summary=(event.target as Element).closest('summary');
   const details=summary?.parentElement;
   if(!(details instanceof HTMLDetailsElement)||details.classList.contains('nav-more')||!details.closest('main'))return;
   if((event.target as Element).closest('a,button,input,select'))return;
   if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   event.preventDefault();
   const current=running.get(details),opening=current?!current.opening:!details.open;
   const from=details.getBoundingClientRect().height;
   current?.animation.cancel();details.style.height='';details.style.overflow='hidden';details.open=true;
   const to=opening?details.getBoundingClientRect().height:summary!.getBoundingClientRect().height+parseFloat(getComputedStyle(details).borderTopWidth)+parseFloat(getComputedStyle(details).borderBottomWidth);
   const animation=details.animate([{height:`${from}px`},{height:`${to}px`}],{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'});
   running.set(details,{animation,opening});
   animation.onfinish=()=>{details.open=opening;details.style.height='';details.style.overflow='';running.delete(details)};
  };
  document.addEventListener('click',click);
  return()=>{document.removeEventListener('click',click);running.forEach(({animation,opening},el)=>{animation.cancel();el.open=opening;el.style.height='';el.style.overflow=''})};
 },[]);
 return null;
}
