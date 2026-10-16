import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { updatePaperTangents } from "../src/lib/portfolia/paper-tangents";
import { applyTurnPose, bakeTurnGeometry, turnGeometryWriter, restingTurnNormals } from "../src/lib/portfolia/turn-geometry-cache";

test("paper normal-map orientation matches resting surfaces at both ends in both directions", () => {
  for (const dir of [1,-1] as const) {
    const sheet = new THREE.PlaneGeometry(1,1.4,32,16);
    const frames = bakeTurnGeometry(sheet,turnGeometryWriter(sheet,1.4,dir,[3,5],[3,5],.001),8,[restingTurnNormals(sheet,1.4,dir,3,dir),restingTurnNormals(sheet,1.4,-dir as 1|-1,5,-dir)]);
    for (const progress of [0,1]) {
      applyTurnPose(frames,progress,sheet);
      // At each endpoint choose the visible face's UV orientation and side.
      const side = progress===0 ? dir : -dir;
      updatePaperTangents(sheet,side===-1);
      const normal=sheet.getAttribute("normal"),tangent=sheet.getAttribute("tangent");
      for(let i=0;i<normal.count;i++){
        const n=new THREE.Vector3().fromBufferAttribute(normal,i).multiplyScalar(side);
        const t=new THREE.Vector3().fromBufferAttribute(tangent,i);
        assert.ok(t.x>0,"paper +U points in the same direction as the resting artwork");
        assert.ok(Math.abs(t.dot(n))<1e-6);
        assert.ok(Math.abs(t.length()-1)<1e-6);
        // Three flips the reverse face's bitangent after applying tangent.w.
        const b=new THREE.Vector3().crossVectors(n,t).multiplyScalar(tangent.getW(i)*side);
        assert.ok(b.y>0,"paper +V remains upwards through the handoff");
      }
    }
    sheet.dispose();
  }
});
