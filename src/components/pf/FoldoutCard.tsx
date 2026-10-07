import { useState } from "react";
import type { Foldout } from "@/lib/portfolia/foldouts";
import { useBlob, useObjectUrl } from "./Chrome";

export function StoredFoldout({ item }: { item: Foldout }) {
  const blob = useBlob(item.imageKey);
  const url = useObjectUrl(blob);
  return <FoldoutCard item={item} imageUrl={url} />;
}

/** The same paper hinge is used in the editor, demo and book. */
export function FoldoutCard({
  item,
  imageUrl,
}: {
  item: Foldout;
  imageUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const image = (right: boolean) => (
    <span className="pf-foldout-image" aria-hidden="true">
      {imageUrl && !failed && (
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          style={{ left: right ? "-100%" : 0 }}
        />
      )}
    </span>
  );
  const r = parseInt(item.colour.slice(1, 3), 16),
    g = parseInt(item.colour.slice(3, 5), 16),
    b = parseInt(item.colour.slice(5), 16);
  const ink = r * 0.299 + g * 0.587 + b * 0.114 > 155 ? "#292722" : "#ffffff";
  return (
    <div
      className="pf-foldout"
      data-foldout="true"
      data-open={open}
      data-hinge={item.hinge}
      style={{
        left: `${item.x * 100}%`,
        top: `${item.y * 100}%`,
        width: `${item.width * 100}%`,
        height: `${item.height * 100}%`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <div className="pf-foldout-base">{image(item.hinge === "left")}</div>
      <button
        type="button"
        className="pf-foldout-flap"
        aria-expanded={open}
        aria-label={`${open ? "Close" : "Open"} fold-out: ${item.title}`}
        disabled={!imageUrl || failed}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="pf-foldout-front"
          style={{ backgroundColor: item.colour, color: ink }}
        >
          <span className="pf-foldout-number">FIELD NOTES / EXTRA</span>
          <span className="pf-foldout-title">{item.title}</span>
          <span className="pf-foldout-hint">
            {failed
              ? "Image unavailable"
              : !imageUrl
                ? "Loading image…"
                : item.hinge === "left"
                  ? "← Unfold"
                  : "Unfold →"}
          </span>
        </span>
        <span className="pf-foldout-back">{image(item.hinge !== "left")}</span>
      </button>
      {open && (
        <button
          type="button"
          className="pf-foldout-close"
          aria-label={`Close fold-out: ${item.title}`}
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      )}
      <span className="sr-only">
        {open
          ? `Revealed image: ${item.title}. Press Escape or close to fold away.`
          : ""}
      </span>
    </div>
  );
}
