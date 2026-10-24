import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const code = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
/** The leads table and rate-limit function are not in the generated database types, so they are reached loosely. */
type LooseQuery = PromiseLike<{ data: unknown; error: unknown }> & {
  insert(row: unknown): PromiseLike<{ error: unknown }>;
  select(columns: string): LooseQuery; eq(column: string, value: unknown): LooseQuery; delete(): LooseQuery;
  order(column: string, options: { ascending: boolean }): LooseQuery; limit(n: number): LooseQuery;
};
const loose = (client: unknown) => client as { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>; from(table: string): LooseQuery };
type StoredPortfolio = { leadForm?: unknown; pdf?: { pages?: number }; name?: string; profile?: { name?: string } } | undefined;
const answers = z.object({
  email: z.string().max(254),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
});

/**
 * A reader leaves their details in a portfolio's lead form. Nothing from the browser is trusted: the portfolio must be
 * published with its form on, the answers must fit that form, its owner must have Personal, and each visitor (and
 * each portfolio) is rate limited. The owner gets an email; the visitor's IP address is never stored.
 */
export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code, page: z.number().int().min(1).max(10000), answers }).parse(d))
  .handler(async ({ data }) => {
    const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readableLeadForm, leadProblem } = await import("./lead-form");
    const { createHash } = await import("node:crypto");
    setResponseHeader("Cache-Control", "private, no-store");
    const request = getRequest();
    if (request.headers.get("origin") !== new URL(request.url).origin) return { ok: false, message: "Please reload the page and try again." };
    const ip = request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
    const bucket = createHash("sha256").update(`lead:${data.code}:${ip}`).digest("hex");
    for (const key of [`global:lead:${data.code}`, bucket]) {
      const { data: allowed, error } = await loose(supabaseAdmin).rpc("portfolio_unlock_attempt", { bucket_key: key });
      if (error || !allowed) return { ok: false, message: "Too many tries. Please wait a few minutes." };
    }
    const { data: row } = await supabaseAdmin.from("portfolios").select("code, owner_id, username, data").eq("code", data.code).eq("status", "published").maybeSingle();
    const portfolio = row?.data as StoredPortfolio;
    const form = readableLeadForm(portfolio?.leadForm, portfolio?.pdf?.pages ?? 0);
    if (!row || !form?.enabled) return { ok: false, message: "This form isn't taking replies just now." };
    const problem = leadProblem(form, data.answers);
    if (problem) return { ok: false, message: problem };
    const { ownerHasPersonal } = await import("./entitlements.server");
    if (!(await ownerHasPersonal(row.owner_id, supabaseAdmin))) return { ok: false, message: "This form isn't taking replies just now." };
    // Only the fields the form shows are kept.
    const pick = (k: "name" | "phone" | "company" | "message") => (form.fields[k] ? data.answers[k]?.trim() || null : null);
    const country = request.headers.get("cf-ipcountry")?.slice(0, 2) || null;
    const lead = { portfolio_code: row.code, email: data.answers.email.trim(), name: pick("name"), phone: pick("phone"), company: pick("company"), message: pick("message"), page: data.page, country };
    const { error } = await loose(supabaseAdmin).from("portfolio_leads").insert(lead);
    if (error) return { ok: false, message: "Your details couldn't be sent. Please try again." };
    try {
      await emailOwner(row.owner_id, portfolio?.name?.trim() || portfolio?.profile?.name?.trim() || "Your portfolio", lead);
    } catch (e) {
      // A failed email never troubles the reader; the lead is saved.
      console.error("[lead-email]", e instanceof Error ? e.message : e);
    }
    return { ok: true, message: "" };
  });

async function emailOwner(ownerId: string, portfolioName: string, lead: { email: string; name: string | null; phone: string | null; company: string | null; message: string | null }) {
  const React = await import("react");
  const { sendLovableEmail } = await import("@lovable.dev/email-js");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { NewLeadEmail } = await import("@/lib/email-templates/new-lead");
  const { render } = await import("@react-email/render");
  const { data: owner } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  const to = owner.user?.email;
  if (!to) return;
  const lines = [
    lead.name && `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone && `Phone: ${lead.phone}`,
    lead.company && `Company: ${lead.company}`,
    lead.message && `Message: ${lead.message}`,
  ].filter((l): l is string => Boolean(l));
  const element = React.createElement(NewLeadEmail, { siteName: "Portfolia", portfolioName, leadsUrl: "https://portfolia.site/dashboard", lines });
  await sendLovableEmail({
    to,
    from: { name: "Portfolia", address: "noreply@portfolia.site" },
    sender_domain: "notify.portfolia.site",
    subject: `New lead from ${portfolioName}`,
    html: await render(element),
    text: await render(element, { plainText: true }),
    purpose: "transactional",
    label: "portfolio-lead",
    idempotency_key: `lead:${ownerId}:${lead.email}:${new Date().toISOString().slice(0, 16)}`,
  }, { apiKey: process.env["LOVABLE_API_KEY"]!, sendUrl: process.env["LOVABLE_SEND_URL"] });
}

/** The leads left in one of the signed-in owner's portfolios, newest first. */
export const ownerLeads = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ code }).parse(d)).handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const { data: row } = await context.supabase.from("portfolios").select("code").eq("code", data.code).eq("owner_id", context.userId).maybeSingle();
  if (!row) throw new Error("Save this portfolio to your account first.");
  const { data: leads, error } = await loose(supabaseAdmin).from("portfolio_leads").select("id, created_at, name, email, phone, company, message, page, country").eq("portfolio_code", data.code).order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error("Couldn't load your leads.");
  return { leads: (leads ?? []) as Array<{ id: string; created_at: string; name: string | null; email: string; phone: string | null; company: string | null; message: string | null; page: number | null; country: string | null }> };
});

/** Removes one lead from one of the signed-in owner's portfolios. */
export const deleteLead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ code, id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  if (req.headers.get("origin") !== new URL(req.url).origin) throw new Error("Please reload and try again.");
  const { data: row } = await context.supabase.from("portfolios").select("code").eq("code", data.code).eq("owner_id", context.userId).maybeSingle();
  if (!row) throw new Error("Save this portfolio to your account first.");
  const { error } = await loose(supabaseAdmin).from("portfolio_leads").delete().eq("id", data.id).eq("portfolio_code", data.code);
  if (error) throw new Error("Couldn't remove that lead.");
  return { ok: true };
});
