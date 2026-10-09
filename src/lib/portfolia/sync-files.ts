/** Browser drafts must finish uploading every referenced asset before cloud metadata is saved. */
export async function migrateDraftFiles(keys: string[], read: (key: string) => Promise<Blob | undefined>, upload: (key: string, blob: Blob) => Promise<void>) {
  for (const key of new Set(keys)) {
    const blob = await read(key);
    if (!blob) throw new Error("A draft file is missing from this browser. Upload it again before publishing.");
    await upload(key, blob);
  }
}
