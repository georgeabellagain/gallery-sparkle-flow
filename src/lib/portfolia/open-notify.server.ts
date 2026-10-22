import * as React from "react";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PortfolioOpenedEmail } from "@/lib/email-templates/portfolio-opened";
import { ownerHasPersonal } from "./entitlements.server";
import { countryName, deviceOf, isBotAgent, OPEN_EMAIL_DAILY, OPEN_EMAIL_GAP_HOURS, OPEN_EVENT_WINDOW_MS, openedWhen } from "./open-notify";
import type { Portfolio } from "./store";

const SITE_NAME = "Portfolia";
const SENDER_DOMAIN = "notify.portfolia.site";
const SITE_URL = "https://portfolia.site";

export type OpenRequest = { code: string; visitor: string; userAgent: string | null; country: string | null; authorization: string | null };

/**
 * Emails a Personal owner who opted in that their published portfolio was opened. Visits are recorded by the browser,
 * so nothing here trusts the caller: the visit must exist, bots and the owner are ignored, and a per-portfolio lock
 * keeps to one email every few hours. Returns what happened, for logs and tests; it never throws to the visitor.
 */
export async function notifyPortfolioOpened(req: OpenRequest, now = new Date()): Promise<"sent" | "counted" | "skipped"> {
  if (isBotAgent(req.userAgent)) return "skipped";
  const { data: row } = await supabaseAdmin.from("portfolios").select("code, owner_id, username, data").eq("code", req.code).eq("status", "published").maybeSingle();
  const p = row?.data as unknown as Portfolio | undefined;
  if (!row || !p?.notifyOnOpen) return "skipped";
  // The owner looking at their own portfolio is not news.
  const token = req.authorization?.startsWith("Bearer ") ? req.authorization.slice(7) : null;
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (data.user?.id === row.owner_id) return "skipped";
  }
  const { data: visit } = await supabaseAdmin.from("portfolio_events").select("id")
    .eq("portfolio_code", row.code).eq("kind", "visit").eq("visitor", req.visitor)
    .gte("created_at", new Date(now.getTime() - OPEN_EVENT_WINDOW_MS).toISOString()).limit(1).maybeSingle();
  if (!visit) return "skipped";
  if (!(await ownerHasPersonal(row.owner_id))) return "skipped";

  const { data: claim, error } = await supabaseAdmin.rpc("claim_open_notification" as never, { p_code: row.code, p_gap: `${OPEN_EMAIL_GAP_HOURS} hours`, p_daily: OPEN_EMAIL_DAILY } as never);
  const decision = (claim as unknown as Array<{ send: boolean; opens: number }> | null)?.[0];
  if (error || !decision) return "skipped";
  if (!decision.send) return "counted";

  const { data: owner } = await supabaseAdmin.auth.admin.getUserById(row.owner_id);
  const to = owner.user?.email;
  if (!to) return "skipped";
  const name = p.name?.trim() || p.profile?.name?.trim() || "Your portfolio";
  const element = React.createElement(PortfolioOpenedEmail, {
    siteName: SITE_NAME,
    portfolioName: name,
    portfolioUrl: row.username ? `${SITE_URL}/u/${encodeURIComponent(row.username)}` : `${SITE_URL}/p/${encodeURIComponent(row.code)}`,
    settingsUrl: `${SITE_URL}/dashboard`,
    when: openedWhen(now),
    country: countryName(req.country),
    device: deviceOf(req.userAgent ?? ""),
    opens: decision.opens,
  });
  const { render } = await import("@react-email/render");
  await sendLovableEmail({
    to,
    from: { name: SITE_NAME, address: "noreply@portfolia.site" },
    sender_domain: SENDER_DOMAIN,
    subject: `Someone opened ${name}`,
    html: await render(element),
    text: await render(element, { plainText: true }),
    purpose: "transactional",
    label: "portfolio-opened",
    // One email per portfolio per claim, even if this request is retried.
    idempotency_key: `opened:${row.code}:${now.toISOString().slice(0, 16)}`,
  }, { apiKey: process.env["LOVABLE_API_KEY"]!, sendUrl: process.env["LOVABLE_SEND_URL"] });
  return "sent";
}
