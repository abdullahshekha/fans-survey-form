import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/compression", () => ({ compressImage: vi.fn(async (f: File) => f) }));
import { PhotoCapture } from "@/components/form/PhotoCapture";

const img = (n: string) => new File([new Uint8Array(8)], n, { type: "image/jpeg" });

describe("PhotoCapture", () => {
  beforeAll(() => { globalThis.URL.createObjectURL = vi.fn(() => "blob:x"); globalThis.URL.revokeObjectURL = vi.fn(); });

  it("compresses and reports a chosen front photo", async () => {
    const onFrontChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} onFrontChange={onFrontChange} onInnerChange={vi.fn()} />);
    await userEvent.upload(screen.getByTestId("front-gallery-input"), img("f.jpg"));
    expect(onFrontChange).toHaveBeenCalledWith(expect.any(File));
  });

  it("appends inner photos and enforces the 10-photo cap", async () => {
    const current = Array.from({ length: 10 }, (_, i) => img(`${i}.jpg`));
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} onInnerChange={onInnerChange} onFrontChange={vi.fn()} />);
    await userEvent.upload(screen.getByTestId("inner-gallery-input"), img("extra.jpg"));
    expect(onInnerChange).not.toHaveBeenCalled();
    expect(screen.getByText(/maximum of 10 inner photos/i)).toBeInTheDocument();
  });

  it("removes an inner photo by index", async () => {
    const current = [img("a.jpg"), img("b.jpg")];
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} onInnerChange={onInnerChange} onFrontChange={vi.fn()} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(onInnerChange).toHaveBeenCalledWith([current[1]]);
  });
});
