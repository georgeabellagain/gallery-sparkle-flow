# Portfolia product iterations

Updated: 6 October 2026.

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

## Iteration 8 — feature imagery (owner completed)

Status: imagery and original-font changes are present on main as of 6 October 2026. Preserved in this iteration.

## Iteration 9 — loading recovery

Status: committed to main on 6 October 2026; live publication verification pending.

- Bound the featured portfolio request to 30 seconds, expose the existing retry action on timeout, and ignore late responses from an expired attempt.
- After 60 seconds of page preparation, offer retry while allowing preparation to continue. A slow device does not trigger a forced reload or reveal an unprepared white book.
- Clear the previous data before retry so stale signed file URLs cannot mount during the new attempt.
- Give loading and recovery messages a contrasting dark surface even if the saved background is light.
- Preserve the owner’s finished imagery, fonts, saved portfolio settings and working renderer.

Validation: TypeScript and production build pass. Actual 3D lighting remains unverified in the WebGL-disabled cloud browser. Signed-in cover generation and mobile checks remain outstanding.

## Iteration 10 — sharing feedback

Status: implemented on 6 October 2026; committed to main after validation. Live publication verification pending.

- Disable Copy link and QR code for unpublished drafts, keeping the publishing instruction visible.
- Display existing account-sync status alongside published sharing controls. Saving and failed saves explain that visitors may still see the previous published version; Retry saving uses the existing sync retry action.
- Keep established published links available during a failed update, rather than implying the entire portfolio is unavailable.
- Hide cover-generation feedback when there is no PDF.
- Preserve finished homepage imagery, fonts and renderer.

Validation: TypeScript and production build pass. Live homepage browser check confirmed the example becomes readable with Studio selected and advances automatically in the fallback reader (page 3 of 14 without interaction). This browser has WebGL disabled. Signed-in save/retry and cover generation were not exercised; no signed-in session was available. Mobile viewport emulation is not exposed by this browser interface, so mobile visual checks remain outstanding.

## Iteration 11 — checks and feature priorities

Status: checks and roadmap review recorded on 6 October 2026. No product code changed.

- All 15 focused tests pass: phone camera/spread handling, compression preservation and signature rejection, draft/upload preservation, owner portfolio selection, share metadata and public-cover publication/version checks.
- Live standalone example loads with Studio selected. Switching to Simple succeeds, and its page remains at page 3 after interaction instead of continuing autoplay.
- Published embed route loads its PDF and preserves the account’s saved Simple default. This checks the route directly, not an iframe embedded on another provider.
- Google sign-in was attempted through the secure authentication prompt, but the provider navigation returned a 502 gateway error. A fresh Portfolia tab still showed Sign in. Signed-in save/retry, cover generation and owner routing remain unverified.
- This browser has WebGL disabled and exposes no mobile viewport control. Phone-layout unit checks pass, but mobile visual and actual 3D checks remain outstanding. No account records or PDFs were changed.

Earlier suggestions reviewed:

| Suggestion | Current position | Priority |
| --- | --- | --- |
| Cover link previews, hero upload, pricing, comparison, owner view and editor preview | Implemented; authenticated backfill still needs verification | Finish account checks |
| Embed guides for Squarespace, Wix and Notion | Generic modal instructions exist; dedicated useful guides are missing | Next low-cost feature |
| Portfolio checker | Could reuse local PDF parsing for size, pages and link count; subjective design scoring should be avoided | After embed guides |
| Password protection and expiring links | Strong potential Personal value; requires server-side protection of pages, PDFs, covers and embeds | Next substantial feature |
| Per-page analytics | Current analytics are basic; consent/privacy and event cost need review | After access controls |
| Opening alerts | Depends on dependable analytics and email delivery | Later |
| Public gallery and testimonials | Needs explicit owner opt-in, real submissions and moderation | Later |
| Custom domains and job-hunt pass | Requires hosting/billing work and evidence of demand | Later |
| Automatic image compression | Current lossless optimiser may save little on image-heavy work; preserve originals and visual quality | Measure first |
| Page sounds, classroom accounts | Limited immediate value for the focused PDF host | Deferred |

## Iteration 12 — dedicated embed guides

Status: implemented on 6 October 2026; included in this main release.

- Add Squarespace, Wix and Notion guide routes with provider-specific instructions, published-page/mobile checks and troubleshooting.
- Link the guides from the embed modal and footer; include static routes in the sitemap with canonical URLs.
- Check the instructions against official provider documentation. Squarespace iframe plan restrictions and Notion app/sign-in limits are explicitly noted; no compatibility guarantee is invented.

## Iteration 13 — local PDF checker

Status: implemented on 6 October 2026; included in this main release.

- Add /portfolio-checker for file size, page count, external link annotations, mixed page sizes, orientation and a first-page preview.
- Process on the visitor’s device without uploading or changing their account. Bound inputs to 75 MB and inspect at most 300 pages, clearly labelling partial checks.
- Give plan-size and reader-link guidance. Do not score design quality or claim to verify link destinations.

## Iteration 14 — Personal passwords and expiry

Status: implemented on 6 October 2026; database migration applied before publication. Included in this main release.

- Add separate owner access settings beside sharing. New protection requires a server-verified live Personal subscription; owners can remove all protection after cancellation. Existing protection is retained on downgrade.
- Store salted scrypt password hashes and random grant secrets in a private table, never in portfolio JSON or browser storage.
- Enforce access before issuing public portfolio data, through code/personalised/legacy routes and embeds. Protect direct database reads using the published-row RLS policy.
- Serve protected PDFs and referenced media through a private, uncached endpoint that checks password grants and expiry on every request. Public cover previews are withheld for both password and expiry settings.
- Bound password attempts per network/portfolio and globally per portfolio using a server-only database limiter. Use HttpOnly, Secure cookies and same-origin POST checks; changing settings rotates grants.
- Prevent shared caching of HTML and server-function data. Exclude protected/expired portfolios from public discovery metadata.
- Update pricing/comparison/privacy copy to describe the new controls and actual account storage.
- File URLs issued before enabling protection can remain valid for up to one hour. Access controls cannot erase previously viewed/downloaded files. Third-party cookie restrictions can require opening protected embeds in a new tab.

