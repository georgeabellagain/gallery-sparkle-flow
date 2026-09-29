<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Portfolia is a focused PDF-hosting prototype (brief v2): no editor, templates or discovery — scope was deliberately reduced by the user.
- State lives in src/lib/portfolia/store.ts (localStorage) with PDFs/photos in IndexedDB; one active portfolio per browser — prototype has no backend.
- PDF viewer renders with pdfjs-dist directly; don't import pdf_viewer.css (Lightning CSS rejects its relative urls) — text-layer rules are copied into styles.css.
- Personalised portfolios use root paths (`/name`); `/p/code` remains the permanent free address and `/u/name` remains compatible with old links.
- Payments: Paddle via connector gateway; subscriptions table synced by webhook at /api/public/payments/webhook; useAccount mirrors subscription into local plan. Why: portfolios are still browser-local.
