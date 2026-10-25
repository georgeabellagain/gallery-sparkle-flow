import { useEffect } from "react";

const OPTIONAL_FONTS: Record<string, string> = {
  "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
  "DM Sans": "DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000",
  "Space Grotesk": "Space+Grotesk:wght@300..700",
  "Archivo": "Archivo:ital,wght@0,100..900;1,100..900",
  "JetBrains Mono": "JetBrains+Mono:ital,wght@0,100..800;1,100..800",
  "Playfair Display": "Playfair+Display:ital,wght@0,400..900;1,400..900",
  "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,300..700;1,300..700",
  "Fraunces": "Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900",
  "Inter": "Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900",
  "Manrope": "Manrope:wght@200..800",
  "Syne": "Syne:wght@400..800",
  "Bricolage Grotesque": "Bricolage+Grotesque:opsz,wght@12..96,200..800",
  "Caveat": "Caveat:wght@400..700",
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
