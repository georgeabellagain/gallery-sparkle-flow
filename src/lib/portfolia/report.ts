/** Visitors report illegal or infringing content by email; the address of the page goes with it. */
export function reportHref(page = typeof window !== "undefined" ? window.location.href : "https://portfolia.site") {
  return `mailto:hello@portfolia.site?subject=${encodeURIComponent("Report a portfolio")}&body=${encodeURIComponent(`Portfolio: ${page}\n\nWhat is wrong with it (for example illegal content or copyright infringement):\n`)}`;
}
