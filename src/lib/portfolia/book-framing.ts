/**
 * Extra room around the book, as a fraction (0.2 = 20% further out). The editor sets it so the book sits clear of its
 * floating tools; it is never saved and is 0 everywhere else.
 */
let inset = 0;
const listeners = new Set<(value: number) => void>();
export const getBookInset = () => inset;
export function setBookInset(value: number) {
  if (value === inset) return;
  inset = value;
  listeners.forEach((l) => l(value));
}
export function subscribeBookInset(listener: (value: number) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
