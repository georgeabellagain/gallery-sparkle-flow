import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$slug")({
  validateSearch: (search: Record<string, unknown>): { preview?: string } => {
    const preview = search["preview"];
    return typeof preview === "string" && preview ? { preview } : {};
  },
  component: () => <Outlet />,
});
