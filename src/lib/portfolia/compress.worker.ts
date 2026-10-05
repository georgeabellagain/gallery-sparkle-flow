import { compressPdfBytes } from "./compress";
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const result = await compressPdfBytes(new Uint8Array(event.data));
    const buffer = new Uint8Array(result).buffer;
    self.postMessage({ buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "This PDF could not be optimised. Try your original file." });
  }
};
