import { setNaturalImperfections } from "./natural-imperfections";
import * as THREE from "three";
import type { NoteFont } from "./foldouts";
import { NOTE_FONT_FAMILIES } from "./foldout-paint";
import { noteInk } from "./foldout-paint";
import { pageRelief } from "./page-relief";
import { readableTabStyle, tabOutline, type TabStyle } from "./tab-style";
import { nearPage, TAB_SIZE, tabFrame, tabSlot, type TabEdge, type TabPlan } from "./tab-geometry";

export interface TabSpec {
  id: string;
  /** What the tab says. */
  text: string;
  colour: string;
  font?: NoteFont;
  fontSize?: number;
  position?: number;
  scale?: number;
}
/** The turning sheet's outer edge at height `v`: the point, and the direction pointing outward along the sheet. */
export type SheetEdgeAt = (v: number) => { x: number; y?: number; z: number; tx: number; ty?: number; tz: number };
const COLS = 4;
const LIFT = 0.001;
/** Paper tabs that are part of the book: they sit on the page edge, travel with the sheet they belong to, and are lit like the paper. */
export function createBookTabs(
  book: THREE.Group,
  ratio: number,
  materials: THREE.MeshStandardMaterial[],
  template: () => THREE.MeshStandardMaterial,
  repaint: () => void,
  relief?: (x: number, y: number) => number,
) {
  type Entry = { spec: TabSpec; y: number; height: number; v: number; front: THREE.BufferGeometry; back: THREE.BufferGeometry; group: THREE.Group };
  let entries: Entry[] = [];
  let compact = false;
  let style: TabStyle = "rounded";
  let lastSpecs: TabSpec[] = [];
  let rest: Record<string, TabEdge> = {};
  const resources: Array<{ dispose: () => void }> = [];
  const own: THREE.MeshStandardMaterial[] = [];
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
  /**
   * A slim, modern tab: its colour with a rounded outer end (cut out through the texture's alpha, so it stays crisp
   * in 3D), a faint sheen along one edge and light, spaced lettering. The canvas runs from the end tucked under the
   * page (left) to the outer end (right).
   */
  const artwork = (spec: TabSpec, width: number, height: number, mirrored: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    // The back of the tab is sampled mirrored, so its shape is drawn mirrored too: the shaped end is then the outer
    // end on both faces (and on whichever side of the book the tab lies). The lettering is not mirrored.
    ctx.save();
    if (mirrored) { ctx.translate(width, 0); ctx.scale(-1, 1); }
    tabOutline(ctx, style, width, height);
    ctx.fillStyle = spec.colour;
    // Flat, matte card: no painted sheen. Studio light gives it its shading.
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = noteInk(spec.colour);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const family = spec.font ? NOTE_FONT_FAMILIES[spec.font].css : '"Instrument Sans", Arial, sans-serif';
    const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    let px = Math.min(width * 0.4, 34) * (spec.fontSize ?? 100) / 100;
    const fit = () => { ctx.font = `500 ${px}px ${family}`; if ("letterSpacing" in spaced) spaced.letterSpacing = `${(px * 0.06).toFixed(1)}px`; };
    fit();
    while (px > 8 && ctx.measureText(spec.text).width > height * 0.78) { px *= 0.9; fit(); }
    // Centred on the visible part of the tab (a ribbon's notch leaves less room at the end).
    const centre = style === "ribbon" ? 0.48 : 0.56;
    ctx.translate(width * (mirrored ? 1 - centre : centre), height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(spec.text, 0, 0);
    return canvas;
  };
  const set = (specs: TabSpec[], isCompact: boolean) => {
    clear();
    lastSpecs = specs;
    compact = isCompact;
    const s = size();
    const length = s.out + s.in;
    specs.forEach((spec, i) => {
      const { y, height } = tabSlot(ratio, i, specs.length, spec.position, spec.scale);
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
      const picture = (mirrored: boolean) => {
        const texture = new THREE.CanvasTexture(artwork(spec, px, Math.max(48, Math.round((px * height) / length)), mirrored));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        resources.push(texture);
        return texture;
      };
      const meshFor = (g: THREE.BufferGeometry, side: THREE.Side) => {
        const texture = picture(side === THREE.BackSide);
        const mat = template().clone();
          setNaturalImperfections(mat,template().userData["naturalEnabled"] as number | boolean | undefined);
        mat.map = texture;
        // Matte card like a sticky note (the scene keeps these matte whatever the paper finish).
        mat.userData["stickyMatte"] = true;
        mat.roughness = .97;
        // The rounded end is cut from the texture's alpha.
        mat.alphaTest = 0.5;
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
  const pose = (plans: TabPlan[] | null, progress: number, dir: 1 | -1, edge?: SheetEdgeAt) => {
    const s = size();
    for (const e of entries) {
      const plan = plans?.find((p) => p.id === e.spec.id) ?? {
        from: rest[e.spec.id] ?? "right",
        to: rest[e.spec.id] ?? "right",
        sheet: false,
      };
      // A tab on the turning sheet hangs from that sheet's real edge, whatever shape the turn gives it: each of its
      // two long sides is read where it meets the sheet, so when a fold that follows the pointer swings the corner
      // round, the tab swings with it, locked to the paper.
      const onSheet = plan.sheet && edge;
      const rows = [-1, 1].map((side) => {
        const v = e.v + (side * e.height) / 2 / ratio;
        if (onSheet) { const f = edge(v); return { x: f.x, y: f.y ?? e.y + (side * e.height) / 2, z: f.z, tx: f.tx, ty: f.ty ?? 0, tz: f.tz }; }
        const f = tabFrame(plan, progress, dir, e.v);
        return { x: f.x, y: e.y + (side * e.height) / 2, z: f.z, tx: f.tx, ty: 0, tz: f.tz };
      });
      const geometries = [e.front, e.back];
      for (const g of geometries) {
        const pos = g.getAttribute("position") as THREE.BufferAttribute;
        for (let c = 0; c <= COLS; c++) {
          const dist = -s.in + ((s.out + s.in) * c) / COLS;
          for (let r = 0; r < 2; r++) {
            const frame = rows[r]!;
            const x = frame.x + frame.tx * dist;
            const yy = frame.y + frame.ty * dist;
            const lift = frame.z + frame.tz * dist;
            const z = lift + (relief ? relief(x, yy) : pageRelief(Math.min(1, Math.abs(frame.x)), e.v, 0)) * nearPage(lift) + LIFT;
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
    /** The shape of every tab; redraws them only when it changes. */
    setStyle(next: unknown) {
      const value = readableTabStyle(next);
      if (value === style) return;
      style = value;
      if (lastSpecs.length) { const keep = rest; set(lastSpecs, compact); rest = keep; pose(null, 0, 1); }
    },
    /** Which edge each tab rests on when no page is turning. */
    setRest(edges: Record<string, TabEdge>) {
      rest = edges;
      pose(null, 0, 1);
    },
    /** Moves tabs for a turn in progress. `edge` reads the turning sheet's outer edge from its live geometry. */
    turn(plans: TabPlan[], progress: number, dir: 1 | -1, edge?: SheetEdgeAt) {
      pose(plans, progress, dir, edge);
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
