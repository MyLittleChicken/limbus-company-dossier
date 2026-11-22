'use client';
import {useState} from 'react';import {usePathname,useSearchParams} from 'next/navigation';import {useListMemory} from './use-list-memory';
export function ListMemory(){const path=usePathname(),query=useSearchParams();const [limit,setLimit]=useState(48);useListMemory(path,query.toString(),limit,setLimit);return null}
