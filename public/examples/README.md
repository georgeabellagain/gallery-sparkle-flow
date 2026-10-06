# Profession demonstrations

Six-page fictional PDFs authored for Portfolia. Architecture and graphic-design drawings/layouts are original vector artwork. No customer, real commission, building or professional outcome is implied. Each PDF is labelled as a demonstration.

`quiet-coast.jpg` is AI-generated imagery used only in the clearly disclosed photography demonstration. It is not a real photographic commission. The original generated triptych was JPEG-encoded for delivery; the PDF layout frames each panel. No third-party photograph or stock licence is required for these generated assets.

Generated with the built-in image tool. Final prompt:

> Use case: photorealistic-natural. Create one refined photographic triptych for a clearly labelled AI demonstration photography portfolio called Quiet coast. Three equal vertical photographs side by side with no gutters, each a different composition of a fictional quiet British coastline: left a distant sea horizon with silver water and low dunes; centre sculptural pale limestone rock and calm sea seen close up; right dune grasses in soft early morning light with water behind. Editorial fine-art landscape photography, restrained sea-grey, chalk and muted olive palette, subtle film grain, delicate natural diffused light, authentic fine texture. Sophisticated art-book quality. Landscape canvas 3:2. Absolutely no people, lettering, logos, watermark, picture frames or mockup.

Files: `{architecture,graphic-design,photography}.pdf`, matching `-cover.webp` previews, `-social.jpg` sharing cards, and `quiet-coast.jpg` as the regeneration source. Scarlett Bushell's real fashion example remains account-backed and is not duplicated here.

Regenerate with `node scripts/build-profession-examples.mjs`. The development generator requires `pdf-lib`, `pdfjs-dist` and `@napi-rs/canvas` (the last can be installed locally without saving to package.json). These are prebuilt static assets; no canvas or PDF generation runs in the deployed server. An optional first argument supplies a replacement original image to encode before regeneration.
