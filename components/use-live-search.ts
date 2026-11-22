'use client';
import {useEffect,useRef,useState} from 'react';
import {canSearch} from '@/lib/korean-search';

export function useLiveSearch(value:string,commit:(query:string)=>void,delay=300){
 const [composing,setComposing]=useState(false);
 const callback=useRef(commit);callback.current=commit;
 useEffect(()=>{
  if(composing)return;
  const timer=setTimeout(()=>callback.current(canSearch(value)?value.trim():''),delay);
  return()=>clearTimeout(timer);
 },[value,composing,delay]);
 return {onCompositionStart:()=>setComposing(true),onCompositionEnd:()=>setComposing(false)};
}
