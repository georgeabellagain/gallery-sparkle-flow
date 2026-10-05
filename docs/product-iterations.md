# Portfolia product iterations

Updated: 5 October 2026.

This log separates implemented work from future ideas. Changes use direct repository edits to avoid Lovable AI generation credits. Hosting and account charges are separate.

## Previous work — retained

The earlier flipbook and studio work was merged in PR #2, followed by further viewer refinements in main. The owner confirms that the 3D flipbook now works. This iteration starts from `e014f02b924f0fde2086495009f9005ff54ee7cd` and does not modify the renderer, studio lighting, materials, textures or demo implementation.

## Iteration 1 — first upload, pricing and trust

Status: merged into main on 5 October 2026 via PR #3, merge commit `4f95aa14bba28c65e26c3219bf828719d1a6af4d`. Live publication has not been verified.

- Put the existing PDF upload control directly in the homepage hero beside the existing studio demo.
- Explain the practical benefit of a shareable link, with clear no-sign-up preview guidance.
- Start newly created portfolios in flipbook mode. Preserve existing drafts' chosen modes and prevent homepage uploads from replacing published work.
- Show the creation preview before profile fields on mobile and keep it sticky on desktop.
- List flipbooks and embedding in Free pricing, explain the free credit and its removal with Personal, and give the paid action and price more prominence.
- Add an About section and expose the existing support email in the homepage and footer.
- Qualify selectable text and clickable PDF links in SEO copy: these work in Scroll and Page by page, not currently Flipbook.
- Supply the required plan-aware credit prop in creation and editing previews.

Validation: TypeScript (`npx tsc --noEmit`) and production build (`npm run build`) pass. Three focused store tests pass: new flipbook draft, replacement of an existing draft without losing its settings, and published-work protection. Build reports existing deprecation and bundle-size warnings. No signed-in cloud publishing or payment flows were exercised locally. Browser visual review and verification of the published site remain outstanding.

## Iteration 2 — cover images for shared links

Status: merged into main on 5 October 2026 via PR #4, merge commit `fd276a79f97a488c01d11694f3cf0ed9246de2d1`. Live publication has not been verified.

- Render a 1200 × 630 JPEG from page one during PDF upload, with the whole page visible against a neutral background.
- Reuse the existing private file bucket and browser-to-account transfer. No new service, dependency, public bucket or database migration.
- Add versioned, absolute cover URLs to Open Graph and large Twitter cards for code, personalised and legacy public addresses.
- Serve only the current published portfolio's derived cover through a server endpoint. Drafts, deleted portfolios, obsolete versions and arbitrary file paths return no image. Responses disable caching; social platforms can nevertheless retain their own copies.
- Replacing or deleting the PDF removes its old cover through the existing asset cleanup path. Unpublishing retains the private cover but closes public access.
- If rendering or saving the cover fails, the PDF upload still succeeds with a text-only card. Existing portfolios acquire covers on their next PDF upload/replacement; there is no automatic historical backfill.
- Search indexing stays owner-controlled and off by default.

Validation: production build and TypeScript pass. Eight focused tests cover upload state preservation plus share metadata, unpublished/legacy behaviour, replacement invalidation rejected storage paths, and endpoint publication/version checks before storage access. Actual social-crawler fetches and authenticated storage lifecycle still need deployment verification; no production credentials or user PDFs were used locally.

## Iteration 3 — owner and editor experience

Status: merged into main on 5 October 2026 via PR #5, merge commit `c81e57c8cb9fb1459989fb93f590dd64c52c14ba`. Deployed browser checks remain outstanding.

- Remove automatic editor redirects from code, personalised and legacy public portfolio routes. Owners see the published server version; explicit draft preview remains available separately.
- Retain the owner-only Edit portfolio / Dashboard controls. Edit selects the matching portfolio before navigation, including when another portfolio was active, and reports a storage failure instead of opening the wrong editor.
- Suppress visit/download tracking for recognised owners viewing their published page.
- Put appearance controls beside a sticky, scrollable preview on desktop; adapt the existing form to a single sidebar column without changing renderer or lighting logic.
- Put the preview first on mobile with Edit settings / Back to preview anchors and retain Full preview.
- Clean up a generated cover when a replacement upload is cancelled.

