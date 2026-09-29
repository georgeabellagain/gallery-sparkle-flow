import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Modal } from "./Chrome";
import { Button } from "@/components/ui/button";

export function PortfolioQrCode({ open, onClose, url, name }: { open: boolean; onClose: () => void; url: string; name: string }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !url) return;
    setImage("");
    setError("");
    void QRCode.toDataURL(url, { width: 480, margin: 3, errorCorrectionLevel: "H" })
      .then(setImage)
      .catch(() => setError("Couldn’t create the QR code. Please close this window and try again."));
  }, [open, url]);

  const download = async () => {
    try {
      const png = await QRCode.toDataURL(url, { width: 1200, margin: 4, errorCorrectionLevel: "H" });
      const safeName = (name || "portfolio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const link = document.createElement("a");
      link.href = png;
      link.download = `${safeName || "portfolio"}-qr-code.png`;
      link.click();
    } catch {
      setError("Couldn’t download the QR code. Please try again.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Your portfolio QR code">
      <p className="text-muted-foreground">Anyone who scans this code will open the same public portfolio address shown in your dashboard.</p>
      <div className="mx-auto mt-5 aspect-square w-full max-w-72 overflow-hidden rounded-2xl border border-border bg-card p-4">
        {image ? <img src={image} alt={`QR code for ${name || "your portfolio"}`} className="size-full" /> : <div className="flex size-full items-center justify-center text-xs text-muted-foreground">Creating QR code…</div>}
      </div>
      <p className="mt-3 break-all text-center font-mono text-xs text-muted-foreground">{url}</p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <Button className="mt-5 w-full" disabled={!image} onClick={() => void download()}><Download /> Download high-resolution PNG</Button>
    </Modal>
  );
}