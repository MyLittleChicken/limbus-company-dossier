'use client';
import {useEffect,useState} from 'react';

/** Keep the existing illustration in place until its replacement is decoded. */
export function DetailArt({src,width,height}:{src:string;width:number;height:number}) {
 const [shown,setShown]=useState(src);
 useEffect(()=>{
  if(src===shown)return;
  let active=true;const image=new Image();image.src=src;
  image.decode().then(()=>{if(active)setShown(src)}).catch(()=>{if(active)setShown(src)});
  return()=>{active=false};
 },[src,shown]);
 return <img key={shown} src={shown} width={width} height={height} style={{aspectRatio:`${width}/${height}`}} alt="" aria-busy={shown!==src}/>;
}
