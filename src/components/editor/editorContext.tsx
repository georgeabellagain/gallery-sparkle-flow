import { createContext, useContext } from "react";
import type { Item, PageElement, Portfolio, Project } from "@/lib/portfolia/types";
import { updateProject } from "@/lib/portfolia/store";

export interface Selection {
  itemId?: string;
  elementId?: string;
  hotspotId?: string;
}

export interface EditorApi {
  portfolio: Portfolio;
  project: Project;
  projectId: string;
  setProjectId: (id: string) => void;
  selection: Selection;
  select: (s: Selection) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  /** "layout" = whole project in the chosen style, "page" = one page composition. */
  mode: "layout" | "page";
  setMode: (m: "layout" | "page") => void;
  notify: (message: string, tone?: "info" | "error") => void;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside the editor");
  return ctx;
}

/* --------------------------------------------------------- item/element ops */

export function patchItem(
  portfolioId: string,
  projectId: string,
  itemId: string,
  fn: (item: Item) => void,
  history = true,
) {
  updateProject(
    portfolioId,
    projectId,
    (pr) => {
      const item = pr.items.find((i) => i.id === itemId);
      if (item) fn(item);
    },
    { history },
  );
}

export function patchElement(
  portfolioId: string,
  projectId: string,
  itemId: string,
  elementId: string,
  fn: (el: PageElement) => void,
  history = true,
) {
  patchItem(
    portfolioId,
    projectId,
    itemId,
    (item) => {
      if (!("elements" in item)) return;
      const el = item.elements.find((e) => e.id === elementId);
      if (el) fn(el);
    },
    history,
  );
}

export function findItem(project: Project, itemId?: string): Item | undefined {
  return itemId ? project.items.find((i) => i.id === itemId) : undefined;
}

export function findElement(item: Item | undefined, elementId?: string): PageElement | undefined {
  if (!item || !("elements" in item) || !elementId) return undefined;
  return item.elements.find((e) => e.id === elementId);
}

export function isPageItem(item?: Item): item is Extract<Item, { kind: "pdfPage" | "composition" }> {
  return Boolean(item && (item.kind === "pdfPage" || item.kind === "composition"));
}
