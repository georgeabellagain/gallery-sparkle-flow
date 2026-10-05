import { useEffect } from "react";

const OPTIONAL_FONTS: Record<string, string> = {
  "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
  "DM Sans": "DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000",
  "Space Grotesk": "Space+Grotesk:wght@300..700",
  "Archivo": "Archivo:ital,wght@0,100..900;1,100..900",
  "JetBrains Mono": "JetBrains+Mono:ital,wght@0,100..800;1,100..800",
};

/** Load only the selected optional heading font, once per browser session. */
export function usePortfolioFont(font?: string) {
  useEffect(() => {
    const family = Object.keys(OPTIONAL_FONTS).find((name) => font?.includes(name));
    if (!family) return;
    const id = `portfolio-font-${family.replace(/ /g, "-").toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${OPTIONAL_FONTS[family]}&display=swap`;
    document.head.appendChild(link);
  }, [font]);
}
