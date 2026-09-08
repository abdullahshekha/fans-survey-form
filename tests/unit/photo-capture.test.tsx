import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/compression", () => ({
  compressImage: vi.fn(async (f: File) => f),
  compressDocument: vi.fn(async (f: File) => f),
}));
import { PhotoCapture } from "@/components/form/PhotoCapture";
import type { ExistingMedia } from "@/lib/validation";

const img = (n: string) => new File([new Uint8Array(8)], n, { type: "image/jpeg" });

const ex = (p: string): ExistingMedia => ({ storagePath: p, url: `https://x/${p}` });

describe("PhotoCapture", () => {
  beforeAll(() => { globalThis.URL.createObjectURL = vi.fn(() => "blob:x"); globalThis.URL.revokeObjectURL = vi.fn(); });

  it("compresses and reports a chosen front photo", async () => {
    const onFrontChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={[]} onFrontChange={onFrontChange} onInnerChange={vi.fn()} onQuotationChange={vi.fn()} />);
    await userEvent.upload(screen.getByTestId("front-gallery-input"), img("f.jpg"));
    expect(onFrontChange).toHaveBeenCalledWith(expect.any(File));
  });

  it("appends inner photos and enforces the 10-photo cap", async () => {
    const current = Array.from({ length: 10 }, (_, i) => img(`${i}.jpg`));
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} quotation={[]} onInnerChange={onInnerChange} onFrontChange={vi.fn()} onQuotationChange={vi.fn()} />);
    await userEvent.upload(screen.getByTestId("inner-gallery-input"), img("extra.jpg"));
    expect(onInnerChange).not.toHaveBeenCalled();
    expect(screen.getByText(/maximum of 10 inner photos/i)).toBeInTheDocument();
  });

  it("removes an inner photo by index", async () => {
    const current = [img("a.jpg"), img("b.jpg")];
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} quotation={[]} onInnerChange={onInnerChange} onFrontChange={vi.fn()} onQuotationChange={vi.fn()} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(onInnerChange).toHaveBeenCalledWith([current[1]]);
  });

  it("compresses and reports a chosen quotation photo", async () => {
    const onQuotationChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={onQuotationChange} />);
    await userEvent.upload(screen.getByTestId("quotation-gallery-input"), img("q.jpg"));
    expect(onQuotationChange).toHaveBeenCalledWith([expect.any(File)]);
  });

  it("caps quotation photos at 2", async () => {
    const current = [img("a.jpg"), img("b.jpg")];
    const onQuotationChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={current}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={onQuotationChange} />);
    await userEvent.upload(screen.getByTestId("quotation-gallery-input"), img("c.jpg"));
    expect(onQuotationChange).not.toHaveBeenCalled();
    expect(screen.getByText(/maximum of 2 quotation photos/i)).toBeInTheDocument();
  });

  it("removes a quotation photo by index", async () => {
    const current = [img("a.jpg"), img("b.jpg")];
    const onQuotationChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={current}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={onQuotationChange} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove b\.jpg/i })[0]);
    expect(onQuotationChange).toHaveBeenCalledWith([current[0]]);
  });
});

describe("PhotoCapture — edit mode", () => {
  it("renders existing inner thumbs and removes one by storagePath", async () => {
    const onRemoveExistingInner = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={vi.fn()}
      existingInner={[ex("u/s/inner-0.jpg"), ex("u/s/inner-1.jpg")]}
      onRemoveExistingInner={onRemoveExistingInner} />);
    const removes = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removes[0]);
    expect(onRemoveExistingInner).toHaveBeenCalledWith("u/s/inner-0.jpg");
  });

  it("counts existing + pending against the inner cap", async () => {
    const existingInner = Array.from({ length: 9 }, (_, i) => ex(`u/s/inner-${i}.jpg`));
    const current = [new File([new Uint8Array(8)], "p.jpg", { type: "image/jpeg" })];
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={onInnerChange} onQuotationChange={vi.fn()}
      existingInner={existingInner} />);
    await userEvent.upload(screen.getByTestId("inner-gallery-input"),
      new File([new Uint8Array(8)], "x.jpg", { type: "image/jpeg" }));
    expect(onInnerChange).not.toHaveBeenCalled();
    expect(screen.getByText(/maximum of 10 inner photos/i)).toBeInTheDocument();
  });

  it("removes an existing front photo", async () => {
    const onRemoveExistingFront = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={vi.fn()}
      existingFront={ex("u/s/front.jpg")} onRemoveExistingFront={onRemoveExistingFront} />);
    await userEvent.click(screen.getByRole("button", { name: /remove front/i }));
    expect(onRemoveExistingFront).toHaveBeenCalled();
  });
});
