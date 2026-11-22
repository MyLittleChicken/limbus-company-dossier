'use client';
import {useSearchParams} from 'next/navigation';
import {validStage} from '@/lib/navigation-state';
export function useDetailQuery() {
 const params=useSearchParams();
 const set=(key:string,value:string)=>{const url=new URL(location.href);url.searchParams.set(key,value);history.replaceState(null,'',url.pathname+url.search+url.hash)};
 return {params,set,stage:(values:number[])=>validStage(params.get('uptie'),values)};
}
