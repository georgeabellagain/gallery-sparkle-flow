import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { readableHiddenPages } from "@/lib/portfolia/hidden-pages";
import { cn } from "@/lib/utils";

/** "2, 5-7" as page numbers, ignoring anything that isn't a page of this PDF. */
export function parsePageList(text: string, pages: number): number[] {
  const out = new Set<number>();
  for (const part of text.replace(/\s*([-–])\s*/g, "$1").split(/[,\s]+/).filter(Boolean)) {
    const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part);
    const [from, to] = range ? [Number(range[1]), Number(range[2])] : [Number(part), Number(part)];
    if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
    for (let n = Math.max(1, Math.min(from, to)); n <= Math.min(pages, Math.max(from, to)); n++) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** The same pages written short: 2, 5–7. */
export function formatPageList(list: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j]! + 1) j++;
    parts.push(j > i ? `${list[i]}–${list[j]}` : String(list[i]));
    i = j;
  }
  return parts.join(", ");
}

/**
 * Hide pages of choice: press a page to hide or show it, or type them ("2, 5-7"). Readers skip hidden pages in every
 * reading style; they stay in the PDF and come back when shown again.
 */
export function HiddenPagesSettings({ pages, hidden, onChange }: { pages: number; hidden?: number[]; onChange: (next: number[] | undefined) => void }) {
  const current = readableHiddenPages(hidden, pages);
  const [batch, setBatch] = useState(0);
  const lastBatch = Math.max(0, Math.ceil(pages / 64) - 1);
  const shownBatch = Math.min(batch, lastBatch);
  const first = shownBatch * 64 + 1;
  const lastPage = Math.min(pages, first + 63);
  const [text, setText] = useState(formatPageList(current));
  useEffect(() => setText(formatPageList(current)), [current.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (list: number[]) => { const next = readableHiddenPages(list, pages); onChange(next.length ? next : undefined); };
  const toggle = (n: number) => save(current.includes(n) ? current.filter((p) => p !== n) : [...current, n]);
  if (pages < 2) return <p className="text-xs text-muted-foreground">A one-page PDF has nothing to hide.</p>;
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-8 gap-1" role="group" aria-label="Pages">
        {Array.from({ length: lastPage - first + 1 }, (_, i) => i + first).map((n) => {
          const off = current.includes(n);
          const last = !off && current.length >= pages - 1;
          return (
            <button key={n} type="button" aria-pressed={off} disabled={last} title={last ? "At least one page stays visible" : off ? `Show page ${n}` : `Hide page ${n}`}
              onClick={() => toggle(n)}
              className={cn("relative flex aspect-[3/4] items-center justify-center rounded-md border text-[11px] tabular-nums transition-colors disabled:opacity-40",
                off ? "border-dashed border-border bg-muted text-muted-foreground line-through" : "border-border bg-background hover:border-foreground/40")}>
              {n}
              {off && <EyeOff className="absolute right-0.5 top-0.5 size-2.5" aria-hidden />}
            </button>
          );
        })}
      </div>
      {pages > 64 && <nav className="flex items-center justify-between gap-2" aria-label="Page choices">
        <button type="button" disabled={shownBatch === 0} className="disabled:opacity-40" onClick={() => setBatch(shownBatch - 1)}>Previous</button>
        <span className="text-muted-foreground" aria-live="polite">{first}–{lastPage} of {pages}</span>
        <button type="button" disabled={shownBatch === lastBatch} className="disabled:opacity-40" onClick={() => setBatch(shownBatch + 1)}>Next</button>
      </nav>}
      <label className="block">Or type them
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => save(parsePageList(text, pages))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(parsePageList(text, pages)); } }}
          placeholder="e.g. 2, 5-7" className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm" />
      </label>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>{current.length ? `${current.length} hidden · readers see ${pages - current.length} of ${pages}` : "Every page is shown."}</span>
        {current.length > 0 && <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" onClick={() => onChange(undefined)}>Show all</button>}
      </div>
    </div>
  );
}
