import { useEffect, useRef, useState } from "react";

/**
 * Whole-page drag and drop: a file dropped anywhere on the page goes to `onFile`. Controls that handle a drop
 * themselves call preventDefault first, so they are not handled twice. Returns whether a file is being dragged over.
 */
export function usePageFileDrop(onFile: (file: File) => void, enabled = true) {
  const [over, setOver] = useState(false);
  const handler = useRef(onFile);
  handler.current = onFile;
  useEffect(() => {
    if (!enabled) return;
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes("Files"));
    const dragover = (e: DragEvent) => { if (!e.defaultPrevented && hasFiles(e)) { e.preventDefault(); setOver(true); } };
    const dragleave = (e: DragEvent) => { if (!e.relatedTarget) setOver(false); };
    const drop = (e: DragEvent) => {
      setOver(false);
      if (e.defaultPrevented || !hasFiles(e)) return;
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      e.preventDefault();
      handler.current(file);
    };
    document.addEventListener("dragover", dragover);
    document.addEventListener("dragleave", dragleave);
    document.addEventListener("drop", drop);
    return () => { document.removeEventListener("dragover", dragover); document.removeEventListener("dragleave", dragleave); document.removeEventListener("drop", drop); };
  }, [enabled]);
  return over;
}
