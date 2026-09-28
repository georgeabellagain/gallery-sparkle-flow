import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { AssetImage, useAssetUrl } from "./AssetImage";
import { ImageViewer, type ViewerTarget } from "./ImageViewer";
import { Presentation } from "./Presentation";
import type { BlockContext } from "./Blocks";
import type { Portfolio, Project, Snapshot } from "@/lib/portfolia/types";
import { cn } from "@/lib/utils";

interface PortfolioViewProps {
  portfolio: Portfolio;
  /** Draft state in the editor preview, published snapshot for visitors. */
  snapshot: Snapshot;
  initialProjectId?: string | null;
  initialAbout?: boolean;
  onProjectChange?: (projectId: string | null) => void;
  compact?: boolean;
  /** Portfolia wordmark in the footer; hidden in the mobile preview frame. */
  branding?: boolean;
}

/** The whole visitor-facing experience: covers, a project, or the About page. */
export function PortfolioView({
  portfolio,
  snapshot,
  initialProjectId,
  initialAbout,
  onProjectChange,
  compact,
  branding = true,
}: PortfolioViewProps) {
  const projects = snapshot.projects;
  const direct = snapshot.singleProjectDirect && projects.length === 1;
  const [projectId, setProjectId] = useState<string | null>(
    initialProjectId ?? (direct ? (projects[0]?.id ?? null) : null),
  );
  const [about, setAbout] = useState(Boolean(initialAbout));
  const [target, setTarget] = useState<ViewerTarget | null>(null);

  useEffect(() => {
    if (initialProjectId !== undefined) setProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (direct && projects[0] && !about) setProjectId(projects[0].id);
  }, [direct, projects, about]);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const layout = (project?.layout ?? null) || snapshot.defaultLayout;
  const ctx: BlockContext = {
    theme: snapshot.theme,
    settings: snapshot.layoutSettings[layout],
    onOpen: setTarget,
  };

  const open = (id: string | null) => {
    setAbout(false);
    setProjectId(id);
    onProjectChange?.(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const showBack = (project && (!direct || about)) || about;

  return (
    <div
      className="flex min-h-full flex-col"
      style={{
        background: snapshot.theme.background,
        color: snapshot.theme.text,
        fontFamily: snapshot.theme.bodyFont,
      }}
    >
      <header
        className={cn(
          "sticky top-0 z-20 flex items-center justify-between gap-4 border-b px-5 py-3 backdrop-blur",
          compact && "px-4 py-2.5",
        )}
        style={{ borderColor: "oklch(0 0 0 / 0.1)", background: `${snapshot.theme.background}ee` }}
      >
        <div className="flex min-w-0 items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={() => (about ? (setAbout(false), open(direct ? (projects[0]?.id ?? null) : null)) : open(null))}
              className="inline-flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100"
            >
              <ArrowLeft className="size-3.5" /> {direct && !about ? "" : "Back"}
            </button>
          )}
          <button
            type="button"
            onClick={() => open(direct ? (projects[0]?.id ?? null) : null)}
            className="truncate text-left"
            style={{
              fontFamily: snapshot.theme.headingFont,
              fontSize: `${(compact ? 15 : 17) * snapshot.theme.headingScale}px`,
            }}
          >
            {snapshot.title}
          </button>
        </div>
        <nav className="flex shrink-0 items-center gap-4 text-xs">
          {project && !direct && <span className="truncate opacity-60">{project.title}</span>}
          {snapshot.about.enabled && !about && (
            <button type="button" onClick={() => (setAbout(true), setProjectId(null))} className="opacity-60 hover:opacity-100">
              About
            </button>
          )}
        </nav>
      </header>

      <main className="flex-1">
        {about ? (
          <AboutPage snapshot={snapshot} compact={compact} />
        ) : project ? (
          <Presentation layout={layout} items={project.items} ctx={ctx} compact={compact} />
        ) : (
          <Covers snapshot={snapshot} projects={projects} onOpen={open} compact={compact} />
        )}
      </main>

      {branding && (
        <footer
          className="mt-auto border-t px-5 py-4 text-xxs"
          style={{ borderColor: "oklch(0 0 0 / 0.08)", opacity: 0.45 }}
        >
          {portfolio.owner} · made with Portfolia
        </footer>
      )}

      <ImageViewer target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function Covers({
  snapshot,
  projects,
  onOpen,
  compact,
}: {
  snapshot: Snapshot;
  projects: Project[];
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      {snapshot.tagline && (
        <p
          className="mb-10 max-w-xl text-balance"
          style={{
            fontFamily: snapshot.theme.headingFont,
            fontSize: `${(compact ? 20 : 26) * snapshot.theme.headingScale}px`,
            lineHeight: 1.22,
          }}
        >
          {snapshot.tagline}
        </p>
      )}
      <div className={cn("grid gap-x-8 gap-y-10", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        {projects.map((p) => (
          <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="group text-left">
            <div className="overflow-hidden" style={{ background: "oklch(0 0 0 / 0.04)" }}>
              <AssetImage
                assetId={p.coverAssetId ?? firstImageAsset(p)}
                alt=""
                className="aspect-4/3 w-full transition-transform duration-500 group-hover:scale-[1.015]"
              />
            </div>
            <h2 className="mt-3 text-sm font-medium">{p.title}</h2>
            {p.description && <p className="mt-1 text-xs opacity-60">{p.description}</p>}
          </button>
        ))}
      </div>
      {!projects.length && (
        <p className="py-16 text-center text-sm opacity-60">No projects published yet.</p>
      )}
    </div>
  );
}

function firstImageAsset(p: Project): string | undefined {
  for (const item of p.items) {
    if (item.kind === "image") return item.assetId;
    if (item.kind === "pdfPage" || item.kind === "composition") {
      if (item.assetId) return item.assetId;
      const el = item.elements.find((e) => e.kind === "image" && e.assetId);
      if (el?.assetId) return el.assetId;
    }
  }
  return undefined;
}

function AboutPage({ snapshot, compact }: { snapshot: Snapshot; compact?: boolean }) {
  const about = snapshot.about;
  const { url: cvUrl } = useAssetUrl(about.cvAssetId);
  return (
    <div className={cn("mx-auto w-full max-w-2xl px-5 py-14", compact && "py-10")}>
      <h1
        style={{
          fontFamily: snapshot.theme.headingFont,
          fontSize: `${(compact ? 26 : 34) * snapshot.theme.headingScale}px`,
          lineHeight: 1.1,
        }}
      >
        {about.name || snapshot.title}
      </h1>
      {about.discipline && <p className="mt-1.5 text-sm opacity-60">{about.discipline}</p>}

      {about.show.portrait && about.portraitId && (
        <AssetImage assetId={about.portraitId} alt={about.name ?? ""} className="mt-8 aspect-4/5 w-56" />
      )}

      {about.show.bio && about.bio && (
        <p className="mt-8 whitespace-pre-wrap text-sm leading-relaxed">{about.bio}</p>
      )}

      {about.show.contact && (about.email || about.phone || about.location) && (
        <dl className="mt-10 space-y-2 text-sm">
          {about.email && (
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 opacity-50">Email</dt>
              <dd>
                <a href={`mailto:${about.email}`} className="underline underline-offset-4">
                  {about.email}
                </a>
              </dd>
            </div>
          )}
          {about.phone && (
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 opacity-50">Phone</dt>
              <dd>{about.phone}</dd>
            </div>
          )}
          {about.location && (
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 opacity-50">Based in</dt>
              <dd>{about.location}</dd>
            </div>
          )}
        </dl>
      )}

      {about.show.links && about.links?.some((l) => l.url) && (
        <ul className="mt-8 space-y-1.5 text-sm">
          {about.links
            .filter((l) => l.url)
            .map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">
                  {l.label || l.url}
                </a>
              </li>
            ))}
        </ul>
      )}

      {about.show.cv && about.cvAssetId && (
        <p className="mt-10">
          <a
            href={cvUrl}
            download={about.cvName || "cv.pdf"}
            className="inline-flex h-9 items-center gap-2 border px-4 text-sm"
            style={{ borderColor: "oklch(0 0 0 / 0.2)" }}
          >
            <Download className="size-3.5" /> Download CV
          </a>
        </p>
      )}
    </div>
  );
}
