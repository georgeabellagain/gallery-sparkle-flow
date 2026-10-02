import { useMemo } from "react";
import { Mail } from "lucide-react";
import { DEFAULT_VIEWER, type PageStyle, type Profile, type ViewerSettings } from "@/lib/portfolia/store";
import { PdfViewer } from "./PdfViewer";
import { CvIcon } from "./CvIcon";
import { useBlob, useObjectUrl, Wordmark } from "./Chrome";

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
  pageStyle,
  viewer,
  embed,
  startPage,
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
  pageStyle?: PageStyle;
  viewer?: ViewerSettings;
  embed?: boolean;
  startPage?: number;
}) {
  const view = { ...DEFAULT_VIEWER, ...viewer };
  const bannerBlob = useBlob(pageStyle?.bannerKey);
  const bannerUrl = useObjectUrl(bannerBlob);
  const cvBlob = useBlob(cvBlobKey);
  const cvUrl = useObjectUrl(cvBlob);
  const cv = cvBlobKey ? profile.cv : undefined;
  const links = profile.links.filter((l) => l.url.trim());
  // With no profile photo, the profile sits hard against the left edge instead of the centred column.
  const flushLeft = !photoUrl && view.showHeader;
  const column = flushLeft ? "max-w-none" : "mx-auto max-w-[1100px]";
  return (
    <div className="flex min-h-full flex-col bg-background" style={pageStyle ? { background: pageStyle.background, color: pageStyle.text } : undefined}>
      {/* A small way home on every public page. Hidden inside embeds and editor previews. */}
      {!embed && !compact && (
        <div className="px-4 pt-3 sm:px-6">
          <div className={`flex ${column}`}>
            <Wordmark className="rounded-full bg-white/90 px-3 py-1.5 opacity-80 shadow-soft transition-opacity hover:opacity-100 focus-visible:opacity-100 [&>img]:h-4" />
          </div>
        </div>
      )}
      {view.showHeader && !embed && bannerUrl && <img src={bannerUrl} alt={profile.name ? `${profile.name} portfolio banner` : "Portfolio banner"} className={immersive ? "h-28 w-full object-cover sm:h-40" : "h-24 w-full object-cover"} />}
      {view.showHeader && !embed && <header className={immersive ? "px-4 py-3 sm:px-6 sm:py-4" : compact ? "px-4 py-4" : "px-5 py-5 sm:px-8 sm:py-8"}>
        <div className={`flex items-start gap-4 ${column}`}>
          {photoUrl ? (
            <img src={photoUrl} alt={profile.name || "Profile photo"} className={immersive ? "size-10 shrink-0 rounded-full object-cover" : "size-11 shrink-0 rounded-full object-cover sm:size-14"} />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 style={pageStyle ? { fontFamily: pageStyle.font } : undefined} className={immersive ? "display-title text-xl leading-tight sm:text-2xl" : "display-title text-2xl leading-tight sm:text-3xl"}>{profile.name || "Your name"}</h1>
            {profile.title && <p className="text-sm text-muted-foreground">{profile.title}</p>}
            {profile.intro && (
              // With no profile photo the text uses the whole width instead of a narrow column.
              <p className={`${immersive ? "mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground" : "mt-2 line-clamp-3 text-sm leading-relaxed sm:line-clamp-none"} ${photoUrl ? "max-w-2xl" : "max-w-none"}`}>{profile.intro}</p>
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
      </header>}
      <div className="flex-1">
        <PdfViewer source={pdf} fileName={`${profile.name || "portfolio"}.pdf`} allowDownload={allowDownload} onDownload={onDownload} compact={compact} immersive={immersive} backdrop={pageStyle?.backdrop} viewer={view} startPage={startPage} />
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
