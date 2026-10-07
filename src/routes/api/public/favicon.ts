import { createFileRoute } from "@tanstack/react-router";

const HOST = /^(?=.{3,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/i;

/**
 * A website's icon, fetched by the server and handed back from our own address. The visitor's browser never
 * contacts a third party, and the page can paint the icon into the book without the browser refusing it.
 */
export const Route = createFileRoute("/api/public/favicon")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = (new URL(request.url).searchParams.get("host") ?? "").toLowerCase();
        if (!HOST.test(host)) return new Response(null, { status: 400 });
        try {
          const upstream = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`, {
            signal: AbortSignal.timeout(5000),
          });
          const type = upstream.headers.get("content-type") ?? "";
          if (!upstream.ok || !type.startsWith("image/")) return new Response(null, { status: 404 });
          const bytes = await upstream.arrayBuffer();
          if (bytes.byteLength > 200_000) return new Response(null, { status: 404 });
          return new Response(bytes, {
            headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
          });
        } catch {
          return new Response(null, { status: 404 });
        }
      },
    },
  },
});
