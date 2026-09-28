import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: typeof search.preview === "string" ? search.preview : undefined,
  }),
  component: () => <Outlet />,
});
