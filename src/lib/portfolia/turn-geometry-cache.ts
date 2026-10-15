import * as THREE from "three";
import {pageRelief} from "./page-relief";
import {turnClearance,turnSheetHeight} from "./turn-motion";

export type TurnPose = {positions: Float32Array; normals: Float32Array};
/** Baked poses retain geometry, never PDF pixels. Exact endpoint poses avoid a handoff jump. */
export function bakeTurnGeometry(template: THREE.BufferGeometry, write: (progress:number, output:THREE.BufferGeometry)=>void, steps=128): TurnPose[] {
  const work=template.clone();
  try {
    return Array.from({length:steps+1},(_,i)=>{
      write(i/steps,work); work.computeVertexNormals();
      return {positions:Float32Array.from(work.getAttribute("position").array),normals:Float32Array.from(work.getAttribute("normal").array)};
    });
  } finally {work.dispose();}
}

/** Linear pose blending follows pointer progress continuously; lighting normals stay unit length. */
export function applyTurnPose(frames: readonly TurnPose[], progress:number, output:THREE.BufferGeometry) {
  const step=Math.min(1,Math.max(0,progress))*(frames.length-1), index=Math.floor(step), blend=step-index;
  const a=frames[index]!,b=frames[Math.min(index+1,frames.length-1)]!;
  const positions=output.getAttribute("position") as THREE.BufferAttribute;
  const normals=output.getAttribute("normal") as THREE.BufferAttribute;
  const p=positions.array as Float32Array,n=normals.array as Float32Array;
  for(let i=0;i<p.length;i++) {p[i]=a.positions[i]!+(b.positions[i]!-a.positions[i]!)*blend;n[i]=a.normals[i]!+(b.normals[i]!-a.normals[i]!)*blend;}
  for(let i=0;i<n.length;i+=3){const length=Math.hypot(n[i]!,n[i+1]!,n[i+2]!);if(length>0){n[i]=n[i]!/length;n[i+1]=n[i+1]!/length;n[i+2]=n[i+2]!/length;}}
  positions.needsUpdate=true;normals.needsUpdate=true;
}

/** Bound retained CPU poses independently of the much larger PDF/GPU texture caches. */
export function createTurnGeometryCache(capacity=8) {
  const cache=new Map<string,TurnPose[]>();
  return {
    get(key:string,bake:()=>TurnPose[]){
      let poses=cache.get(key);
      if(!poses) poses=bake();
      cache.delete(key);cache.set(key,poses);
      while(cache.size>capacity)cache.delete(cache.keys().next().value!);
      return poses;
    },
    clear(){cache.clear();},
  };
}

/** Original turn deformation, evaluated only while baking a new page combination. */
export function turnGeometryWriter(template:THREE.BufferGeometry, ratio:number, dir:1|-1, seeds:readonly number[], restingSeeds:readonly number[], gap:number) {
  const uv=template.getAttribute("uv");
  const from=Float32Array.from({length:uv.count},(_,i)=>pageRelief(uv.getX(i),uv.getY(i),seeds[0]!));
  const to=Float32Array.from({length:uv.count},(_,i)=>pageRelief(uv.getX(i),uv.getY(i),seeds[1]!));
  const curl=Float32Array.from({length:uv.count},(_,i)=>.30*Math.sin(Math.PI*uv.getX(i))*(1+.35*(.5-uv.getY(i))));
  return (progress:number, output:THREE.BufferGeometry)=>{
    const positions=output.getAttribute("position") as THREE.BufferAttribute;
    const t=Math.min(1,Math.max(0,(progress-.3)/.4)),blend=t*t*(3-2*t);
    const sin=Math.sin(Math.PI*progress),cos=Math.cos(Math.PI*progress),clearance=turnClearance(progress,gap);
    for(let i=0;i<uv.count;i++) {
      const u=uv.getX(i),v=uv.getY(i),bow=sin*curl[i]!;
      const x=dir*(u*cos+bow*sin),z=u*sin-bow*cos;
      const relief=from[i]!*(1-blend)+to[i]!*blend;
      const floor=pageRelief(Math.min(1,Math.abs(x)),v,restingSeeds[x<0?0:1]!);
      positions.setXYZ(i,x,(v-.5)*ratio,turnSheetHeight(z+relief+clearance,floor,gap,progress));
    }
  };
}
