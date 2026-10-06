import { foldoutKeys } from "./foldouts";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { Portfolio } from "./store";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PublicPortfolio = { portfolio: Portfolio; urls: Record<string, string> } | null;

/** A published portfolio plus short-lived links to its files. Drafts are never returned. */
export const getPublicPortfolio = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ by: z.enum(["code", "username"]), value: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }): Promise<PublicPortfolio> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requestAccess } = await import("./access.server");
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    const q = supabaseAdmin.from("portfolios").select("code, owner_id, data").eq("status", "published");
    const { data: row } = await (data.by === "code" ? q.eq("code", data.value) : q.eq("username", data.value.toLowerCase())).maybeSingle();
    if (!row) return null;
    const access = await requestAccess(row.code);
    if (access.state !== "open") return null;
    const p = row.data as unknown as Portfolio;
    const keys = [p.pdf?.blobKey, p.profile?.photoKey, p.plan === "personal" ? p.profile?.cv?.blobKey : undefined, p.plan === "personal" ? p.style?.bannerKey : undefined, p.viewer?.backgroundKey, ...foldoutKeys(p.pdf)].filter(Boolean) as string[];
    const urls: Record<string, string> = {};
    if (keys.length) {
      // Signing needs privileged access; only files referenced by this published portfolio are signed.
      if (access.policy?.password_hash || access.policy?.expires_at) {
        for (const key of keys) urls[key] = `/api/public/portfolio-file/${encodeURIComponent(row.code)}?asset=${encodeURIComponent(key)}`;
      } else {
      const { data: signed } = await supabaseAdmin.storage.from("portfolio-files").createSignedUrls(keys.map((k) => `${row.owner_id}/${k}`), 3600);
      for (const s of signed ?? []) if (s.signedUrl && s.path) urls[s.path.split("/").slice(1).join("/")] = s.signedUrl;
      }
    }
    return { portfolio: { ...p, code: row.code, ...(access.policy?.password_hash || access.policy?.expires_at ? { searchIndexing: false, pdf: p.pdf ? { ...p.pdf, coverKey: undefined } : p.pdf } : {}) }, urls };
  });

export const listIndexablePortfolios = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("portfolios").select("code, username, updated_at, data").eq("status", "published").eq("search_indexing", true).limit(5000);
  return (data ?? []).map((r) => ({
    path: r.username && (r.data as unknown as Portfolio).plan === "personal" ? `/${r.username}` : `/p/${r.code}`,
    lastmod: r.updated_at,
  }));
});
