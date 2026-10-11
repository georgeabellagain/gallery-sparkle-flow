import { SeoLanding } from "./SeoLanding";
import { IndustryUpload } from "./IndustryUpload";
import { COMPETITORS, COMPARISON_CHECKED, comparisonContent, type Competitor } from "@/lib/portfolia/competitors";

export function CompetitorComparison({ competitor: c }: { competitor: Competitor }) {
  return <SeoLanding c={comparisonContent(c)}>
    <section className="rule-t"><div className="shell max-w-4xl py-12">
      <p className="text-xs tracking-wide text-muted-foreground">Portfolia vs {c.name} · Reviewed {COMPARISON_CHECKED}</p>
      <h2 className="mt-4 display-title text-2xl">The difference that matters</h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{c.focus}</p>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-border" tabIndex={0} aria-label="Comparison table; scroll horizontally on small screens">
        <table className="w-full min-w-[600px] text-left text-sm">
          <caption className="sr-only">Portfolia and {c.name}: selected workflow and plan differences</caption>
          <thead className="bg-muted"><tr><th scope="col" className="p-4">What you need</th><th scope="col" className="p-4">Portfolia</th><th scope="col" className="p-4">{c.name}</th></tr></thead>
          <tbody>{c.rows.map(row => <tr key={row.topic} className="border-t border-border"><th scope="row" className="p-4 align-top font-medium">{row.topic}</th><td className="p-4 align-top leading-6 text-muted-foreground">{row.portfolia}</td><td className="p-4 align-top leading-6 text-muted-foreground">{row.other} <a className="text-xs underline underline-offset-4" href={c.sources[row.source]!.url} aria-label={`Source for ${c.name}: ${row.topic}`}>Source</a></td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-5 text-sm leading-7 text-muted-foreground">{c.price}</p>
      <h2 className="mt-9 display-title text-2xl">Which fits your next project?</h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{c.choose}</p>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">Portfolia currently has no public discovery gallery, in-page video/audio player, lead forms, custom domains or team approval workflow. Its visit statistics are basic. A personalised Portfolia address and a link to your store are different from own-domain hosting and an integrated checkout.</p>
      <div className="mt-8"><IndustryUpload /></div>
      <aside className="mt-8 rounded-xl bg-muted/50 p-5 text-xs leading-6 text-muted-foreground">
        <p>Independent comparison by Portfolia, not affiliated with {c.name}. Selected capabilities, not an exhaustive audit. Prices are quoted in the provider’s currency and billing cycle; features and checkout totals can change.</p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">{c.sources.map(source => <li key={source.url}><a href={source.url} className="underline underline-offset-4">{source.label}</a></li>)}</ul>
      </aside>
      <nav aria-label="Other flipbook comparisons" className="mt-8 flex flex-wrap gap-3 text-xs"><a href="/flipbook-alternatives" className="underline underline-offset-4">All comparisons</a>{COMPETITORS.filter(other => other.slug !== c.slug).map(other => <a key={other.slug} href={`/${other.slug}`} className="underline underline-offset-4">{other.name}</a>)}</nav>
    </div></section>
  </SeoLanding>;
}
