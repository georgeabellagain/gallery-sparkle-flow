# Roadmap

- [x] Dedicated /pricing route + footer link next to Terms
- [x] Replace homepage "What visitors see" sample page image with a sharper, more interesting example
- [x] SEO landing pages: /free-pdf-portfolio, /free-portfolio-website, /architecture-portfolio
- [x] Downloadable personal portfolio QR codes and related SEO messaging
- [x] Discipline SEO pages (fashion, photography, design, art, student etc.)

- [x] Flipbook: curved page turn, no shadow
- [x] Flipbook: desktop two-page spreads with single-page viewing on phones
- [x] Flipbook: replace segmented turn with smooth continuous sheet to remove seams and frame drops
- [x] Flipbook: slow the turn by 25% and extend the curved sheet beyond the book frame

## Queued flipbook work — resume when credits are available

- [x] Targeted reader refinements (complete together before later stages):
  - Use single-page Flipbook viewing on mobile while retaining desktop spreads.
  - Increase the existing page curvature so the bend is more visible.
  - Keep artwork colours consistent throughout turns; remove whole-page darkening and retain only subtle fold shadows.
  - Add space below the toolbar so the book's top edge remains visible.
  - Slightly reduce the book's default size at 100% zoom.
  - Centre standalone first and last pages.
  - Smoothly centre the full spread when moving from a standalone page to two pages, and reverse that motion when returning.
  - Reuse existing components and dependencies; avoid unrelated refactoring, redesigns and extra features.
- [x] Stage 2: Add the creator setting for PDFs containing single pages or ready-made spreads.
- [x] Stage 3: Add the Clean and Studio appearance panel and save settings per portfolio.
- [x] Stage 4: Add the published-only embed viewer, embed code/options and sharing cover preview.
- [x] Stage 5: Complete accessibility work and one focused verification pass covering all queued changes.
- [x] Run focused checks once after the related implementation is batched; provide a brief completion summary.

## Flipbook polish (Oct 1)
- [x] Sequential slide → turn (open) and turn → slide (close); no overlapping animations
- [x] Studio materials via lit relief maps (matte/satin/textured/natural)
- [x] Oak and walnut tabletop backgrounds with contact shadows
- [x] Centre seam removed
- [x] Dashboard preview opens the portfolio
- [x] Homepage flipbook showcase from real viewer captures

## Flipbook and workspace refinement
- [ ] Fix forward turns for ready-made spreads and reveal destination spreads only after turns complete
- [ ] Double flip duration with a faster midpoint and focused forward/backward checks
- [ ] Add owner return navigation and route own-portfolio clicks to portfolio editing unless explicitly previewing
- [ ] Separate profile editing from portfolio editing
- [ ] Simplify viewer appearance controls, retain background colour, and add Personal image uploads
- [ ] Overhaul the homepage around the flipbook with a restrained monochrome book animation
- [ ] Modernise the site toward a clean white gallery aesthetic without unrelated feature changes
