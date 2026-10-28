import type { PageLink } from "./page-extras";

export function linkAppearance(link: Pick<PageLink, "iconKey" | "iconShape" | "iconFit" | "iconPadding" | "iconBackground">) {
  return {
    radius: link.iconShape === "circle" ? .5 : link.iconShape === "square" ? 0 : .22,
    fit: link.iconFit ?? (link.iconKey ? "cover" : "contain"),
    padding: (link.iconPadding ?? (link.iconKey ? 0 : 19)) / 100,
    background: link.iconBackground ?? "#ffffff",
  } as const;
}
