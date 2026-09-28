import { useMemo } from "react";
import { Mail } from "lucide-react";
import type { Profile } from "@/lib/portfolia/store";
import { PdfViewer } from "./PdfViewer";
import { CvIcon } from "./CvIcon";
import { useBlob, useObjectUrl } from "./Chrome";

/** The visitor-facing page: compact profile, then the PDF. No editor controls. */
export function PortfolioPage({
  profile,
  pdf,
  photoUrl,
  allowDownload,
  showCredit,
  onDownload,
  compact,
  immersive,
  cvBlobKey,
}: {
  profile: Profile;
  pdf: { blob: Blob } | { url: string } | null;
  photoUrl?: string;
  allowDownload: boolean;
  showCredit: boolean;
  onDownload?: () => void;
  compact?: boolean;
  immersive?: boolean;
  cvBlobKey?: string;
}) {
  const cvBlob = useBlob(cvBlobKey);
  const cvUrl = useObjectUrl(cvBlob);
  const cv = cvBlobKey ? profile.cv : undefined;
  const links = profile.links.filter((l) => l.url.trim());
  const initials = profile.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className={immersive ? "px-4 py-3 sm:px-6 sm:py-4" : compact ? "px-4 py-4" : "px-5 py-5 sm:px-8 sm:py-8"}>
        <div className="mx-auto flex max-w-[1100px] items-start gap-4">
          {photoUrl ? (
            <img src={photoUrl} alt="" className={immersive ? "size-10 shrink-0 rounded-full object-cover" : "size-11 shrink-0 rounded-full object-cover sm:size-14"} />
          ) : (
            <span className="hidden size-14 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground sm:flex" aria-hidden>
              {initials || "·"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className={immersive ? "display-title text-xl leading-tight sm:text-2xl" : "display-title text-2xl leading-tight sm:text-3xl"}>{profile.name || "Your name"}</h1>
            {profile.title && <p className="text-sm text-muted-foreground">{profile.title}</p>}
            {profile.intro && (
              <p className={immersive ? "mt-1 line-clamp-2 max-w-2xl text-xs leading-relaxed text-muted-foreground" : "mt-2 line-clamp-3 max-w-2xl text-sm leading-relaxed sm:line-clamp-none"}>{profile.intro}</p>
            )}
            {(profile.email || links.length > 0 || cv) && (
              <div className={immersive ? "mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs" : "mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"}>
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                    <Mail className="size-3.5" /> {profile.email}
                  </a>
                )}
                {cv && cvUrl && (
                  <a href={cvUrl} download={cv.name} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                    <CvIcon className="size-3.5" /> CV
                  </a>
                )}
                {links.map((l, i) => (
                  <a key={i} href={withProtocol(l.url)} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                    {l.label || prettyUrl(l.url)}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1">
        <PdfViewer source={pdf} fileName={`${profile.name || "portfolio"}.pdf`} allowDownload={allowDownload} onDownload={onDownload} compact={compact} immersive={immersive} />
      </div>
      {showCredit && (
        <footer className="py-5 text-center text-xxs text-muted-foreground">
          Hosted on <span className="display-title text-xs text-foreground">Portfolia</span>
        </footer>
      )}
    </div>
  );
}

export function withProtocol(u: string) {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
export function prettyUrl(u: string) {
  return u.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Loads the creator's stored PDF + photo for display. */
export function useStoredMedia(pdfKey?: string, photoKey?: string) {
  const pdfBlob = useBlob(pdfKey);
  const photoBlob = useBlob(photoKey);
  const photoUrl = useObjectUrl(photoBlob);
  const pdf = useMemo(() => (pdfBlob ? { blob: pdfBlob } : null), [pdfBlob]);
  return { pdf, photoUrl };
}
