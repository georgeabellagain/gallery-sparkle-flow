import test from "node:test";
import assert from "node:assert/strict";
import { downloadLink, isStreamedPdf, markStreamedPdf, openRemotePdf, PDF_RANGE_CHUNK } from "../src/lib/portfolia/remote-pdf";

class FakeTransport {
  received: [number, Uint8Array][] = [];
  requestDataRange: (begin: number, end: number) => void = () => {};
  constructor(public length: number, public initialData: Uint8Array | null) {}
  onDataRange(begin: number, chunk: Uint8Array) { this.received.push([begin, chunk]); }
}
const pdfjs = { PDFDataRangeTransport: FakeTransport as never };
const file = Uint8Array.from({ length: 300_000 }, (_, i) => i % 251);

/** Like a Supabase signed link: answers Range with 206, but Content-Range is hidden from the page. */
function storage({ exposeRange = false, honourRange = true, expired = new Set<string>() } = {}) {
  const calls: { url: string; range: string | null; method: string }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), range = new Headers(init?.headers).get("range"), method = init?.method ?? "GET";
    calls.push({ url, range, method });
    if (expired.has(url)) return new Response("expired", { status: 400 });
    if (method === "HEAD") return new Response(null, { headers: { "Content-Length": String(file.length) } });
    const m = /^bytes=(\d+)-(\d+)$/.exec(range ?? "");
    if (!m || !honourRange) return new Response(file, { headers: { "Content-Length": String(file.length) } });
    const start = Number(m[1]), end = Math.min(Number(m[2]), file.length - 1);
    return new Response(file.slice(start, end + 1), { status: 206, headers: exposeRange ? { "Content-Range": `bytes ${start}-${end}/${file.length}` } : {} });
  }) as typeof fetch;
  return { calls, fetcher };
}

test("streams by range when the length is only available from HEAD (cross-origin signed links)", async () => {
  const { calls, fetcher } = storage();
  const open = await openRemotePdf(pdfjs, { url: "https://s/sign/a" }, { fetcher });
  assert.equal(open.kind, "range");
  if (open.kind !== "range") return;
  const transport = open.transport as unknown as FakeTransport;
  assert.equal(open.length, file.length);
  assert.equal(transport.initialData?.byteLength, PDF_RANGE_CHUNK);
  assert.deepEqual(calls.map((c) => c.method), ["GET", "HEAD"]);
  transport.requestDataRange(200_000, 260_000);
  await new Promise((r) => setTimeout(r, 10));
  const [begin, chunk] = transport.received[0]!;
  assert.equal(begin, 200_000);
  assert.deepEqual(chunk, file.slice(200_000, 260_000));
  assert.equal(calls.at(-1)!.range, "bytes=200000-259999");
});

test("uses Content-Range when it is visible and skips the HEAD request", async () => {
  const { calls, fetcher } = storage({ exposeRange: true });
  const open = await openRemotePdf(pdfjs, { url: "/api/public/portfolio-file/book?asset=pdf" }, { fetcher });
  assert.equal(open.kind, "range");
  assert.equal(calls.length, 1);
});

test("a server that ignores Range hands over the whole file once", async () => {
  const { calls, fetcher } = storage({ honourRange: false });
  const open = await openRemotePdf(pdfjs, { url: "https://s/plain" }, { fetcher });
  assert.equal(open.kind, "data");
  if (open.kind === "data") assert.equal(open.data.byteLength, file.length);
  assert.equal(calls.length, 1);
});

test("an expired signed link is refreshed and the range retried", async () => {
  const expired = new Set<string>();
  const { calls, fetcher } = storage({ expired });
  let refreshed = 0;
  const open = await openRemotePdf(pdfjs, { url: "https://s/old", refresh: async () => { refreshed++; return "https://s/new"; } }, { fetcher });
  if (open.kind !== "range") return assert.fail("expected range");
  expired.add("https://s/old");
  const transport = open.transport as unknown as FakeTransport;
  transport.requestDataRange(70_000, 80_000);
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(refreshed, 1);
  assert.equal(calls.at(-1)!.url, "https://s/new");
  assert.deepEqual(transport.received[0]![1], file.slice(70_000, 80_000));
});

test("a range that keeps failing is reported instead of leaving the page waiting", async () => {
  const { fetcher } = storage();
  let broken = false;
  const failing = (async (input: RequestInfo | URL, init?: RequestInit) => broken ? new Response(null, { status: 500 }) : fetcher(input, init)) as typeof fetch;
  let reported: Error | null = null;
  const open = await openRemotePdf(pdfjs, { url: "https://s/flaky" }, { fetcher: failing, onError: (e) => { reported = e; } });
  if (open.kind !== "range") return assert.fail("expected range");
  broken = true;
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: () => void) => realTimeout(fn, 0)) as typeof setTimeout;
  try {
    open.transport.requestDataRange(0, 10);
    await new Promise((r) => realTimeout(r, 50));
  } finally { globalThis.setTimeout = realTimeout; }
  assert.match(String((reported as Error | null)?.message), /Couldn’t load part of this PDF/);
});

test("documents are marked as streamed, and signed links download as files", () => {
  const doc = {};
  assert.equal(isStreamedPdf(doc), false);
  markStreamedPdf(doc);
  assert.equal(isStreamedPdf(doc), true);
  const link = downloadLink("https://x.supabase.co/storage/v1/object/sign/portfolio-files/u/pdf_1?token=abc", "Jo portfolio.pdf");
  assert.equal(new URL(link).searchParams.get("token"), "abc");
  assert.equal(new URL(link).searchParams.get("download"), "Jo portfolio.pdf");
  assert.equal(downloadLink("/api/public/portfolio-file/book?asset=pdf_1", "a.pdf"), "/api/public/portfolio-file/book?asset=pdf_1");
});
