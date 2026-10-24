import type { BackgroundContext, ViewerSettings } from "./store";
export type BackgroundChoice = Pick<
  ViewerSettings,
  "backgroundColor" | "backgroundKey" | "backgroundPreset" | "backgroundFit"
>;
export function backgroundFor(view: ViewerSettings, context: BackgroundContext): ViewerSettings {
  const own = view.backgrounds?.[context];
  return own
    ? {
        ...view,
        background3D: false,
        ...own,
        backgroundKey: own.backgroundKey,
        backgroundPreset: own.backgroundPreset,
        backgroundColor: own.backgroundColor ?? view.backgroundColor,
        backgroundFit: own.backgroundFit,
      }
    : { ...view, background3D: false };
}
export function backgroundKeys(view?: Partial<ViewerSettings>): string[] {
  return [
    ...new Set(
      [
        view?.backgroundKey,
        // The creator's own logo in the viewer lives with the viewer's pictures, so it saves and publishes the same way.
        view?.brandLogoKey,
        ...(view?.backgroundUploads ?? []),
        ...Object.values(view?.backgrounds ?? {}).map((v) => v?.backgroundKey),
      ].filter((v): v is string => Boolean(v)),
    ),
  ];
}
