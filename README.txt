Faster first page for public portfolios (streamed PDFs)

APPLY AFTER "upload-video-on-page". This folder is built on top of it: PdfViewer,
PortfolioPage, Visitor, assets and BookView contain the video changes plus this work,
and PdfViewer imports PageVideoHtml, which only the video upload adds.

Drag "src", "tests" and AGENTS.md from this folder onto the GitHub repo
(georgeabellagain/gallery-sparkle-flow) and commit. They replace files in place.

New files: src/lib/portfolia/remote-pdf.ts, tests/remote-pdf.test.ts.
Not included on purpose: routeTree.gen.ts, dev routes, package.json, lockfiles.
No database migration and no new packages.

What it does, measurements and the next step (page images made at publish):
see ../FASTER-FIRST-PAGE.md
