import { getBlob } from "./assets";
import { createZip, downloadBlob, type ZipEntry } from "./zip";
import { getDoc } from "./store";
import type { Portfolio } from "./types";

/**
 * Export a portfolio's content/layout data plus the original uploaded assets.
 * This is a backup archive, not a standalone hosted website.
 */
export async function exportPortfolio(portfolio: Portfolio): Promise<{ files: number; missing: number }> {
  const doc = getDoc();
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  const walk = (id?: string) => {
    if (id) used.add(id);
  };
  walk(portfolio.about.portraitId);
  walk(portfolio.about.cvAssetId);
  for (const pr of portfolio.projects) {
    walk(pr.coverAssetId);
    for (const item of pr.items) {
      if (item.kind === "image") walk(item.assetId);
      if (item.kind === "pdfPage" || item.kind === "composition") {
        walk(item.assetId);
        if (item.kind === "pdfPage") walk(item.sourcePdfId);
        for (const el of item.elements) walk(el.assetId);
        for (const h of item.hotspots ?? []) walk(h.assetId);
      }
      if (item.kind === "image") for (const h of item.hotspots ?? []) walk(h.assetId);
    }
  }
  // Include the original PDFs that page renders came from.
  for (const id of [...used]) {
    const src = doc.assets[id]?.sourcePdfId;
    if (src) used.add(src);
  }

  const manifest: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    exportedBy: "Portfolia prototype",
    note: "Backup of portfolio content, layout settings and original uploaded files. This archive is not a ready-to-host website.",
    portfolio,
    assets: [...used].map((id) => doc.assets[id]).filter(Boolean),
  };

  entries.push({
    name: "portfolio.json",
    data: enc.encode(JSON.stringify(manifest, null, 2)),
  });

  let missing = 0;
  for (const id of used) {
    const meta = doc.assets[id];
    if (!meta) continue;
    let blob: Blob | undefined;
    try {
      if (meta.blobKey) blob = await getBlob(meta.blobKey);
      else if (meta.url) blob = await fetch(meta.url).then((r) => r.blob());
    } catch {
      blob = undefined;
    }
    if (!blob) {
      missing++;
      continue;
    }
    const safe = meta.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    entries.push({
      name: `originals/${id}-${safe}`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }

  entries.push({
    name: "README.txt",
    data: enc.encode(
      [
        "Portfolia export",
        "",
        "portfolio.json  — your projects, items, layout choices, theme and image details.",
        "originals/      — the files you uploaded, unchanged, including any source PDFs.",
        "",
        "This is a backup of your content. It is not a standalone website and cannot be",
        "uploaded to a host as-is. Portfolia cannot recover files that were cleared from",
        "this browser's storage.",
      ].join("\n"),
    ),
  });

  downloadBlob(createZip(entries), `portfolia-${portfolio.slug}.zip`);
  return { files: entries.length, missing };
}
