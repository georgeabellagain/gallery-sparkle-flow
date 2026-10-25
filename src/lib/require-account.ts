import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A signed-in owner, with two-step sign-in finished when the account has it turned on: a session that has only
 * passed the password (or Google/Apple) step of a two-step account is refused, as the database refuses it too.
 */
export const requireAccount = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    if (context.claims.aal !== "aal2") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: context.userId });
      if (error) throw new Error("Couldn’t check your sign-in. Please try again.");
      if (data.factors.some((f) => f.status === "verified")) throw new Error("Unauthorized: enter the code from your authenticator app to continue.");
    }
    return next();
  });
