/** Restrained monochrome book loop for the homepage. */
export function BookAnimation() {
  return (
    <div className="pf-hero-book" aria-hidden>
      <div className="pf-hero-book-shadow" />
      <div className="pf-hero-book-page pf-hero-book-page-back">
        <span className="pf-hero-book-image" />
        <span className="pf-hero-book-line pf-hero-book-line-short" />
        <span className="pf-hero-book-line" />
      </div>
      <div className="pf-hero-book-page pf-hero-book-page-mid" />
      <div className="pf-hero-book-page pf-hero-book-page-turn">
        <span className="pf-hero-book-kicker">PORTFOLIA / 01</span>
        <span className="pf-hero-book-image" />
        <span className="pf-hero-book-line pf-hero-book-line-short" />
      </div>
      <span className="pf-hero-book-spine" />
    </div>
  );
}