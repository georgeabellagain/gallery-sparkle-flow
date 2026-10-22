import { useEffect, useState } from "react";
import { CornerDownRight, ExternalLink } from "lucide-react";
import { hostOf, linkName, siteIconUrl, type PageJump, type PageLink } from "@/lib/portfolia/page-extras";
import { useBlob, useObjectUrl } from "./Chrome";

/** A website's logo on a tile: the creator's own picture if they chose one, otherwise the site's own icon. */
export function LinkLogo({ link, className = "" }: { link: Pick<PageLink, "url" | "iconKey" | "label">; className?: string }) {
  const custom = useObjectUrl(useBlob(link.iconKey));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [link.url, link.iconKey]);
  const src = link.iconKey ? custom : hostOf(link.url) ? siteIconUrl(link.url) : undefined;
  const letter = (linkName(link as PageLink) || "?").charAt(0).toUpperCase();
  return (
    <span
      className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[22%] bg-background ring-1 ring-border ${className}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className={link.iconKey ? "h-full w-full object-cover" : "h-[62%] w-[62%] object-contain"}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-semibold text-foreground" style={{ fontSize: "1.4em" }}>
          {letter}
        </span>
      )}
    </span>
  );
}

/**
 * A contents line that takes the reader to another page. It is invisible over the printed line until pointed at,
 * when the line is softly highlighted with a "go to page" hint; touches and clicks never turn the page underneath.
 */
export function PageJumpLink({ jump, onGo }: { jump: PageJump; onGo: (page: number) => void }) {
  const label = `Go to page ${jump.target}`;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-page-jump
      className="group pointer-events-auto absolute cursor-pointer touch-manipulation rounded-[3px] outline-none transition-colors hover:bg-amber-300/20 hover:ring-1 hover:ring-amber-500/40 focus-visible:bg-amber-300/20 focus-visible:ring-2 focus-visible:ring-amber-500/60"
      style={{ left: `${jump.x * 100}%`, top: `${jump.y * 100}%`, width: `${jump.width * 100}%`, height: `${jump.height * 100}%` }}
      onPointerDown={stop}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      onClick={(e) => { e.stopPropagation(); onGo(jump.target); }}
    >
      <span aria-hidden className="pointer-events-none absolute -right-1 top-1/2 flex -translate-y-1/2 translate-x-full items-center gap-0.5 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] leading-none text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <CornerDownRight className="size-2.5" />p. {jump.target}
      </span>
    </button>
  );
}

/**
 * A real link on a page of the book. It opens the website in a new tab and never hands the site this page.
 * The logo itself is painted into the page; hovering (or, on touch screens, always) shows a small "opens a
 * website" badge and where it goes, so readers know the logo is clickable.
 */
export function PageLinkAnchor({ link, visible = false }: { link: PageLink; visible?: boolean }) {
  const name = linkName(link), host = hostOf(link.url);
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${name} (opens in a new tab)`}
      aria-label={`${name} (opens in a new tab)`}
      data-page-link
      className="group pointer-events-auto absolute block cursor-pointer touch-manipulation outline-none"
      style={{ left: `${link.x * 100}%`, top: `${link.y * 100}%`, width: `${link.size * 100}%` }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="block aspect-square w-full rounded-[22%] transition-[background-color,box-shadow] group-hover:bg-foreground/5 group-hover:ring-2 group-hover:ring-foreground/25 group-focus-visible:ring-2 group-focus-visible:ring-foreground/60 [container-type:inline-size]">
        {visible && <span className="block text-[36cqw]"><LinkLogo link={link} /></span>}
        {visible && link.label?.trim() && <span className="relative -left-[45%] mt-[10%] block w-[190%] text-center font-medium leading-tight text-foreground text-[24cqw]" style={{ fontSize: `${24 * (link.fontSize ?? 100) / 100}cqw` }}>{link.label}</span>}
      </span>
      <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 shadow-md ring-2 ring-background transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-90">
        <ExternalLink className="size-3" />
      </span>
      {host && <span aria-hidden className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] leading-none text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">Opens {host}</span>}
    </a>
  );
}
