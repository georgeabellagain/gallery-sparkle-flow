/** Explicit owner-selected published examples; never choose an arbitrary account portfolio. */
export const HOME_EXAMPLE_CODES = ["adu2v", "pink28"] as const;
export const chooseHomeExample = (random = Math.random) => HOME_EXAMPLE_CODES[random() < .5 ? 0 : 1];
