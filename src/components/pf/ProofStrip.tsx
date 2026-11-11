import { CARE_POINTS, PROOF_FEATURED, PROOF_FIGURES, PROOF_QUOTES } from "@/lib/portfolia/proof";

/** Real figures and quotes once the owner adds them (proof.ts); until then nothing is shown. */
export function ProofStrip() {
  const figures = PROOF_FIGURES.slice(0, 3), quotes = PROOF_QUOTES.slice(0, 3);
  if (!figures.length && !quotes.length) return null;
  return <section aria-label="Portfolia in use" className="rule-t">
    <div className="shell max-w-6xl py-12">
      {figures.length > 0 && <dl className="grid gap-6 sm:grid-cols-3">{figures.map(f => <div key={f.label}><dt className="text-sm text-muted-foreground">{f.label}</dt><dd className="display-title text-4xl">{f.value}</dd><dd className="text-xs text-muted-foreground">As of {f.asOf}</dd></div>)}</dl>}
      {quotes.length > 0 && <div className="mt-10 grid gap-6 sm:grid-cols-3">{quotes.map(q => <figure key={q.name} className="rounded-2xl border border-border bg-card p-6"><blockquote className="text-[15px] leading-relaxed">“{q.text}”</blockquote><figcaption className="mt-4 text-sm text-muted-foreground">{q.name}{q.role ? `, ${q.role}` : ""}</figcaption></figure>)}</div>}
      {PROOF_FEATURED && <p className="mt-8 text-sm"><a href={PROOF_FEATURED.href} className="underline underline-offset-4">{PROOF_FEATURED.title}</a> <span className="text-muted-foreground">· {PROOF_FEATURED.credit}</span></p>}
    </div>
  </section>;
}

/** "How we look after your work": statements that are true today, so this row can always ship. */
export function CareRow() {
  return <section aria-labelledby="care-title" className="rule-t">
    <div className="shell max-w-6xl py-16 sm:py-24">
      <h2 id="care-title" className="display-title text-3xl sm:text-4xl">How we look after your work</h2>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CARE_POINTS.map(c => <li key={c.title} className="rounded-2xl border border-border bg-card p-6"><h3 className="text-base font-medium">{c.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p></li>)}
      </ul>
    </div>
  </section>;
}