Validation: 21 focused tests pass, including salted passwords, incorrect-password rejection, grant tampering/rotation/expiry, file whitelist and access checks before storage, cover suppression, PDF checker bounds and all earlier tests. TypeScript and production build pass. Transactional SQL checks confirm open/password/expired/future-expiry predicates and anonymous RLS protection; all fixtures rolled back. Rate-limit threshold and private table/function grants checked. Existing account count remains one; no existing portfolio settings or files changed. Full signed-in UI validation remains blocked by the earlier Google gateway error.

## Iteration 15 — faster featured example

Status: implemented on 6 October 2026; included in this main release.

- Add a lightweight mode only to the featured example: 1600-pixel textures, no multi-page image-density scan, and reveal after two prepared pages while remaining pages load in the background.
- Reuse Scarlett’s published PDF and saved Studio appearance, keeping the Simple/Studio switch, forward/back autoplay, interaction stop and readiness/retry controls.
- Preserve the full visitor reader’s existing resolution and rendering settings. No duplicate public PDF, new storage service or Lovable AI generation call.
- Expected startup work is reduced; live timing and WebGL-capable visual checks still need verification.

## Publication verification for iterations 12–15

Code commit: `987eaf89cfb3693442ec5b9923cfdb910a3eb6ca`, fast-forwarded to main. Lovable sync confirmed before deployment request `7713b737-1b72-40ff-9cb9-ba0981bdb2bd`.

- Public Squarespace, Wix and Notion guide routes return HTTP 200 with the new page titles and content.
- Public PDF checker returns HTTP 200 with its new title and local-processing UI.
- The live protected-file endpoint rejects an unreferenced asset with HTTP 404, private/no-store caching and noindex.
- Browser preview verification timed out. Full signed-in access settings, successful password-entry UI, checker file-selection UI and actual WebGL visual checks are not claimed as verified.
- Homepage startup work is reduced by implementation, but a live before/after timing measurement is not available.

## Next — remaining release checks

Prioritise desktop/mobile and real-account checks of this batch before further feature work. Verify initial loading, the complete forward/back autoplay cycle and permanent interaction stop, Simple/Studio switching, optional compression acceptance, older-cover generation, sharing metadata and embedding. Confirm the actual live deployment separately from merging GitHub.

## Iteration 16 — named projects and direct project links

Implemented 6 October 2026. Available on Free and Personal.

- Add **Named projects** to the appearance editor: names, first/last PDF pages, explicit save, removal, and copied public links. Up to 30 projects; 80-character names; integer, non-overlapping page ranges. Covers and interstitial pages may stay ungrouped.
- Add a visual **Projects** contents panel to public readers, embeds and editor previews, with first-page thumbnails, page ranges and current-project indication. Thumbnails render only as they approach the visible panel.
- Direct links use stable IDs (`/p/<code>#project=<id>`). Renaming a project or updating its range preserves the link. Unknown/deleted IDs fall back to the opening page. Personal URLs also accept the fragment; copied links use the permanent address.
- Support project navigation in Scroll, Page by page, Simple and Studio. Preserve the selected page when changing reading modes. A jump requested during a book turn is applied once after that turn finishes; rendering, lighting and animation geometry are unchanged.
- Store project metadata inside the existing PDF JSON using the existing account sync. No new database tables, services, AI calls or uploaded thumbnail files. PDF replacement clears project ranges, with an explanation in the replacement dialog. Other readers continue to access the full PDF; projects do not hide/reorder/remove pages or bypass password/expiry controls.
- Existing portfolios keep their current appearance until their owners add project names and ranges. Scarlett's example PDF and saved settings were not modified.
- Validation: all 26 focused tests pass, including five new project tests covering boundaries/overlaps, old or malformed metadata, stable links and PDF replacement. TypeScript and production build pass. Authenticated editor interaction and real-device WebGL navigation still require visual verification; these are not claimed as tested.
- Publication: main code commit `79e00427383d47bbccc7d1e020541ca58fc6fbe0` synced to Lovable; deployment `ce26013e-fa24-4a8f-a878-fd174ac6ffc5`. Verified live `/edit` responds HTTP 200 and its current editor/viewer assets respond HTTP 200 with Named projects, Save projects, Copy project link and Projects controls. This confirms publication, not a signed-in end-to-end visual test.

## Iteration 17 — richer profession landing pages

The architecture, graphic-design, fashion and photography landing routes already exist, with canonical URLs, metadata and sitemap entries. Currently their shared template links to the same Scarlett Bushell fashion example.

- Improve these existing URLs instead of creating competing duplicates. Start with the four requested disciplines.
- Give each page a relevant, lightweight example flipbook, genuinely useful profession-specific advice and FAQs, accurate feature descriptions, a distinct search title/description and contextual internal links.
- Fashion: keep Scarlett's credited lookbook; explain collection process, textiles and garment detail. Architecture: show drawings, plans, sections and project roles. Graphic design: show identity, editorial layouts and process. Photography: show sequencing, series, image detail and client enquiries.
- Source permission-cleared real examples, or commission clearly labelled fictional demonstration portfolios. Do not present invented work as customer evidence or reuse unrelated fashion work as a discipline-specific example.
- Keep previews lightweight and load interactive examples on demand or near the viewport, building on the homepage optimisation. No ranking guarantees or unverified keyword-volume claims.
- Implemented 6 October 2026 after iteration 16. The four existing URLs now have distinct guidance, additional FAQs, checklists, contextual links, updated titles/descriptions and matching demonstration readers.
- Architecture and graphic design use original six-page vector PDFs (approximately 7 KB each); photography uses a six-page PDF (approximately 370 KB) with explicitly disclosed AI-generated coastal imagery. All three are fictional examples, not customer work. Covers are approximately 13–40 KB. Profession-specific 1200 × 630 sharing cards are included.
- The shared professional visual style uses warm paper, muted green, restrained typography and generous space. Assets and generation provenance are recorded in `public/examples/README.md`; the development-only generator is `scripts/build-profession-examples.mjs`.
- Interactive readers import and load after the visitor selects Open example. Static cover previews and useful page copy are available first. Preparing pages stay hidden until ready, with slow-load retry. Fashion reuses Scarlett’s published PDF/settings and existing copyright credit.
- No new service, subscription, database migration or runtime AI generation. Other discipline pages retain their existing content and example link.
- Verification: TypeScript, production build and all 26 existing focused tests pass. All 18 demonstration PDF pages were rendered successfully, disclosures checked and contact-sheet layouts visually reviewed. Real-device WebGL and signed-in visual tests remain outstanding.

