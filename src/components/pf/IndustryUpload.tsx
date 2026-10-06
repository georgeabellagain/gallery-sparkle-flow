import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { DropZone } from "./DropZone";
import { Button } from "@/components/ui/button";
import { deleteBlob } from "@/lib/portfolia/assets";
import { getDoc, startPortfolio, uploadLimitMb, useDoc } from "@/lib/portfolia/store";

/** The existing upload flow, available directly from each discipline landing page. */
export function IndustryUpload() {
  const doc = useDoc();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  return <div id="upload" className="mt-8 max-w-xl scroll-mt-6">
    {doc.portfolio?.status === "published" ? <div className="rounded-2xl border border-border bg-card p-6 text-sm">
      <p>You already have a published portfolio. Manage it or add another from your dashboard.</p>
      <Button asChild className="mt-4"><Link to="/dashboard">Open dashboard</Link></Button>
    </div> : <DropZone small label="Preview my PDF" limitMb={uploadLimitMb(doc)} onAccepted={(pdf) => {
      setError(undefined);
      // Account sync may finish while the file is being checked. Never replace a published PDF.
      if (getDoc().portfolio?.status === "published") {
        void deleteBlob(pdf.blobKey).catch(() => {});
        if (pdf.coverKey) void deleteBlob(pdf.coverKey).catch(() => {});
        setError("Your published portfolio is ready in the dashboard. Open it to manage your files.");
        return;
      }
      if (!startPortfolio(pdf)) return setError("Your browser could not save this PDF. Free some storage and try again.");
      void navigate({ to: "/create" });
    }} />}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <p className="mt-3 text-xs text-muted-foreground">No sign-up to preview. Sign in to save and publish.</p>
  </div>;
}
