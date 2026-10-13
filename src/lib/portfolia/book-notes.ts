import * as THREE from "three";
import { foldoutSurfaces, type Foldout } from "./foldouts";
import { flapGeometry, flapGrid, flapShape, NOTE_LIFT, FLAP_LIFT, PAPER_GAP, FLAP_SEGMENTS, FLAP_ACROSS } from "./note-flap";
import { pageRelief } from "./page-relief";
import { loadNoteFonts, loadNoteImages, paintNoteSurface, paintStickySurface } from "./foldout-paint";

/** Compress raised paper where the fold leaves too little clearance above a resting page. */
export function stickyTurnClearance(lift: number, u: number, normal: THREE.Vector3, sheetZ: number, floorZ?: number) {
  let distance = Math.abs(lift);
  if (floorZ !== undefined && normal.z * lift < 0) {
    distance = Math.min(distance, Math.max(.0005, sheetZ - floorZ - .002) / Math.max(.001, Math.abs(normal.z)));
  }
  if (u < .12 && Math.abs(normal.x) > .2) distance = Math.min(distance, Math.max(.001, u * .5) / Math.abs(normal.x));
  return Math.sign(lift) * distance;
}

/** Real paper meshes share the book's scene, materials, environment and shadows. */
export function createBookNotes(
  book: THREE.Group,
  ratio: number,
  materials: THREE.MeshPhysicalMaterial[],
  template: () => THREE.MeshPhysicalMaterial,
  repaint: () => void,
) {
  let generation = 0;
  const entries = new Map<
    string,
    { group: THREE.Group; side: number; exterior: boolean; incoming: boolean; sticky: boolean; shapeFlap: (p: number) => void }
  >();
  const resources: Array<{ dispose: () => void }> = [];
  const ownMaterials: THREE.MeshPhysicalMaterial[] = [];
  /** Height of the page at a point of the book (book units): both pages share one arch, measured from the gutter. */
  const reliefAt = (x: number, y: number) => pageRelief(Math.abs(x), y / ratio + 0.5, 0);
  let currentKey = "", settledKey = "";
  const clear = () => {
    currentKey = ""; settledKey = "";
    generation++;
    entries.forEach((e) => book.remove(e.group));
    entries.clear();
    for (const m of ownMaterials) {
      const i = materials.indexOf(m);
      if (i >= 0) materials.splice(i, 1);
    }
    ownMaterials.length = 0;
    resources.splice(0).forEach((r) => r.dispose());
    repaint();
  };
  const set = async (notes: Array<{ item: Foldout; side: number; exterior?: boolean; incoming?: boolean }>) => {
    const key = JSON.stringify(notes);
    if (key === currentKey) return;
    // Keep the current meshes visible while destination fonts/images prepare.
    const ticket = ++generation;
    await loadNoteFonts(notes.flatMap(({ item }) => Object.values(foldoutSurfaces(item))));
    if (ticket !== generation) return;
    const images = await loadNoteImages(
      notes.flatMap(({ item }) =>
        Object.values(foldoutSurfaces(item)).flatMap((s) =>
          s.imageKey ? [s.imageKey] : [],
        ),
      ),
    );
    if (ticket !== generation) {
      images.forEach((i) => i.close());
      return;
    }
    clear();
    currentKey = key;
    try {
      for (const { item: f, side, exterior = false, incoming = false } of notes) {
        if (f.hinge === "none") continue;
        const vertical = f.hinge === "top" || f.hinge === "bottom",
          negative = f.hinge === "left" || f.hinge === "top";
        const spineDistance = side === 0 ? 1 - f.x - f.width : f.x;
        const spineBlend = exterior ? 1 : Math.min(1, Math.max(0, (spineDistance - .12) / .08));
        const curlAmount = spineBlend * spineBlend * (3 - 2 * spineBlend);
        const stickyLift = THREE.MathUtils.lerp(.003, NOTE_LIFT + FLAP_LIFT, curlAmount);
        const w = f.width,
          h = f.height * ratio;
        const density = Math.min(
          1400,
          1536 / Math.max(w, h),
          Math.sqrt(1_500_000 / Math.max(1, notes.length) / (w * h)),
        );
        const cw = Math.max(32, Math.round(density * w)),
          ch = Math.max(32, Math.round(density * h));
        const surface = (width: number, height: number) => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          return c;
        };
        const { outside, inside } = foldoutSurfaces(f);
        const front = surface(cw, ch);
        (f.style === "sticky" ? paintStickySurface : paintNoteSurface)(front.getContext("2d")!, cw, ch, outside, images);
        const panorama = surface(
          cw * (vertical ? 1 : 2),
          ch * (vertical ? 2 : 1),
        );
        paintNoteSurface(
          panorama.getContext("2d")!,
          panorama.width,
          panorama.height,
          inside,
          images,
        );
        const half = (second: boolean) => {
          const c = surface(cw, ch);
          c.getContext("2d")!.drawImage(
            panorama,
            vertical ? 0 : second ? cw : 0,
            vertical ? (second ? ch : 0) : 0,
            cw,
            ch,
            0,
            0,
            cw,
            ch,
          );
          return c;
        };
        const mesh = (art: HTMLCanvasElement, geometry: THREE.BufferGeometry, side: THREE.Side) => {
          const texture = new THREE.CanvasTexture(art);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          resources.push(texture);
          const mat = template().clone();
          if (f.style === "sticky") {
            const grain = new Uint8Array(64 * 64 * 4);
            for (let i = 0; i < 64 * 64; i++) {
              const value = 110 + ((i * 73 + (i >> 6) * 37) % 36);
              grain.set([value, value, value, 255], i * 4);
            }
            const texture = new THREE.DataTexture(grain, 64, 64);
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4); texture.needsUpdate = true;
            resources.push(texture);
            mat.userData["stickyMatte"] = true;
            mat.bumpMap = texture; mat.bumpScale = .0015;
            mat.roughness = .97; mat.clearcoat = 0; mat.specularIntensity = .1;
          }
          mat.map = texture;
          mat.side = side;
          mat.shadowSide = THREE.DoubleSide;
          mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
          mat.emissiveMap = mat.emissive.getHex() ? texture : null;
          materials.push(mat);
          ownMaterials.push(mat);
          resources.push(mat);
          const m = new THREE.Mesh(geometry, mat);
          m.castShadow = true;
          m.receiveShadow = f.style !== "sticky";
          m.frustumCulled = false;
          return m;
        };
        const group = new THREE.Group();
        const centre = {
          x: (side === 0 ? -1 : 0) + f.x + w / 2,
          y: ratio / 2 - f.y * ratio - h / 2,
        };
        group.position.set(centre.x, centre.y, 0);
        // The paper under the flap follows the page's own curve, so a note never floats or sinks into it.
        const baseGeometry = new THREE.PlaneGeometry(w, h, 8, 8);
        resources.push(baseGeometry);
        const basePos = baseGeometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < basePos.count; i++)
          basePos.setZ(
            i,
            NOTE_LIFT + reliefAt(centre.x + basePos.getX(i), centre.y + basePos.getY(i)),
          );
        baseGeometry.computeVertexNormals();
        const baseMesh = mesh(half(negative), baseGeometry, THREE.FrontSide);
        baseMesh.castShadow = false;
        baseMesh.visible = f.style !== "sticky";
        group.add(baseMesh);
        // The flap is a gridded sheet shaped every frame: it rotates about its hinge, trails like paper in the
        // hand, and settles onto the page's curve wherever it lands.
        const along = vertical ? h : w,
          across = vertical ? w : h;
        const e = negative ? (vertical ? -1 : 1) : vertical ? 1 : -1;
        const hinge = (vertical ? h : w) / 2 * (e === 1 ? -1 : 1);
        const grid = flapGrid(FLAP_SEGMENTS, FLAP_ACROSS);
        const frontGeometry = flapGeometry(grid, vertical, e, false);
        const backGeometry = flapGeometry(grid, vertical, e, true);
        resources.push(frontGeometry, backGeometry);
        const frontMesh = mesh(front, frontGeometry, THREE.FrontSide),
          back = mesh(half(!negative), backGeometry, THREE.BackSide);
        back.castShadow = false;
        group.add(frontMesh, back);
        if (f.style === "sticky") {
          const adhesiveArt = surface(cw, Math.max(1, Math.round(ch * .08)));
          adhesiveArt.getContext("2d")!.drawImage(front, 0, 0, cw, ch * .08, 0, 0, cw, adhesiveArt.height);
          const adhesiveGeometry = new THREE.PlaneGeometry(w, h * .08, 8, 1);
          resources.push(adhesiveGeometry);
          const positions = adhesiveGeometry.getAttribute("position") as THREE.BufferAttribute;
          for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i) + h * .46;
            positions.setY(i, y);
            positions.setZ(i, stickyLift + .002 + reliefAt(centre.x + positions.getX(i), centre.y + y));
          }
          adhesiveGeometry.computeVertexNormals();
          const adhesive = mesh(adhesiveArt, adhesiveGeometry, THREE.FrontSide);
          adhesive.castShadow = false;
          group.add(adhesive);
        }
        group.visible = f.style === "sticky" && !incoming;
        book.add(group);
        const shapeFlap = (p: number) => {
          const points = flapShape(
            { along, across, e, hinge, vertical, centre },
            grid,
            p,
            reliefAt,
          );
          for (const [geometry, sign] of [[frontGeometry, 1], [backGeometry, -1]] as const) {
            const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
            for (let i = 0; i < points.length; i++) {
              const q = points[i]!;
              pos.setXYZ(
                i,
                q.x + q.nx * sign * PAPER_GAP,
                q.y + q.ny * sign * PAPER_GAP,
                q.z + q.nz * sign * PAPER_GAP + (f.style === "sticky" ? stickyLift : NOTE_LIFT + FLAP_LIFT)
                  + (f.style === "sticky" ? curlAmount * .035 * grid.a[i]! ** 2 * (1 - Math.sin(Math.PI * p)) : 0),
              );
            }
            pos.needsUpdate = true;
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
            geometry.computeBoundingBox();
          }
        };
        shapeFlap(0);
        entries.set(f.id, { group, side, exterior, incoming, sticky: f.style === "sticky", shapeFlap });
      }
    } finally {
      images.forEach((i) => i.close());
    }
    settledKey = key;
    repaint();
  };
  let moving: Array<{ mesh: THREE.Mesh; rest: Float32Array; centre: THREE.Vector3; incoming: boolean; exterior: boolean }> = [];
  let covered: Array<{ mesh: THREE.Mesh; rest: Float32Array; centre: THREE.Vector3; revealing: boolean }> = [];
  const beginTurn = (side: number) => {
    moving = []; covered = [];
    for (const [id, entry] of entries) {
      if (sourceIds && destinationIds && !sourceIds.has(id) && !destinationIds.has(id)) { entry.group.visible = false; continue; }
      if (!entry.sticky) { entry.group.visible = false; continue; }
      entry.group.visible = true;
      entry.shapeFlap(0);
      if (entry.side !== (entry.incoming ? 1 - side : side)) {
        if ((entry.incoming && sourceIds && !sourceIds.has(id)) || (!entry.incoming && destinationIds && !destinationIds.has(id))) {
          for (const child of entry.group.children) {
            const mesh = child as THREE.Mesh;
            const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
            covered.push({ mesh, rest: Float32Array.from(positions.array), centre: entry.group.position.clone(), revealing: entry.incoming });
            if (entry.incoming) {
              const gap = (mesh.material as THREE.MeshPhysicalMaterial).side === THREE.BackSide ? -.0002 : .0002;
              for (let i = 0; i < positions.count; i++) positions.setZ(i, reliefAt(positions.getX(i) + entry.group.position.x, positions.getY(i) + entry.group.position.y) + .002 + gap);
              positions.needsUpdate = true;
              mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
            }
          }
        }
        continue;
      }
      for (const child of entry.group.children) {
        const mesh = child as THREE.Mesh;
        const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        moving.push({ mesh, rest: Float32Array.from(positions.array), centre: entry.group.position.clone(), incoming: entry.incoming, exterior: entry.exterior });
      }
    }
  };
  let destinationKey = "";
  let sourceIds: Set<string> | undefined, destinationIds: Set<string> | undefined;
  return {
    set,
    has(notes: Array<{ item: Foldout; side: number; exterior?: boolean }>) { return settledKey === JSON.stringify(notes); },
    async prepare(from: Array<{ item: Foldout; side: number; exterior?: boolean }>, to: Array<{ item: Foldout; side: number; exterior?: boolean }>) {
      destinationKey = JSON.stringify(to);
      const ids = new Set(from.map(n => n.item.id));
      sourceIds = ids; destinationIds = new Set(to.map(n => n.item.id));
      await set([...from, ...to.filter(n => !ids.has(n.item.id)).map(n => ({ ...n, incoming: true }))]);
    },
    beginTurn,
    turn(progress: number, dir: 1 | -1, sheetPoint?: (u: number, v: number) => { position: THREE.Vector3; normal: THREE.Vector3; floorZ?: number }) {
      // Compress the note under the approaching sheet, fully flat at 75%.
      const t = Math.min(1, Math.max(0, (progress - .6) / .15));
      const flatten = t * t * (3 - 2 * t);
      const reveal = Math.min(1, Math.max(0, (progress - .25) / .15));
      const revealFlatten = 1 - reveal * reveal * (3 - 2 * reveal);
      for (const { mesh, rest, centre, revealing } of covered) {
        const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const faceGap = (mesh.material as THREE.MeshPhysicalMaterial).side === THREE.BackSide ? -.0002 : .0002;
        for (let i = 0; i < positions.count; i++) {
          const originalZ = rest[i * 3 + 2]!;
          const flatZ = reliefAt(rest[i * 3]! + centre.x, rest[i * 3 + 1]! + centre.y) + .002 + faceGap;
          positions.setZ(i, THREE.MathUtils.lerp(originalZ, flatZ, revealing ? revealFlatten : flatten));
        }
        positions.needsUpdate = true;
        mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
      }
      const angle = Math.PI * progress, sin = Math.sin(angle), cos = Math.cos(angle);
      for (const { mesh, rest, centre, incoming, exterior } of moving) {
        const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < positions.count; i++) {
          const x = rest[i * 3]! + centre.x, y = rest[i * 3 + 1]! + centre.y;
          const u = Math.max(0, Math.min(1, Math.abs(x))), v = y / ratio + .5;
          const curl = sin * .22 * Math.sin(Math.PI * u) * (1 + .35 * (.5 - v));
          const lift = (rest[i * 3 + 2]! - reliefAt(x, y)) * (incoming ? -1 : 1);
          if (sheetPoint) {
            const surface = sheetPoint(u, v);
            const clearance = stickyTurnClearance(lift, exterior ? 1 : u, surface.normal, surface.position.z, surface.floorZ);
            // Offset along the real curved sheet normal, not a flat rotation.
            // The destination note belongs to its opposite face.
            positions.setXYZ(i,
              surface.position.x + surface.normal.x * clearance - centre.x,
              surface.position.y + surface.normal.y * clearance - centre.y,
              surface.position.z + surface.normal.z * clearance);
          } else {
            positions.setXYZ(i,
              dir * (u * cos + curl * sin - lift * sin) - centre.x,
              rest[i * 3 + 1]!,
              u * sin - curl * cos + reliefAt(x, y) + .01 + lift * cos);
          }
        }
        positions.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
      }
    },
    endTurn(complete = false) {
      for (const { mesh, rest } of covered) {
        const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        positions.array.set(rest); positions.needsUpdate = true;
        mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
      }
      covered = [];
      for (const { mesh, rest, incoming } of moving) {
        if (complete && mesh.parent) mesh.parent.visible = incoming;
        const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        positions.array.set(rest); positions.needsUpdate = true;
        mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
      }
      moving = [];
      const visibleIds = complete ? destinationIds : sourceIds;
      if (visibleIds) for (const [id, entry] of entries) {
        if (!visibleIds.has(id)) { book.remove(entry.group); entries.delete(id); }
        else { entry.group.visible = entry.sticky; entry.incoming = false; }
      }
      if (complete && destinationKey) currentKey = settledKey = destinationKey;
    },
    clear,
    bounds() {
      const bounds = new THREE.Box3();
      book.updateWorldMatrix(true, true);
      for (const entry of entries.values()) {
        if (!entry.group.visible) continue;
        for (const child of entry.group.children) if (child.visible) bounds.union(new THREE.Box3().setFromObject(child));
      }
      return bounds.isEmpty() ? null : bounds;
    },
    progress(id: string, p: number) {
      const e = entries.get(id);
      if (!e) return;
      e.group.visible = e.sticky || p > 0.0001;
      if (e.group.visible) e.shapeFlap(p);
      repaint();
    },
  };
}
