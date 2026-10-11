const PAGES: Record<string, readonly number[]> = {
  paged: [4, 5, 6, 7],
  scroll: [5, 6, 7, 8],
  links: [8],
  share: [12, 13],
};

export function featureArtworkReady(feature: string, images: Record<number, string>) {
  const pages = PAGES[feature];
  return Boolean(pages && pages.every(page => Boolean(images[page])));
}
