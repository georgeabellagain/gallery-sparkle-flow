import * as THREE from "three";
import { noteInk } from "./foldout-paint";
import { pageRelief } from "./page-relief";
import { nearPage, TAB_SIZE, tabFrame, tabSlot, type TabEdge, type TabPlan } from "./tab-geometry";

export interface TabSpec {
  id: string;
  /** What the tab says. */
  text: string;
  colour: string;
  position?: number;
}
const COLS = 4;
const LIFT = 0.012;
/** Paper tabs that are part of the book: they sit on the page edge, travel with the sheet they belong to, and are lit like the paper. */
export function createBookTabs(
  book: THREE.Group,
  ratio: number,
  materials: THREE.MeshPhysicalMaterial[],
  template: () => THREE.MeshPhysicalMaterial,
  repaint: () => void,
) {
  type Entry = { spec: TabSpec; y: number; height: number; v: number; front: THREE.BufferGeometry; back: THREE.BufferGeometry; group: THREE.Group };
  let entries: Entry[] = [];
  let compact = false;
  let rest: Record<string, TabEdge> = {};
  const resources: Array<{ dispose: () => void }> = [];
  const own: THREE.MeshPhysicalMaterial[] = [];
  const size = () => (compact ? TAB_SIZE.compact : TAB_SIZE.full);
  const clear = () => {
    entries.forEach((e) => book.remove(e.group));
    entries = [];
    for (const m of own) {
      const i = materials.indexOf(m);
      if (i >= 0) materials.splice(i, 1);
    }
    own.length = 0;
    resources.splice(0).forEach((r) => r.dispose());
  };
  const artwork = (spec: TabSpec, width: number, height: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = spec.colour;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = noteInk(spec.colour);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let px = Math.min(width * 0.52, 44);
    ctx.font = `600 ${px}px "Instrument Sans", Arial, sans-serif`;
    while (px > 8 && ctx.measureText(spec.text).width > height * 0.84) {
      px *= 0.9;
      ctx.font = `600 ${px}px "Instrument Sans", Arial, sans-serif`;
    }
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(spec.text, 0, 0);
    return canvas;
  };
  const set = (specs: TabSpec[], isCompact: boolean) => {
    clear();
    compact = isCompact;
    const s = size();
    const length = s.out + s.in;
    specs.forEach((spec, i) => {
      const { y, height } = tabSlot(ratio, i, specs.length, spec.position);
      const geometry = new THREE.BufferGeometry();
      const back = new THREE.BufferGeometry();
      const uv: number[] = [],
        uvBack: number[] = [],
        index: number[] = [];
      for (let c = 0; c <= COLS; c++) {
        const u = c / COLS;
        uv.push(u, 0, u, 1);
        uvBack.push(1 - u, 0, 1 - u, 1);
        if (c < COLS) {
          const b = c * 2;
          index.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      const positions = new THREE.Float32BufferAttribute(new Float32Array((COLS + 1) * 2 * 3), 3);
      geometry.setAttribute("position", positions);
      back.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((COLS + 1) * 2 * 3), 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      back.setAttribute("uv", new THREE.Float32BufferAttribute(uvBack, 2));
      geometry.setIndex(index);
      back.setIndex(index);
      resources.push(geometry, back);
      const px = 96;
      const texture = new THREE.CanvasTexture(artwork(spec, px, Math.max(48, Math.round((px * height) / length))));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      resources.push(texture);
      const meshFor = (g: THREE.BufferGeometry, side: THREE.Side) => {
        const mat = template().clone();
        mat.map = texture;
        mat.side = side;
        mat.emissiveMap = mat.emissive.getHex() ? texture : null;
        materials.push(mat);
        own.push(mat);
        resources.push(mat);
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        return mesh;
      };
      const group = new THREE.Group();
      group.add(meshFor(geometry, THREE.FrontSide), meshFor(back, THREE.BackSide));
      book.add(group);
      entries.push({ spec, y, height, v: y / ratio + 0.5, front: geometry, back, group });
    });
    pose(null, 0, 1);
  };
  const pose = (plans: TabPlan[] | null, progress: number, dir: 1 | -1) => {
    const s = size();
    for (const e of entries) {
      const plan = plans?.find((p) => p.id === e.spec.id) ?? {
        from: rest[e.spec.id] ?? "right",
        to: rest[e.spec.id] ?? "right",
        sheet: false,
      };
      const frame = tabFrame(plan, progress, dir, e.v);
      const geometries = [e.front, e.back];
      for (const g of geometries) {
        const pos = g.getAttribute("position") as THREE.BufferAttribute;
        for (let c = 0; c <= COLS; c++) {
          const dist = -s.in + ((s.out + s.in) * c) / COLS;
          for (let r = 0; r < 2; r++) {
            const x = frame.x + frame.tx * dist;
            const lift = frame.z + frame.tz * dist;
            const yy = e.y + (r === 0 ? -1 : 1) * (e.height / 2);
            const z = lift + pageRelief(Math.min(1, Math.abs(frame.x)), e.v, 0) * nearPage(lift) + LIFT;
            pos.setXYZ(c * 2 + r, x, yy, z);
          }
        }
        pos.needsUpdate = true;
        g.computeVertexNormals();
        g.computeBoundingSphere();
      }
    }
    repaint();
  };
  return {
    set,
    clear,
    /** Which edge each tab rests on when no page is turning. */
    setRest(edges: Record<string, TabEdge>) {
      rest = edges;
      pose(null, 0, 1);
    },
    /** Moves tabs for a turn in progress. */
    turn(plans: TabPlan[], progress: number, dir: 1 | -1) {
      pose(plans, progress, dir);
    },
    /** Where each tab lies when at rest, in book units: used to place the invisible buttons over them. */
    rects() {
      const s = size();
      return entries.map((e) => {
        const edge = rest[e.spec.id] ?? "right";
        return {
          id: e.spec.id,
          x0: edge === "right" ? 1 - s.in : -1 - s.out,
          x1: edge === "right" ? 1 + s.out : -1 + s.in,
          y0: e.y - e.height / 2,
          y1: e.y + e.height / 2,
        };
      });
    },
  };
}
