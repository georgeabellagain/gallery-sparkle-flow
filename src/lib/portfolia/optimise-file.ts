/** Run CPU-heavy repacking off the UI thread; no external service receives the PDF. */
export async function optimiseFile(file: File): Promise<File | null> {
  if (file.size > 75 * 1024 * 1024) throw new Error("For PDFs above 75 MB, export a smaller web copy first.");
  const input = await file.arrayBuffer();
  const worker = new Worker(new URL("./compress.worker.ts", import.meta.url), { type: "module" });
  try {
    const output = await new Promise<ArrayBuffer>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Optimisation took too long. Try a smaller export or use the original.")), 60000);
      worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => {
        clearTimeout(timeout);
        if (event.data.buffer) resolve(event.data.buffer);
        else reject(new Error(event.data.error || "Could not optimise this PDF."));
      };
      worker.onerror = () => { clearTimeout(timeout); reject(new Error("Could not optimise this PDF. Try the original file.")); };
      worker.postMessage(input, [input]);
    });
    return output.byteLength < file.size ? new File([output], file.name.replace(/\.pdf$/i, "") + "-optimised.pdf", { type: "application/pdf" }) : null;
  } finally { worker.terminate(); }
}
