'use client';
import {useLayoutEffect,useEffect,useRef} from 'react';
import {listStateKey,readListState,type ListState} from '@/lib/navigation-state';
const RESET_EVENT='dossier:list-reset';
/** Top-level navigation starts a new visit; detail return links do not call this. */
export function resetListNavigation(path:string) {
 const prefix=listStateKey(path,'');
 try {
  for(const key of Object.keys(sessionStorage))if(key.startsWith(prefix))sessionStorage.removeItem(key);
  sessionStorage.removeItem('dossier:origin:'+path.split('/')[2]);
 }catch{}
 window.dispatchEvent(new CustomEvent(RESET_EVENT,{detail:path}));
 window.scrollTo({top:0,behavior:'instant'});
}
export function useListMemory(path:string,query:string,limit:number,setLimit:(n:number)=>void) {
 const key=listStateKey(path,query),pending=useRef<ListState|null>(null),current=useRef({limit}),ready=useRef(false);
 current.current={limit};
 useLayoutEffect(()=>{
  ready.current=false;
  try {pending.current=readListState(sessionStorage.getItem(key));}catch{pending.current=null}
  setLimit(pending.current?.limit??48);
  if(!pending.current)ready.current=true;
 },[key,path,setLimit]);
 useLayoutEffect(()=>{
  const state=pending.current;if(!state||limit<state.limit)return;
  let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   if(pending.current!==state)return;
   const node=state.anchor?document.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(state.anchor)}"]`):null;
   window.scrollTo({top:node?window.scrollY+node.getBoundingClientRect().top-state.offset:state.y,behavior:'instant'});
   pending.current=null;ready.current=true;
  })});return()=>cancelAnimationFrame(frame);
 },[key,path,limit]);
 useEffect(()=>{
  const reset=(event:Event)=>{
   if(listStateKey((event as CustomEvent<string>).detail,'')!==listStateKey(path,''))return;
   pending.current=null;ready.current=true;setLimit(48);
  };
  window.addEventListener(RESET_EVENT,reset);
  const save=()=>{
   if(!ready.current)return;
   const nodes=Array.from(document.querySelectorAll<HTMLElement>('[data-entry-id]'));
   const anchor=nodes.find(n=>n.getBoundingClientRect().bottom>100);
   const value:ListState={limit:current.current.limit,anchor:anchor?.dataset.entryId??null,offset:anchor?.getBoundingClientRect().top??0,y:window.scrollY};
   try {sessionStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('dossier:origin:'+path.split('/')[2],location.pathname+location.search);}catch{}
  };
  let frame=0;const scroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(save)};
  const click=(e:MouseEvent)=>{const link=(e.target as Element).closest('a');if(!link)return;save();if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&link.origin===location.origin&&link.pathname!==location.pathname)ready.current=false;};
  window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('pagehide',save);document.addEventListener('click',click,true);
  return()=>{window.removeEventListener(RESET_EVENT,reset);cancelAnimationFrame(frame);window.removeEventListener('scroll',scroll);window.removeEventListener('pagehide',save);document.removeEventListener('click',click,true)};
 },[key,path,setLimit]);
}
