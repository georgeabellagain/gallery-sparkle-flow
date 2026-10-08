# Portfolia experience review — 8 October 2026

## Assessment

The core product is distinctive: preserve an existing PDF, present it as a physical book and share a stable link. The surrounding interface has accumulated competing actions and repeated explanations. The best direction is a calm workspace with progressive disclosure, clear saved/published states and consistently available actions.

This review covers source for the homepage, profession/SEO landing template, pricing, upload, dashboard, profile setup, visual editor, sharing, statistics, sign-in and error recovery. It is not a completed visual QA or security audit.

The public homepage displayed “This page didn't load” in the review browser after a refresh. The development preview connection timed out. This does not establish an outage for other visitors, and no root cause was confirmed. Treat a successful live homepage smoke test as a release gate. An unnecessary server request solely for homepage metadata was removed; this is a resilience improvement, not proof that the observed failure is resolved.

## Implemented in iteration 30

| Area | Finding | Change |
| --- | --- | --- |
| Homepage | Oversized heading, repeated explanations, a second decorative book and long duplicate plan lists compete with uploading | Quieter heading, compact three-step explanation, concise plan summaries with Free CTA and link to full comparison |
| Navigation | Eight equally weighted links wrap into a busy second header | Keep Pricing and PDF checker visible; group all six profession/publication links in a keyboard-accessible “For your work” disclosure |
| Footer | A long undifferentiated link row is hard to scan | Group product resources and help/legal links; remove duplicate marketing destinations from the footer |
| Upload | Compression choices compete with the first action | Put optional compression/help in Upload options; announce processing to assistive technology; soften the drop-zone border |
| Dashboard | Blank loading state, hidden-on-hover actions, strong cover shadows and a misleading Free plan count | Add a loading message, always-visible Edit/Preview/Share, quieter cover styling and plan-aware capacity |
| Sharing | Dashboard allowed copying draft links and duplicated a less complete editor flow | Reuse ShareActions, which disables sharing for drafts and includes sync feedback; collapse cover and access controls into labelled sections |
| Profile setup | Scrapbook editing and a large mobile preview distract from required details | Name first, optional profile details and appearance in disclosures, form before preview on phones, clear visual-editor shortcut |
| Profile assets | Previous photo/CV could be deleted even if saving its replacement failed | Only remove the previous asset after metadata saves; discard a newly uploaded asset if metadata cannot save |
| Editor | Footer and statistics create a second page below the full-screen work area | Move portfolio-specific statistics to a tool panel, remove the editor footer and add direct dashboard navigation |
| Publishing | Editor could mark a draft published before profile/sign-in steps | Route missing-name drafts to profile setup and signed-out creators to sign-in first |
| Pricing | Raised cards and heavy shadows add unnecessary emphasis | Align cards and reduce decoration; preserve full feature/price information |
| Recovery/accessibility | Generic error pages and repeated modal title IDs | Add Portfolia identity, support path and unique accessible modal labels |
| Statistics/help | Dense explanatory text competes with totals | Keep totals visible; place methodology and feedback form behind labelled disclosures |

All existing reader modes, saved lighting, backgrounds, notes, tabs, links, PDF data and access settings remain available. No server-side access or billing rules were changed.

## Valuable next additions, in order

1. **Undo and version recovery.** Highest value for a visual editor with drag, crop, flap and colour changes. Begin with session undo/redo for appearance and scrapbook state; add retained published revisions only with clear storage limits.
2. **Duplicate a portfolio.** Tailor a copy for a job, client or discipline while preserving the original. Give the copy its own draft identity and link; do not inadvertently duplicate analytics or public access credentials.
3. **Email sharing card.** Export a polished clickable cover card first, with an optional animated preview later. Link to the full viewer; do not promise a live 3D email embed.
4. **Desktop/phone preview in the editor.** A reversible preview frame that changes neither saved settings nor the visitor experience.
5. **Publish readiness summary.** Clearly show saved state, link, cover preview and access settings before first publication. This should be a short useful summary, not another mandatory wizard.

Larger later bets: an opt-in curated gallery with real owner permission, custom domains, and consent-aware recipient feedback. These add operational work; they are lower priority than making editing and sharing dependable.

Do not count existing passwords, link expiry, named projects, page tabs, page links, cover previews, local PDF compression, font loading optimisation or discipline landing pages as missing features.

## Validation and limits

- TypeScript and production build pass in the existing workspace environment.
- All 51 existing focused tests pass (PDF handling, access, sharing, projects, analytics, foldouts, tabs and book layout).
- Generated app build is available locally; no deployment was performed.
- Latest main received an unrelated Lovable build-config dependency update during the review. The review commit preserves it. The local build uses the preinstalled workspace dependency set; a fresh dependency install in Lovable/CI remains a release check.
- Desktop/mobile screenshots, actual drag behaviour, native nested share dialogs, account sync and payment journeys require browser validation. The public browser error and preview timeout prevented a credible visual sign-off.
- Recommended smoke tests: homepage upload → profile → sign-in → editor; draft sharing disabled; published link/QR/embed; profile image replacement with failed storage; editor statistics and dock; phone navigation/overflow; successful homepage and sign-in on the deployment target.

## Release state

Prepared on a review branch. Not merged or published. Review the rendered changes and resolve the public loading observation before publication.
