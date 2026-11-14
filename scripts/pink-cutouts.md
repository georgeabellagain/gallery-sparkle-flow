# Pink cutout animations

Generate the replacement pack from the original 24-page Pink PDF:

```sh
python -m pip install Pillow PyMuPDF numpy opencv-python-headless
python scripts/build-pink-cutouts.py /path/to/pink.pdf /path/to/output
```

The generator uses original-pixel masked layers, translated or rotated about their joints. It does not use displacement fields or mesh deformation. Exposed flat background is restored from the page colour; small occluded regions are inpainted, and the dress beneath the clapping palms is patched from the original dress. Eyelids and the turtle mouth use small discrete poses. Inspect the generated QA frames before importing a new pack.

Page 9 targets the airborne mouse between the text lines at the top, not the rabbit on the horse or the mouse on the dog. Page 8 targets the yellow lightbulb glass above Dad's head. Other pages isolate the head and Zs (6), balancing stack and girl (7), girl and flamingo eye (12), pig head/eye/tail (13), hanging sign (14), turtle head/mouth (15), hands/forearms (18), separate tails (19), and rainbow title (22).

All loops are 3 seconds at 20 fps. Each has a constant transparent mask and a tight crop. Files remain under the existing 2 MB image-animation allowance; retain lossless output where it fits, using high-quality WebP only for larger crops. The square placement compensates for each crop's aspect ratio, as required by the existing sticker model.

After reviewing a regenerated pack, copy `placement.json` into `PINK_NEW_ANIMATIONS` in `src/lib/portfolia/pink-animation-placement.ts`. Its content hashes deliberately reject different bytes. Import the eleven WebPs together with the Pink portfolio's aligned import control, save, then copy the aligned animations in the Pink product editor and save. Existing IDs replace the eleven rejected clips without duplicating them or changing the original eight animations or the preview-page selection.
