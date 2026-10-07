import * as THREE from "three";
import { foldoutSurfaces, type Foldout } from "./foldouts";
import { loadNoteImages, paintNoteSurface } from "./foldout-paint";

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
    { group: THREE.Group; pivot: THREE.Group; vertical: boolean; sign: number }
  >();
  const resources: Array<{ dispose: () => void }> = [];
  const ownMaterials: THREE.MeshPhysicalMaterial[] = [];
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
        const geometry = new THREE.PlaneGeometry(w, h);
        resources.push(geometry);
        const mesh = (art: HTMLCanvasElement) => {
          const texture = new THREE.CanvasTexture(art);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          resources.push(texture);
          const mat = template().clone();
          mat.map = texture;
          mat.emissiveMap = mat.emissive.getHex() ? texture : null;
          materials.push(mat);
          ownMaterials.push(mat);
          resources.push(mat);
          const m = new THREE.Mesh(geometry, mat);
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        };
        const group = new THREE.Group();
        group.position.set(
          (side === 0 ? -1 : 0) + f.x + w / 2,
          ratio / 2 - f.y * ratio - h / 2,
          0.022,
        );
        const base = mesh(half(negative));
        group.add(base);
        const pivot = new THREE.Group();
        pivot.position.set(
          vertical ? 0 : negative ? -w / 2 : w / 2,
          vertical ? (negative ? h / 2 : -h / 2) : 0,
          0.001,
        );
        const frontMesh = mesh(front),
          back = mesh(half(!negative));
        const cx = vertical ? 0 : negative ? w / 2 : -w / 2,
          cy = vertical ? (negative ? -h / 2 : h / 2) : 0;
        frontMesh.position.set(cx, cy, 0.0005);
        back.position.set(cx, cy, -0.0005);
        if (vertical) back.rotation.x = Math.PI;
        else back.rotation.y = Math.PI;
        pivot.add(frontMesh, back);
        group.add(pivot);
        group.visible = false;
        book.add(group);
        entries.set(f.id, { group, pivot, vertical, sign: negative ? -1 : 1 });
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
      if (e.vertical) e.pivot.rotation.x = p * Math.PI * e.sign;
      else e.pivot.rotation.y = p * Math.PI * e.sign;
      repaint();
    },
  };
}
