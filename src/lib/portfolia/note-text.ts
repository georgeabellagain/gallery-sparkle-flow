/** Pure text layout for notes, kept apart from the canvas so it can be tested on its own. */
export type NoteLine = { text: string; last: boolean };
/** Wraps and sizes note text to fit a box. `measure` returns a string's width at a font size, so this is testable without a canvas. */
export function layoutNoteText(
  text: string,
  width: number,
  height: number,
  startSize: number,
  measure: (s: string, size: number) => number,
): { size: number; lines: NoteLine[] } {
  let size = startSize;
  let lines: NoteLine[] = [];
  const wrap = (): NoteLine[] => {
    const out: NoteLine[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      const words = para.split(/\s+/).filter(Boolean);
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) {
          out.push({ text: line, last: false });
          line = "";
        }
        for (const char of word) {
          if (line && measure(line + char, size) > width) {
            out.push({ text: line, last: false });
            line = "";
          }
          line += char;
        }
      }
      out.push({ text: line, last: true });
    }
    return out;
  };
  for (let i = 0; i < 40; i++) {
    lines = wrap();
    if (lines.length * size * 1.3 <= height) break;
    size *= 0.88;
  }
  return { size, lines };
}
