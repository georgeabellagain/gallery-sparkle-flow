import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { SiteFooter, SiteHeader, PrototypeNote } from "@/components/portfolia/SiteChrome";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { storageUsed, useDoc } from "@/lib/portfolia/store";
import { formatBytes } from "@/lib/portfolia/assets";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plans — Portfolia" },
      {
        name: "description",
        content: "A provisional comparison of the Free plan and the Pro concept. No billing in this prototype.",
      },
      { property: "og:title", content: "Plans — Portfolia" },
      { property: "og:description", content: "Free today, Pro as a concept. Nothing is charged." },
    ],
  }),
  component: Plans,
});

const free = [
  "One portfolio containing multiple projects",
  "All five viewing styles",
  "Core design controls",
  "PDF import",
  "Image details and external links",
  "Unlisted sharing",
  "Optional discovery in Explore",
  "A configurable storage allowance",
];

const pro = [
  "More storage",
  "Multiple portfolios and client-specific versions",
  "Custom domain connection",
  "Removal of Portfolia branding",
  "Visitor analytics",
  "Password-protected sharing",
];

function Plans() {
  const doc = useDoc();
  const [open, setOpen] = useState(false);
  const used = storageUsed(doc);
  const allowance = doc.storageAllowanceMb * 1024 * 1024;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-5 py-14">
          <h1 className="display-title text-4xl">Plans</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Provisional and under discussion. Prices are not decided, and nothing on this page can be
            purchased.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <section className="border border-border p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-medium">Free</h2>
                <span className="text-xs text-muted-foreground">Available in this prototype</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {free.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="label-xs">Your storage</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBytes(used)} of {doc.storageAllowanceMb} MB
                  </span>
                </div>
                <Progress value={Math.min(100, (used / allowance) * 100)} className="mt-2 h-1" />
                <p className="mt-2 text-xxs text-muted-foreground">
                  The allowance is a configurable prototype number, not a final limit. No plan offers
                  unlimited storage.
                </p>
              </div>
            </section>

            <section className="border border-border p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-medium">Pro</h2>
                <span className="text-xs text-muted-foreground">Concept — planned features</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {pro.map((f) => (
                  <li key={f} className="flex gap-2.5 text-muted-foreground">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-border-strong" />
                    <span>
                      {f} <span className="text-xxs">· planned</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant="line" onClick={() => setOpen(true)}>
                About the Pro concept
              </Button>
              <p className="mt-3 text-xxs text-muted-foreground">
                None of these are built yet. Every prototype feature stays available for testing on
                Free.
              </p>
            </section>
          </div>

          <div className="mt-10 max-w-2xl space-y-4">
            <h3 className="text-sm font-medium">If plans change later</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Any future upgrade or downgrade would explain its consequences before you commit — for
              example which portfolio stays visible if a storage allowance drops. Cancelling a plan
              would never immediately delete your work; you would keep access to export your
              originals and content.
            </p>
            <PrototypeNote>
              No payment provider, checkout or analytics is connected to this prototype.
            </PrototypeNote>
          </div>
        </div>
      </main>
      <SiteFooter />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prototype information — no checkout</DialogTitle>
            <DialogDescription>
              This button exists to test the shape of the offer, not to sell anything.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Pro is a concept: more storage, multiple portfolios and client versions, custom domains,
              branding removal, visitor analytics and password-protected sharing. None of it is
              implemented.
            </p>
            <p>
              There is no price yet, no billing integration, and nothing will be charged. Feedback on
              which of these matter most is the point of this page.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
