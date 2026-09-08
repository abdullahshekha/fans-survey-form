import imageCompression from "browser-image-compression";

function toJpgName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") + ".jpg";
}

export async function compressImage(file: File): Promise<File> {
  try {
    const blob = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 0.5,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.8,
    });
    return new File([blob], toJpgName(file.name), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