Validation: TypeScript and production build pass. Nine focused tests pass, including selecting another owned portfolio without losing the previously active work. Signed-in browser routing, responsive layout and analytics still need deployed browser checks. No renderer files or dependencies changed.

## Iteration 4 — discovery and comparison

Status: merged into main on 5 October 2026 via PR #6, merge commit `105f8829bd2003d9ba15415f9d8fa91e960f2311`. Deployed visual verification remains outstanding.

- Expand the Issuu alternative page with a comparison table, migration advice and explicit limits (PDF links in Flipbook, basic analytics, no discovery gallery and no password protection).
- Cite Squarespace's current Issuu integration documentation for its paid embedding requirement. Exact Issuu prices are deliberately omitted: third-party prices conflict and the official pricing page could not be retrieved. Link readers to current vendor terms instead.
- Add a clearly labelled architecture demonstration image and live example link to SEO landing pages, reusing an existing asset rather than generating images or inventing customer portfolios/testimonials.
- Add FAQPage structured data generated from the same questions and answers rendered on each SEO landing page, with script-safe escaping.
- Add SoftwareApplication and Free/Personal offer metadata to homepage and pricing using existing price constants. No fabricated reviews or ratings; structured data does not guarantee a search enhancement.
- Point SEO and pricing upload actions directly at the homepage upload area.

Validation: production build and TypeScript pass. No viewer, PDF handling, storage or payment logic changed. Live indexing and browser presentation are not verified. No changes to customer indexing or the sample's noindex status; example permission review and measured font optimisation remain deferred.

## Iteration 5 — Scarlett’s example, embedding and upload guidance

Status: merged into main on 5 October 2026 via PR #7, merge commit `d376ce7866d44c8524bcbf167bb5179510a9981c`. Browser verification remains outstanding.

- Owner requested the only account's saved flipbook as the public example. A read-only database query confirmed one published portfolio (`adu2v`), containing Scarlett Bushell's 14-page lookbook and both Simple/Studio looks.
- Replace the synthetic homepage animation and fictional `/p/sample` portfolio with the existing PDF reader loading that explicitly selected published portfolio. Its saved background, material, lighting, shadows and booklet settings are retained; visitors can choose Simple or Studio. No account record, original PDF or renderer is modified.
- Display the exact credit “Property of Scarlett Bushell 2026” beneath the example. Update sample metadata and SEO example links to identify Scarlett's fashion lookbook; remove the old architecture image from that example card.
- The example follows the published portfolio: replacement/settings updates flow through, while unpublishing/deletion makes it unavailable. No draft fallback or permanently public copy of the PDF is created. Loading/error/retry states are included.
- Add practical HTML/embed-block instructions and host-plan limitations in the embed modal. Preserve the saved initial Simple/Studio look in embeds instead of forcing Simple.
- Add web-export guidance beside uploads, with the original-preservation and 50 MB Personal limits explained. No automatic compression or external upload service.

Validation: TypeScript and production build pass. Database inspection was read-only. Real PDF rendering, responsive appearance and published-site verification remain outstanding. No Lovable AI generation calls or new dependencies.

## Iteration 6 — loading, autoplay, homepage and optimisation

Status: merged into main on 5 October 2026 via PR #8, merge commit `3ce6d5bf963fbf3053c8e3c1772c213229787c93`. Lovable sync confirmed and publication requested; the new homepage was subsequently verified on https://portfolia.site/.

