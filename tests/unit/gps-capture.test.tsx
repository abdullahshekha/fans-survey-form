import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/MiniMap", () => ({ MiniMap: () => <div data-testid="mini-map" /> }));
vi.mock("@/lib/geo", () => ({ getCurrentPosition: vi.fn() }));
import { getCurrentPosition } from "@/lib/geo";
import { GpsCapture } from "@/components/form/GpsCapture";

describe("GpsCapture", () => {
  it("captures a fix and reports it upward", async () => {
    (getCurrentPosition as unknown as Mock).mockResolvedValue({ lat: 24.86123, lng: 67.02456, accuracy: 9 });
    const onChange = vi.fn();
    render(<GpsCapture value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /capture location/i }));
    expect(onChange).toHaveBeenCalledWith({ lat: 24.86123, lng: 67.02456, accuracy: 9 });
  });

  it("shows a permission message on denial", async () => {
    (getCurrentPosition as unknown as Mock).mockRejectedValue(new Error("permission-denied"));
    render(<GpsCapture value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /capture location/i }));
    expect(await screen.findByText(/location permission was denied/i)).toBeInTheDocument();
  });

  it("renders the map preview when a value is present", () => {
    render(<GpsCapture value={{ lat: 24.86, lng: 67.02, accuracy: 5 }} onChange={vi.fn()} />);
    expect(screen.getByTestId("mini-map")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recapture/i })).toBeInTheDocument();
  });
});
