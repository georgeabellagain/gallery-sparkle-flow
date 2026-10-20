Page pictures: public portfolios open on small pre-made page images

APPLY AFTER "upload-faster-first-page" (which itself goes after "upload-video-on-page").
These files contain both of those changes plus this work.

Drag "src", "tests" and AGENTS.md from this folder onto the GitHub repo
(georgeabellagain/gallery-sparkle-flow) and commit. They replace files in place.

New files:
  src/lib/portfolia/page-images.ts          manifest, keys, checks (shared with the server)
  src/lib/portfolia/page-image-render.ts    draws one page as WebP/JPEG pictures
  src/lib/portfolia/page-images.worker.ts   runs that in a worker (pdf.js + OffscreenCanvas)
  src/lib/portfolia/make-page-images.ts     publish/replace/backfill: draw, upload, save manifest
  src/lib/portfolia/page-image-doc.ts       the viewer's picture document (stands in for pdf.js)
  src/components/pf/PageImagesNote.tsx      "Preparing quick-opening pages" status / button
  tests/page-images.test.ts, tests/page-images-store.test.ts

Not included on purpose: routeTree.gen.ts, dev routes, package.json, lockfiles.
No database migration and no new packages. Page pictures do not count toward the plan
allowance (your decision); each one is far below the per-file size cap.

What it does, measurements and limits: see ../PAGE-IMAGES.md
