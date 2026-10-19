import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Server-verified Personal entitlement for photo shoot downloads; never trusts the cached plan. */
export const canExportPhoto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerHasPersonal } = await import("./entitlements.server");
    return { allowed: await ownerHasPersonal(context.userId) };
  });
