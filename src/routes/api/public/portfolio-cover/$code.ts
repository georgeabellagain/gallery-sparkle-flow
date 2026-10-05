import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/portfolio-cover/$code")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { servePortfolioCover } = await import("@/lib/portfolia/cover.server");
        return servePortfolioCover(params.code, request.url);
      },
    },
  },
});
