/**
 * Client-side photo preparation.
 *
 * Phone cameras produce 4–12 MB images, which is slow to analyse and larger
 * than we ever store. Everything is downscaled on the device first, which also
 * strips EXIF metadata — including the GPS coordinates a camera writes into the
 * file — before anything is sent anywhere.
 */

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  /** Original file size in bytes, for the "we shrank this" message. */
  originalBytes: number;
  /** Bytes of the encoded data URL. */
  finalBytes: number;
}

const MAX_EDGE = 1024;
const QUALITY = 0.82;

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("That photo is larger than 20 MB. Please retake it.");
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process the image in this browser.");

  // White background so transparent PNGs do not turn black in JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  return {
    dataUrl,
    width,
    height,
    originalBytes: file.size,
    finalBytes: Math.round(dataUrl.length * 0.75),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path below (e.g. HEIC on some browsers).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = url;
    });
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
