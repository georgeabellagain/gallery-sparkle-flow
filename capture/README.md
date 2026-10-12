# Original feature video recording

The capture entry mounts the original `FeatureAnimation` 3D scenes using `live`, full quality PDF textures and a 1600 × 1000 frame. The source is the explicitly selected Scarlett Bushell portfolio (`adu2v`). The PDF stays local and is excluded from Git.

Run the capture Vite config and recorder in the same network environment. The recorder requires Playwright, a compatible Chromium executable and ffmpeg. It uses a controlled browser clock to avoid capturing software-rendering slowdown as stutter, and encodes H.264 at 30 fps / CRF 18. Stationary frames are reused; moving pages and changing light are captured from the original renderer. Forward and reversed sections can be joined for a continuous return loop.

The homepage uses `/features/{lighting,background,tabs}.mp4` and matching WebP posters. Only the selected slide mounts. Videos pause offscreen and honour the slideshow's pause/reduced-motion state; `object-contain` keeps every page edge in frame. Other feature demos retain their existing behaviour.

Do not commit the featured PDF or temporary capture frames. Public upload and production release require authorization before publishing these portfolio-derived videos.

The paged, scroll, links and share demos are recorded by `capture/record-flat.cjs` at 1600 × 1000, 30 fps and H.264 CRF 17 from artwork rendered at up to 1920 pixels. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` if needed. Before recording, place the selected PDF at `public/capture/featured.pdf` and copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/capture/pdf.worker.min.mjs`. Run the capture Vite server and recorder in the same network environment. The homepage frame uses the matching 8:5 ratio with cover sizing, keeping all recorded scenes full width.
