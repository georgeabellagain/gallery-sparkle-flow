import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileUp, PenLine } from "lucide-react";
import { SiteFooter, SiteHeader, PrototypeNote } from "@/components/portfolia/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { createPortfolio } from "@/lib/portfolia/store";
import { TEMPLATES, createFromTemplate, importPdfIntoPortfolio } from "@/lib/portfolia/importFlow";
import { pdfPageLimit } from "@/lib/portfolia/pdf";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Start a portfolio — Portfolia" },
      {
        name: "description",
        content: "Upload an existing PDF or begin with a blank canvas. No setup questionnaire.",
      },
      { property: "og:title", content: "Start a portfolio — Portfolia" },
      { property: "og:description", content: "Two ways to begin: bring a PDF, or start from nothing." },
    ],
  }),
  component: Create,
});

function Create() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("blank");
  const [progress, setProgress] = useState<{ phase: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startBlank = () => {
    const id = createFromTemplate(template, title || "Untitled portfolio");
    void navigate({ to: "/editor/$id", params: { id } });
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setProgress({ phase: "Preparing", percent: 2 });
    const portfolioId = createPortfolio({
      title: title || file.name.replace(/\.pdf$/i, ""),
      layout: "paged",
    });
    // Read the fresh project id from the store-created portfolio.
    const projectId = `first`;
    try {
      const { pages } = await importPdfIntoPortfolio(file, {
        portfolioId,
        projectId: projectIdFor(portfolioId) ?? projectId,
        onProgress: (info) => setProgress({ phase: info.phase, percent: info.percent }),
      });
      setProgress({ phase: `Imported ${pages} pages`, percent: 100 });
      void navigate({ to: "/editor/$id", params: { id: portfolioId } });
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : "That upload didn’t finish. Nothing else was changed.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-14">
          <h1 className="display-title text-4xl">Start a portfolio</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Two ways in. You can change everything later — nothing is locked by this choice.
          </p>

          <div className="mt-8 max-w-sm">
            <Label htmlFor="pf-title" className="text-xs">
              Portfolio name (optional)
            </Label>
            <Input
              id="pf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Your name, or a series title"
              className="mt-1.5"
            />
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <section className="flex flex-col border border-border p-6">
              <FileUp className="size-5" />
              <h2 className="mt-4 text-base font-medium">Upload an existing PDF</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Every page is imported exactly as designed. Reorder, hide, crop regions, and add
                links on top. Up to {pdfPageLimit} pages in this prototype.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <Button className="mt-5" onClick={() => fileRef.current?.click()} disabled={Boolean(progress)}>
                Choose a PDF
              </Button>
            </section>

            <section className="flex flex-col border border-border p-6">
              <PenLine className="size-5" />
              <h2 className="mt-4 text-base font-medium">Create from scratch</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                A genuinely blank canvas. Add images and text straight away, or pick a light starting
                point.
              </p>
              <div className="mt-4 space-y-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={cn(
                      "w-full border px-3 py-2 text-left transition-colors",
                      template === t.id ? "border-foreground" : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="text-sm">{t.name}</span>
                    <span className="block text-xxs text-muted-foreground">{t.blurb}</span>
                  </button>
                ))}
              </div>
              <Button className="mt-5" variant="line" onClick={startBlank} disabled={Boolean(progress)}>
                Start editing
              </Button>
            </section>
          </div>

          {progress && (
            <div className="mt-8 border border-border p-5">
              <div className="flex items-baseline justify-between text-sm">
                <span>{progress.phase}</span>
                <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
              </div>
              <Progress value={progress.percent} className="mt-3 h-1" />
              <p className="mt-3 text-xs text-muted-foreground">
                You can keep scrolling while pages render. Large files take a moment.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-8 border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Upload didn’t finish</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <Button variant="line" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}>
                Try another file
              </Button>
            </div>
          )}

          <PrototypeNote className="mt-12">
            Prototype behaviour: your PDF, images and portfolio are saved in this browser only
            (IndexedDB and local storage). Clearing site data removes them, and they cannot be opened
            on another device. This is not a cloud backup.
          </PrototypeNote>

          <p className="mt-6 text-xs text-muted-foreground">
            Already started something?{" "}
            <Link to="/dashboard" className="underline underline-offset-4">
              Open your workspace
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Reads back the id of the single project created with a new portfolio. */
function projectIdFor(portfolioId: string): string | undefined {
  // Import lazily to avoid a circular module reference at module scope.
  const { doc } = (window as unknown as { __portfoliaStore?: never }) && getDocSafely();
  return doc?.portfolios.find((p) => p.id === portfolioId)?.projects[0]?.id;
}

function getDocSafely() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { doc: readDoc() };
}

function readDoc() {
  return storeRef.read();
}

import { storeRef } from "@/lib/portfolia/storeRef";
