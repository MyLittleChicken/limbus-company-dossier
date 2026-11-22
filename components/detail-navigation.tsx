'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';
import type {Locale} from '@/lib/locale';
export function DetailNavigation({locale,section,label,name}:{locale:Locale;section:string;label:string;name:string}) {
 const fallback=`/${locale}/${section}`;const [origin,setOrigin]=useState(fallback);
 useEffect(()=>{setOrigin(fallback);try{const old=sessionStorage.getItem('dossier:origin:'+section);if(old&&new RegExp(`^/(ko|en)/${section}(\\?|$)`).test(old))setOrigin(old.replace(/^\/(ko|en)/,`/${locale}`))}catch{}},[locale,section,fallback]);
 return <div className="detail-navigation"><nav aria-label={locale==='ko'?'현재 위치':'Breadcrumb'}><ol><li><Link href={`/${locale}`}>{locale==='ko'?'홈':'Home'}</Link></li><li><Link href={fallback}>{label}</Link></li><li aria-current="page"><span>{name}</span></li></ol></nav><Link className="return-list" href={origin} scroll={false}>{locale==='ko'?'목록으로':'Back to list'}</Link></div>;
}
