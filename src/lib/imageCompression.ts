import imageCompression from "browser-image-compression";

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 0.12, // ~120KB max
  maxWidthOrHeight: 800, // 800px max dimension
  useWebWorker: true,
  fileType: "image/jpeg",
};

/**
 * Compresses an image file on the client-side to minimize Supabase Storage usage.
 */
export async function compressImage(
  file: File,
  customOptions?: Partial<CompressionOptions>
): Promise<File> {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  try {
    const compressedBlob = await imageCompression(file, options);
    // Return as File object preserving original/clean name
    const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
    return new File([compressedBlob], cleanName, { type: "image/jpeg" });
  } catch (error) {
    console.error("Compression failed, fallback to original:", error);
    return file;
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
