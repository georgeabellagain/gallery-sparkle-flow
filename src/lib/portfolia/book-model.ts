import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** Unit-sized board with a bevel measured in book units, not stretched with thickness. */
export function coverBoardGeometry(width:number,height:number,depth:number){
  const geometry=new RoundedBoxGeometry(width,height,depth,3,Math.min(.003,depth*.2));
  geometry.scale(1/width,1/height,1/depth);
  return geometry;
}
/** Half-elliptical binding: smooth outer case, no exposed cylindrical pipe. */
export function caseSpineGeometry(){
  const geometry=new THREE.CylinderGeometry(1,1,1,48,1,false,Math.PI/2,Math.PI);
  // Cylinder arc faces the back (-Z); ends are capped at the head and tail.
  return geometry;
}
/** Bounds of the displayed model only; hidden spread/cover meshes must not affect framing. */
export function visibleBookBounds(object:THREE.Object3D){
  object.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3();
  const visit=(node:THREE.Object3D)=>{
    if(!node.visible)return;
    if(node instanceof THREE.Mesh){
      node.geometry.computeBoundingBox();
      bounds.union(node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld));
    }
    node.children.forEach(visit);
  };
  visit(object);return bounds;
}

/** The leaf lines run through depth on every exposed edge, including the head and tail. */
export function pageBlockGeometry(){
  const geometry=new THREE.BoxGeometry(1,1,1),p=geometry.getAttribute("position"),uv=geometry.getAttribute("uv");
  for(let i=0;i<p.count;i++)uv.setY(i,p.getZ(i)+.5);
  uv.needsUpdate=true;return geometry;
}
