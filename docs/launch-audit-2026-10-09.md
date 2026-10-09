# Public launch audit — 9 October 2026

Base: main at `8f04e67faa565956b1edf87364b02c4a621b499e` (PR #22). This iteration is proposed for review; it is not deployed.

## Verdict

The public presentation and SEO foundations are suitable for a controlled launch after these corrections. A full paid-launch sign-off still requires real account, payment and phone checks below. This audit does not certify legal compliance, search indexing or universally smooth 3D performance.

## Evidence

- Crawled 37 live URLs through the published Lovable origin; inspected the custom-domain homepage and pricing in the browser. All 27 marketing pages had unique titles/descriptions, one H1, correct canonical URLs and parseable structured data. Robots and the 28-URL sitemap were available.
- Desktop homepage had no horizontal overflow and its images had alternative text. The audit browser disables WebGL: its readable canvas fallback worked, so hardware 3D performance could not be measured here.
- TypeScript, production build and all 61 regression tests passed. Built-worker checks returned 404 for invalid portfolio, embed and username URLs; editor previews remained 200 and noindex. Embed framing remained allowed.
- Queried the npm advisory endpoint for 306 production package names: no reported advisories. Development dependencies were not included. This is not a penetration test.
- Network/proxy timings are not reliable application performance measurements. Lighthouse, field Core Web Vitals and phone frame-rate measurements remain outstanding.

## Corrections

| Finding | Correction | Validation |
| --- | --- | --- |
| Public portfolios lacked canonicals; preview URLs could inherit indexing metadata | Consistent personal/code canonical, preview noindex and Twitter metadata | Metadata regression tests |
| Missing portfolio URLs returned a successful HTTP response | Route loaders throw notFound for missing/invalid records; protected links retain their gates | Built-worker HTTP checks; protected route code review |
| Database/signing failures could masquerade as missing pages | Propagate operational errors to the existing error boundary | Production build and code review |
| Password or expiring portfolios could enter the sitemap | Exclude gated entries; retain personal-address cancellation grace | Code review and existing access tests |
| Older portfolios and some static pages lacked a branded social-image fallback | Root/portfolio fallback uses the bundled OG image; drafts never expose a cover | Share-image regression tests |
| Failed draft-file uploads were ignored and the draft marked synced | Upload all required files before marking synced; serialize writes; retain errors and retry | Failure, retry, missing-file and deduplication tests |
| Browser storage restrictions could break visit tracking | Guard storage access and use an in-memory visitor/session fallback | Blocked-storage regression tests |
| Failed PDF module loads stayed permanently rejected | Clear the rejected import so retry can recover | Production build and code review |
| Upgrade-before-upload modal offered only dismissal | Link directly to the homepage upload section | Live original flow inspection and code review |
| Pricing metadata/schema and privacy storage wording were incomplete | Mention actual included features, expose schema price, accurately describe visitor identifiers | Build and metadata review |
| Response hardening was incomplete | Add nosniff/referrer policy and frame restrictions, preserving public embeds | Built-worker header checks |

Existing deferred customer fonts, lazy industry examples, memory-bounded PDF rendering, image proportion fixes, slideshow preparation and page-turn optimisations are preserved. No fabricated ratings or testimonials were added to structured data.

## Required launch checks

1. On a fresh account: upload before sign-up, verify email, publish, open the public link in another browser, replace the PDF, edit scrapbook notes and delete a portfolio. Verify cross-device persistence and a failed-upload retry. Test password reset and protected/expired links.
2. Verify a real Paddle checkout, webhook entitlement, cancellation and billing portal flow with the owner. No purchase or account mutation was performed in this audit.
3. On actual iPhone Safari and Android Chrome: swipe/release turns once, fullscreen, large PDF, Studio HDRIs, notes and reduced-motion behaviour. Measure frame rate and Core Web Vitals; this browser cannot supply a GPU benchmark.
4. Confirm support mailbox delivery and use Google Search Console to verify ownership, submit the sitemap and inspect indexing. Search visibility cannot be inferred from valid tags alone.
5. After deployment, recheck a valid-looking missing portfolio URL returns 404, confirm canonicals/OG cards on the custom domain, and repeat the account smoke test.

## Reference guidance

- [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google crawling and soft-404 errors](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)
- [Software application structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)

