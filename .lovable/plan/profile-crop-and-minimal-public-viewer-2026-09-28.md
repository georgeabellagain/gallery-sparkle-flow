# Profile crop and minimal public viewer

## What will change
- Add a profile-photo crop dialog after image selection, with drag-to-position, zoom, reset, cancel, and save controls.
- Save a new square cropped image while leaving the previously saved profile photo untouched until the user confirms.
- Make shared portfolio pages nearly full-screen: a compact creator header followed immediately by the PDF on a black stage.
- Hide the PDF toolbar and page navigation while idle on desktop, then reveal them when the pointer moves over the viewer or controls receive keyboard focus.
- Keep essential controls visible on touch devices, where hover is unavailable.
- Preserve the existing scroll/page-by-page choice, zoom, full-screen, download, keyboard navigation, selectable text, and PDF links.

## Logo direction
- Create two distinct colourful geometric Portfolia logo concepts.
- Present both for selection before replacing the existing text logo.
- Apply the selected logo consistently at navigation sizes while retaining accessible text.

## Verification
- Test profile photo selection, positioning, zooming, saving, and cancellation.
- Test the public sample and local portfolio pages at desktop and mobile sizes.
- Confirm idle controls hide correctly, pointer and keyboard interactions reveal them, and both PDF reading modes still work.

## Technical details
- Use the browser canvas to generate the square crop locally; no upload service or account changes.
- Scope the immersive presentation to visitor-facing portfolio links so the create-page preview remains practical.
