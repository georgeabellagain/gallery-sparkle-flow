import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Search } from "lucide-react";

type Hit = { page: number; before: string; match: string; after: string };
const MAX_HITS = 60;

/** Finds words in the PDF's own text and lists every page they're on, with the words around them. */
export function BookSearch({ doc, onGo }: { doc: PDFDocumentProxy; onGo: (page: number) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Each page's text is read once and kept while the viewer is open.
  const texts = useRef(new Map<number, string>());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { texts.current.clear(); }, [doc]);
  useEffect(() => {
    const words = query.trim();
    if (words.length < 2) { setHits(null); return; }
    let live = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found: Hit[] = [];
      const needle = words.toLocaleLowerCase();
      for (let page = 1; page <= doc.numPages && found.length < MAX_HITS && live; page++) {
        let text = texts.current.get(page);
        if (text === undefined) {
          try {
            const content = await (await doc.getPage(page)).getTextContent();
            text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ");
          } catch { text = ""; }
          texts.current.set(page, text);
        }
        const lower = text.toLocaleLowerCase();
        for (let at = lower.indexOf(needle); at >= 0 && found.length < MAX_HITS; at = lower.indexOf(needle, at + needle.length)) {
          found.push({ page, before: text.slice(Math.max(0, at - 40), at), match: text.slice(at, at + words.length), after: text.slice(at + words.length, at + words.length + 60) });
          // One line per page is enough to choose from.
          break;
        }
      }
      if (live) { setHits(found); setSearching(false); }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [query, doc]);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input ref={input} type="search" aria-label="Search this portfolio" placeholder="Search the pages" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
      {hits && !searching && !hits.length && <p className="text-xs text-muted-foreground">Nothing found for “{query.trim()}”. Pictures of words can't be searched.</p>}
      {hits && hits.length > 0 && (
        <ol className="space-y-1" aria-label="Search results">
          {hits.map((h) => (
            <li key={h.page}>
              <button type="button" onClick={() => onGo(h.page)} className="w-full rounded-xl px-3 py-2 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2">
                <span className="block text-[11px] font-medium text-muted-foreground">Page {h.page}</span>
                <span className="block text-sm leading-snug">…{h.before}<mark className="rounded bg-amber-200 px-0.5 text-inherit">{h.match}</mark>{h.after}…</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
