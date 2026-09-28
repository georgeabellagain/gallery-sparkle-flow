# Banner crop and personalised paths

## What will change
- Open a wide banner crop window after image selection, with drag-to-position, zoom, reset, cancel, and save controls.
- Save the cropped banner only after confirmation, leaving the current banner unchanged when cancelled or if saving fails.
- Change personalised portfolio addresses to `portfolia.site/name`, including the chooser, dashboard, copy/open actions, and plan examples.
- Add a root-level portfolio page for personalised names while retaining `/p/code` free links and the previous `/u/name` links.

## Verification
- Test banner selection, repositioning, zooming, saving, cancellation, replacement, and removal.
- Test published and unpublished personalised paths, copying/opening the new address, and existing free links.
- Check desktop and mobile layouts and confirm the project builds cleanly.

## Technical details
- Crop banners locally in the browser to a wide fixed ratio and store each confirmed crop as a new browser-local image.
- Reserve existing site page names so personalised addresses cannot conflict with Portfolia pages.