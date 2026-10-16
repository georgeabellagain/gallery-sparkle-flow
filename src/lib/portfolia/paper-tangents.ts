import * as THREE from "three";
/** A stable paper-local tangent frame shared by resting and deforming sheets.
 * Derivative-derived tangents can change handedness on the mirrored reverse
 * face. Explicit tangents follow the baked normal and the printed UV direction.
 */
export function updatePaperTangents(geometry: THREE.BufferGeometry, mirrored = false) {
  const normals = geometry.getAttribute("normal");
  let tangents = geometry.getAttribute("tangent") as THREE.BufferAttribute | undefined;
  if (!tangents) {
    tangents = new THREE.Float32BufferAttribute(new Float32Array(normals.count * 4), 4);
    geometry.setAttribute("tangent", tangents);
  }
  const sign = mirrored ? -1 : 1;
  for (let i = 0; i < normals.count; i++) {
    const x = normals.getZ(i), z = -normals.getX(i), length = Math.hypot(x,z) || 1;
    tangents.setXYZW(i, sign*x/length, 0, sign*z/length, sign);
  }
  tangents.needsUpdate = true;
}