## Iteration 18 — faster homepage autoplay and centred spread

Implemented with iteration 17 on 6 October 2026.

- Homepage/featured fashion demo pauses 1.6 seconds between completed page turns, down from 3.2 seconds. It still waits for readiness, reverses at the ends, pauses offscreen and respects reduced motion. Interaction still stops automatic movement.
- Demo-only `fullSpread` framing keeps both pages centred on narrow screens, using the desktop spread framing. It does not invoke browser fullscreen. Standalone covers still centre as a single page.
- Ordinary portfolio readers retain the existing phone camera behaviour and resolution. The new profession demonstrations also use centred full-spread framing.
- These changes adjust framing/timing props; page-turn geometry, materials and lighting are unchanged.

## Next — outstanding verification and future options

- Check the new demos and faster forward/back homepage cycle on a real phone and desktop with WebGL, including interaction stop and reduced-motion preference.
- Complete the previously recorded real-account checks for project settings, passwords/expiry, cover backfills, compression and sharing.
- Replace fictional examples with permission-cleared real portfolios when available. Consider tailored editions only after validating demand for the new project navigation.

## Later — validate demand first

Measure whether the optional lossless optimiser meaningfully reduces upload failures before considering more aggressive image compression; preserve legibility and original files. Consider passwords, expiry, analytics and a job-hunt pass after validating demand and operating cost. A public social gallery, sounds and classroom tooling are deferred.

## Release checklist

- Keep this log updated with the PR, merge and live publication status for each batch.
- Before publication, review homepage and creation layouts on mobile and desktop.
- After publication, verify upload-to-preview, pricing links, footer anchors and support links.
- Treat successful GitHub merging and successful live deployment as separate facts.

## Iteration 19 — slightly brighter Studio examples

- Increase the architecture, graphic-design and photography example brightness from the default 50% to 58%.
- Apply an eight-percentage-point uplift to Scarlett's saved brightness in the featured demo, capped at 100%. This is a presentation override only; the account's saved settings and ordinary visitor reader are unchanged.
- Simple view, HDRI choice, page-turn timing and centred spread framing remain unchanged.
- Next priority: complete the real-device and real-account release checks recorded above, then assess demand for tailored project editions. Passwords and expiry are already implemented (iteration 14); they are not future feature work.

## Iteration 20 — brighter examples and direct industry uploads

- Raise the three static Studio demos from 58% to 64%; increase the featured fashion demo uplift from eight to fourteen percentage points over its saved setting (capped at 100%). This does not alter account settings or Simple appearance.
- Add the existing drag-and-drop/file-picker upload flow to every discipline landing page, including architecture, graphic design, fashion, photography, interiors, art, illustration, UX, product design, student and landscape architecture. Respect current Free/Personal file limits and optional local compression; navigate accepted drafts to the creation preview.
- Published portfolios show the dashboard action instead of accepting an accidental replacement. Recheck publication after upload in case account sync completes during processing.
- Scrapbook feasibility: optional coloured tabs can map to named project start pages. A subsequent, larger feature could let creators attach images to per-page fold-out panels, store their positions and hinge sides, and open/close them on tap/click. Panels should close before page turns and inherit portfolio access controls. These would be interactive web additions; the original PDF download would not contain them. Not implemented in this iteration.
- Next priority remains mobile/account release checks; optional coloured project tabs are the smallest proposed scrapbook step. Fold-out image editing and animation require a separate scoped iteration.

## Iteration 21 — zines, magazines, homepage navigation and statistics scope

- Preserve intervening Lovable changes to upload redirects, profile appearance settings and page-edge controls. Include the previous industry drop zones and 64% demo brightness in this publication.
- Add `/zine-flipbook` and `/magazine-flipbook` with distinct copy, FAQs, canonical/search/social metadata, sitemap entries, reserved paths, direct uploads, export guidance and internal links. Do not pretend existing fashion/identity demos are magazine or zine examples, or advertise unfinished scrapbook/media capabilities.
- Add a wrapping homepage top navigation for Architecture, Graphic design, Fashion, Photography, Zines, Magazines, PDF checker and Pricing.
- Dashboard statistics combine all owned portfolios and default to All time. Individual editors show only their selected portfolio; the public viewing page has an owner-only Statistics panel. Visitors do not receive account analytics through the public portfolio response.
- Keep viewing sessions distinct from actual reads. Estimate unique browsers across the combined dataset, exclude missing visitor IDs from the estimate, and label the chart's 90-day all-time display window.
- Fetch event history in stable, ordered 1,000-row batches using an as-of cutoff instead of a capped query. Errors fail visibly rather than displaying a partial result as a total. No database migration or new tracking event is introduced.
- “Project-specific” here means the individual uploaded portfolio. Named-section engagement would require new tracking and is not retrospectively available.
- Record the official-source Heyzine gap review and proposed priorities in `docs/heyzine-feature-review.md`. Coloured tabs and scrapbook fold-outs remain proposed, not shipped.

- Validation: TypeScript and the production build pass; all 30 focused tests pass, including combined/per-portfolio totals and multi-batch event loading. Real-account and real-device visual checks remain outstanding.


## Iteration 22 — scrapbook fold-out prototype (unpublished)

