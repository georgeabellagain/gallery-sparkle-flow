import assert from "node:assert/strict";
import test from "node:test";
import { bookFocus, bookLayout, spreadIndex } from "../src/lib/portfolia/book-layout.ts";

test("single-page PDFs cover every page exactly once, with a standalone cover", () => {
  for (const count of [1, 2, 3, 6, 7]) {
    const { leaves, spreads } = bookLayout(count, false);
    assert.deepEqual(spreads[0], [null, 0]);
    assert.deepEqual(
      spreads.flat().filter((n) => n !== null),
      leaves.map((_, i) => i),
    );
    for (let i = 0; i < leaves.length; i++)
      assert.ok(spreads[spreadIndex(spreads, i)]!.includes(i));
  }
});

test("the phone camera changes sides without changing the physical spread", () => {
  const { spreads } = bookLayout(6, false);
  assert.equal(spreadIndex(spreads, 1), spreadIndex(spreads, 2));
  assert.equal(bookFocus(spreads[1]!, 1, true), -0.5);
  assert.equal(bookFocus(spreads[1]!, 2, true), 0.5);
  assert.equal(bookFocus(spreads[1]!, 1, false), 0);
  assert.equal(bookFocus(spreads[0]!, 0, false), 0.5);
  assert.equal(bookFocus(spreads[3]!, 5, false), -0.5);
});

test("ready-made PDF spreads stay paired and each half remains readable on phones", () => {
  const { leaves, spreads } = bookLayout(3, true);
  assert.equal(leaves.length, 6);
  for (let page = 1; page <= 3; page++) {
    const [a, b] = spreads[page - 1]!;
    assert.deepEqual(leaves[a!], { page, half: "left" });
    assert.deepEqual(leaves[b!], { page, half: "right" });
    assert.equal(bookFocus(spreads[page - 1]!, a!, true), -0.5);
    assert.equal(bookFocus(spreads[page - 1]!, b!, true), 0.5);
  }
});
