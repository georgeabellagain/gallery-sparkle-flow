import { readableTurnCurve, deepTurnCurl, turnCurl, turnCornerLead, type TurnCurve } from "./turn-curve";
import * as THREE from "three";
import {pageRelief} from "./page-relief";
import {turnClearance,turnSheetHeight} from "./turn-motion";

export type TurnPose = {positions: Float32Array; normals: Float32Array};
/** Baked poses retain geometry, never PDF pixels. Exact endpoint poses avoid a handoff jump. */
export function bakeTurnGeometry(template: THREE.BufferGeometry, write: (progress:number, output:THREE.BufferGeometry)=>void, steps=128, endpoints?:readonly [Float32Array,Float32Array]): TurnPose[] {
  const work=template.clone();
  try {
    return Array.from({length:steps+1},(_,i)=>{
      const progress=i/steps;
      write(progress,work); work.computeVertexNormals();
      if (endpoints) {
        const edge = progress < .5 ? 0 : 1;
        const distance = edge === 0 ? progress : 1-progress;
        const t = Math.max(0,1-distance/.08), blend=t*t*(3-2*t);
        if (blend > 0) {
          const normals=work.getAttribute("normal").array as Float32Array, target=endpoints[edge]!;
          for(let j=0;j<normals.length;j+=3) {
            const x=normals[j]!+(target[j]!-normals[j]!)*blend;
            const y=normals[j+1]!+(target[j+1]!-normals[j+1]!)*blend;
            const z=normals[j+2]!+(target[j+2]!-normals[j+2]!)*blend;
            const length=Math.hypot(x,y,z)||1;normals[j]=x/length;normals[j+1]=y/length;normals[j+2]=z/length;
          }
        }
      }
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

/** Deformation is baked once per curve/page combination, with shared resting poses. */
export function turnGeometryWriter(template:THREE.BufferGeometry, ratio:number, dir:1|-1, seeds:readonly number[], restingSeeds:readonly number[], gap:number, curve:TurnCurve = "classic") {
  const uv=template.getAttribute("uv");
  const from=Float32Array.from({length:uv.count},(_,i)=>pageRelief(uv.getX(i),uv.getY(i),seeds[0]!));
  const to=Float32Array.from({length:uv.count},(_,i)=>pageRelief(uv.getX(i),uv.getY(i),seeds[1]!));
  const shape = readableTurnCurve(curve);
  const curl=Float32Array.from({length:uv.count},(_,i)=>turnCurl(shape,uv.getX(i),uv.getY(i)));
  const lead=Float32Array.from({length:uv.count},(_,i)=>turnCornerLead(shape,uv.getX(i),uv.getY(i)));
  return (progress:number, output:THREE.BufferGeometry)=>{
    const positions=output.getAttribute("position") as THREE.BufferAttribute;
    const t=Math.min(1,Math.max(0,(progress-.3)/.4)),blend=t*t*(3-2*t);
    const sin=Math.sin(Math.PI*progress),cos=Math.cos(Math.PI*progress),clearance=turnClearance(progress,gap);
    for(let i=0;i<uv.count;i++) {
      const u=uv.getX(i),v=uv.getY(i),bow=sin*(shape === "deep" ? deepTurnCurl(u,v,progress) : curl[i]!);
      const angle = Math.PI*progress + sin*sin*lead[i]!;
      const localSin = shape === "corner" ? Math.sin(angle) : sin;
      const localCos = shape === "corner" ? Math.cos(angle) : cos;
      const x=dir*(u*localCos+bow*localSin),z=u*localSin-bow*localCos;
      const relief=from[i]!*(1-blend)+to[i]!*blend;
      const floor=pageRelief(Math.min(1,Math.abs(x)),v,restingSeeds[x<0?0:1]!);
      positions.setXYZ(i,x,(v-.5)*ratio,turnSheetHeight(z+relief+clearance,floor,gap,progress));
    }
  };
}

/** Match the resting mesh's triangulation and world-space normals on either side of the spine. */
export function restingTurnNormals(template:THREE.BufferGeometry,ratio:number,side:1|-1,seed:number,sign:number) {
 const work=template.clone(),uv=template.getAttribute("uv"),positions=work.getAttribute("position") as THREE.BufferAttribute;
 const columns=new Set(Array.from({length:uv.count},(_,i)=>uv.getX(i))).size;
 try {
  for(let i=0;i<uv.count;i++)positions.setXYZ(i,uv.getX(i)-.5,(uv.getY(i)-.5)*ratio,0);
  for(let i=0;i<uv.count;i++)positions.setZ(i,pageRelief(.5+side*positions.getX(i),positions.getY(i)/ratio+.5,seed));
  work.computeVertexNormals();const normals=work.getAttribute("normal"),result=new Float32Array(uv.count*3);
  for(let i=0;i<uv.count;i++){
   const source=side===1?i:Math.floor(i/columns)*columns+columns-1-i%columns;
   result[i*3]=normals.getX(source)*sign;result[i*3+1]=normals.getY(source)*sign;result[i*3+2]=normals.getZ(source)*sign;
  }
  return result;
 } finally {work.dispose();}
}
