import { FIELD_NOTES_CODE } from "./field-notes-example";

/** The homepage example is Field Notes, the site's own feature book (shipped with the site, not published from an account). */
export const HOME_EXAMPLE_CODES = [FIELD_NOTES_CODE] as const;
export const chooseHomeExample = () => HOME_EXAMPLE_CODES[0];
