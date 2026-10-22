import { useContext, useEffect, useRef, useState, type PointerEvent } from "react";
import { LiveScrapbookContext } from "./live-scrapbook-context";
import { NoteSurface } from "./FoldoutCard";
import { LinkLogo } from "./PageLinks";
import {
  foldoutsForLeaf,
  foldoutSurfaces,
  noteRotation,
  rotateFoldout,
  type Foldout,
  type ResizeCorner,
} from "@/lib/portfolia/foldouts";
import { jumpsForLeaf, linksForLeaf, placeVideo, readablePageJumps, readablePageSpotlights, readablePageVideos, spotlightsForLeaf, tabSlots, videoHeight, videosForLeaf, type PageLink, type PageTag, type PageVideo } from "@/lib/portfolia/page-extras";
import { CornerDownRight, Search } from "lucide-react";
import { useBlob } from "./Chrome";

/** The video's still in the editor; the moving picture plays in the reader. */
function VideoPoster({ video }: { video: PageVideo }) {
  const blob = useBlob(video.posterKey);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} /> : <span className="absolute inset-0 bg-black/70" />;
}
import { tabSlot } from "@/lib/portfolia/tab-geometry";
import type { Leaf } from "@/lib/portfolia/book-layout";
import { patchPortfolioExtra, removePortfolioExtra } from "@/lib/portfolia/store";
import { transformExtra, type Extra, type ExtraKind } from "@/lib/portfolia/scrapbook-transform";
export function LiveScrapbookPage({
  leaf,
  side,
  ratio,
}: {
  leaf: Leaf;
  side: "left" | "right";
  ratio: number;
}) {
  const context = useContext(LiveScrapbookContext)!;
  const pdf = context.portfolio.pdf!;
  const root = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ kind: ExtraKind; item: Extra } | null>(null),
    [ownSelection, setOwnSelection] = useState<string | null>(null);
  // The editor's side panel shares the selection when it can, so the picked item can be edited there.
  const selected = context.onSelect ? context.selected?.id ?? null : ownSelection;
  const setSelected = (kind: ExtraKind, id: string) => (context.onSelect ? context.onSelect({ kind, id }) : setOwnSelection(id));
  const drag = useRef<{
    kind: ExtraKind;
    item: Extra;
    x: number;
    y: number;
    width: number;
    height: number;
    handle: "move" | ResizeCorner | "rotate";
    next: Extra;
    centre?: { x: number; y: number };
  } | null>(null);
  useEffect(() => setDraft(null), [pdf.foldouts, pdf.links, pdf.tags, pdf.videos, pdf.spotlights, pdf.jumps]);
  const leafVideos = videosForLeaf(readablePageVideos(pdf.videos, pdf.pages), leaf);
  // A new video is placed at a typical page shape; fit its height to this page's real shape once it is seen.
  useEffect(() => {
    for (const v of leafVideos) {
      if (Math.abs(v.height - videoHeight(v, ratio)) > 0.002) commit("videos", placeVideo(v, v.x, v.y, v.width, ratio));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(leafVideos), ratio]);
  const commit = (kind: ExtraKind, item: Extra) =>
    context.onError(
      patchPortfolioExtra(context.portfolio.code, pdf.blobKey, kind, item.id, item)
        ? null
        : "The item could not be saved. Please try again.",
    );
  const begin = (
    e: PointerEvent<HTMLButtonElement>,
    kind: ExtraKind,
    item: Extra,
    handle: "move" | ResizeCorner | "rotate",
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(kind, item.id);
    const bounds = root.current!.getBoundingClientRect();
    const note = item as Foldout;
    drag.current = {
      kind,
      item,
      x: e.clientX,
      y: e.clientY,
      width: bounds.width,
      height: bounds.height,
      handle,
      next: item,
      ...(handle === "rotate" ? { centre: { x: bounds.left + (note.x + note.width / 2) * bounds.width, y: bounds.top + (note.y + note.height / 2) * bounds.height } } : {}),
    };
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    if (d.handle === "rotate") {
      if (!d.centre) return;
      // The handle sits above the note, so straight up is no turn.
      const angle = (Math.atan2(e.clientY - d.centre.y, e.clientX - d.centre.x) * 180) / Math.PI + 90;
      d.next = rotateFoldout(d.item as Foldout, ((angle + 540) % 360) - 180);
      setDraft({ kind: d.kind, item: d.next });
      return;
    }
    d.next = transformExtra(
      d.kind,
      d.item,
      (e.clientX - d.x) / d.width,
      (e.clientY - d.y) / d.height,
      d.handle,
      ratio,
    );
    setDraft({ kind: d.kind, item: d.next });
  };
  const end = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const d = drag.current;
    drag.current = null;
    if (d) commit(d.kind, d.next);
  };
  const cancel = () => {
    drag.current = null;
    setDraft(null);
  };
  const live = <T extends Extra>(item: T) =>
    draft?.item.id === item.id ? (draft.item as T) : item;
  const controls = (kind: ExtraKind, item: Extra, handle: "move" | ResizeCorner | "rotate") => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => begin(e, kind, item, handle),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        context.onSelect?.(null);
        context.onError(removePortfolioExtra(context.portfolio.code, pdf.blobKey, kind, item.id) ? null : "The item could not be removed. Please try again.");
        return;
      }
      if (handle === "rotate" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        e.stopPropagation();
        commit(kind, rotateFoldout(item as Foldout, noteRotation(item as Foldout) + (e.key === "ArrowRight" ? 3 : -3)));
        return;
      }
      const dx = e.key === "ArrowRight" ? 0.005 : e.key === "ArrowLeft" ? -0.005 : 0,
        dy = e.key === "ArrowDown" ? 0.005 : e.key === "ArrowUp" ? -0.005 : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      e.stopPropagation();
      if (handle !== "rotate") commit(kind, transformExtra(kind, item, dx, dy, handle, ratio));
    },
  });
  const resize = (kind: ExtraKind, item: Extra, all = false) =>
    (all ? ["nw", "ne", "sw", "se"] : ["se"]).map((corner) => (
      <button
        key={corner}
        type="button"
        aria-label={`Resize ${kind === "foldouts" ? "note" : kind === "tags" ? "tab" : kind === "videos" ? "video" : kind === "spotlights" ? "spotlight" : kind === "jumps" ? "page link" : "link"} ${corner}`}
        {...controls(kind, item, corner as ResizeCorner)}
        className={`pointer-events-auto absolute z-20 size-3 touch-none border border-white bg-blue-600 ${corner.includes("n") ? "-top-1.5" : "-bottom-1.5"} ${corner.includes("w") ? "-left-1.5" : "-right-1.5"}`}
        style={{ cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize" }}
      />
    ));
  return (
    <div ref={root} className="pointer-events-none absolute inset-0" data-live-scrapbook>
      {foldoutsForLeaf(pdf.foldouts ?? [], leaf).map((original) => {
        const f = live(original);
        return (
          <div
            key={f.id}
            data-selected={selected === f.id || undefined}
            className="absolute pointer-events-auto shadow-[0_2px_6px_rgba(0,0,0,.25)] ring-1 ring-blue-500/60 data-[selected]:ring-2 data-[selected]:ring-blue-600"
            style={{
              left: `${f.x * 100}%`,
              top: `${f.y * 100}%`,
              width: `${f.width * 100}%`,
              height: `${f.height * 100}%`,
              transform: noteRotation(f) ? `rotate(${noteRotation(f)}deg)` : undefined,
            }}
          >
            <NoteSurface side={foldoutSurfaces(f).outside} sticky={f.style === "sticky"} />
            <button
              type="button"
              aria-label={`Move ${f.style === "sticky" ? "sticky note" : "fold-out"} ${f.title || ""}`}
              {...controls("foldouts", f, "move")}
              className="absolute inset-0 touch-none cursor-move bg-transparent"
            />
            {resize("foldouts", f, true)}
            <button
              type="button"
              aria-label={`Rotate ${f.style === "sticky" ? "sticky note" : "fold-out"} ${f.title || ""}. Left and right arrows turn it.`}
              title="Drag to rotate"
              {...controls("foldouts", f, "rotate")}
              className="pointer-events-auto absolute -top-7 left-1/2 z-20 size-4 -translate-x-1/2 touch-none cursor-grab rounded-full border-2 border-white bg-blue-600 shadow"
            />
            <span aria-hidden className="pointer-events-none absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-blue-600" />
          </div>
        );
      })}
      {leafVideos.map((original) => {
        const v = live(original);
        return (
          <div
            key={v.id}
            data-selected={selected === v.id || undefined}
            className="absolute pointer-events-auto overflow-visible ring-1 ring-blue-500/60 data-[selected]:ring-2 data-[selected]:ring-blue-600"
            style={{ left: `${v.x * 100}%`, top: `${v.y * 100}%`, width: `${v.width * 100}%`, height: `${v.height * 100}%` }}
          >
            <VideoPoster video={v} />
            <span aria-hidden className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Video</span>
            <button
              type="button"
              aria-label={`Move video ${v.name ?? ""}`}
              {...controls("videos", v, "move")}
              className="absolute inset-0 touch-none cursor-move bg-transparent"
            />
            {resize("videos", v)}
          </div>
        );
      })}
      {jumpsForLeaf(readablePageJumps(pdf.jumps, pdf.pages), leaf).map((original) => {
        const j = live(original);
        return (
          <div
            key={j.id}
            data-selected={selected === j.id || undefined}
            className="absolute pointer-events-auto border-2 border-dashed border-emerald-600/80 bg-emerald-500/10 data-[selected]:border-solid data-[selected]:bg-emerald-500/15"
            style={{ left: `${j.x * 100}%`, top: `${j.y * 100}%`, width: `${j.width * 100}%`, height: `${j.height * 100}%` }}
          >
            <span aria-hidden className="pointer-events-none absolute right-0.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded bg-emerald-600 px-1 py-px text-[9px] leading-tight text-white">
              <CornerDownRight className="size-2.5" />p. {j.target}
            </span>
            <button
              type="button"
              aria-label={`Move page link to page ${j.target}`}
              {...controls("jumps", j, "move")}
              className="absolute inset-0 touch-none cursor-move bg-transparent"
            />
            {resize("jumps", j)}
          </div>
        );
      })}
      {spotlightsForLeaf(readablePageSpotlights(pdf.spotlights, pdf.pages), leaf).map((original) => {
        const s = live(original);
        return (
          <div
            key={s.id}
            data-selected={selected === s.id || undefined}
            className="absolute pointer-events-auto border-2 border-dashed border-blue-600/80 bg-blue-500/10 data-[selected]:border-solid data-[selected]:bg-blue-500/15"
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.width * 100}%`, height: `${s.height * 100}%` }}
          >
            <span aria-hidden className="pointer-events-none absolute right-1 top-1 inline-flex items-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
              <Search className="size-3" />Spotlight
            </span>
            <button
              type="button"
              aria-label={`Move spotlight ${s.caption ?? ""}`}
              {...controls("spotlights", s, "move")}
              className="absolute inset-0 touch-none cursor-move bg-transparent"
            />
            {resize("spotlights", s)}
          </div>
        );
      })}
      {linksForLeaf(pdf.links ?? [], leaf).map((original) => {
        const l = live(original);
        return (
          <div
            key={l.id}
            className="absolute pointer-events-auto ring-2 ring-blue-500"
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              width: `${l.size * 100}%`,
              aspectRatio: "1",
            }}
          >
            <LinkLogo link={l} />
            <button
              type="button"
              aria-label={`Move website link ${l.label || l.url}`}
              {...controls("links", l, "move")}
              className="absolute inset-0 touch-none cursor-move bg-transparent"
            />
            {resize("links", l)}
          </div>
        );
      })}
      {tabSlots(pdf.tags ?? [])
        .filter((t) => t.page === leaf.page && (!leaf.half || leaf.half === side))
        .map((original) => {
          const t = live(original);
          const slot = tabSlot(ratio, original.slot, original.of, t.position, t.scale);
          const positioned = { ...t, position: 0.5 - slot.y / ratio };
          return (
            <div
              key={t.id}
              className="absolute pointer-events-auto ring-2 ring-blue-500"
              style={{
                left: side === "left" ? "-7.5%" : "100%",
                top: `${(0.5 - slot.y / ratio - slot.height / ratio / 2) * 100}%`,
                width: "7.5%",
                height: `${(slot.height / ratio) * 100}%`,
                background: t.colour,
              }}
            >
              <button
                type="button"
                aria-label={`Move page tab ${t.label}`}
                {...controls("tags", positioned, "move")}
                className="absolute inset-0 touch-none cursor-move overflow-hidden text-[10px] text-black"
                style={{ writingMode: "vertical-rl" }}
              >
                {t.label}
              </button>
              {resize("tags", positioned)}
            </div>
          );
        })}
      {selected && (
        <span className="sr-only" aria-live="polite">
          Selected item. Drag to move or use arrow keys. Delete removes it.
        </span>
      )}
    </div>
  );
}
