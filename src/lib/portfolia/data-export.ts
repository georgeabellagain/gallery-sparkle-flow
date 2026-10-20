import { portfolioAnalytics } from "./analytics";
import { pageImageKeys } from "./page-images";
import { allPortfolios, type Doc } from "./store";

/**
 * Everything Portfolia holds about an account, in a readable file: portfolio details and settings, their visit
 * statistics and the names of stored files. The PDFs and pictures themselves are the creator's own uploads and
 * download separately. Page pictures are copies Portfolia drew from each PDF so it opens quickly; their file
 * names are listed so the export accounts for every stored file.
 */
export function accountExport(doc: Doc, email?: string, now = new Date()) {
  return {
    exportedAt: now.toISOString(),
    account: { email: email ?? null },
    portfolios: allPortfolios(doc).map((portfolio) => {
      const pagePictures = pageImageKeys(portfolio.pdf);
      return {
        ...portfolio,
        analytics: portfolioAnalytics(doc, portfolio.code),
        ...(pagePictures.length ? { pagePictureFiles: pagePictures } : {}),
      };
    }),
  };
}
export function accountExportFile(doc: Doc, email?: string, now = new Date()) {
  return new Blob([JSON.stringify(accountExport(doc, email, now), null, 2)], { type: "application/json" });
}
