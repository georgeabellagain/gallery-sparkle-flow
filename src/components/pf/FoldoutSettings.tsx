import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { getDoc, patchPortfolio, type Portfolio } from "@/lib/portfolia/store";
import {
  fitFoldout,
  MAX_FOLDOUTS,
  readableFoldouts,
  validateFoldout,
  type Foldout,
} from "@/lib/portfolia/foldouts";
import { prepareFoldoutImage } from "@/lib/portfolia/foldout-image";
import { StoredFoldout } from "./FoldoutCard";

export function FoldoutSettings({ p }: { p: Portfolio }) {
  const pdf = p.pdf!;
  const items = readableFoldouts(pdf.foldouts, pdf.pages);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const current = () => {
    const value = getDoc().portfolio;
    if (value?.code !== p.code || value.pdf?.blobKey !== pdf.blobKey)
      throw new Error(
        "The portfolio changed. Reopen its editor before adding fold-outs.",
      );
    return value.pdf;
  };
  const save = (next: Foldout[]) => {
    const latest = current();
    if (next.length > MAX_FOLDOUTS)
      throw new Error(`Use up to ${MAX_FOLDOUTS} fold-outs per PDF.`);
    for (const f of next) {
      const invalid = validateFoldout(f, latest.pages);
      if (invalid) throw new Error(invalid);
    }
    if (!patchPortfolio({ pdf: { ...latest, foldouts: next } }))
      throw new Error(
        "Could not save. Free some browser storage and try again.",
      );
    setError("");
    setMessage(
      "Fold-out saved. Account saving status appears at the top of the editor.",
    );
  };
  const add = async (file?: File) => {
    if (!file || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const imageKey = uid("foldout");
    let stored = false;
    try {
      if (
        readableFoldouts(current().foldouts, pdf.pages).length >= MAX_FOLDOUTS
      )
        throw new Error(`Use up to ${MAX_FOLDOUTS} fold-outs per PDF.`);
      const image = await prepareFoldoutImage(file);
      current();
      await putBlob(imageKey, image);
      stored = true;
      const latest = current();
      const item: Foldout = {
        id: uid("flap"),
        imageKey,
        page: 1,
        half: "right",
        title:
          file.name
            .replace(/\.[^.]+$/, "")
            .slice(0, 60)
            .trim() || "Extra image",
        hinge: "left",
        colour: "#d6dfd0",
        x: 0.55,
        y: 0.3,
        width: 0.32,
        height: 0.38,
      };
      save([...readableFoldouts(latest.foldouts, latest.pages), item]);
      stored = false;
    } catch (e) {
      if (stored) await deleteBlob(imageKey).catch(() => {});
      setError(e instanceof Error ? e.message : "Could not add the image.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      aria-labelledby="foldout-settings-title"
      className="mt-6 rule-t pt-5"
    >
      <h2 id="foldout-settings-title" className="text-sm font-medium">
        Scrapbook fold-outs{" "}
        <span className="ml-1 text-xs text-muted-foreground">Experimental</span>
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Add an image behind a paper flap. Click to unfold it in Simple or
        Studio. Both panels stay inside the page so they fit on a phone. Count
        the cover as page 1.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        JPEG, PNG or WebP, up to 8 MB each; {MAX_FOLDOUTS} per PDF. These web
        additions are not included in PDF downloads or other reading modes.
        Replacing the PDF clears them.
      </p>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <FoldoutFields
            key={`${item.id}:${JSON.stringify(item)}`}
            item={item}
            pages={pdf.pages}
            onSave={(next) => {
              try {
                const latest = current();
                save(
                  readableFoldouts(latest.foldouts, latest.pages).map((f) =>
                    f.id === next.id ? next : f,
                  ),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
            onRemove={() => {
              try {
                const latest = current();
                const remaining = readableFoldouts(
                  latest.foldouts,
                  latest.pages,
                ).filter((f) => f.id !== item.id);
                save(remaining);
                if (!remaining.some((f) => f.imageKey === item.imageKey))
                  void deleteBlob(item.imageKey).catch(() => {});
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        ))}
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Fold-out image"
        disabled={busy || items.length >= MAX_FOLDOUTS}
        onChange={(e) => {
          void add(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <Button
        className="mt-4"
        size="sm"
        variant="line"
        disabled={busy || items.length >= MAX_FOLDOUTS}
        onClick={() => input.current?.click()}
      >
        {busy ? "Preparing image…" : "Add image fold-out"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        {message}
      </p>
    </section>
  );
}

function FoldoutFields({
  item,
  pages,
  onSave,
  onRemove,
}: {
  item: Foldout;
  pages: number;
  onSave: (f: Foldout) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const change = (patch: Partial<Foldout>) =>
    setDraft((v) => fitFoldout({ ...v, ...patch }));
  const field =
    "mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm";
  return (
    <fieldset className="rounded-xl border border-border p-3">
      <legend className="px-1 text-xs">
        Page {item.page} · {item.title}
      </legend>
      <div
        className="relative mb-3 aspect-[4/3] overflow-hidden rounded-lg border bg-[#f5f1e7]"
        aria-label="Fold-out placement preview"
      >
        <StoredFoldout key={JSON.stringify(draft)} item={draft} />
      </div>
      <label className="block text-xs">
        Image description
        <input
          className={field}
          maxLength={60}
          value={draft.title}
          onChange={(e) => change({ title: e.target.value })}
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs">
          PDF page
          <input
            className={field}
            type="number"
            min={1}
            max={pages}
            value={Number.isNaN(draft.page) ? "" : draft.page}
            onChange={(e) => change({ page: e.target.valueAsNumber })}
          />
        </label>
        <label className="text-xs">
          Opens to
          <select
            className={field}
            value={draft.hinge}
            onChange={(e) =>
              change({ hinge: e.target.value as Foldout["hinge"] })
            }
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="text-xs">
          If PDF is a spread
          <select
            className={field}
            value={draft.half}
            onChange={(e) =>
              change({ half: e.target.value as Foldout["half"] })
            }
          >
            <option value="left">Left half</option>
            <option value="right">Right half</option>
          </select>
        </label>
        <label className="text-xs">
          Flap colour
          <input
            className="mt-1 block h-9 w-full"
            type="color"
            value={draft.colour}
            onChange={(e) => change({ colour: e.target.value })}
          />
        </label>
      </div>
      <div className="mt-3 space-y-2">
        {(["x", "y", "width", "height"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-xs">
            <span className="w-20">
              {
                {
                  x: "Left / right",
                  y: "Up / down",
                  width: "Panel width",
                  height: "Height",
                }[k]
              }
            </span>
            <input
              className="min-w-0 flex-1"
              aria-label={`Fold-out ${k}`}
              type="range"
              min={k === "width" || k === "height" ? 18 : 0}
              max={k === "width" ? 45 : k === "height" ? 70 : 100}
              value={Math.round(draft[k] * 100)}
              onChange={(e) => change({ [k]: Number(e.target.value) / 100 })}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onSave(draft)}>
          Save fold-out
        </Button>
        <Button size="sm" variant="quiet" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </fieldset>
  );
}
