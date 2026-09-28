import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { SiteHeader, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
import { DropZone } from "@/components/pf/DropZone";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { PRICE, startPortfolio, useDoc } from "@/lib/portfolia/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portfolia — Your portfolio. One simple link." },
      { name: "description", content: "Upload your PDF, add your details, and share your work." },
      { property: "og:title", content: "Portfolia — Your portfolio. One simple link." },
      { property: "og:description", content: "Upload your PDF, add your details, and share your work." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const doc = useDoc();
  const [err, setErr] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const published = doc.portfolio?.status === "published";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          doc.account.signedIn ? (
            <Link to="/dashboard" className="hover:underline underline-offset-4">Dashboard</Link>
          ) : (
            <Link to="/signin" className="hover:underline underline-offset-4">Sign in</Link>
          )
        }
      />
      <main className="flex-1">
        <section className="shell grid gap-12 pt-16 pb-16 sm:pt-24 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <h1 className="display-title text-5xl leading-[1.05] sm:text-6xl">Your portfolio. One simple link.</h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Upload your PDF, add your details, and share your work.
            </p>
            <p className="mt-6 text-sm">
              <Link to="/p/$slug" params={{ slug: "sample" }} className="underline underline-offset-4">
                View an example portfolio
              </Link>
            </p>
          </div>
          <div>
            {published ? (
              <div className="border border-border p-8 text-sm">
                <p>Your portfolio is published.</p>
                <Button asChild className="mt-4"><Link to="/dashboard">Open dashboard</Link></Button>
              </div>
            ) : (
              <DropZone
                onAccepted={(pdf) => {
                  if (!startPortfolio(pdf)) return setErr("Your browser refused to save. Free some storage and try again.");
                  void navigate({ to: "/create" });
                }}
              />
            )}
            {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
            <p className="mt-3 text-xs text-muted-foreground">No account needed to upload and preview.</p>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-14">
            <h2 className="text-sm font-medium">Plans</h2>
            <div className="mt-6 grid max-w-3xl gap-px bg-border sm:grid-cols-2">
              <Plan name="Free" price="£0" items={["One PDF portfolio", "Address like portfolia.com/p/8fh2k", "Profile and contact links", "Clean PDF viewer", "Basic visit statistics", "Replace your PDF, keep your link", "Small “Hosted on Portfolia” credit"]} />
              <Plan
                name="Personal"
                price={`${PRICE.month}/month or ${PRICE.year}/year`}
                items={["Everything in Free", "Personalised address like georgebell.portfolia.com", "Portfolia credit removed"]}
                action={<Button variant="line" size="sm" className="mt-5" onClick={() => setUpgrade(true)}>Choose Personal</Button>}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Provisional pricing. Both plans accept PDFs up to 25 MB. Addresses shown are illustrative.</p>
            <DemoNote className="mt-8 max-w-2xl">{LOCAL_NOTE}</DemoNote>
          </div>
        </section>
      </main>
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
    </div>
  );
}

function Plan({ name, price, items, action }: { name: string; price: string; items: string[]; action?: React.ReactNode }) {
  return (
    <div className="bg-background p-6">
      <h3 className="text-base font-medium">{name}</h3>
      <p className="text-sm text-muted-foreground">{price}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />{i}</li>
        ))}
      </ul>
      {action}
    </div>
  );
}
