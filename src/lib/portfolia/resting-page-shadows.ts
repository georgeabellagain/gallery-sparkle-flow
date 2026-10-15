import * as THREE from "three";

/** Page visibility avoids overlapping paper; its shadow presence follows the physical spread instead. */
export function createRestingPageShadows(book:THREE.Group, pages:readonly THREE.Mesh[]) {
 const material=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false});
 material.shadowSide=THREE.DoubleSide;
 const casters=pages.map(page=>{
  const caster=new THREE.Mesh(page.geometry,material);
  caster.position.copy(page.position);caster.rotation.copy(page.rotation);caster.scale.copy(page.scale);
  caster.castShadow=true;caster.receiveShadow=false;caster.frustumCulled=false;caster.visible=false;
  page.castShadow=false;book.add(caster);return caster;
 });
 return {
  sync(present:readonly boolean[]){casters.forEach((caster,i)=>{caster.visible=Boolean(present[i]);});},
  dispose(){casters.forEach(caster=>book.remove(caster));material.dispose();},
 };
}
