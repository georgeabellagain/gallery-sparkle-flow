export interface CheckPage { getViewport(o: { scale: number }): { width: number; height: number }; getAnnotations(): Promise<Array<{ subtype?: string; url?: string; unsafeUrl?: string }>> }
export interface CheckDocument { numPages: number; getPage(n: number): Promise<CheckPage> }
export async function inspectPdf(doc: CheckDocument, bytes: number) {
  const inspected = Math.min(doc.numPages, 300);
  let links = 0, variedSizes = false;
  let width = 0, height = 0;
  for (let n = 1; n <= inspected; n++) {
    const page = await doc.getPage(n);
    const view = page.getViewport({ scale: 1 });
    if (n === 1) { width = view.width; height = view.height; }
    else if (Math.abs(view.width - width) > 1 || Math.abs(view.height - height) > 1) variedSizes = true;
    const annotations = await page.getAnnotations();
    links += annotations.filter(a => a.subtype === "Link" && /^(https?:|mailto:|tel:)/i.test(a.url || a.unsafeUrl || "")).length;
  }
  return { bytes, pages: doc.numPages, inspected, links, variedSizes, landscape: width > height };
}
