/** Tracking must never prevent a portfolio opening when browser storage is blocked. */
export function createVisitorSession(makeId: () => string) {
  let visitor: string | undefined;
  const seen = new Set<string>();
  return {
    visitor(storage: Pick<Storage, "getItem" | "setItem"> | undefined) {
      if (visitor) return visitor;
      try { visitor = storage?.getItem("portfolia.vid") || undefined; } catch { /* use the in-memory id */ }
      visitor ??= makeId();
      try { storage?.setItem("portfolia.vid", visitor); } catch { /* optional statistics */ }
      return visitor;
    },
    firstVisit(code: string, storage: Pick<Storage, "getItem" | "setItem"> | undefined) {
      if (seen.has(code)) return false;
      seen.add(code);
      const key = `portfolia.session.${code}`;
      try {
        if (storage?.getItem(key)) return false;
        storage?.setItem(key, "1");
      } catch { /* deduplicate this visit in memory */ }
      return true;
    },
  };
}
