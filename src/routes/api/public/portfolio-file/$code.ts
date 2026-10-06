import { createFileRoute } from "@tanstack/react-router";
import { servePortfolioFile } from "@/lib/portfolia/file.server";
export const Route = createFileRoute("/api/public/portfolio-file/$code")({ staticData: { sitemap: false }, server: { handlers: { GET: ({ params, request }) => servePortfolioFile(params.code, request.url) } } });
