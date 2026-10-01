# Portfolio Canvas

Create a polished, interactive prototype of **Portfolia**, a minimalist portfolio platform for artists, designers, architects, photographers and other visual creatives.

The core promise is: **Upload or create your portfolio, choose how it is experienced, and share it through one personal link.**

Make the basic journey exceptionally simple, with powerful design controls available when requested. The prototype should demonstrate real interactions, not just static screens.

## 1. Design direction

Use a white background, dark typography, generous whitespace, fine grey dividers and restrained controls. The experience should feel professional, calm and gallery-like.

Avoid oversized marketing sections, decorative gradients, heavy shadows, excessive cards and unnecessary dashboard clutter. Creative work should dominate the screen.

Keep the platform interface visually consistent. Allow creators to customise their portfolio’s fonts, colours, backgrounds and composition.

## 2. Homepage and discovery

Create a simple homepage offering three clear actions:

* Create a portfolio.
* Explore portfolios.
* Search creators and work.

Include a modest selection of attractive demonstration portfolios covering architecture, photography, graphic design and fine art. Label them as examples.

The discovery page should support search and simple creative-discipline filters. Only portfolios explicitly opted into discovery should appear.

Do not add likes, followers, comments or social feeds. Instagram and Pinterest are references for presentation layouts, not social functionality.

## 3. Core creation journey

Make this journey work end to end:

**Upload or start blank → arrange content → select viewing style → preview → publish → share.**

Start with two equally prominent options:

* **Upload an existing PDF**
* **Create from scratch**

Allow optional templates, but always offer a genuinely blank canvas.

Avoid a long setup questionnaire. Let creators begin immediately and configure details later.

Provide a minimal dashboard showing existing portfolios, drafts, storage usage and “Create portfolio”.

## 4. Portfolio organisation

Support portfolios with one or multiple projects.

For multiple projects, offer a homepage with project covers, titles and optional short descriptions. Each project opens into its own presentation.

For a single project, allow the shared link to open directly into the work.

Include an optional About page with:

* Name and discipline.
* Biography.
* Portrait.
* Contact details and external links.
* Uploaded CV with a download link.

Creators decide which fields appear. Hide unused sections completely.

## 5. Five essential viewing styles

Implement all five styles as working prototype features:

1. **Paged presentation:** previous/next controls, page count and keyboard navigation.
2. **Continuous vertical scroll:** content flows down the page and loads progressively where needed. Never repeat content to simulate infinity.
3. **Instagram-style grid:** a regular, clean thumbnail grid.
4. **Pinterest-style masonry:** varied image heights that preserve image proportions.
5. **Page-turn book:** an interactive bottom-right corner that turns the page with a convincing animation. Include backward navigation, touch controls and accessible button alternatives.

The creator chooses the style. Visitors do not receive a layout switcher.

Allow a portfolio-wide default and optional project-specific overrides.

Show each layout using the creator’s own content in the editor. Switching layouts must preserve all content and remember previous layout settings.

Use complete designed pages as tiles when necessary. Do not automatically dismantle a carefully arranged composition when switching to a grid.

## 6. PDF upload and adaptation

Allow real PDF upload and page preview within the prototype.

Preserve the PDF’s original page design by default. Support:

* Reordering, hiding and removing pages.
* Adding text, images and links as overlays.
* Displaying imported pages in all five viewing styles.
* Selecting a rectangular region of a PDF page and creating a separate cropped image item.
* Adding clickable regions over images within PDF pages.

Clickable regions must remain aligned when pages resize. They can open an image viewer with optional details or follow a creator-defined external link.

Keep original PDFs available and unchanged.

Clearly distinguish intact PDF pages from separately cropped image items. Do not claim to automatically convert every PDF element into an editable object.

Provide useful upload progress and error messages. A failed upload should preserve the rest of the creator’s work.

## 7. Simple editor with optional advanced controls

Use a large central canvas, compact toolbar and collapsible panels.

The default experience should focus on:

* Adding images and text.
* Reordering content.
* Selecting a viewing style.
* Changing fonts and colours.
* Previewing and sharing.

Provide an **Advanced controls** toggle for detailed design work. When enabled, support:

* Free positioning, resizing and rotation.
* Layers and stacking order.
* Locking and hiding elements.
* Opacity.
* Image cropping and focal-point adjustment.
* Background colours.
* Detailed typography.
* Margins, padding and gaps.
* Alignment guides and snapping.
* Grid columns and spacing.

Support duplication, deletion, undo and redo throughout.

Allow users to click text and edit directly. Avoid nested dialogs for routine changes.

Use the same underlying content across viewing styles. Free positioning applies within page compositions; grid and masonry layouts arrange standalone items or complete compositions.

Preserve image-specific interactions within native page compositions.

## 8. Mobile experience

Make published portfolios responsive and comfortable to browse on phones.

Scale fixed page compositions proportionally. Reflow standalone content appropriately.

Provide desktop and mobile previews, with clearly separated mobile overrides where needed.

On mobile, make these creator actions straightforward:

* Upload images.
* Edit text and image details.
* Reorder items.
* Preview and share.

Detailed canvas editing can be optimised for desktop. Explain this clearly if an advanced action is unavailable on a small screen.

