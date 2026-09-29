import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ message: z.string().trim().min(2).max(4000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("feedback").insert({ user_id: context.userId, message: data.message });
    if (error) throw new Error("Couldn’t send your feedback — please try again.");
    return { ok: true };
  });
