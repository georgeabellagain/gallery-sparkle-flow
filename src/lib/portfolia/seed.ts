/**
 * Demonstration portfolios. These are bundled with the prototype, marked as
 * examples, and rebuilt from the build on every load (they are never persisted).
 */

import arch from "@/assets/demo-arch-1.jpg";
import photo from "@/assets/demo-photo-1.jpg";
import graphic from "@/assets/demo-graphic-1.jpg";
import art from "@/assets/demo-art-1.jpg";
import {
  defaultAbout,
  defaultLayoutSettings,
  defaultTheme,
  type AssetMeta,
  type Doc,
  type Item,
  type Portfolio,
} from "./types";

const A = {
  arch: {
    id: "demo-arch",
    name: "north-stair.jpg",
    mime: "image/jpeg",
    bytes: 0,
    width: 1408,
    height: 1760,
    url: arch,
    createdAt: 0,
  },
  photo: {
    id: "demo-photo",
    name: "coast-road.jpg",
    mime: "image/jpeg",
    bytes: 0,
    width: 1808,
    height: 1200,
    url: photo,
    createdAt: 0,
  },
  graphic: {
    id: "demo-graphic",
    name: "grid-study.jpg",
    mime: "image/jpeg",
    bytes: 0,
    width: 1248,
    height: 1600,
    url: graphic,
    createdAt: 0,
  },
  art: {
    id: "demo-art",
    name: "ochre-slate.jpg",
    mime: "image/jpeg",
    bytes: 0,
    width: 1504,
    height: 1504,
    url: art,
    createdAt: 0,
  },
} satisfies Record<string, AssetMeta>;

let n = 0;
const sid = (p: string) => `${p}_seed${++n}`;

function image(assetId: string, details?: Item extends never ? never : Record<string, unknown>): Item {
  return {
    id: sid("it"),
    kind: "image",
    assetId,
    alt: "Example artwork from a demonstration portfolio.",
    details: details as never,
  };
}

function text(content: string, size = 15): Item {
  return {
    id: sid("it"),
    kind: "text",
    text: content,
    style: { size, lineHeight: 1.6, align: "left" },
  };
}

const base = (p: Partial<Portfolio> & Pick<Portfolio, "id" | "slug" | "title" | "owner" | "discipline">): Portfolio => ({
  visibility: "discoverable",
  searchEngineIndexing: false,
  isExample: true,
  defaultLayout: "scroll",
  layoutSettings: defaultLayoutSettings(),
  theme: defaultTheme(),
  about: defaultAbout(),
  singleProjectDirect: false,
  projects: [],
  versions: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...p,
});

