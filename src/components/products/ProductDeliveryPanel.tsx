import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productAuth } from "@/lib/products/client";
import { addManualOrder, listOrders, resendOrder, revokeOrderLink, saveDeliverySettings } from "@/lib/products/delivery.functions";
import { cn } from "@/lib/utils";

type Data = Awaited<ReturnType<typeof listOrders>>;
type Shop = "gumroad" | "shopify" | "generic";
const field = "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

/**
 * Feature F: send each buyer their own private link by email, automatically. Business only (owner decision, default).
 * Etsy has no simple order webhook, so it is shown but not offered.
 */
export function ProductDeliveryPanel({ id, business, published, onUpgrade, copy }: { id: string; business: boolean; published: boolean; onUpgrade: () => void; copy: (text: string, done: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [shop, setShop] = useState<Shop>("gumroad");
  const [gumroad, setGumroad] = useState(""), [shopify, setShopify] = useState(""), [secret, setSecret] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [test, setTest] = useState({ email: "", name: "" });
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [note, setNote] = useState("");
  const load = useCallback(async () => {
    const d = await listOrders({ data: { id }, headers: await productAuth() });
    setData(d);
    if (d.delivery?.source) setShop(d.delivery.source as Shop);
    setGumroad(d.delivery?.gumroadProduct ?? "");
    setShopify(d.delivery?.shopifyProduct ?? "");
  }, [id]);
  useEffect(() => { void load().catch((e) => setError((e as Error).message)); }, [load]);
  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(""); setNote("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };
  if (!business) return <div className="space-y-3">
    <p>Send each buyer their own private link by email, automatically, when they buy on Gumroad, Shopify or through Zapier and similar tools.</p>
    <p className="text-xs text-muted-foreground">Automatic delivery is part of Business.</p>
    <Button size="sm" onClick={onUpgrade}>See Business</Button>
  </div>;
  if (!published) return <p className="text-sm text-muted-foreground">Publish the product first. Automatic delivery sends links to the published edition.</p>;
  if (!data) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <p role="status" className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.available) return <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{data.message}</p>;
  const base = `https://portfolia.site/api/public/product-delivery/${id}/${shop}`;
  const saved = data.delivery?.source === shop && data.delivery.hasKey;
  const save = (newKey = false) => act("Saving", async () => {
    const r = await saveDeliverySettings({ data: { id, source: shop, gumroadProduct: gumroad, shopifyProduct: shopify, secret: secret || undefined, newKey }, headers: await productAuth() });
    setSecret("");
    if (r.key) setKey(r.key);
    await load();
    setNote(r.key ? "Saved. Copy the key now: it is shown only once." : "Saved.");
  });
  const endpoint = shop === "gumroad" ? `${base}?key=${key ?? "YOUR-KEY"}` : base;
  return <div className="space-y-5">
    <p>Send each buyer their own private link by email, automatically.</p>
    <div role="radiogroup" aria-label="Your shop" className="grid grid-cols-2 gap-2">
      {([["gumroad", "Gumroad"], ["shopify", "Shopify"], ["generic", "Other (Zapier, Make, Payhip…)"]] as const).map(([value, label]) => (
        <button key={value} type="button" role="radio" aria-checked={shop === value} onClick={() => { setShop(value); setKey(null); }} className={cn("rounded-xl border px-3 py-2 text-left text-xs", shop === value ? "border-foreground bg-muted" : "border-border hover:bg-muted/60")}>{label}</button>
      ))}
      <button type="button" disabled className="rounded-xl border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground">Etsy</button>
    </div>
    <p className="text-xs text-muted-foreground">Etsy has no automatic option yet. Use the delivery PDF in Links.</p>

    <ol className="list-decimal space-y-3 pl-4 text-xs">
      {shop === "gumroad" && <>
        <li><label className="block">Your Gumroad product permalink or id<input className={field} value={gumroad} maxLength={120} onChange={(e) => setGumroad(e.target.value)} placeholder="my-zine" /></label></li>
        <li>Save, then paste this address into Gumroad › Settings › Advanced › Ping:
          <AddressRow value={endpoint} hidden={!key} onCopy={() => key && copy(endpoint, "Ping address copied.")} /></li>
      </>}
      {shop === "shopify" && <>
        <li><label className="block">The Shopify product id or SKU<input className={field} value={shopify} maxLength={120} onChange={(e) => setShopify(e.target.value)} /></label></li>
        <li>In Shopify › Settings › Notifications › Webhooks, create an <b>Order payment</b> webhook (JSON) and a <b>Refund create</b> webhook, both to:
          <AddressRow value={endpoint} onCopy={() => copy(endpoint, "Webhook address copied.")} /></li>
        <li><label className="block">The webhook signing secret Shopify shows under the list{data.delivery?.hasSecret ? " (saved: leave empty to keep it)" : ""}<input className={field} type="password" autoComplete="off" value={secret} maxLength={200} onChange={(e) => setSecret(e.target.value)} /></label></li>
      </>}
      {shop === "generic" && <>
        <li>Send a POST request to:<AddressRow value={endpoint} onCopy={() => copy(endpoint, "Address copied.")} /></li>
        <li>With the header <code>Authorization: Bearer &lt;your key&gt;</code> and a JSON body <code>{"{ \"order_id\", \"email\", \"name\", \"refunded\" }"}</code>. Name and refunded are optional; <code>refunded: true</code> switches the link off.</li>
      </>}
    </ol>
    {key && <div className="space-y-2 rounded-xl bg-leaf-soft/60 p-3">
      <p className="text-xs font-medium text-leaf">Your delivery key. Keep it now: for security it is shown only once.</p>
      <input readOnly aria-label="Delivery key" value={key} onFocus={(e) => e.currentTarget.select()} className={field} />
      <Button size="sm" onClick={() => copy(key, "Key copied.")}><Copy /> Copy key</Button>
    </div>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={!!busy} onClick={() => void save(false)}>{saved ? "Save changes" : "Save and make a key"}</Button>
      {saved && <Button size="sm" variant="line" disabled={!!busy} onClick={() => void save(true)}>New key</Button>}
    </div>
    {saved && !key && shop !== "shopify" && <p className="text-xs text-muted-foreground">Your key was shown when it was made. Lost it? Make a new key and update your shop; the old key stops working.</p>}

    <div className="space-y-2 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Send a test, or add an order by hand</h3>
      <label className="block text-xs">Buyer email<input className={field} type="email" value={test.email} onChange={(e) => setTest({ ...test, email: e.target.value })} /></label>
      <label className="block text-xs">Buyer name (optional, stamped on their download)<input className={field} maxLength={80} value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} /></label>
      <Button size="sm" variant="line" disabled={!!busy || !test.email} onClick={() => void act("Sending", async () => {
        const r = await addManualOrder({ data: { id, email: test.email, name: test.name || undefined, orderRef: `test-${Date.now()}` }, headers: await productAuth() });
        setNote(r.status === "sent" ? `Sent to ${test.email}.` : r.status === "limit" ? "Not sent: daily limit reached." : "Already sent.");
        setTest({ email: "", name: "" });
        await load();
      })}>Send</Button>
    </div>

    <div className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Orders</h3>
      {data.orders.length === 0 ? <p className="text-xs text-muted-foreground">No orders yet.</p> : <div className="overflow-hidden rounded-2xl border border-border/80">
        {data.orders.map((o) => <div key={o.id} className="flex items-start justify-between gap-3 border-t border-border/70 px-3 py-2.5 first:border-t-0">
          <div className="min-w-0 text-xs">
            <p className={cn("truncate text-sm", o.refundedAt && "text-muted-foreground line-through")}>{o.name || o.email}</p>
            <p className="truncate text-muted-foreground">{o.orderRef} · {o.source}{o.name ? ` · ${o.email}` : ""}</p>
            <p className="text-muted-foreground">{o.refundedAt ? "Switched off" : o.note ?? (o.sentAt ? `Sent ${new Date(o.sentAt).toLocaleDateString()}` : "Not sent")} · Opened {o.opens} time{o.opens === 1 ? "" : "s"}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button size="xs" variant="quiet" disabled={!!busy} onClick={() => void act("Resending", async () => { await resendOrder({ data: { id, orderId: o.id }, headers: await productAuth() }); setNote("Sent again with a new link. The old link is off."); await load(); })}>Resend</Button>
            {!o.refundedAt && <Button size="xs" variant="quiet" disabled={!!busy} onClick={() => void act("Switching off", async () => { await revokeOrderLink({ data: { id, orderId: o.id }, headers: await productAuth() }); await load(); })}>Switch off</Button>}
          </div>
        </div>)}
      </div>}
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {note && !error && <p role="status" className="text-xs">{note}</p>}
    <p className="text-xs text-muted-foreground">Buyer email addresses are kept for you, the seller, to deliver and resend orders. Send delivery emails only to people who bought from you.</p>
  </div>;
}

function AddressRow({ value, hidden = false, onCopy }: { value: string; hidden?: boolean; onCopy: () => void }) {
  return <span className="mt-1.5 flex gap-2">
    <input readOnly aria-label="Address to paste" value={hidden ? "Save to make a key, then copy the full address" : value} onFocus={(e) => e.currentTarget.select()} className={field + " mt-0"} />
    {!hidden && <Button size="sm" variant="line" onClick={onCopy} aria-label="Copy address"><Copy /></Button>}
  </span>;
}
