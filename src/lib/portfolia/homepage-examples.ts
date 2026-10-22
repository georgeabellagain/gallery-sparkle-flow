/**
 * The homepage example is Field Notes as published from the owner's account, so its lighting, backdrop and pages
 * can be edited in the editor like any portfolio. If it can't be loaded (unpublished, offline), the copy shipped
 * with the site (field-notes-example.ts) shows instead.
 */
export const FIELD_NOTES_PUBLISHED_CODE = "67wkw";
export const HOME_EXAMPLE_CODES = [FIELD_NOTES_PUBLISHED_CODE] as const;
export const chooseHomeExample = () => HOME_EXAMPLE_CODES[0];
