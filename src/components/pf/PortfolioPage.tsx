import { useMemo } from "react";
import { Mail } from "lucide-react";
import { DEFAULT_VIEWER, type PageStyle, type Profile, type ViewerSettings } from "@/lib/portfolia/store";
import { PdfViewer } from "./PdfViewer";
import { CvIcon } from "./CvIcon";
import { useBlob, useObjectUrl } from "./Chrome";

/**
 * The visitor-facing page: the PDF, and nothing else on screen. The person's details
 * live behind a small profile icon, and every control is a quiet icon.
 */
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
  startFullscreen,
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
  /** Open full screen on a phone or tablet (a portfolio opened from its QR code). */
  startFullscreen?: boolean;
}) {
  const view = { ...DEFAULT_VIEWER, ...viewer };
  const bannerBlob = useBlob(pageStyle?.bannerKey);
  const bannerUrl = useObjectUrl(bannerBlob);
  const cvBlob = useBlob(cvBlobKey);
  const cvUrl = useObjectUrl(cvBlob);
  const backgroundBlob = useBlob(view.backgroundKey);
  const backgroundUrl = useObjectUrl(backgroundBlob);
  const cv = cvBlobKey ? profile.cv : undefined;
  const links = profile.links.filter((l) => l.url.trim());
  const hasProfile = view.showHeader && !embed && Boolean(profile.name?.trim() || profile.title || profile.intro || profile.email || links.length > 0 || cv || photoUrl || bannerUrl);

  const details = hasProfile ? (
    <div className="-m-3 rounded-2xl p-3" style={pageStyle ? { background: pageStyle.background, color: pageStyle.text } : undefined}>
      {bannerUrl && (
        <img src={bannerUrl} alt={profile.name ? `${profile.name} portfolio banner` : "Portfolio banner"} className="-mx-3 -mt-3 mb-3 h-24 w-[calc(100%+1.5rem)] max-w-none rounded-t-2xl object-cover" />
      )}
      <div className="flex items-start gap-3">
        {photoUrl && <img src={photoUrl} alt={profile.name || "Profile photo"} className="size-12 shrink-0 rounded-full object-cover" />}
        <div className="min-w-0">
          <p style={pageStyle ? { fontFamily: pageStyle.font } : undefined} className="display-title text-xl leading-tight">
            {profile.name || "Your name"}
          </p>
          {profile.title && <p className="text-sm text-muted-foreground">{profile.title}</p>}
        </div>
      </div>
      {profile.intro && <p className="mt-3 text-sm leading-relaxed">{profile.intro}</p>}
      {(profile.email || links.length > 0 || cv) && (
        <div className="mt-3 flex flex-col gap-1.5 text-sm">
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
  ) : undefined;

  return (
    <div className="flex min-h-full flex-col bg-background" style={pageStyle ? { background: pageStyle.background, color: pageStyle.text } : undefined}>
      <h1 className="sr-only">{profile.name || "Portfolio"}</h1>
      <div className="flex-1">
        <PdfViewer
          source={pdf}
          fileName={`${profile.name || "portfolio"}.pdf`}
          allowDownload={allowDownload}
          onDownload={onDownload}
          compact={compact}
          immersive={immersive}
          credit={showCredit}
          backdrop={pageStyle?.backdrop}
          viewer={view}
          startPage={startPage}
          startFullscreen={startFullscreen}
          profile={details}
          home={!embed && !compact}
          backgroundUrl={backgroundUrl}
          controls
        />
      </div>
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
