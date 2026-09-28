import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteHeader, DemoNote } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { getDoc, update } from "@/lib/portfolia/store";

export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => (typeof s["next"] === "string" ? { next: s["next"] } : {}),
  head: () => ({
    meta: [
      { title: "Sign in — Portfolia" },
      { name: "description", content: "Continue with the Portfolia demo account." },
      { property: "og:title", content: "Sign in — Portfolia" },
      { property: "og:description", content: "Continue with the Portfolia demo account." },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-sm px-5 py-20">
        <h1 className="display-title text-3xl">Sign in</h1>
        <p className="mt-3 text-sm text-muted-foreground">This prototype uses a demo account instead of real sign-in. There are no passwords and no account security.</p>
        <Button
          className="mt-6 w-full"
          onClick={() => {
            update((d) => ({ ...d, account: { signedIn: true } }));
            void navigate({ to: next === "create" && getDoc().portfolio?.status === "draft" ? "/create" : "/dashboard" });
          }}
        >
          Continue with demo account
        </Button>
        <DemoNote className="mt-8">Demo account: your work is kept in this browser only.</DemoNote>
      </main>
    </div>
  );
}
