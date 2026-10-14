# Rendered Studio

An optional publishing mode. The editor and live Studio remain available.

## Creator flow

Customise → Lighting & paper → Studio → Render Studio in HD. Keep the tab open until finished. The renderer prepares all PDF artwork, selected lighting, background and notes, fits the open notes inside the capture frame, and exports up to 3840 pixels on the long edge images and clips. A successful render enables rendered playback on shared Studio links. The preview/editor stays live.

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
- Zoom uses the existing toolbar and rendered controls. Dragging the background while zoomed pans the recorded scene; page clicks play turns.
- Page tabs and project/page navigation jump to the corresponding recorded spread.

The viewer resolves assets through the existing private portfolio-file storage and signed published URLs. Rendered files participate in cloud sync, PDF replacement and asset cleanup. Adjacent turn clips are prefetched. Errors expose a live-Studio fallback. Still images and clips use the same curved scene/camera, avoiding the earlier 3D-to-flat handoff.

## Practical limits and verification

The capture is a fixed camera matching the window proportions. Zooming magnifies recorded pixels rather than rerendering PDF vectors. The capture uses the same baseline camera scale as Simple; notes extending outside that frame may be cropped. Exporting is browser-side, not a server render queue. Only one note is open at a time.

TypeScript, production build and deterministic state/timing/storage tests are checked. Actual WebGL → WebCodecs/MediaRecorder → private storage → published video playback still needs an end-to-end check on a graphics-enabled browser, including forward/backward turns, overlapping notes, fullscreen/mobile and cancellation. The production storage bucket was checked read-only: it has no MIME restriction and a 50 MB per-file limit; the renderer also checks this limit. Do not infer GPU frame rate from unit tests.

Dependency: Mediabunny 1.61.4, lazily imported for rendering, unmodified MPL-2.0. Licence text is available at /licenses/mediabunny.txt; upstream source https://github.com/Vanilagy/mediabunny.


### Render controls and preview
The editor's customise subpanels have a Back button. Capture follows the window proportions and uses the same baseline camera scale/inset as Simple. A bounded high-resolution surface (up to 3840 pixels on the long edge, 8.3 million pixels) and 32 Mbps video preserve more detail when zoomed. Stills use maximum WebP quality. Old captures need re-rendering.

Export progress counts saved stills and clips, including notes and both turn directions. Finish returns to editing. View rendered version opens an interactive preview from the editor or completed render dialog.

Rendered playback fills the viewer width at its recorded aspect ratio. Page clicks turn pages; the wheel zooms, and click-and-hold dragging pans when zoomed. Dragging does not scrub or open pages. Movement beyond five pixels suppresses the subsequent click. There is no preparing-animation indicator. The bottom Simple/Studio switch returns to the live non-video Simple viewer, with the same viewport aspect ratio, and Studio restores rendered playback. Zoomed video remains rasterised; it cannot recover vector detail indefinitely.
