import { createContext, useCallback, useEffect, useState, type RefObject } from "react";
import { toggleFullscreen, type FullscreenDocument } from "@/lib/portfolia/fullscreen";

export const EditorFullscreenContext = createContext<{
  full: boolean;
  toggle: () => Promise<void>;
  container: RefObject<HTMLDivElement | null>;
} | null>(null);

/** Fullscreen includes the preview, draggable tool dock and editing panels. */
export function useEditorFullscreen(container: RefObject<HTMLDivElement | null>) {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const change = () => {
      const doc = document as FullscreenDocument;
      setNative((doc.fullscreenElement ?? doc.webkitFullscreenElement) === container.current);
    };
    document.addEventListener("fullscreenchange", change);
    document.addEventListener("webkitfullscreenchange", change);
    return () => {
      document.removeEventListener("fullscreenchange", change);
      document.removeEventListener("webkitfullscreenchange", change);
    };
  }, [container]);
  useEffect(() => {
    if (!fallback) return;
    const html = document.documentElement, body = document.body;
    const before = [html.style.overflow, body.style.overflow];
    html.style.overflow = body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setFallback(false); };
    window.addEventListener("keydown", escape);
    return () => {
      html.style.overflow = before[0]!; body.style.overflow = before[1]!;
      window.removeEventListener("keydown", escape);
    };
  }, [fallback]);
  const toggle = useCallback(async () => {
    const result = await toggleFullscreen(container.current, document as FullscreenDocument, fallback);
    setFallback(result === "fallback");
  }, [container, fallback]);
  return { full: native || fallback, fallback, toggle, container };
}
