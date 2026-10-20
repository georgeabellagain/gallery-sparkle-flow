import { prepareEnvironment } from "./environment-pixels";

/** Downloads and prepares Studio lighting off the main thread, so page turns never wait on it. */
const scope = self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<{ id: number; url: string }>) => void) | null };

scope.onmessage = async (event) => {
  const { id, url } = event.data;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Lighting file ${response.status}`);
    const prepared = prepareEnvironment(await response.arrayBuffer());
    scope.postMessage({ id, prepared }, [prepared.pixels.buffer]);
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : "Lighting failed" });
  }
};
