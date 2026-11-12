import { NOTO_ANIMATIONS, NOTO_CATEGORIES } from "./noto-animations";

/**
 * The built-in animation library: Google's Noto animated emoji, about 880 looping pictures with see-through
 * backgrounds (artwork CC BY 4.0, credited in public/licenses/noto-animated-emoji.txt). The catalogue ships with the
 * site, so searching sends nothing anywhere. A picture is fetched from Google's font host only when an owner hovers
 * over or picks it; a picked one is saved with their portfolio, so readers load it from Portfolia like any other file.
 */
export type LibraryAnimation = { code: string; name: string; words: string; category: number };
export const LIBRARY_CATEGORIES = NOTO_CATEGORIES;
export const LIBRARY_CREDIT = "Animated emoji by Google (Noto), CC BY 4.0";

const ALL: LibraryAnimation[] = NOTO_ANIMATIONS.map(([code, names, category]) => ({ code, name: names.split("|")[0] ?? code, words: names.replaceAll("|", " ").toLowerCase(), category }));
export const LIBRARY_SIZE = ALL.length;

/** The emoji character for an entry, drawn by the device's own emoji font as a light thumbnail. */
export const libraryEmoji = (code: string) => String.fromCodePoint(...code.split("_").map((hex) => parseInt(hex, 16)));
/** The animated picture (512 px WebP with a see-through background). Only ever built from a catalogue code. */
export function libraryUrl(code: string): string | null {
  return /^[0-9a-f]{2,6}(_[0-9a-f]{2,6}){0,7}$/.test(code) && ALL.some((a) => a.code === code) ? `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/512.webp` : null;
}

/**
 * Animations matching every word typed (each word may be the start of a name word: "bal" finds balloon), within a
 * category when one is chosen. Exact names come first; otherwise the catalogue's own order (most used first).
 */
export function searchLibrary(query: string, category: number | null = null, limit = 48): LibraryAnimation[] {
  const wanted = query.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter(Boolean);
  const pool = category === null ? ALL : ALL.filter((a) => a.category === category);
  if (!wanted.length) return pool.slice(0, limit);
  const scored: Array<[number, LibraryAnimation]> = [];
  for (const a of pool) {
    const words = a.words.split(" ");
    if (!wanted.every((w) => words.some((word) => word.startsWith(w)))) continue;
    scored.push([a.name === wanted.join(" ") ? 0 : wanted.every((w) => words.includes(w)) ? 1 : 2, a]);
  }
  return scored.sort((x, y) => x[0] - y[0]).slice(0, limit).map(([, a]) => a);
}
