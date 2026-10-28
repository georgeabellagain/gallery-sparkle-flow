# Flipbook customisation review — 28 October 2026

Reviewed main `a426492caed37f71155199a5c0b5d02ecff7acb2`, then implemented
this branch's focused corrections. This is a source/control-wiring review with
regression tests and a production build, not a claim that every combination has
been visually exercised on a GPU. The local dev server runs, but the available
browser cannot reach it. Real iPhone/Android and live editor interaction checks
remain necessary.

## Product judgment

The editor covers the core needs of a PDF portfolio/flipbook creator. More HDRIs,
paper varieties or turn styles are not the main gap. Existing presets, separate
Simple/Studio controls and per-reader backgrounds give ample visual range.
Prioritise discoverability, precise adjustment, reliable saving and device testing.
A professional print-production tool would need physical dimensions, bleed,
spine calculations and colour proofing; those are outside this product's promise.

## Control coverage and recommendations

| Area | Current functionality and wiring | Judgment / next useful improvement |
| --- | --- | --- |
| Ready-made looks | Presets apply book, paper, light, background and motion; undo restores the earlier appearance | Strong starting point. Consider user-saved looks and copying appearance between portfolios later; do not overwrite content or sharing settings. |
| Reading modes | Scroll, page-by-page and flipbook; at least one stays enabled; creator chooses the opening mode | Sufficient. Test mode switches with an open note, zoom and links. |
| Page interpretation | Single PDF pages or precomposed spreads | Essential. Add a tiny diagram or sample thumbnail explaining the distinction; do not add another ambiguous layout toggle. |
| Opening page / hidden pages | Start-page number, nearest-visible resolution, page selection and typed ranges | Retains at least one visible page. Fixed spaced ranges and bounded the page grid to 64 buttons. Hidden pages remain in the original PDF: this is presentation, not redaction. |
| Book style | Flipbook, soft cover and hardback; hardback cover geometry is distinct | Good range. Judge closed/open/first/last spreads on actual GPUs. Physical thickness or spine-title controls would be useful for book-marketing users, but must stay consistent in viewer and photoshoot. |
| Page motion | Five page curves, timing styles, speed and reset | More than enough choice. A one-click 'test turn' would be more useful than another curve. Reduced motion must override automatic motion. |
| Studio lighting | 15 previewable HDRIs in Free/Personal groups, brightness, diffusion and white fill | Good scope. Added Reset lighting. Future precision improvement: editable numeric values beside sliders; descriptive lighting names while retaining stable numeric IDs. |
| Paper | Matte, satin, crumbled and newspaper; normal/roughness/tint maps are applied through the shared paper renderer | Keep this compact. Paper is only visible under Studio lighting; when Studio is disabled the UI should explain why the preview does not change. Do not re-enable retired paper types without checking their ink legibility. |
| Simple shading | Shadow strength and illustrated shading styles | Correctly separate from Studio. Validate all styles on white and dark artwork. |
| Backgrounds | Default plus separate Studio/Simple/Scroll/Page-by-page choices; colours, motion scenes, texture presets, uploads and size/position | Rich enough. Static picker thumbnails reduce unnecessary animation. Consider 'Use default again' and copy-to-other-mode actions if users struggle with inherited backgrounds. |
| Background lighting | HDRI application toggle; textured surfaces use normals/roughness | Correct intent. Validate colour scene versus photographic background and fullscreen cropping. |
| Reader buttons | Profile, thumbnails, search, page number, zoom, fullscreen, share and control colour | Useful control. A contrast warning and a clear 'Reset controls' action would be preferable to more icon choices. |
| Automatic presentation | Auto-flip interval and idle 3D tour | Now visibility- and reduced-motion-aware inside BookView. Manual turns and explicit exports remain available. |
| Announcement | Text, optional URL and button label with URL validation | Useful, but not central to appearance. Test save immediately after editing the last field because these boxes commit on blur. |
| On-page extras | Notes, tabs, links, uploaded video/GIF, hotspots, slideshows, detail spotlights and page jumps | Already broad. Prioritise keyboard placement, alignment and clearer selection feedback over new object types. End-to-end placement and page-turn visuals remain device checks. |
| Save / undo / preview | Appearance drafts, undo/redo, explicit Save, navigation confirmation and separate public preview | The correct model. Verify save/discard/cross-device persistence against the now-running backend; unit tests cannot prove this whole journey. |
| Branding / access / sharing | Separate panels for logo, address, password/expiry, lead forms and sharing | Good separation. Keep account/privacy decisions separate from visual presets. |
| Photoshoot | Separate saved scene choices, shared lighting/paper controls, book style, page/spread and export dimensions | Good related workflow. Must verify it retains its own choices and the chosen spread after switching back to the editor. |

## Implemented efficiency improvements

- Renderer-owned HDRI targets are limited to three recently used maps. The
  currently displayed and incoming maps are protected while a selection loads.
  Eviction releases their diffusion targets as well. Late full-resolution loads
  do not recreate already-evicted maps. CPU preparation and browser downloads
  remain shared/cached as before.
- Brightness and white fill update exposure/light intensity directly. They do
  not rebuild paper setup, reframe the camera or invalidate world-space shadows.
  Motion-only settings update the next turn without reconfiguring lighting.
  Graphics-context recovery explicitly forces full reconfiguration.
- Diffusion retains four reusable render targets. Scrubbing twenty distinct
  values uses four targets rather than allocating twenty; identical cached
  values skip the offscreen blend draw. Source replacement releases stale blends.
- Automatic orbit/auto-flip runs only for an intersecting, visible book with
  reduced motion off. No new automatic turns are scheduled for a hidden book.
- Background selection thumbnails no longer animate all presets simultaneously.
- Hidden-page editing renders at most 64 page buttons rather than the entire
  document's page count.
- Keyboard focus now activates the appearance being edited, matching pointer use.

These are work/allocation reductions, not measured FPS or load-time promises.
Page resolution, HDRI resolution, shadow antialiasing, paper appearance and export
quality were not reduced. Existing render-on-demand, shadow invalidation,
page caches, worker-prepared lighting, preview HDRIs and shader warm-up remain.

## Verification and remaining checks

Local validation: all 338 tests, TypeScript and the production build pass through
`npm run check`. GitHub checks run on the pull request. New regressions exercise resource
eviction/protection/disposal, direct brightness classification, diffusion reuse,
render-target restoration after an error, and spaced hidden-page ranges.

For visual sign-off: test all book styles and paper finishes with at least one
even and one patterned HDRI, change lighting quickly, scrub sliders, recover a
lost graphics context, enter/leave fullscreen, and turn through first/last pages.
Test keyboard preview, reduced motion, automatic motion off-screen, large PDFs,
Save/discard, premium preview/save gating and photoshoot independence. Record cold
load, repeated turns and memory after cycling all 15 lights on real phones.
Do not claim maximum possible efficiency without those measurements.

## Database migration completed

On 28 October both migrations from PR #124 were applied to the connected database:
`20261027160000_launch_backgrounds.sql` and
`20261027161000_atomic_subscription_events.sql`.
Catalog checks confirmed Sorbet/Aurora in the validation function and the atomic
subscription RPC present, with execute denied to anon/authenticated and granted
to service_role. No customer records were edited. This verifies installation and
privileges, not a real Paddle checkout or full Supabase RLS/storage smoke test.
