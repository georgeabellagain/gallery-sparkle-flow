/** Restrained monochrome book loop for the homepage. */
export function BookAnimation() {
  return (
    <div className="pf-hero-book" aria-hidden>
      <div className="pf-hero-book-shadow" />
      <div className="pf-hero-book-page pf-hero-book-page-back pf-hero-book-back-cover">
        <span className="pf-hero-book-image" />
        <span className="pf-hero-book-line pf-hero-book-line-short" />
        <span className="pf-hero-book-line" />
      </div>
      <div className="pf-hero-book-page pf-hero-book-page-mid pf-hero-book-page-fixed" />
      <div className="pf-hero-book-page pf-hero-book-page-turn pf-hero-book-leaf-3">
        <span className="pf-hero-book-kicker">PROJECT / 03</span>
        <span className="pf-hero-book-image" />
        <span className="pf-hero-book-line" />
      </div>
      <div className="pf-hero-book-page pf-hero-book-page-turn pf-hero-book-leaf-2">
        <span className="pf-hero-book-kicker">PROJECT / 02</span>
        <span className="pf-hero-book-image" />
        <span className="pf-hero-book-line pf-hero-book-line-short" />
      </div>
      <div className="pf-hero-book-page pf-hero-book-page-turn pf-hero-book-leaf-1">
        <span className="pf-hero-book-kicker">PROJECT / 01</span>
        <span className="pf-hero-book-image" />
        <span className="pf-hero-book-line" />
      </div>
      <div className="pf-hero-book-page pf-hero-book-page-turn pf-hero-book-cover">
        <span className="pf-hero-book-kicker">PORTFOLIA / 01</span>
        <span className="pf-hero-book-image" />
        <span className="pf-hero-book-line pf-hero-book-line-short" />
      </div>
      <span className="pf-hero-book-spine" />
    </div>
  );
}