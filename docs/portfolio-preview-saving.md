# Portfolio previews, explicit saves and book marketing

The /edit route opens a memory-only portfolio draft. Existing editing controls
update this draft; getSavedDoc supplies canonical data to cloud sync. Save commits
it to local storage and schedules cloud sync. Draft previews never reach the
published page. In-app navigation offers Save & leave, Discard & leave and Keep
editing; browser close/reload uses the browser's native unsaved-changes prompt.
Drafts are discarded on unmount/reload. A failed save leaves the draft intact.
Original files remain protected while replacing images/PDFs, and discarded new
assets are cleaned up. Switching books parks the saved version rather than draft.

Free may save HDRIs 1–4, solid colours, Warm wood and Soft concrete backgrounds.
Personal may save all 15 HDRIs, every bundled background and uploaded pictures.
Everyone can preview these choices in the editor. Personal choices are labelled.
A server billing check guards the normal Save flow. A database trigger rejects
new premium viewer settings written by unpaid owners, even with forged JSON plan
fields. Public responses also downgrade unpaid viewer settings. The migration
supabase/migrations/20261016162000_premium_appearance.sql is applied separately.

The book marketing panel saves a description, button label and external http(s)
purchase URL. Public previews display that call to action; Portfolia does not
handle book checkout. /book-marketing is indexable with canonical/FAQ metadata,
sitemap inclusion and internal links. Exact spine artwork, binding geometry and
print-proof validation are not part of this change.
