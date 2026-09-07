import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => new File([await file.arrayBuffer()], "out.dat", { type: "image/jpeg" })),
}));

import imageCompression from "browser-image-compression";
import { compressImage } from "@/lib/compression";

describe("compressImage", () => {
  it("passes the spec size options and returns a .jpg File", async () => {
    const input = new File([new Uint8Array(2048)], "Shopfront.PNG", { type: "image/png" });
    const out = await compressImage(input);
    expect(out).toBeInstanceOf(File);
    expect(out.name).toBe("Shopfront.jpg");
    expect(out.type).toBe("image/jpeg");
    const opts = (imageCompression as unknown as Mock).mock.calls[0][1];
    expect(opts.maxWidthOrHeight).toBe(1600);
    expect(opts.maxSizeMB).toBeCloseTo(0.5);
  });

  it("returns the original file if compression throws", async () => {
    (imageCompression as unknown as Mock).mockRejectedValueOnce(new Error("boom"));
    const input = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
    await expect(compressImage(input)).resolves.toBe(input);
  });
});
