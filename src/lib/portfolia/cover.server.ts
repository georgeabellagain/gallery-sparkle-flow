import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Portfolio } from "./store";
import { readAccessPolicy, accessState } from "./access.server";
import { shareImageKey } from "./share-image";

export async function servePortfolioCover(code: string, url: string, db = supabaseAdmin): Promise<Response> {
        const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };
        const missing = () => new Response(null, { status: 404, headers });
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(code)) return missing();
        const { data: row, error } = await db.from("portfolios").select("owner_id, data").eq("code", code).eq("status", "published").maybeSingle();
        if (error) return new Response(null, { status: 503, headers });
        if (!row) return missing();
        const policy = await readAccessPolicy(code, db);
        if (policy?.password_hash || policy?.expires_at || accessState(policy) !== "open") return missing();
        const key = shareImageKey(row?.data as unknown as Portfolio | undefined);
        if (!row || !key || new URL(url).searchParams.get("v") !== key) return missing();
        const { data: blob, error: storageError } = await db.storage.from("portfolio-files").download(`${row.owner_id}/${key}`);
        if (storageError || !blob) return missing();
        return new Response(blob, { headers: { ...headers, "Content-Type": "image/jpeg" } });
}
