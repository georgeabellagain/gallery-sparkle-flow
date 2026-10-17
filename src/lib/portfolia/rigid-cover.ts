import * as THREE from "three";
export const COVER_OVERHANG=.014;
/** Top of every page block. Resting paper relief never dips more than ~.0025 below zero. */
export const PAGE_TOP=-.005;
/** Printed cover art sits this far above its board, so the board never z-fights the artwork. */
export const COVER_GAP=.0006;
/** An open cover lies below the paper surface, so pages turned onto it always land on top of it. */
export const OPEN_COVER_Z=-.004;
/** Kept for callers that only show open covers (photo-shoot spreads). */
export const COVER_HEIGHT=OPEN_COVER_Z;
export type CoverRest="open"|"closed";
/** A closed cover lies on top of the page block; an open one lies flat beside it. */
export function coverArtZ(rest:CoverRest,board:number){return rest==="closed"?PAGE_TOP+board+COVER_GAP:OPEN_COVER_Z;}
/** Both printed faces belong to the same rigid front/back board. */
export function coverLeaf(index:number,total:number){return Math.floor(index/2)===0||Math.floor(index/2)===Math.floor((total-1)/2);}
const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
/**
 * Hinge pose of a turning board. Its height moves between the two resting heights, and it lifts briefly off
 * the hinge at either end so the board clears the arched paper beside the spine. Lift is zero at rest.
 */
export function coverTurnPose(progress:number,startZ:number,endZ:number){
  const p=Math.max(0,Math.min(1,progress));
  const lift=.035*smooth(p/.07)*smooth((1-p)/.07);
  return {angle:Math.PI*p,z:THREE.MathUtils.lerp(startZ,endZ,smooth(p))+lift};
}
export function rigidCoverWriter(template:THREE.BufferGeometry,ratio:number,dir:1|-1,startZ=OPEN_COVER_Z,endZ=OPEN_COVER_Z){
  const uv=template.getAttribute("uv");
  return (progress:number,output:THREE.BufferGeometry)=>{
    const {angle,z}=coverTurnPose(progress,startZ,endZ),sin=Math.sin(angle),cos=Math.cos(angle);
    const positions=output.getAttribute("position") as THREE.BufferAttribute;
    for(let i=0;i<uv.count;i++){
      const distance=uv.getX(i)*(1+2*COVER_OVERHANG);
      positions.setXYZ(i,dir*distance*cos,(uv.getY(i)-.5)*(ratio+2*COVER_OVERHANG),z+distance*sin);
    }
  };
}