- Merged into main via PR #9 on 7 October at the user’s request; not published. Iteration 21 remains the last published release.
- Add optional PDF-bound image fold-outs in the appearance editor. Creators choose PDF page, spread half, caption, left/right hinge, colour, size and position. A small interactive placement preview updates while editing; Save fold-out applies the changes to the book.
- Readers click/tap the flap to unfold a two-panel image in Simple or Studio. Enter/Space work on the focused flap; Escape closes it. Reduced-motion preferences disable the transition. Page turns, jumps and look changes reset the panels; overlays are hidden during page animation to avoid floating over the turning sheet.
- Keep both opened panels within their physical page for phone framing. Pre-arranged PDF spreads attach the fold-out to the selected half only. Zoom and pan use the scene's projected page bounds.
- Restrict uploads to JPEG/PNG/WebP, maximum 8 MB input, 12 fold-outs per PDF. Re-encode images at up to 2,400 pixels on the long edge. Preserve aspect ratio across the two panels without cropping.
- Store images using existing private portfolio assets. Include them in account sync, published signed assets and password/expiry-checked file responses. Remove them on explicit removal, PDF replacement or portfolio deletion. No live database migration or account content changes were made for this prototype.
- Add `/scrapbook-preview` as a noindex, non-sitemap review route, with hinge/colour/phone-width controls and an optional actual flipbook demo. The route is present in main after the requested merge, but is not a live URL until publication.
- Scope: animated DOM paper overlays, not physically simulated Three.js sheets. Fold-outs are available in the functioning 3D book (Simple/Studio), not Scroll, Page by page, graphics fallback or the original PDF download. Coloured project navigation tabs remain separate, unbuilt work.
- Checks: production build and TypeScript pass; all 34 focused tests pass. New tests cover placement validation, spread-half mapping, safe image keys and password/expiry protection. Browser visual verification was blocked by unavailable Chromium and a failed browser download; desktop/mobile interaction, camera alignment and cloud persistence still require manual review before any release.


## Iteration 23 — direct scrapbook editing and attached page artwork (unpublished)

- Replace the small placement sliders with a large, focus-trapped scrapbook editor showing the actual PDF page. Drag notes to position them and resize from any corner, including with touch. Arrow keys provide precise movement/resizing; Shift increases the step. Numeric width/height controls remain available.
- Drop a raster image directly onto the page to create a note at that position. Choose Text note for an image-free note. Move existing notes between PDF pages or spread halves from the inspector.
- Give the outside and interior separate colour, text and optional image settings. Each surface supports image replacement/removal and its own drop target. Existing image-only prototypes remain readable without migration.
- Keep edits local to the editor until Save changes. Cancel discards placements and staged images; save checks that the same portfolio/PDF is still selected. Replacement/removal cleanup includes both image surfaces, using the existing private storage/access rules.
- Paint closed outside artwork into each actual page canvas before Three.js uploads it. The note therefore stays flush with the page, receives its material/lighting and follows the bending page through forward/backward turns, instead of vanishing from a turning sheet. A transparent hit target opens the interactive hinge over that location when the page is still.
- Closed notes may be positioned anywhere on the physical page and resized from 8% to 100% in either dimension. Opened panels may extend beyond the page; choose the appropriate opening direction. Both the desktop editor and phone use normalized page coordinates, including the existing mixed cover/spread layout.
- Render outside artwork at the existing PDF page resolution. Decode outside images only for the PDF page being prepared, then release the bitmaps; interior images load when a note opens. Original PDF downloads are unchanged.
- Validation: production build, TypeScript and 37 focused tests pass, including text-only/legacy compatibility, both surface asset keys, resize bounds and proof that only outside artwork is painted into the turning page. Real-device visual checks and signed-in cloud round trips remain outstanding in this environment.
- Merged as PR #10 after approval. Not published.


## Iteration 24 — make scrapbook editing easy to find (unpublished)

- Confirmed that GitHub main and Lovable both contained iteration 23; no overwritten code was found. This does not establish which preview build was displayed in the user’s browser.
- Move the Scrapbook notes entry above the entire appearance editor and preview. Add the same entry to Edit profile, so both editing routes expose it without searching through long forms. On phones it appears before the preview.
- Included with iteration 25 for review. Not published.


## Iteration 25 — interactive, lit scrapbook flaps (unpublished)

- Remove the flap close X. Click either the note or its unfolded panel to close; drag in the unfolding direction to open and reverse the drag to close. Keyboard activation and Escape remain supported.
- Add top/bottom hinges and a no-flap option for flat notes, alongside left/right.
- Add independent image fit/crop, scale and horizontal/vertical placement for both surfaces, including dragging the artwork preview. Original image files remain intact.
- Add serif, sans serif, typewriter and handwritten system-font choices without adding font downloads.
- Render opened flaps as Three.js paper meshes in the same book scene, sharing material, HDRI, lighting and shadows. Closed artwork remains baked into the turning page. Release meshes/textures when leaving the spread.
- Keep the scrapbook editor prominent on both editing routes (iteration 24).
- Review branch only; no deployment. Browser/device interaction and visual lighting review remain required before publishing.
- Validation: production build and TypeScript pass; all 40 focused tests pass, including bounded crop settings, non-destructive image transforms, four hinge directions, shared paper materials and mesh cleanup.


## Iteration 26 — scrapbook polish: handwriting, alignment, page tabs, website links, curved paper (unpublished)

- Notes: add Handwritten (Caveat), Neat pen (Patrick Hand), Script (Dancing Script) and Marker (Permanent Marker) beside the system fonts. They load from Google Fonts only when a note uses one, and artwork waits for the font before painting. The font picker shows each font as itself.
- Notes: left, centre, right and justified text, plus top, middle and bottom positioning, on the 3D paper and the flat preview alike.
- Page tabs: coloured tabs with text stick out of the book's edges, including when it is closed (right edge for pages ahead, left for pages passed). Pressing one turns the book to that page in one smooth turn.
- Website links: place a website's logo on any page; it opens the site in a new tab (`noopener noreferrer`, http/https only). The logo is the site's favicon, requested from Google's favicon service when a visitor sees the page; a creator can upload their own logo or return to the site's. Falls back to a letter tile if the icon cannot load.
- Editor: Notes / Tabs / Links panels in the one scrapbook editor, one Save. Links are dragged on the page; tabs and links have colour/page/caption/size controls. Custom logos use the existing private file store, publishing and cleanup (`foldoutKeys` now includes them).
- Curvature: flipbook pages rise from the gutter in a soft arch, and the turning sheet bows more. Scrapbook flaps are shaped each frame: they trail as they lift, and settle onto the curve of the page they land on.
- Open scrapbook notes fold shut before the page turns away (click, drag, swipe or tab).
- Data: `pdf.tags` and `pdf.links` live beside `pdf.foldouts`, so they sync and publish with the portfolio. Replacing the PDF clears them.
- Review branch only; no deployment. Tests: new `tests/page-extras.test.ts`; `tests/book-notes.test.ts` now checks the flap bends and lies on the page. A full build and device visual review are still needed.


## Iteration 27 — dock editor, tabs and links on the paper, fixes (unpublished)

