import { useEffect, useState } from "react";
import { hostOf, linkName, siteIconUrl, type PageLink } from "@/lib/portfolia/page-extras";
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
      className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[22%] bg-white shadow-[0_2px_8px_rgba(0,0,0,.28)] ring-1 ring-black/10 ${className}`}
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
        <span className="font-semibold text-neutral-700" style={{ fontSize: "1.4em" }}>
          {letter}
        </span>
      )}
    </span>
  );
}

/** A real link on a page of the book. It opens the website in a new tab and never hands the site this page. */
export function PageLinkAnchor({ link }: { link: PageLink }) {
  const name = linkName(link);
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${name} (opens in a new tab)`}
      aria-label={`${name} (opens in a new tab)`}
      data-page-link
      className="group pointer-events-auto absolute block touch-manipulation outline-none"
      style={{ left: `${link.x * 100}%`, top: `${link.y * 100}%`, width: `${link.size * 100}%`, fontSize: "clamp(10px, 1.6cqw, 18px)" }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <LinkLogo
        link={link}
        className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-offset-2"
      />
      {link.label?.trim() && (
        <span className="pointer-events-none mt-1 block truncate rounded-full bg-white/90 px-1.5 py-0.5 text-center text-[0.8em] leading-tight text-neutral-800 shadow-sm">
          {link.label.trim()}
        </span>
      )}
    </a>
  );
}
