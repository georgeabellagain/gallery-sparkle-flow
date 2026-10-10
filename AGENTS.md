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
- Flipbook rendering lives in BookView.tsx and book-scene.ts. One persistent Three.js scene lights both stationary pages and the turning sheet. Simple/Studio settings are viewer-local; Studio uses physically shaded paper and bundled CC0 photographic backdrops. Phones use the same two-page book and a camera that follows each page; corner cues are desktop-only and hide before turns. Page textures load before animation and are bounded to eight cached PDF pages.
- Published embeds use `/embed/<code>` and receive route-specific framing and no-index response headers in the server entry. Why: only the compact viewer should be frameable and excluded from search.
- Profile details and portfolio appearance are edited on separate routes; own portfolio cards open the appearance editor while explicit Preview opens the visitor view. Why: creator navigation should distinguish identity from presentation.
- Flipbook camera zoom and cursor anchoring live in the persistent book scene; the viewer toolbar owns the shared zoom value. Why: wheel and button zoom must remain coordinated while turns can smoothly reset the camera.
- Desktop page-turn drag targets cover the full left and right book sides at normal zoom; zoomed dragging remains camera panning. Why: readers can pull pages anywhere without losing positioning controls.
- Viewer mode and Flipbook appearance availability are creator-owned portfolio settings; visitors may switch only among enabled choices, while Studio material and lighting remain fixed by the creator. Why: shared links must preserve the intended presentation.
- A lost flipbook graphics context shows a readable canvas page and restores the scene when graphics return; the homepage example uses smaller page textures. Why: temporary GPU failures must not hide the portfolio or leave a permanent warning.
- Website links use one shared PDF-page collection; full-page readers map split-leaf coordinates and display icons inside the committed artwork layer. Why: every viewing style must preserve placement without duplicating links or showing destination links before a page is ready.
- Page tabs may store an optional edge-centre fraction; geometry clamps the whole tab to the edge and omission retains automatic spacing. Why: creators can reposition tabs without changing existing portfolios.
