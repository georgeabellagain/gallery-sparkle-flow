import { VIDEO_MAX_MB, type PageVideo } from "./page-extras";

/** Which files can become page videos; the browser must also be able to decode them (checked when read). */
export function videoFileProblem(file: File): string | null {
  const type = file.type || (/\.webm$/i.test(file.name) ? "video/webm" : /\.(mp4|m4v)$/i.test(file.name) ? "video/mp4" : "");
  if (type !== "video/mp4" && type !== "video/webm") return "Choose an MP4 or WebM video.";
  if (file.size > VIDEO_MAX_MB * 1048576) return `This video is ${(file.size / 1048576).toFixed(1)} MB. Use one up to ${VIDEO_MAX_MB} MB (export it at 720p or 1080p).`;
  return null;
}
export const videoMime = (file: File): PageVideo["mime"] => (file.type === "video/webm" || /\.webm$/i.test(file.name) ? "video/webm" : "video/mp4");

/**
 * Reads a video's shape and makes its still from a frame just after the start (the very first frame is often black).
 * Nothing leaves the browser.
 */
export async function readVideo(file: File): Promise<{ aspect: number; poster: Blob; duration: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("This video can't be played in the browser. Export it as an H.264 MP4 and try again."));
      setTimeout(() => reject(new Error("The video took too long to open. Try a shorter or smaller export.")), 20000);
    });
    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) throw new Error("This video has no picture.");
    const at = Math.min(0.15, (video.duration || 0) / 2);
    if (at > 0) await new Promise<void>((resolve) => { video.onseeked = () => resolve(); video.currentTime = at; setTimeout(resolve, 3000); });
    const scale = Math.min(1, 1600 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the video's still."))), "image/jpeg", 0.88));
    return { aspect: Math.min(5, Math.max(0.2, w / h)), poster, duration: video.duration || 0 };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
