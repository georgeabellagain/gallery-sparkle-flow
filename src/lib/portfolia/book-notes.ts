import * as THREE from "three";
import { foldoutSurfaces, type Foldout } from "./foldouts";
import { flapGeometry, flapGrid, flapShape, NOTE_LIFT, FLAP_LIFT, PAPER_GAP, FLAP_SEGMENTS, FLAP_ACROSS } from "./note-flap";
import { pageRelief } from "./page-relief";
import { loadNoteFonts, loadNoteImages, paintNoteSurface } from "./foldout-paint";

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
    { group: THREE.Group; shapeFlap: (p: number) => void }
  >();
  const resources: Array<{ dispose: () => void }> = [];
  const ownMaterials: THREE.MeshPhysicalMaterial[] = [];
  /** Height of the page at a point of the book (book units): both pages share one arch, measured from the gutter. */
  const reliefAt = (x: number, y: number) => pageRelief(Math.abs(x), y / ratio + 0.5, 0);
  const clear = () => {
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
  const set = async (notes: Array<{ item: Foldout; side: number }>) => {
    clear();
    const ticket = generation;
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
    try {
      for (const { item: f, side } of notes) {
        if (f.hinge === "none") continue;
        const vertical = f.hinge === "top" || f.hinge === "bottom",
          negative = f.hinge === "left" || f.hinge === "top";
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
        paintNoteSurface(front.getContext("2d")!, cw, ch, outside, images);
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
          mat.map = texture;
          mat.side = side;
          mat.emissiveMap = mat.emissive.getHex() ? texture : null;
          materials.push(mat);
          ownMaterials.push(mat);
          resources.push(mat);
          const m = new THREE.Mesh(geometry, mat);
          m.castShadow = true;
          m.receiveShadow = true;
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
        group.add(mesh(half(negative), baseGeometry, THREE.FrontSide));
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
        group.add(frontMesh, back);
        group.visible = false;
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
                q.z + q.nz * sign * PAPER_GAP + NOTE_LIFT + FLAP_LIFT,
              );
            }
            pos.needsUpdate = true;
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
          }
        };
        shapeFlap(0);
        entries.set(f.id, { group, shapeFlap });
      }
    } finally {
      images.forEach((i) => i.close());
    }
    repaint();
  };
  return {
    set,
    clear,
    progress(id: string, p: number) {
      const e = entries.get(id);
      if (!e) return;
      e.group.visible = p > 0.0001;
      if (e.group.visible) e.shapeFlap(p);
      repaint();
    },
  };
}
