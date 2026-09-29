import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";

const prose =
  "text-[15px] leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:leading-relaxed [&_table]:mt-3 [&_table]:w-full [&_th]:text-left [&_th]:py-1.5 [&_th]:pr-4 [&_td]:py-1.5 [&_td]:pr-4 [&_td]:align-top";

export function LegalPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:py-16">
        <article className={prose}>{children}</article>
      </main>
      <SiteFooter />
    </div>
  );
}
