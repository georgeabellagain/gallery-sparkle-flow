import { compressPdfBytes } from "./compress";
import { browserReencode, webCopyPdfBytes } from "./web-copy";
/** "repack" keeps every image as it is; "web" also resizes large photos for screens. */
self.onmessage = async (event: MessageEvent<ArrayBuffer | { mode: "repack" | "web"; buffer: ArrayBuffer }>) => {
  try {
    const { mode, buffer: input } = event.data instanceof ArrayBuffer ? { mode: "repack" as const, buffer: event.data } : event.data;
    const result = mode === "web" ? (await webCopyPdfBytes(new Uint8Array(input), browserReencode)).bytes : await compressPdfBytes(new Uint8Array(input));
    const buffer = new Uint8Array(result).buffer;
    self.postMessage({ buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "This PDF could not be optimised. Try your original file." });
  }
};