- Start Scarlett's example in Studio while retaining its saved lighting, finish, background and other settings and the Simple/Studio switch.
- Keep the actual book canvas invisible while pages are preparing, including the non-3D fallback. Reveal the example only after real page readiness, rather than a timeout. Rendering failures expose a retry state.
- Automatically turn the example forwards, reverse at the end, and continue back to the start. Use the existing animated turn path with a 3.2-second reading pause. Pause offscreen/in hidden tabs and honour reduced-motion settings. Pointer, keyboard or wheel interaction permanently stops autoplay for that visit.
- Replace the old reading cards with six keyboard-accessible feature tabs: Page by page, Scroll, Your backdrop, Studio lighting, Easy sharing and Embed. Each has a distinct lightweight SVG illustration. The page-by-page visual now shows one page, with all illustrations clearly labelled as illustrative.
- Improve reader controls with dark-grey icons on light backplates or white icons on dark backplates. Picture brightness detection now requests CORS-safe image sampling; contrasting plates keep controls readable over mixed imagery or when sampling is unavailable.
- Reduce always-loaded Google font families from seven to two. Load optional portfolio heading fonts only when selected in the viewer/editor; code text uses its system monospace fallback.
- Generate missing cover images when signed-in owners open the sharing tools for an existing published portfolio. Reuse private storage, deduplicate concurrent attempts, check that the PDF still matches before attaching the cover, and expose retry feedback. This is owner-device backfill, not a bulk production-data migration.
- Add optional browser-worker PDF compression using pinned pdf-lib 1.17.1. It repacks PDF objects without rasterising pages or downsampling images, only offers a smaller result, and never replaces the original on disk. Show both sizes, offer a download to review, and require choosing the smaller copy before upload. Plan limits remain enforced; processing is bounded to 75 MB inputs and 60 seconds. Signed PDFs are rejected to avoid invalidating signatures. Already-compressed/image-heavy files may see little or no saving.
- Expand the free flipbook guide with export, compression, spreads, link behaviour, privacy and replacement advice.

Validation: TypeScript and production build pass. Twelve tests pass, including a compression fixture that retains page dimensions, content-stream bytes and URL annotations, never grows an already-compact file and rejects signatures. Existing upload-preservation and cover-access tests still pass. Bun dependency lock updated. Browser testing was attempted but blocked: the local browser download failed and the remote preview timed out. Autoplay, image contrast, mobile tabs and authenticated backfill therefore still require browser checks. No production account records or original portfolio files were changed, and no Lovable AI generation calls were made.

## Iteration 7 — live release verification

Status: release verification performed on 5 October 2026; no additional product changes.

- Confirmed Lovable synced the exact iteration-6 merge before publishing. Deployment request `a24f6135-c1e8-4b0f-b273-c681075fbc68` initially returned pending; the live custom domain subsequently served the new six-tab homepage and optional compression control.
- Live desktop browser confirmed the loading area has no blank white book, the example eventually becomes readable, Studio is selected, and Scarlett’s credit is present.
- Verified Studio lighting tab by click and Easy sharing by arrow-key navigation. Verified the example’s Next page control advances the displayed page.
- This cloud browser explicitly reports WebGL disabled. Its readable fallback works, but actual 3D rendering, lighting and the full forward/back autoplay cycle remain unverified. This is not evidence of a failure on a WebGL-capable device.
- Prior TypeScript, production build and twelve focused test results remain the code-validation baseline. No production account records were changed and no Lovable AI generation calls were used.

## Next — remaining release checks

Prioritise desktop/mobile and real-account checks of this batch before further feature work. Verify initial loading, the complete forward/back autoplay cycle and permanent interaction stop, Simple/Studio switching, optional compression acceptance, older-cover generation, sharing metadata and embedding. Confirm the actual live deployment separately from merging GitHub.

## Later — validate demand first

Measure whether the optional lossless optimiser meaningfully reduces upload failures before considering more aggressive image compression; preserve legibility and original files. Consider passwords, expiry, analytics and a job-hunt pass after validating demand and operating cost. A public social gallery, sounds and classroom tooling are deferred.

## Release checklist

- Keep this log updated with the PR, merge and live publication status for each batch.
- Before publication, review homepage and creation layouts on mobile and desktop.
- After publication, verify upload-to-preview, pricing links, footer anchors and support links.
- Treat successful GitHub merging and successful live deployment as separate facts.