## 9. Individual image viewer

Clicking an image opens a focused viewer for that image only.

Include:

* Zoom.
* Pan when zoomed.
* Reset zoom.
* Visible close control.
* Escape to close.
* Return to the same portfolio position on closing.

Do not include next/previous image arrows, a thumbnail carousel or swipe navigation to another image.

Creators choose which optional details appear:

* Title.
* Description.
* Date.
* Medium or materials.
* Dimensions.
* Credits.
* Custom text fields.
* External links with custom labels, such as “Buy this print”.

If no details are enabled, show the image and zoom controls only. Never display an empty details panel.

Store accessibility descriptions separately from visible captions.

## 10. Privacy, publishing and sharing

Use three clearly described states:

* **Draft:** not published.
* **Unlisted:** accessible to anyone with the link, excluded from Portfolia discovery.
* **Discoverable:** explicitly included in Portfolia search and browsing.

Default publishing to **Unlisted**.

Use this explanation: “Anyone with your link can view. Your portfolio will not appear in Explore.”

Do not describe unlisted portfolios as access-controlled or confidential.

Keep external search-engine indexing disabled by default. Offer a separate opt-in for indexing discoverable portfolios. Do not imply that search exclusion prevents access.

Provide a share panel with:

* Portfolio address.
* Copy-link button.
* Visibility settings.
* Visitor preview.
* Clear published status.

The intended future address format is `name.portfolia.com`, subject to domain ownership and configuration.

For the prototype, use routes such as `/p/name`. Do not claim that portfolia.com or real subdomains are connected.

Keep draft edits separate from the published version. Visitors should continue seeing the last published version until the creator explicitly publishes changes.

## 11. Saving, recovery and ownership

Make creators confident that their work is safe.

Implement:

* Visible “Saving”, “Saved” and “Couldn’t save” states.
* Retry behaviour without discarding edits.
* Undo and redo.
* Recoverable deletion with a clear trash area.
* Named version snapshots and restoration.
* Preservation of uploaded originals.
* Export of original assets and portfolio content/layout data in a downloadable archive.

Explain that the archive is a backup, not necessarily a standalone hosted website.

Switching viewing styles must be reversible. Publishing must not overwrite the editable draft structure or destroy previous compositions.

For this prototype, use appropriate browser storage, such as IndexedDB for uploaded assets. Clearly state that local storage is limited to this browser and can be cleared; do not describe it as a cloud backup.

If a production capability is not implemented, label it honestly rather than showing a misleading success message.

## 12. Subscription concept

Show a restrained, provisional Free/Pro comparison. Do not implement billing.

**Free:**

* One portfolio with multiple projects.
* All five viewing styles.
* Core design controls.
* PDF import.
* Image details and external links.
* Unlisted sharing.
* Optional discovery.
* A configurable storage allowance.

**Pro concept:**

* More storage.
* Multiple portfolios and client-specific versions.
* Custom domain connection.
* Removal of Portfolia branding.
* Visitor analytics.
* Password-protected sharing.

Keep essential prototype features available for testing.

Do not advertise unlimited storage or invent final prices. Mark unimplemented Pro capabilities as planned features.

Show storage use clearly. Explain future upgrade and downgrade consequences before users commit. Never imply that cancellation immediately deletes work.

Subscription buttons should open a clearly labelled prototype information modal, not a checkout.

## 13. Prototype scope and honesty

This is a prototype for refining the product, not a production service.

Provide a demo creator workspace without requiring real authentication. Use realistic example portfolios so the product is immediately explorable.

Implement real interactions for uploading, editing, switching styles, opening image details, saving locally and previewing publication.

If publishing and sharing only work in the same browser, say so clearly. Do not pretend another person can access locally stored uploads through a shared URL.

Keep prototype-specific explanations in the creator interface. Published portfolio previews should remain clean.

Do not integrate payments, domain purchases or production analytics.

## 14. Accessibility and performance

Support keyboard navigation, visible focus states, readable contrast and accessible dialogs.

Respect reduced-motion preferences. Replace page-turn animation with a simple transition when reduced motion is enabled.

Use appropriately sized previews and progressive loading for large portfolios while preserving originals.

Keep navigation responsive during uploads and rendering. Show clear progress instead of freezing the interface.

## 15. Acceptance criteria

The prototype is complete when I can:

1. Start with either a PDF or a blank canvas.
2. Create a portfolio containing multiple projects.
3. Add images and directly edit text.
4. Use advanced layers, positioning and opacity controls.
5. Switch between all five viewing styles without losing work.
6. Add optional image details and an external purchase link.
7. Open one image, zoom it and close it without navigating to another image.
8. Add clickable regions to an imported PDF page.
9. Preview desktop and mobile presentation.
10. Publish an unlisted prototype version and inspect its visitor view.
11. Continue editing without changing the published version.
12. Explicitly opt a portfolio into discovery.
13. Recover a deleted item or restore a saved version.
14. Export portfolio content and original assets.

Build the experience around a short, satisfying path from existing work to a polished presentation. Advanced flexibility should be available without making the first experience complicated.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gallery-sparkle-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/86363cf5-7611-481e-8bb2-90e848ccdb36).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
