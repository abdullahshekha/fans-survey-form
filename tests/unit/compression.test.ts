import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(async () => new File([new Uint8Array(8)], "out.dat", { type: "image/jpeg" })),
}));

import imageCompression from "browser-image-compression";
import { compressImage, compressDocument } from "@/lib/compression";

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

describe("compressDocument", () => {
  it("compressDocument uses gentler document settings", async () => {
    (imageCompression as unknown as Mock).mockClear();
    const input = new File([new Uint8Array(2048)], "quote.png", { type: "image/png" });
    const out = await compressDocument(input);
    expect(out).toBeInstanceOf(File);
    expect(out.name).toBe("quote.jpg");
    const opts = (imageCompression as unknown as Mock).mock.calls[0][1];
    expect(opts.maxWidthOrHeight).toBe(2400);
    expect(opts.maxSizeMB).toBeCloseTo(1.2);
  });
});
