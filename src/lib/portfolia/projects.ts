/** PDF page numbers are one-based, including the cover. IDs survive title edits. */
export interface PortfolioProject {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
}

export const MAX_PROJECTS = 30;
export const PROJECT_TITLE_LIMIT = 80;
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

/** Old portfolios and malformed cached data must remain readable. */
export function readableProjects(raw: unknown, pages: number): PortfolioProject[] {
  if (!Array.isArray(raw) || !Number.isInteger(pages) || pages < 1) return [];
  const seen = new Set<string>();
  return raw.slice(0, MAX_PROJECTS).filter((p): p is PortfolioProject => {
    if (!p || !validId(p.id) || seen.has(p.id) || typeof p.title !== "string" || !p.title.trim() || p.title.trim().length > PROJECT_TITLE_LIMIT || !Number.isInteger(p.startPage) || !Number.isInteger(p.endPage) || p.startPage < 1 || p.endPage < p.startPage || p.endPage > pages) return false;
    seen.add(p.id);
    return true;
  }).map((p) => ({ id: p.id, title: p.title.trim(), startPage: p.startPage, endPage: p.endPage })).sort((a, b) => a.startPage - b.startPage);
}

export function validateProjects(projects: PortfolioProject[], pages: number): string | null {
  if (projects.length > MAX_PROJECTS) return `Use up to ${MAX_PROJECTS} projects.`;
  const sorted = readableProjects(projects, pages);
  if (sorted.length !== projects.length) return `Give every project a name (up to ${PROJECT_TITLE_LIMIT} characters) and whole page numbers between 1 and ${pages}. The last page must follow or equal the first.`;
  if (sorted.some((p, i) => i > 0 && p.startPage <= sorted[i - 1]!.endPage)) return "Project page ranges must not overlap. Covers and other pages can remain outside a project.";
  return null;
}

export function projectHash(id: string): string {
  return `#project=${encodeURIComponent(id)}`;
}

export function projectFromHash(hash: string, projects: PortfolioProject[]): PortfolioProject | undefined {
  const id = new URLSearchParams(hash.replace(/^#/, "")).get("project");
  return projects.find((p) => p.id === id);
}

export function projectPath(code: string, id: string): string {
  return `/p/${encodeURIComponent(code)}${projectHash(id)}`;
}
