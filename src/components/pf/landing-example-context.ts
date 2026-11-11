import { createContext, useContext } from "react";

/** A PDF that a section below the hero asks the hero's one live viewer to open (see LandingExampleProvider). */
/** Either a PDF to open in the reader, or one of the two built-in live examples (the examples page swaps between them). */
export type HeroExample = { url: string; fileName: string; /** The six-page demonstrations carry a Projects menu; other books do not. */ projects?: boolean } | { demo: "portfolio" | "product" };
export type ExampleState = { example: HeroExample | null; showExample: (example: HeroExample) => void; clearExample: () => void };
export const ExampleContext = createContext<ExampleState | null>(null);

export const useHeroExample = () => useContext(ExampleContext);
