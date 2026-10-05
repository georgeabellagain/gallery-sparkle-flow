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

Status: implemented on the iteration-2 branch; not yet merged or verified live.

- Render a 1200 × 630 JPEG from page one during PDF upload, with the whole page visible against a neutral background.
- Reuse the existing private file bucket and browser-to-account transfer. No new service, dependency, public bucket or database migration.
- Add versioned, absolute cover URLs to Open Graph and large Twitter cards for code, personalised and legacy public addresses.
- Serve only the current published portfolio's derived cover through a server endpoint. Drafts, deleted portfolios, obsolete versions and arbitrary file paths return no image. Responses disable caching; social platforms can nevertheless retain their own copies.
- Replacing or deleting the PDF removes its old cover through the existing asset cleanup path. Unpublishing retains the private cover but closes public access.
- If rendering or saving the cover fails, the PDF upload still succeeds with a text-only card. Existing portfolios acquire covers on their next PDF upload/replacement; there is no automatic historical backfill.
- Search indexing stays owner-controlled and off by default.

Validation: production build and TypeScript pass. Eight focused tests cover upload state preservation plus share metadata, unpublished/legacy behaviour, replacement invalidation rejected storage paths, and endpoint publication/version checks before storage access. Actual social-crawler fetches and authenticated storage lifecycle still need deployment verification; no production credentials or user PDFs were used locally.

## Iteration 3 — owner and editor experience

Planned, not implemented. Let owners view their real public page with a clear Edit action. Improve the existing editor's preview visibility with compact/collapsible settings after a desktop and mobile layout review. Creation-preview improvements in iteration 1 do not complete this editor work.

## Iteration 4 — discovery and comparison

Planned, not implemented. Expand the Issuu comparison using verified current features and prices; add real examples only with permission. Consider indexing the demonstration portfolio after confirming it is intended for public discovery. Measure font loading before reducing it. Do not automatically index private or unlisted customer portfolios.

## Later — validate demand first

Measure upload failures before adding optional PDF optimisation; preserve legibility and original files. Consider passwords, expiry, analytics and a job-hunt pass after validating demand and operating cost. A public social gallery, sounds and classroom tooling are deferred.

## Release checklist

- Keep this log updated with the PR, merge and live publication status for each batch.
- Before publication, review homepage and creation layouts on mobile and desktop.
- After publication, verify upload-to-preview, pricing links, footer anchors and support links.
- Treat successful GitHub merging and successful live deployment as separate facts.
