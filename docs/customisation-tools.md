# Flipbook customisation tools

These additions build on PR #125's Studio caching and render-on-demand work.
`20261028120000_private_saved_looks.sql` was applied to the connected database
on 28 October 2026; catalog checks confirmed RLS, anonymous denial and the
owner/MFA policy. Local drafts keep
the library with their portfolio; cloud sync stores it in the owner-only
`portfolio_saved_looks` table, separate from publicly readable portfolio JSON.

## Where to find the controls

- **Customise → Book & turns / Paper:** Test page turn uses the actual reader and
  chosen curve/speed. On the last spread it tests a backward turn. It never changes the configured
  opening page. It respects reduced motion, waits for readiness and expires or
  cancels when its panel is left. Only one request is consumed.
- **Light & shade:** all 15 stable HDRI IDs now have descriptive names. Brightness,
  diffusion and white fill accept exact percentages as well as sliders. Number
  changes commit on blur/Enter and clamp to the existing supported ranges;
  Escape restores the current value. The photoshoot reuses these controls.
- **Paper:** explains Studio relief and offers a Studio preview without enabling
  Studio for public visitors. Owner previews can inspect a look excluded from
  the saved visitor options. Public reader restrictions remain in force.
- **Reading:** diagrams distinguish separate PDF pages from wide, precomposed
  spreads. The existing selector still controls interpretation.
- **Background:** each mode says whether it inherits the default or has its own
  background. Use default here reconnects one mode. Use this background in every
  mode copies the effective choice and removes overrides; appearance Undo restores
  the earlier choices.
- **Customise → Your looks & copy appearance:** save, rename, apply and remove
  named looks, or copy appearance from another owned portfolio. Keep up to 20
  looks per portfolio; the library lists looks across the account's portfolios.
  Looks stay with their source portfolio, so keep a copy if that portfolio will
  be deleted. Applying one changes the current draft; it does not overwrite the
  source. Save the portfolio to persist/sync changes; Discard restores them.
- **Scrapbook → selected item:** align left/centre/right/top/middle/bottom, type
  percentage coordinates, or use nudge buttons. Arrow keys move focused canvas
  items 0.5%, Shift 2%, Alt 0.1%. Optional snapping attracts nearby edges/centres;
  Alt bypasses snapping during a drag. Guides appear during moves. Tabs retain
  their existing safety margins. Alignment uses an item's unrotated box.

## Copying and asset safety

A visual allowlist includes book, paper, lighting, motion, tab style and background
settings, including uploaded backgrounds. It excludes the PDF, page interpretation,
opening/hidden pages, on-page content, automatic presentation, reader modes,
branding and portfolio-level identity/access/sharing settings.

Copied uploaded-background keys stay within the same owner's private storage.
Saved-look-only keys participate in file migration, retention and account export;
removing an active background cannot delete one still referenced by a saved look.
Public portfolio rows and responses omit the saved-look library and do not sign
its inactive files. The private table enforces owner access and completed MFA.
Applying premium settings still goes through the existing Personal save gate and
server-side publication enforcement.

## Validation

Regression tests cover visual-only copying, deep snapshots, absent-field resets,
background inheritance, inactive asset retention/public omission, position bounds,
video/hotspot aspect ratios, tab margins, snapping, keyboard precision and test-turn
request lifetime. Draft tests cover explicit Save, discard, persisted look metadata
and failed saves. Server-rendered control tests cover the descriptive lighting
choices, numeric inputs, layout guidance and test/preview controls.

Local `npm run check` passes: 347 tests, TypeScript and production build.
The new SQL regression passes on an isolated PostgreSQL-compatible database;
GitHub also runs it on PostgreSQL 16. Full visual interaction
on real devices and actual cross-device cloud persistence remain separate checks;
local tests do not certify either. No GPU rendering quality or resolution was reduced.
