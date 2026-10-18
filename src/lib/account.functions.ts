import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A Personal plan still renewing must be cancelled first, so deleting an account never leaves a live charge. */
export function deletionBlocked(sub: { status: string; cancel_at_period_end: boolean | null } | null) {
  return Boolean(sub && ["active", "trialing", "past_due"].includes(sub.status) && !sub.cancel_at_period_end);
}

/**
 * Deletes the signed-in account: every stored file, every portfolio (with its access settings, domains and visit
 * events, which cascade), feedback, and the sign-in itself. Billing records stay, as the privacy notice says,
 * because tax law requires them.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }) => {
    const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    setResponseHeader("Cache-Control", "private, no-store");
    const request = getRequest();
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Please reload and try again.");
    const uid = context.userId;
    for (const env of ["live", "sandbox"]) {
      const { data: sub, error } = await (supabaseAdmin as any).from("subscriptions").select("status,cancel_at_period_end")
        .eq("user_id", uid).eq("environment", env).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error("Couldn’t check your plan. Nothing was deleted.");
      if (deletionBlocked(sub)) throw new Error("Cancel Personal in Manage billing first. Nothing was deleted.");
    }
    const bucket = supabaseAdmin.storage.from("portfolio-files");
    for (let guard = 0; guard < 100; guard++) {
      const { data: files, error } = await bucket.list(uid, { limit: 1000 });
      if (error) throw new Error("Couldn’t delete your files. Nothing else was deleted.");
      if (!files?.length) break;
      const { error: removeError } = await bucket.remove(files.map((f) => `${uid}/${f.name}`));
      if (removeError) throw new Error("Couldn’t delete your files. Please try again.");
    }
    const { error: portfolioError } = await supabaseAdmin.from("portfolios").delete().eq("owner_id", uid);
    if (portfolioError) throw new Error("Your files were deleted but your portfolios could not be. Please try again.");
    await (supabaseAdmin as any).from("feedback").delete().eq("user_id", uid);
    const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (userError) throw new Error("Your portfolios were deleted but the sign-in could not be. Please email hello@portfolia.site.");
    return { ok: true };
  });
