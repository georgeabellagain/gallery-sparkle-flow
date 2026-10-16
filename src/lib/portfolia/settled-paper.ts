import * as THREE from "three";
/** Preserve a page's actual turn face, including inverted normals and winding.
 * Snapshots are CPU-only and weakly held by the cached PDF canvas. */
export function createSettledPaperCache() {
  const pages=new WeakMap<object,{geometry:THREE.BufferGeometry;side:THREE.Side}>();
  const applied=new WeakMap<THREE.Object3D,object>();
  return {
    invalidate(mesh:THREE.Object3D) { applied.delete(mesh); },
    remember(page:object,face:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>,offset:THREE.Vector3) {
      const geometry=face.geometry.clone();geometry.translate(-offset.x,-offset.y,-offset.z);geometry.computeBoundingSphere();
      pages.set(page,{geometry,side:face.material.side});
    },
    apply(page:object,mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>) {
      const saved=pages.get(page);if(!saved)return false;
      if(applied.get(mesh)===saved)return true;
      for(const name of ['position','normal','uv','tangent']){
        const source=saved.geometry.getAttribute(name);if(!source)continue;
        const target=mesh.geometry.getAttribute(name) as THREE.BufferAttribute|undefined;
        if(target&&target.array.length===source.array.length){target.array.set(source.array);target.needsUpdate=true;}
        else mesh.geometry.setAttribute(name,source.clone());
      }
      mesh.geometry.boundingSphere=saved.geometry.boundingSphere!.clone();
      applied.set(mesh,saved);
      if(mesh.material.side!==saved.side){mesh.material.side=saved.side;mesh.material.needsUpdate=true;}
      return true;
    },
  };
}
