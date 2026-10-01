# Flipbook upgrade (staged, preview only)

Scroll and Page-by-page modes, accounts, links, plans and analytics stay unchanged. Each stage is checked in preview before the next one starts. Nothing gets published until you approve it.

## Causes of the stutter found so far
- A new 3D drawing surface is created for **every** page turn. That includes setting up the graphics context, building the shader and uploading both page images, all inside the first frames of the animation.
- Saved page images have no memory limit, and each one is kept at full size.
- The turning sheet only appears if the page image is already saved. Otherwise the turn starts with a fallback image, which causes the occasional wrong or blank face.
- Turns only work by clicking. Dragging the corner isn't supported, and swiping can clash with zooming.

## Stage 1: Reliable, smooth reading (core fixes)
- One long-lived page-turn surface per viewer, prepared as soon as Flipbook opens. It is hidden when idle, stops drawing when off-screen, and is released when the viewer closes.
- A shared page-image store with a memory cap. It keeps the visible spread, both faces of the next and previous turns, and nearby pages, and drops the oldest. The rest of the document is never rendered at high resolution.
- A turn only starts once both faces are ready. Until then the current spread stays on screen, so there are no blank sheets and no texture swaps mid-turn.
- An explicit turn state (idle, dragging, turning, settling). Rapid input is queued or ignored, so turns never overlap and page numbers stay correct.
- No screen updates on every animation frame. The animation runs outside the normal page updates.
- Corner dragging with natural release: let go past halfway to finish the turn, before halfway to fall back. Click, tap and arrow keys still work.
- Correct handling of the cover, odd page counts and the first and last pages. Original page proportions are kept.
- On narrow phones, Flipbook switches to single pages when a two-page spread would be too small. Pinch-zoom and scrolling no longer trigger turns.
- If 3D isn't available, or turns run slowly, the viewer falls back to a flat turn without losing your place.
- Each change is measured: time to the first turn from cold, frame times for warmed turns, and memory after 50 turns.

## Stage 2: Page layout setting
- A creator setting, "My PDF contains: single pages / ready-made spreads", with a small preview. Ready-made spreads show as one sheet per spread. Landscape pages are never assumed to be spreads.

## Stage 3: Appearance panel (Clean and Studio)
- Clean (default): sharp, neutral pages, a plain background, a light shadow, no texture over the artwork.
- Studio: a restrained real-book look with page-edge thickness, spine, cover, matte, satin or textured finish, soft lighting and a grounded shadow, from a calm fixed viewing angle. Studio loads only when chosen. Clean never uses its lighting.
- A dashboard Appearance panel with a live preview:
  - Default reading mode and look
  - Background presets
  - Cover finish, paper texture and lighting
  - Shadow and page thickness, under Advanced
  - Show or hide the profile header and the download button
- Settings are saved per portfolio, and existing portfolios start with safe defaults. Plan rules stay as they are.

## Stage 4: Embedding and sharing
- A new page at `/embed/{code}`. It shows only published portfolios, never drafts, using the same rules as the normal link. It shows the book and compact controls only, and is kept out of search results.
- A "Copy embed code" button that gives a titled, lazy-loading, fullscreen-capable, responsive iframe with a fallback link.
- Embed options: starting page, reading mode, look and background. These can't override the creator's download setting.
- Framing is allowed only on the embed page. The live hosting headers are checked, and any hosting limitation is reported.
- A cover preview image for social media and email shares.

## Stage 5: Accessibility and verification
- Controls stay keyboard- and touch-reachable even while auto-hidden. Reduced motion means instant page changes. Links and selectable text are kept in Scroll and Page-by-page.
- Testing covers:
  - Portrait, landscape, spread and odd-page PDFs
  - A long, image-heavy file
  - Rapid clicks, interrupted drags, thumbnail jumps, resizing, zoom, switching looks
  - Embedding from a separate test page
- The final report covers measured results, what was actually tested (headless Chromium only) and remaining limits. There will be no claims of matching Issuu.

## Technical notes
- New `src/lib/portfolia/pageCache.ts`: an LRU store keyed by doc and page with a byte budget of about 150 MB on desktop and 60 MB on mobile. It renders pages through a single queue.
- `CurvedPage.tsx` becomes a persistent `BookRenderer` (one WebGLRenderer, shader warmed through `renderer.compile`, textures reused with `needsUpdate`). Drag progress drives a ref, not React state.
- New `viewer` fields on Portfolio: `mode`, `look`, `background`, `finish`, `paper`, `light`, `shadow`, `thickness`, `spreads`, `showHeader`. They are read with defaults, so stored data needs no migration.
- An embed route at `src/routes/embed.$code.tsx` uses `getPublicPortfolio`. The response sets `Content-Security-Policy: frame-ancestors *` on that route only, plus `robots: noindex`.
- Studio uses three.js only (React Three Fiber isn't needed) with a procedural room environment through PMREM, generated once.
