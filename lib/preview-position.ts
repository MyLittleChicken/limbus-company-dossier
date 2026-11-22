export function previewPosition(anchor:{left:number;top:number;bottom:number},panel:{width:number;height:number},viewport:{width:number;height:number}) {
 const gap=8,edge=16;
 const below=viewport.height-anchor.bottom-gap-edge,above=anchor.top-gap-edge;
 const useBelow=panel.height<=below||below>=above;
 const maxHeight=Math.max(80,Math.min(520,useBelow?below:above));
 const height=Math.min(panel.height,maxHeight);
 return {left:Math.max(edge,Math.min(anchor.left,viewport.width-panel.width-edge)),top:Math.max(edge,useBelow?anchor.bottom+gap:anchor.top-gap-height),maxHeight};
}