export function buildSeedDoc(): Doc {
  const portfolios: Portfolio[] = [
    base({
      id: "demo-marta",
      slug: "marta-oyelaran",
      title: "Marta Oyelaran",
      tagline: "Architecture and adaptive reuse, Lisbon",
      owner: "Marta Oyelaran",
      discipline: "Architecture",
      defaultLayout: "paged",
      theme: {
        ...defaultTheme(),
        headingFont: '"Archivo", sans-serif',
        bodyFont: '"Archivo", sans-serif',
        text: "#171717",
      },
      about: {
        ...defaultAbout(),
        enabled: true,
        name: "Marta Oyelaran",
        discipline: "Architect",
        bio: "I work on quiet interventions in existing buildings — stairs, thresholds, light. Studio practice since 2016, mostly in Portugal and Spain.",
        portraitId: A.arch.id,
        email: "studio@example.com",
        location: "Lisbon, PT",
        links: [{ id: "l1", label: "Studio journal", url: "https://example.com" }],
        show: { bio: true, portrait: false, contact: true, links: true, cv: false },
      },
      projects: [
        {
          id: "demo-marta-p1",
          title: "North Stair",
          description: "Concrete insertion in a 1930s warehouse, 2023",
          coverAssetId: A.arch.id,
          layout: "paged",
          items: [
            text("North Stair\nWarehouse conversion, Lisbon, 2023", 22),
            image(A.arch.id, {
              title: "North Stair, upper flight",
              medium: "Board-marked concrete",
              date: "2023",
              dimensions: "Rise 4.2 m",
              credits: "Photograph: A. Reis",
            }),
            text(
              "The stair is the only new structure in the building. Everything else was cleaned and left alone.",
            ),
            image(A.photo.id, { title: "Approach road", date: "2023" }),
          ],
        },
        {
          id: "demo-marta-p2",
          title: "Survey drawings",
          description: "Working documents, shown as a grid",
          coverAssetId: A.graphic.id,
          layout: "grid",
          items: [
            image(A.graphic.id, { title: "Plate 01" }),
            image(A.arch.id, { title: "Plate 02" }),
            image(A.art.id, { title: "Plate 03" }),
            image(A.photo.id, { title: "Plate 04" }),
            image(A.graphic.id, { title: "Plate 05" }),
            image(A.arch.id, { title: "Plate 06" }),
          ],
        },
      ],
    }),
    base({
      id: "demo-rune",
      slug: "rune-kjeldsen",
      title: "Rune Kjeldsen",
      tagline: "Coastal road, 2021–2024",
      owner: "Rune Kjeldsen",
      discipline: "Photography",
      defaultLayout: "scroll",
      singleProjectDirect: true,
      theme: { ...defaultTheme(), bodyFont: '"DM Sans", sans-serif' },
      projects: [
        {
          id: "demo-rune-p1",
          title: "Coastal Road",
          description: "Four years of driving the same fifty kilometres",
          coverAssetId: A.photo.id,
          items: [
            text("Coastal Road", 30),
            text("Four years of driving the same fifty kilometres at dusk."),
            image(A.photo.id, {
              title: "Dusk, kilometre 12",
              medium: "Archival pigment print",
              dimensions: "60 × 90 cm",
              links: [{ id: "b1", label: "Buy this print", url: "https://example.com/print" }],
            }),
            image(A.arch.id, { title: "Service stair, kilometre 31" }),
            image(A.art.id, { title: "Untitled (wall)" }),
            image(A.photo.id, { title: "Dusk, kilometre 48" }),
          ],
        },
      ],
    }),
    base({
      id: "demo-atelier",
      slug: "atelier-vide",
      title: "Atelier Vide",
      tagline: "Graphic design, printed matter",
      owner: "Atelier Vide",
      discipline: "Graphic design",
      defaultLayout: "book",
      theme: {
        ...defaultTheme(),
        headingFont: '"Space Grotesk", sans-serif',
        bodyFont: '"Space Grotesk", sans-serif',
      },
      projects: [
        {
          id: "demo-atelier-p1",
          title: "Grid Studies",
          description: "A bound sequence of spreads, read as a book",
          coverAssetId: A.graphic.id,
          layout: "book",
          items: [
            {
              id: sid("it"),
              kind: "composition",
              aspect: 1248 / 1600,
              background: "#ffffff",
              label: "Cover",
              elements: [
                {
                  id: sid("el"),
                  kind: "text",
                  x: 10,
                  y: 12,
                  w: 80,
                  h: 20,
                  rotation: 0,
                  z: 2,
                  opacity: 1,
                  text: "Grid Studies",
                  style: { size: 34, align: "left", font: '"Space Grotesk", sans-serif' },
                },
                {
                  id: sid("el"),
                  kind: "image",
                  x: 10,
                  y: 34,
                  w: 80,
                  h: 54,
                  rotation: 0,
                  z: 1,
                  opacity: 1,
                  assetId: A.graphic.id,
                  alt: "Black and white geometric grid study.",
                  details: { title: "Grid study, plate I", medium: "Screenprint" },
                },
              ],
            },
            image(A.graphic.id, { title: "Plate II", medium: "Screenprint" }),
            image(A.art.id, { title: "Plate III" }),
            image(A.arch.id, { title: "Plate IV" }),
          ],
        },
      ],
    }),
    base({
      id: "demo-ines",
      slug: "ines-vollmer",
      title: "Ines Vollmer",
      tagline: "Painting and works on paper",
      owner: "Ines Vollmer",
      discipline: "Fine art",
      defaultLayout: "masonry",
      theme: {
        ...defaultTheme(),
        headingFont: '"Libre Baskerville", serif',
        bodyFont: '"Libre Baskerville", serif',
      },
      about: {
        ...defaultAbout(),
        enabled: true,
        name: "Ines Vollmer",
        discipline: "Painter",
        bio: "Oil on linen, mostly large. Interested in the edge where one colour gives up.",
        email: "ines@example.com",
        location: "Leipzig, DE",
        show: { bio: true, portrait: false, contact: true, links: false, cv: false },
      },
      projects: [
        {
          id: "demo-ines-p1",
          title: "Ochre / Slate",
          description: "2024–2025",
          coverAssetId: A.art.id,
          layout: "masonry",
          items: [
            image(A.art.id, {
              title: "Ochre / Slate no. 4",
              medium: "Oil on linen",
              dimensions: "140 × 140 cm",
              date: "2024",
              links: [{ id: "b2", label: "Enquire", url: "https://example.com/enquire" }],
            }),
            image(A.graphic.id, { title: "Study, no. 11" }),
            image(A.photo.id, { title: "Studio, winter" }),
            image(A.arch.id, { title: "Wall, unfinished" }),
            image(A.art.id, { title: "Ochre / Slate no. 7", dimensions: "90 × 90 cm" }),
          ],
        },
      ],
    }),
  ];

  for (const p of portfolios) {
    p.published = { at: Date.now(), snapshot: JSON.parse(JSON.stringify(snapshot(p))) };
  }

  return {
    version: 3,
    portfolios,
    assets: Object.fromEntries(Object.values(A).map((a) => [a.id, a])),
    trash: [],
    plan: "free",
    storageAllowanceMb: 500,
  };
}

function snapshot(p: Portfolio) {
  return {
    title: p.title,
    tagline: p.tagline,
    projects: p.projects,
    about: p.about,
    theme: p.theme,
    defaultLayout: p.defaultLayout,
    layoutSettings: p.layoutSettings,
    singleProjectDirect: p.singleProjectDirect,
  };
}
