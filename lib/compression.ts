import imageCompression from "browser-image-compression";

function toJpgName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") + ".jpg";
}

async function compressTo(
  file: File,
  opts: { maxWidthOrHeight: number; maxSizeMB: number; initialQuality: number },
): Promise<File> {
  try {
    const blob = await imageCompression(file, {
      ...opts,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    return new File([blob], toJpgName(file.name), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export const compressImage = (file: File): Promise<File> =>
  compressTo(file, { maxWidthOrHeight: 1600, maxSizeMB: 0.5, initialQuality: 0.8 });

export const compressDocument = (file: File): Promise<File> =>
  compressTo(file, { maxWidthOrHeight: 2400, maxSizeMB: 1.2, initialQuality: 0.9 });
