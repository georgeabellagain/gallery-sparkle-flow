import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/account.functions";
import { accountExportFile } from "@/lib/portfolia/data-export";
import { getDoc, resetAll } from "@/lib/portfolia/store";

/** Download everything held about the account, or delete it. Billing records stay with Paddle and for tax. */
export function YourData({ email, open: startOpen = false }: { email?: string; open?: boolean }) {
  const remove = useServerFn(deleteAccount);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false), [typed, setTyped] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const download = () => {
    const url = URL.createObjectURL(accountExportFile(getDoc(), email)), a = document.createElement("a");
    a.href = url; a.download = `portfolia-data-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const confirm = async () => {
    setBusy(true); setError("");
    try {
      await remove({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      resetAll();
      void navigate({ to: "/" });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete your account. Nothing was deleted."); }
    finally { setBusy(false); }
  };
  return <details open={startOpen} className={startOpen ? "max-w-2xl rounded-xl border border-border p-4" : "mt-4 max-w-2xl rounded-xl border border-border p-4"}>
    <summary className="cursor-pointer text-sm font-medium">Your data</summary>
    <div className="mt-4 space-y-4 text-sm">
      <div><Button size="sm" variant="line" onClick={download}>Download my data</Button><p className="mt-1 text-xs text-muted-foreground">A JSON file of your portfolios, settings and visit statistics. Your PDFs and pictures are the files you uploaded.</p></div>
      <div><Button size="sm" variant="quiet" className="text-destructive" onClick={() => { setOpen(true); setTyped(""); setError(""); }}>Delete my account</Button><p className="mt-1 text-xs text-muted-foreground">Removes every portfolio, file and link for good. Cancel Personal first if it is still renewing.</p></div>
    </div>
    <Modal open={open} onClose={() => !busy && setOpen(false)} title="Delete your account?">
      <p className="text-muted-foreground">Every portfolio, PDF, picture, link and statistic is deleted permanently and shared links stop working. Paid time left on a cancelled plan is lost. Billing records are kept for tax.</p>
      <label className="mt-4 block text-sm">Type DELETE to confirm<input aria-label="Type DELETE to confirm" autoComplete="off" className="mt-1.5 w-full rounded-full border border-input bg-background px-4 py-2 text-sm" value={typed} onChange={e => setTyped(e.target.value)} /></label>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="line" disabled={busy} onClick={() => setOpen(false)}>Keep my account</Button>
        <Button variant="destructive" disabled={busy || typed !== "DELETE"} onClick={() => void confirm()}>{busy ? "Deleting…" : "Delete permanently"}</Button>
      </div>
    </Modal>
  </details>;
}
