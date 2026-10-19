/** Whole animation cycle. Was 16s; 50% quicker is 8s. Change this one number to retune. */
const CYCLE = "8s";

/** Every leaf has two visible faces; opening reveals a complete spread. */
function Face({ title, back = false }: { title: string; back?: boolean }) {
  return (
    <div className={`pf-hero-face${back ? " pf-hero-face-reverse" : ""}`}>
      <span className="pf-hero-book-kicker">{title}</span>
      <span className="pf-hero-book-image" />
      <span className="pf-hero-book-line pf-hero-book-line-short" />
      <span className="pf-hero-book-line" />
    </div>
  );
}

/** cover and kicker let landing pages label the pages for their audience, e.g. "UCAS / 2027" and "PROJECT". */
export function BookAnimation({ cover = "PORTFOLIA / 01", opening = "SELECTED WORK", kicker = "PROJECT" }: { cover?: string; opening?: string; kicker?: string }) {
  return (
    <div className="pf-hero-book" aria-hidden style={{ animationDuration: CYCLE }}>
      <div className="pf-hero-book-shadow" />
      <div className="pf-hero-book-page pf-hero-book-back-cover">
        <Face title={cover.replace(/\/.*$/, "/ 08")} />
      </div>
      {[3, 2, 1].map((n) => (
        <div
          key={n}
          className={`pf-hero-book-page pf-hero-book-page-turn pf-hero-book-leaf-${n}`}
          style={{ animationDuration: CYCLE }}
        >
          <Face title={`${kicker} / 0${n * 2}`} />
          <Face title={`${kicker} / 0${n * 2 + 1}`} back />
        </div>
      ))}
      <div
        className="pf-hero-book-page pf-hero-book-page-turn pf-hero-book-cover"
        style={{ animationDuration: CYCLE }}
      >
        <Face title={cover} />
        <Face title={opening} back />
      </div>
    </div>
  );
}
