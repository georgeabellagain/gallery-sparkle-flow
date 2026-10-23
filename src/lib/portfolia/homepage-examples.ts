/**
 * The homepage example is the owner-selected published fashion lookbook, opened on its pages 4–5. Features are added
 * to it in the editor like any portfolio. Field Notes stays published from the owner's account (and ships with the
 * site, field-notes-example.ts) for the other places that show it.
 */
export const LOOKBOOK_CODE = "adu2v";
export const FIELD_NOTES_PUBLISHED_CODE = "67wkw";
export const HOME_EXAMPLE_CODES = [LOOKBOOK_CODE] as const;
export const chooseHomeExample = () => HOME_EXAMPLE_CODES[0];
/** The page the homepage example opens on (its spread is pages 4–5). */
export const HOME_EXAMPLE_START_PAGE = 4;
