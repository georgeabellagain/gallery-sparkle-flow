# Creator-controlled viewer options

## What will change
- Replace the single reading-mode selector in the portfolio editing panel with checkboxes for Scroll, Page by page, and Flipbook.
- Treat the saved reading mode as the initial mode; if it is unticked, automatically choose the first enabled mode. Keep at least one mode enabled.
- Show visitors only the reading modes the creator enabled.
- When Flipbook is enabled, show creator-side checkboxes for Simple and Studio. Keep at least one appearance enabled.
- Move all Studio controls into the editing side panel. Visitors will only see appearance choices explicitly enabled by the creator and will not be able to alter paper, lighting, or brightness.
- Save Studio paper, lighting, and brightness with the portfolio so published links reproduce the creator's chosen setup.
- Make Studio lighting cast visible shadows from both resting pages and the turning page.

## Technical details
- Extend `ViewerSettings` compatibly with optional enabled-mode/enabled-look lists and persisted Studio brightness/lighting values; old portfolios retain their current defaults.
- Filter the public viewer toolbar from those saved lists and pass the chosen saved Studio setup into the persistent book scene.
- Remove the visitor-side Studio settings panel from the flipbook.
- Ensure settled page meshes continue to cast onto the Studio shadow surface and tune the shadow surface so resting-page shadows remain visible.
- Run focused type/build checks and verify the edit panel plus a shared flipbook in the preview.
