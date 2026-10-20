import type { PDFDataRangeTransport } from "pdfjs-dist";

/**
 * Published PDFs are read with HTTP Range requests, so a visitor sees the opening spread after a few megabytes
 * instead of after the whole file. Supabase signed URLs answer ranges but do not expose Accept-Ranges or
 * Content-Range across origins, so pdf.js would quietly download everything if handed the URL itself; this
 * transport asks for each range directly and learns the length from Content-Range or a HEAD request.
 */

/** Small enough that reading a scattered page entry costs little; pdf.js joins neighbouring chunks into one request. */
export const PDF_RANGE_CHUNK = 65536;

export type RemotePdf = {
  url: string;
  /** A fresh link once the signed one has expired (signed links last an hour). */
  refresh?: () => Promise<string | undefined>;
  /** Pictures made at publishing: the readers open on these, and the PDF is streamed only for text and deep zoom. */
  pageImages?: import("./page-image-doc").PageImageSource;
};

type Pdfjs = {
  PDFDataRangeTransport: new (length: number, initialData: Uint8Array | null) => PDFDataRangeTransport;
};

const streamed = new WeakSet<object>();
/** True for documents read range by range, which should only ask for the pages a reader is about to see. */
export const isStreamedPdf = (doc: object) => streamed.has(doc);
export const markStreamedPdf = (doc: object) => void streamed.add(doc);

export type RemoteOpen =
  | { kind: "range"; transport: PDFDataRangeTransport; length: number }
  | { kind: "data"; data: Uint8Array }
  | { kind: "url"; url: string };

/** Browsers ignore `download` on another site's link, so a Supabase signed link asks storage to send it as a file. */
export function downloadLink(url: string, fileName: string) {
  if (!/\/storage\/v1\/object\/sign\//.test(url)) return url;
  const link = new URL(url);
  link.searchParams.set("download", fileName);
  return link.toString();
}

function totalFrom(contentRange: string | null) {
  const total = Number(/\/(\d+)\s*$/.exec(contentRange ?? "")?.[1]);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/**
 * Prepares a remote PDF for pdf.js. Servers that ignore Range simply return the whole file (handed over as data),
 * and anything unexpected falls back to pdf.js's own loading. `onError` reports a range that could not be read
 * after retries, since pdf.js has no way to fail a page that is waiting for data.
 */
export async function openRemotePdf(
  pdfjs: Pdfjs,
  source: RemotePdf,
  { signal, onError, fetcher = fetch }: { signal?: AbortSignal; onError?: (error: Error) => void; fetcher?: typeof fetch } = {},
): Promise<RemoteOpen> {
  let url = source.url;
  const first = await fetcher(url, { headers: { Range: `bytes=0-${PDF_RANGE_CHUNK - 1}` }, signal }).catch(() => null);
  if (!first?.ok) return { kind: "url", url };
  if (first.status !== 206) return { kind: "data", data: new Uint8Array(await first.arrayBuffer()) };
  const initial = new Uint8Array(await first.arrayBuffer());
  let length = totalFrom(first.headers.get("content-range"));
  if (!length) {
    const head = await fetcher(url, { method: "HEAD", signal }).catch(() => null);
    length = head?.ok ? Number(head.headers.get("content-length")) || 0 : 0;
  }
  if (!length || initial.byteLength > length) return { kind: "url", url };
  if (initial.byteLength === length) return { kind: "data", data: initial };
  const transport = new pdfjs.PDFDataRangeTransport(length, initial);

  let refreshing: Promise<void> | null = null;
  const refresh = () => (refreshing ??= (async () => {
    const next = await source.refresh?.().catch(() => undefined);
    if (next) url = next;
  })().finally(() => { refreshing = null; }));

  const read = async (begin: number, end: number): Promise<Uint8Array> => {
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new Error("Viewer closed");
      const response = await fetcher(url, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal }).catch(() => null);
      if (response?.status === 206) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === end - begin) return bytes;
      } else if (response?.status === 200) {
        // The server sent the whole file: hand it all over, which also satisfies every later request.
        const whole = new Uint8Array(await response.arrayBuffer());
        if (whole.byteLength === length) return whole.subarray(begin, end);
      } else if (response && [400, 401, 403].includes(response.status) && source.refresh) await refresh();
      if (attempt >= 3) throw new Error(`Couldn’t load part of this PDF (bytes ${begin}–${end}).`);
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  };
  transport.requestDataRange = (begin: number, end: number) => {
    void read(begin, end).then(
      (bytes) => transport.onDataRange(begin, bytes),
      (error: Error) => { if (!signal?.aborted) onError?.(error); },
    );
  };
  return { kind: "range", transport, length };
}
