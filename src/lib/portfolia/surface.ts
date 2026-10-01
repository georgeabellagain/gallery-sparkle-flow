/**
 * Procedural surface materials for the Studio flipbook. Each material is a
 * height map lit through its normals (a baked bump/normal + roughness pass),
 * returned as a neutral-grey tile that is soft-light blended over pages, so
 * artwork colour is preserved and only the surface relief shows.
 * Wood tabletops are generated the same way — no external image assets.
 */
export type SurfaceKind = "matte" | "satin" | "textured" | "natural";
export type Light = "soft" | "bright";

const cache = new Map<string, HTMLCanvasElement>();

function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Tileable value noise with period p. */
function noise(x: number, y: number, p: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (n: number) => ((n % p) + p) % p;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s);
  const c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

type Spec = { octaves: [scale: number, amp: number][]; stretch: number; bump: number; shine: number; spec: number };
const SPECS: Record<SurfaceKind, Spec> = {
  // Fine, dense tooth; no specular response.
  matte: { octaves: [[64, 0.6], [128, 0.4]], stretch: 1, bump: 2.2, shine: 0, spec: 0 },
  // Nearly flat with a smooth, tight sheen.
  satin: { octaves: [[16, 0.7], [64, 0.3]], stretch: 1, bump: 0.6, shine: 36, spec: 0.22 },
  // Pronounced pebbled grain for covers.
  textured: { octaves: [[24, 0.55], [48, 0.3], [128, 0.15]], stretch: 1, bump: 5.5, shine: 8, spec: 0.05 },
  // Uncoated stock: soft, slightly fibrous.
  natural: { octaves: [[32, 0.5], [96, 0.5]], stretch: 2.4, bump: 3.2, shine: 0, spec: 0 },
};

export function surfaceCanvas(kind: SurfaceKind, light: Light): HTMLCanvasElement {
  const key = `${kind}-${light}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const N = 256;
  const spec = SPECS[kind];
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0;
      spec.octaves.forEach(([sc, amp], i) => {
        const px = Math.round(sc / spec.stretch) || 1;
        v += amp * noise((x / N) * px, (y / N) * sc, sc, i + 7);
      });
      h[y * N + x] = v;
    }
  const L = light === "bright" ? [-0.45, -0.55, 0.7] : [-0.35, -0.45, 0.82];
  const ll = Math.hypot(L[0]!, L[1]!, L[2]!);
  const [lx, ly, lz] = [L[0]! / ll, L[1]! / ll, L[2]! / ll];
  // Half vector for a viewer straight above.
  const hl = Math.hypot(lx, ly, lz + 1);
  const [hx, hy, hz] = [lx / hl, ly / hl, (lz + 1) / hl];
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  const at = (x: number, y: number) => h[((y + N) % N) * N + ((x + N) % N)]!;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * spec.bump;
      const dy = (at(x, y + 1) - at(x, y - 1)) * spec.bump;
      const nl = Math.hypot(dx, dy, 1);
      const nx = -dx / nl, ny = -dy / nl, nz = 1 / nl;
      const diffuse = (nx * lx + ny * ly + nz * lz) / lz; // 1 on flat areas
      const s = spec.spec ? spec.spec * Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), spec.shine) : 0;
      const g = Math.max(0, Math.min(255, 128 * diffuse + 255 * s * 0.5));
      const o = (y * N + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

const urls = new Map<string, string>();
export function surfaceUrl(kind: SurfaceKind, light: Light) {
  const key = `${kind}-${light}`;
  if (!urls.has(key)) urls.set(key, surfaceCanvas(kind, light).toDataURL("image/png"));
  return urls.get(key)!;
}

/** Procedural tabletop: tileable-enough grain lit softly from the top left. */
export function woodUrl(kind: "oak" | "walnut") {
  const key = `wood-${kind}`;
  if (urls.has(key)) return urls.get(key)!;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const [lo, hi] = kind === "oak"
    ? [[176, 136, 94], [214, 182, 140]]
    : [[52, 33, 22], [96, 64, 44]];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const warp = noise(x / 160, y / 40, 1 << 20, 3) * 9 + noise(x / 40, y / 12, 1 << 20, 4) * 1.5;
      const ring = 0.5 + 0.5 * Math.sin((y / 7 + warp) * 1.3);
      const fibre = noise(x / 3, y / 0.9, 1 << 20, 5);
      const pores = noise(x / 1.5, y / 1.5, 1 << 20, 6) > 0.9 ? -0.08 : 0;
      let t = 0.35 + 0.4 * Math.pow(ring, 2.2) + 0.2 * fibre + pores;
      // Soft directional light falloff across the table.
      t *= 0.92 + 0.12 * (1 - (x / W) * 0.6 - (y / H) * 0.4);
      t = Math.max(0, Math.min(1, t));
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) img.data[o + k] = lo[k]! + (hi[k]! - lo[k]!) * t;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL("image/jpeg", 0.86);
  urls.set(key, url);
  return url;
}
