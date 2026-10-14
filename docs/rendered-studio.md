# Rendered Studio

An optional publishing mode. The editor and live Studio remain available.

## Creator flow

Customise → Lighting & paper → Studio → Render Studio in HD. Keep the tab open until finished. The renderer prepares all PDF artwork, selected lighting, background and notes, fits the open notes inside the capture frame, and exports 1920×1080 images and clips. A successful render enables rendered playback on shared Studio links. The preview/editor stays live.

H.264-capable WebCodecs browsers use Mediabunny to encode every sample at a fixed 60 FPS timestamp. Scene and note animations advance by frame count, with encoder backpressure; a slower rendering device takes longer instead of dropping animation samples. Browsers without that encoder use a visibly labelled MediaRecorder real-time fallback, whose achieved frame rate depends on the device. Unsupported browsers show a message. A render is bounded at 250 MB.

Rendering can be cancelled; switching tabs cancels it to avoid paused background animation. Partial output is cleaned up. A changed PDF/appearance/note configuration invalidates the artifact, and live Studio is used until the creator renders again. Signature comparison is canonical, so cloud JSON key ordering does not invalidate a valid render.

## Recorded states

Each spread has a closed-note still, a forward turn clip, and a separate backward turn clip where applicable. Every visible sticky note/foldout has an opening clip, an open-state still and a closing clip. Website links and tabs retain interactive hit areas.

- Clicking a closed note plays its opening clip and holds the open still.
- Clicking it again, or Close note, plays its closing clip.
- Turning with no note open plays only the turn clip; all note sections are skipped.
- Turning with an open note closes it first, then plays the turn.
- Opening another note closes the previous one first. This initial implementation supports one open note at a time.
- Clicking either book side, swiping, or Previous/Next turns the page. Arrow keys work when the rendered viewer is focused.
- Zoom uses the existing toolbar; dragging while zoomed pans the recorded scene. It does not scrub the page turn.
- Page tabs and project/page navigation jump to the corresponding recorded spread.

The viewer resolves assets through the existing private portfolio-file storage and signed published URLs. Rendered files participate in cloud sync, PDF replacement and asset cleanup. Adjacent turn clips are prefetched. Errors expose a live-Studio fallback. Still images and clips use the same curved scene/camera, avoiding the earlier 3D-to-flat handoff.

## Practical limits and verification

The capture is a fixed landscape camera. Zooming magnifies recorded pixels rather than rerendering PDF vectors. Large notes require wider framing. Exporting is browser-side, not a server render queue. This initial implementation does not scrub a turn or combine independently open notes.

TypeScript, production build and deterministic state/timing/storage tests are checked. Actual WebGL → WebCodecs/MediaRecorder → private storage → published video playback still needs an end-to-end check on a graphics-enabled browser, including forward/backward turns, overlapping notes, fullscreen/mobile and cancellation. The production storage bucket was checked read-only: it has no MIME restriction and a 50 MB per-file limit; the renderer also checks this limit. Do not infer GPU frame rate from unit tests.

Dependency: Mediabunny 1.61.4, lazily imported for rendering, unmodified MPL-2.0. Licence text is available at /licenses/mediabunny.txt; upstream source https://github.com/Vanilagy/mediabunny.
