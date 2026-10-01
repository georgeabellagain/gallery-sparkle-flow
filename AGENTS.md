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
- PDF upload allowances are plan-based: Free accepts up to 10 MB and Personal up to 50 MB, so storage value is clear and enforceable.
- Portfolios live in the `portfolios` table (full Portfolio JSON in `data`) and files in private `portfolio-files/<uid>/<key>`; store.ts keeps a localStorage/IndexedDB cache and cloud.ts syncs it. Why: links must work on any device.
- Public portfolio pages load via getPublicPortfolio (publishable read + admin-signed file URLs); drafts are never returned.
- PDF viewer renders with pdfjs-dist directly; don't import pdf_viewer.css (Lightning CSS rejects its relative urls) — text-layer rules are copied into styles.css.
- Personalised portfolios use root paths (`/name`); `/p/code` remains the permanent free address and `/u/name` remains compatible with old links.
- Payments: Paddle via connector gateway; subscriptions table synced by webhook at /api/public/payments/webhook; useAccount mirrors subscription into the portfolio plan field, which syncs to the account.
- Portfolio QR codes are generated locally in the browser from the active public link and downloaded as high-resolution PNGs; no third-party QR service receives portfolio URLs.
- Flipbook turns use one persistent WebGL sheet with colour-space-correct textures and fold-only shading; mobile uses single pages and desktop uses spreads. Why: this avoids seams, preserves artwork colour and keeps turns smooth.
- Published embeds use `/embed/<code>` and receive route-specific framing and no-index response headers in the server entry. Why: only the compact viewer should be frameable and excluded from search.
- Studio flipbook materials and tabletops are procedural (src/lib/portfolia/surface.ts): lit height-map tiles soft-light blended over pages and into the WebGL sheet. Why: no licensed image assets needed and artwork colour is preserved.
