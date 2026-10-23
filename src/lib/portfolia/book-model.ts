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
/**
 * A closed book's spine: a rounded but nearly square "D" (a superellipse), so it meets both covers at full depth
 * instead of pinching to nothing at its top and bottom edges. Unit size: bulges from x 0 to -1, runs z -1..1
 * (the book's thickness) and y -0.5..0.5 (head to tail), capped at both ends.
 */
export function closedSpineGeometry(){
  const points:THREE.Vector2[]=[];
  for(let i=0;i<=40;i++){
    const t=-Math.PI/2+Math.PI*i/40,c=Math.cos(t),s=Math.sin(t);
    points.push(new THREE.Vector2(-Math.pow(Math.abs(c),.35),Math.sign(s)*Math.pow(Math.abs(s),.35)));
  }
  const geometry=new THREE.ExtrudeGeometry(new THREE.Shape(points),{depth:1,bevelEnabled:false,curveSegments:1});
  geometry.translate(0,0,-.5);geometry.rotateX(Math.PI/2);geometry.computeVertexNormals();
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