- Editor: a top bar (name, save status, Simple/Studio preview switch, Preview, Publish), a left dock of tool icons, and a card on the right that opens the chosen tool's options over a full-width preview: Reading, Lighting & look, Background, Scrapbook, Projects, Page style, Share, File & publishing. The scrapbook opens its editor (Notes, Tabs, Links) from the dock. Statistics stay under the editor.
- The Simple/Studio switch pins the preview's look until the other is chosen (`pinPreviewLook`); editing a look's options still shows that look briefly.
- Page tabs are now paper in the 3D book: they sit on the page edge (right for pages ahead, left for pages passed, visible when closed), travel with their own sheet during a turn, hop edge halfway for jumps, and take the same light and shadow as the pages in Studio. Invisible buttons over them make them pressable.
- Website links are printed on the page texture: flat, no shadow, and they curve and turn with the page. Smallest size is now 2% of the page width. Logos are fetched by our own `/api/public/favicon` route (the visitor's browser no longer contacts a third party) and fall back to a letter tile after 4 seconds.
- Fix: an open scrapbook note could block the next page turn (the turn waited on a close animation whose card was removed as the book went busy), leaving the book on page 1. Notes now close before the book is marked busy, a removed card always finishes its pending close, and a press on the page edge while a note is open closes it, then a plain click turns.
- Smoothness: the book no longer re-renders when panning/zooming/turning produces unchanged edge positions.
- Review branch only; no deployment. Browser and device review of the new editor, tabs and links is still needed.


## Iteration 28 — full-height editor canvas and movable tools

- Extend the portfolio canvas to the full viewport height below the editor header. Preserve page proportions while fitting the available height/width; remove extra editor camera inset and mobile bottom padding.
- Keep the book framing stable when opening settings and narrow the desktop settings panel to 19rem.
- Add a top grip to the editing widget. Drag with mouse, touch or pen; movement stays inside the canvas and is clamped again after resizing. Arrow keys move it, Shift increases the step, Home or double-click resets its position.
- Preserve the latest editor, scrapbook, tabs and links work from main.
- Merge requested by the user; no live publication.
- Validation: production build and TypeScript pass. Real-browser visual and pointer checks remain outstanding.

## Iteration 29 — correct editor height cascade and dock drag offset

- Apply the editor viewport height in the same unlayered CSS cascade as the reader; Tailwind's layered height utility was losing to the default 66vh reader height.
- Reset the separate CSS translate property when switching the dock from centred placement to pointer positioning. Resetting transform alone left the negative half-height translation active, moving the handle out of reach.
- Prevent focus-triggered scrolling when grabbing the handle. Preserve bounds, resize clamping and keyboard reset.
- Follow-up fix to iteration 28; no live publication.

## Iteration 30 — simplify the website and workspace

- Simplify homepage navigation, hero scale, onboarding explanation, plan summaries and footer groups.
- Make dashboard actions always visible, add loading feedback, correct Free capacity and soften cover styling.
- Reuse the editor sharing flow on the dashboard so draft links cannot be copied/QR-shared; keep advanced sharing options behind labelled sections.
- Put profile essentials first, collapse optional fields, retain a clear visual-editor shortcut and show the form first on phones.
- Move portfolio statistics into the editor dock and remove below-canvas footer/content; add dashboard navigation and publication prerequisites.
- Simplify upload options, statistics explanations and pricing decoration. Improve branded recovery states and modal labelling.
- Keep the previous photo/CV when saving a replacement fails.
- Remove an unnecessary homepage metadata server request.
- TypeScript, production build and 51 existing tests pass in the workspace. Browser review blocked by a public homepage error and preview timeout; no claim of visual sign-off.
- See experience-review-2026-10-08.md for the full assessment, limitations and prioritised additions.
- Merged in PR #14 at the user’s request; not published.


## Iteration 31 — editorial feature showcase using the real portfolio

- Apply selected style A: approximately 75% reader and 25% explanation on desktop; stack on smaller screens.
- Replace illustrative feature artwork with the actual published Scarlett Bushell PDF and the existing portfolio renderer. No generated or substitute imagery.
- Add eight feature tags, keyboard navigation, arrows and a ten-second automatic slideshow. Pause on interaction and hover; respect reduced motion and hidden/off-screen states.
- Demonstrate genuine reading modes, background colours, Studio lighting, saved scrapbook notes and page tabs. Animate notes through their existing renderer/lighting and page turns through the real reader.
- Reuse actual QR and embed dialogs and the public example URL. Keep Scarlett’s saved data/settings unchanged and retain the ownership credit.
- Load the reader only when the section enters view. Hide it until rendering reports readiness; offer retry for slow/failed loading rather than reveal unprepared white pages.
- Validation: TypeScript, production build and existing regression suite; browser visual review remains outstanding because the available preview session timed out.
- Merged in PR #15 at the user’s request; no publication. Superseded by the presentation-only direction below.


## Iteration 32 — short feature loops, without reader controls

- Retain the approved editorial layout, top feature tags, arrows and 75/25 desktop proportions.
- Replace the interactive reader with presentation-only animations on midnight blue. Reuse actual PDF artwork; no generated images.
- Loop a real page turn between two spreads; slide between PDF pages in Page by page; slowly pan through pages in Scroll.
- Cycle actual Studio lighting presets while turning the pages starting at PDF page 9; alternate forwards/backwards. Backdrops cycles real background colours.
- Add a local demonstration flap on page 9 using the actual scrapbook renderer and lighting. Add two local page tabs and animate a cursor clicking their real navigation buttons. These demonstration extras never change Scarlett’s saved portfolio.
- Show a simple link-to-website embedding animation using PDF artwork. Remove reader tools and share dialogs from this presentation section.
- Decode the PDF once per section visit and reuse the prepared artwork across tabs. Keep the section hidden until ready; respect pause, reduced motion and off-screen states. Selecting a feature keeps its loop playing while stopping automatic feature changes.
- Validation: TypeScript and production build. Real-browser visual review remains outstanding after the preview timeout; review loop framing and tab cursor positioning before publication.
- Merged in PR #16 at the user’s request; not published.


## Iteration 33 — varied pages and gentler detail demonstrations

- Give each feature a distinct starting PDF page: flipbook 3, page-by-page 4, scroll 5, backgrounds 6, Studio 9, scrapbook 10, tabs 11, sharing 12. Exclude pages 1–2 from the demonstration sequences.
- Extend reading and tab loops to up to four pages; turn forward and back within those ranges.
- Speed up continuous scrolling and remove both fading edges; retain seamless duplicate end frames.
- Use beige behind Studio, slow demonstration turns to 2.5 times their normal duration, and allow extra carousel dwell time to see the lighting on the moving paper.
- Use a lighter beige scrapbook flap, handwriting text and a close-up cropped directly from page 10 inside it. Open over 1.8 seconds and close over 1 second. The crop stays in browser memory and the example data is not saved.
- Validation: TypeScript, production build and existing regression tests. Browser visual review of the new crop/framing remains outstanding.
- Merged in PR #17 at the user’s request; not published.


## Iteration 34 — preserve scrapbook image proportions

- Correct the showcase detail crop: derive its output dimensions from the source crop aspect ratio instead of stretching it to 1000 × 700.
- Move the demonstration note to the bottom right of its page, retaining a small edge margin.
- Verify the shared note image painter uses one uniform scale when fitting, zooming and repositioning images in wide, tall and square notes. Cover crops; contain fits; neither stretches the original image.
- Add a regression test for resized note image proportions across both fitting modes and zoom/position changes.
- Validation: TypeScript, production build and existing tests plus the new image-fit regression. Visual browser review remains outstanding.
- Merged in PR #18 at the user’s request; not published.


## Iteration 35 — prepare previews early and place the profile beside the logo

- Reserve the homepage book frame height at each responsive breakpoint through loading, rendering, errors and retries.
- Start the PDF module alongside the published-example metadata request; share that short-lived request between homepage demonstrations. Read lightweight preview page dimensions concurrently.
- Remove Flipbook from the feature carousel and start with Page by page.
- Begin preparation before the carousel reaches the viewport. Keep the next slide mounted and prepared while the current slide plays, sharing its parsed PDF and raster artwork. Automatic advancement waits for the next slide to report readiness. Only current and next scenes are retained.
- Move the enabled portfolio profile button beside the top-left logo, with its panel below. Use the uploaded photo as a circular button, falling back to the profile icon if absent or unavailable. Preserve outside-click/Escape dismissal and reserve room for mobile controls.
- Validation: TypeScript, production build and regression suite. Browser performance/layout verification remains outstanding; no measured loading-time claim.
- Review branch only; not merged or published.


## Iteration 36 — page-turn work reduction and dappled sunlight

- Cache the two page-relief profiles per turn and reuse a precomputed curl profile, instead of repeating expensive relief/trigonometry for every vertex on every animation frame. Mark changing geometry buffers for dynamic updates.
- Remove the extra mid-turn warm-up render and explicitly upload turn textures before starting. Cast the double-sided turning sheet's shadow once instead of twice.
- Limit speculative prefetch to immediate neighbours to avoid evicting the next turn's textures. Preserve existing full-resolution page texture budgets and Simple/Studio separation.
- Add Pine sunlight and Leaf sunlight after the original four choices. Bundle reduced CC0 Forest Slope and Autumn Forest 04 HDRIs, with source/licence records and derived thumbnails.
- Pair the HDR environments with an actual foliage-pattern spotlight so patches of direct light fall on moving pages and scrapbook notes. Only one key light casts shadows per preset.
- Validation: TypeScript, production build, regression suite and decoding/finite-value checks for both bundled HDRIs. No browser frame-rate benchmark or visual lighting sign-off is claimed.
- Review branch only; not merged or published.


## Iteration 37 — quiet loading, single mobile turns and fullscreen budgets

- Enable the existing monochrome book loader throughout the portfolio viewer, with an accessible loading label and reduced-motion support. Keep the current homepage text removal; fix its missing carousel loader import.
- Keep the book hidden until readiness rather than exposing it after a 20-second timeout. Forward render failures into the visible viewer error state.
- Exclude buttons, links and scrapbook notes from the viewport swipe handler, reset cancelled touches, and verify release distance before recognising a tap. This prevents pointer drags also becoming swipes/taps on release.
- Enforce the drawing-surface pixel budget on 4K/fullscreen screens, including ratios below one CSS pixel. Permit measured slow-device adjustment below 1x while preserving HD PDF source textures and lighting.
- Coalesce drag mesh deformation and normal recalculation into the next screen frame, using the latest pointer position.
- Retain memory-bounded preloading: prepare the pages that fit and upload each turn's textures before animation. Unbounded full-document HD rasterisation risks exhausting phone memory and cannot solve lighting fill-rate costs.
- Validation: TypeScript, production build and 54 regression tests, including large fullscreen budgets and adaptive reduction below 1x. Actual phone gesture and frame-rate verification remain outstanding; no guarantee of universally smooth animation.
- Draft review PR only; not merged or published.


## Iteration 38 — smaller, centred loading indicator

- Reduce the monochrome book loader from 72 × 50px to 48 × 34px, including matching page, border and perspective dimensions.
- Limit the homepage example's full-height rule to its viewer wrapper. Loading status children retain their natural height, so the loader centres in the fixed preview frame.
- Validation: TypeScript and production build. Merge and publish requested by the user.

## Iteration 39 — public launch audit and reliability corrections

- Audit 37 live URLs, homepage/pricing UI, SEO metadata, public route responses, account sync and production dependencies. Record evidence and remaining launch checks in `launch-audit-2026-10-09.md`.
- Add portfolio canonicals, preview noindex, branded social-image fallbacks and real missing-page 404s. Exclude password/expiring portfolios from the sitemap and preserve personal-address grace periods.
- Prevent failed draft uploads being marked synced, serialize account writes and make visitor tracking tolerate blocked browser storage. Permit PDF module retries after load failures.
- Improve the pre-upload upgrade action, pricing metadata/schema and accuracy of privacy storage wording. Add response headers while preserving embeds.
- Validation: TypeScript, production build, 61 regression tests, built-worker status/header checks and production dependency advisory lookup. Real-account, payment and actual-phone checks remain outstanding.
- Review branch only; not merged or published.

## Iteration 40 — reduce fullscreen page-turn rendering cost

- Cap the drawing surface at 1.3 million pixels during page turns, including dragging and camera recentering; restore the existing reading resolution once settled. Small previews remain at their original resolution and PDF textures remain HD.
- Keep slow-device reductions specific to motion so they no longer permanently reduce settled reading quality.
- Cancel queued pointer/contact-shadow draws when a direct animation draw already covers them, and avoid resizing unchanged canvas dimensions.
- Validation: TypeScript, production build and three rendering-budget regression tests, including 1080p/4K motion cost and small-preview resolution. The attempted broad test bundling encountered TanStack virtual-module resolution; the focused test bundle passes. Actual GPU frame-rate comparison remains unverified because the available browser disables WebGL.
- Review branch only; not merged or published.

## Iteration 41 — centred single pages and numbered window lighting

- Give Page by page a dedicated viewport-height frame and centre each page within the space below controls, fitting both width and height instead of reusing Scroll's 1100px cap/top alignment. Preserve zoom and overflow navigation.
- Observe rendered page width and redraw PDF/text/link layers when fullscreen or layout dimensions change, preserving sharpness and link alignment.
- Add reduced CC0 Blinds and Reading Room HDRIs as Lighting 7 and 8, paired with real projected direct light through slats/window panes on pages and notes. Rename Lighting 5 and 6 to match the numerical naming while retaining all saved IDs.
- Validation: TypeScript, production build and decoding/finite-value checks for both HDR assets. GPU lighting appearance and browser layout visual sign-off remain outstanding.
- Review branch only; not merged or published.

## Iteration 42 — full-height editor pages and finer zoom controls

- Override compact Page by page sizing with the editor stage's full available height, keeping standalone compact previews and fullscreen sizing independent. Remove redundant bottom credit padding from the fixed-height single-page frame.
- Add non-passive mouse-wheel zoom in Page by page, normalise wheel delta modes and coalesce updates per animation frame. Keep the existing 100–300% bounds and reset/pinch controls.
- Reduce Scroll toolbar zoom steps from 25% to 10%.
- Lighting 5–8 now use the same soft directional shadow as Lighting 1–4. Keep the sunlight projector for page highlights but disable its hard backdrop shadow; retain one shadow-casting light.
- Validation: TypeScript and production build. Final editor layout and wheel behaviour need browser visual/input verification.
- Review branch only; not merged or published.

## Iteration 43 — gradual Scroll zoom and drag panning

- Keep Scroll's fitted 900/1100px baseline when zooming rather than removing its width cap at the first zoom step. Reduce toolbar increments to 5%.
- Add mouse click-and-drag panning above 100% in Scroll and Page by page, with pointer capture/cancellation, drag-release click suppression and interactive element exclusions.
- Give Scroll a bounded reader viewport so both axes can be panned; use safe centring in Page by page so enlarged page edges remain reachable.
- Validation: TypeScript and production build. Browser input and layout verification remains outstanding.
- Review branch only; not merged or published.

## Iteration 44 — larger default Scroll pages

- Start Scroll at the existing 130% size on initial load and when switching into that reading mode. Reset zoom returns to this new default; zoom out to 100% and 5% toolbar steps remain available.
- Other reading modes start at 100%, so Scroll's larger default does not carry into the flipbook or Page by page.
- Validation: TypeScript and production build. Merge requested by the user; publication not requested.

## Iteration 45 — Studio appearance across reading modes

- Stop changing reading mode when the editor's Simple/Studio preview changes. Share the selected appearance between Flipbook, Scroll and Page by page while respecting visitor appearance permissions; the editor can preview both.
- Offer appearance controls without requiring Flipbook to be enabled. Keep editor toolbar and reader appearance switches in step.
- Add a lazy, shared offscreen Three.js renderer for stationary PDF pages, using the same HDRI sources, brightness exposure, paper properties and projected leaf/window lighting as the book. Render each page once into a normal 2D canvas; preserve existing selectable text and clickable links above it.
- Serialize page lighting, reuse environments/materials, skip obsolete page requests, limit snapshot pixels and release the GPU context on mode/appearance changes or unmount. Fall back to readable original artwork when graphics or lighting fail.
- Simple uses original PDF colours. Existing zoom, pan, Scroll 130% default and book-turn path remain in place. This iteration lights stationary pages; it does not add 3D foldout animation to Scroll/Page by page.
- Validation: TypeScript, production build and three render-queue tests (ordering, failure recovery and closure). Actual HDRI visual matching and browser switching/link verification remain outstanding because the available browser disables WebGL.
- Review branch only; not merged or published.

## Iteration 46 — move pages through live Studio light

- Replace Iteration 45’s prelit page snapshots with one visible Three.js surface for Scroll and Page by page. Cache original PDF artwork; keep HDRI/projected light fixed in the reader while meshes follow page scrolling, sliding and drag panning.
- Add a short Page by page slide with reduced-motion support. Keep text selection and PDF links above the live artwork; preserve Simple colours and readable source pages if graphics fail.
- Allocate textures only for nearby pages, coalesce movement updates, stop rendering while idle, use a smaller drawing budget during motion and restore detail once movement ends. Dispose observers, textures and the graphics context on reader changes/unmount.
- Validation: TypeScript, production build and three page-position tests covering centring, movement through fixed light coordinates and whole-reader positioning. Actual GPU appearance/performance needs device verification: the available public-site browser reports WebGL unavailable.
- Review branch; not merged or published.

## Iteration 47 — restrained presentation polish

- Review the public homepage, feature showcase, pricing, PDF checker and footer, and shared presentation code. Preserve the established white gallery canvas, typography and PDF-based demonstrations.
- Share one plan-card component between the homepage and Pricing: larger standalone prices, quieter monthly/yearly details, aligned full-width actions, more legible feature spacing and a recommendation badge that wraps safely on narrow cards.
- Give the homepage pricing section a clearer heading and short introduction. Replace the native disclosure triangle with a consistent rotating chevron in the profession navigation; retain Escape closing and keyboard focus.
- Style the PDF checker’s file-selection control with the existing button colours, a rounded card and visible selected-file text; keep its native input and local-only processing.
- Existing global keyboard focus styling was already present and remains in use. No new images, paid services or dependencies.
- Validation: TypeScript and production build. Live visual review covered the existing desktop site; the new layout and GPU effects still need preview/device visual sign-off.
- Next: verify live lighting and responsive plan layout on a WebGL-capable desktop and phone before release.
- Review branch; not merged or published.

## Iteration 48 — smooth loading into live Studio light

- Iterations 46–47 merged through PR #30. Publication was not requested here.
- Stage new PDF artwork until the live lighting frame can commit DOM layers, replace the GPU texture and draw together. Eliminate the intermediate unlit canvas that caused a brightness flash.
- Keep the current Page by page component and its lit artwork in place until the requested page is ready. Start its slide on presentation rather than on mounting; avoid repeating the slide when cached artwork is upgraded to the final render.
- Give first-time Scroll artwork a short lit reveal, honour reduced motion and keep cold loading-page backgrounds transparent. Existing readable graphics-failure fallback remains available.
- Keep original canvases concealed while Studio is active, including when offscreen textures are released. This prevents an unlit flash as a previously loaded page re-enters the viewport. Restore originals only on Simple/renderer removal or graphics failure.
- Guard commits against cancelled renders, newer page requests and unmounted pages; keep replacement work within the existing nearby-texture and demand-driven rendering budgets.
- Validation: TypeScript, production build and frame-commit regression tests covering delayed presentation, latest-page selection, cancellation, unmount and next-frame scheduling. Actual GPU visual/device sign-off remains outstanding because the available browser disables WebGL.
- Review branch; not merged or published.

## Iteration 49 — ready feature tabs and window-light demonstration

- Iteration 48 merged through PR #31. Publication was not requested.
- Keep all six feature demonstrations mounted after the shared PDF loads, instead of retaining only the current/next pair. Switching a tab reuses its prepared DOM and book scene, with no scene remount or opacity transition. Hidden demonstrations stop their animation clocks and remain inaccessible/inert.
- Decode and retain the actual PDF-derived slideshow images with the shared artwork lease before declaring them prepared. The initial PDF/assets still require loading; instant switching applies once preparation completes.
- Studio demonstration cycles through Lighting 1, 2, 3, 7 and 8. Preload those environments and compile the window/blinds projector variants in the actual book renderer before showing the prepared demo. Preserve its beige backdrop, slow page turns and pages 9–12.
- Use optional demonstration-only lighting preparation; regular portfolios retain their existing lighting choices and startup path. No new dependencies, imagery or external services.
- Tradeoff: retain three small demand-rendered book scenes instead of one/two while the showcase is mounted, in exchange for avoiding rebuilding them on arbitrary tab clicks. Only the selected animation runs. Shared PDF/artwork is still released when the showcase unmounts.
- Validation: TypeScript and production build. Real-device GPU/tab latency measurement remains outstanding because the available browser disables WebGL.
- Review branch; not merged or published.

## Proposed next features — creative workflow

- Tailored portfolio editions: choose/reorder existing named projects for a client or application, with a separate link, while keeping the master portfolio intact. Strongest next product addition; requires careful access and PDF-export behaviour.
- Private page-specific feedback: invite clients/tutors to leave notes attached to a page, with owner controls and an optional review deadline.
- Revision history and rollback: recover a previous PDF and its matching project ranges, notes and settings after replacement.
- Project context cards: optional role, collaborators, year and short process/case-study text alongside existing named projects, keeping the PDF central.
- A reader shortlist: bookmark selected projects during a visit and copy a link to that selection.
- Useful viewing insights: project/page engagement and return visits, presented as estimates rather than proof someone read the work; minimise tracking.
- Branded enquiry action: a discreet availability/contact button, then custom domains if demand supports the hosting cost.

## Iteration 50 — clipped, coordinated single-page transitions

- Iteration 49 merged through PR #32. Publication was not requested.
- Keep Page by page’s layout element stationary. Slide an inner artwork/text/link layer inside its existing overflow clip; suppress horizontal scrolling at fitted zoom while preserving genuine horizontal panning above 100%.
- Studio uses a single renderer-driven 420ms eased slide. Calculate matching DOM pixel/GPU world offsets from one clock instead of sampling an independently composited page transform. Clip the GPU paper to the fixed page bounds, keeping the light fixed as the sheet moves through it.
- Use a shorter 12% travel distance, support previous/next directions and respect reduced motion. Preserve the current page during loading and the existing Simple/graphics-failure fallback.
- Delay cached-to-HD artwork replacements until an active slide ends so texture uploads/material replacement do not interrupt the movement. Reset inner transforms when restoring the ordinary canvas.
- Validation: TypeScript, production build and two reader-slide tests covering bounded forward/backward motion, exact landing and matching DOM/GPU scaling. Existing frame-commit tests retain cancellation/staging coverage. Actual GPU smoothness and editor/phone visual checks remain outstanding because the available browser disables WebGL.
- Review branch; not merged or published.

## Iteration 51 — prepare the entire Scroll portfolio before opening

- Iteration 50 merged through PR #33. Merge requested for this iteration after checks; publication not requested.
- Eagerly render every Scroll page through a serial preparation queue, including its PDF artwork, selectable text and links. Keep the small monochrome loader and an inert/hidden reading area until every page reports final preparation.
- Use a per-document/mode/appearance readiness gate; duplicate completions and cached previews cannot bypass it. Disable the 20-second readiness override for Scroll. A failed page produces an explicit reload error instead of revealing a partly prepared portfolio.
- Retain every prepared canvas in its Scroll page and skip redundant shared-cache copies. Keep existing render quality, zoom and panning. Redraws retain the previous artwork while the replacement is prepared.
- Wait for Studio presentation readiness as well as PDF preparation, with a readable fully prepared fallback if WebGL cannot start. Offscreen GPU textures remain bounded: a visible page is drawn directly from current bounds even if IntersectionObserver has not yet caught up with fast scrolling.
- Validation: TypeScript, production build and focused readiness/queue/commit tests. GPU appearance and rapid-scroll device verification remain outstanding because the available browser disables WebGL.
- Expected tradeoff: the initial Scroll wait now includes the whole PDF; larger documents take longer and retain all their page canvases. No new dependencies or account changes.


## Iteration 52 — smaller, simpler portfolio loader

- Iteration 51 merged through PR #34. This iteration is a review branch; not merged or published.
- Use the selected Turning page design: one transparent outline book and a single softly turning sheet, replacing the three filled animated leaves.
- Reduce the loader from 48 × 34px to 28 × 20px (about 42% smaller in each dimension). Keep the existing centred placement, light/dark contrast and text-free viewer usage.
- Preserve the accessible loading status and reduced-motion still state. No new dependencies or loading/readiness changes.
- Validation: TypeScript and production build.
