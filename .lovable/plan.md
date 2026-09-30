# Smooth the Flipbook page turn

## Viewer motion
- Keep the current spread fixed until the turn completes, then swap pages without a visible layout change.
- Render the turning sheet with a front and back face, natural easing, subtle shading, and GPU-stable transforms.
- Ignore repeated clicks while a turn is in progress so animations cannot overlap.

## Layout stability
- Give both page slots a stable aspect ratio and preserve the viewer height between spreads.
- Prevent control focus, corner targets, and page-number changes from shifting the book.
- Keep reduced-motion behavior as an immediate, non-animated page change.

## Verification
- Test forward and backward turns, rapid clicks, keyboard navigation, and mobile sizing.
- Confirm the viewer does not move vertically during a page turn and the preview remains error-free.
