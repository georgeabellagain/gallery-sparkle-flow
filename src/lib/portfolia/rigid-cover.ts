import * as THREE from "three";
export const COVER_OVERHANG=.014;
export const COVER_HEIGHT=.036;
/** Both printed faces belong to the same rigid front/back board. */
export function coverLeaf(index:number,total:number){return Math.floor(index/2)===0||Math.floor(index/2)===Math.floor((total-1)/2);}
export function rigidCoverWriter(template:THREE.BufferGeometry,ratio:number,dir:1|-1){
  const uv=template.getAttribute("uv");
  return (progress:number,output:THREE.BufferGeometry)=>{
    const p=Math.max(0,Math.min(1,progress)),angle=Math.PI*p,sin=Math.sin(angle),cos=Math.cos(angle);
    const positions=output.getAttribute("position") as THREE.BufferAttribute;
    for(let i=0;i<uv.count;i++){
      const distance=uv.getX(i)*(1+2*COVER_OVERHANG);
      positions.setXYZ(i,dir*distance*cos,(uv.getY(i)-.5)*(ratio+2*COVER_OVERHANG),COVER_HEIGHT+distance*sin);
    }
  };
}
