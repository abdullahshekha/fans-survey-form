import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateSurveyMock = vi.fn(async (..._a: any[]) => {});
vi.mock("@/lib/submitSurvey", () => ({ updateSurvey: (...a: any[]) => updateSurveyMock(...a) }));
vi.mock("@/components/form/VoiceRecorder", () => ({ VoiceRecorder: () => <div data-testid="voice" /> }));
// MiniMap renders react-leaflet, which crashes in jsdom; stub it (same pattern as gps-capture.test.tsx).
vi.mock("@/components/MiniMap", () => ({ MiniMap: () => <div data-testid="mini-map" /> }));

import { SurveyEditForm } from "@/components/form/SurveyEditForm";

const survey: any = {
  id: "s1", rep_id: "r1", shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
  customer_name: "Bilal", customer_number: "03001234567",
  gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
  most_selling_fan: "GFC", most_selling_fan_other: null,
  rec_30w_1: "Tamoor", rec_30w_1_other: null, rec_30w_2: null, rec_30w_2_other: null,
  rec_50w_1: "Royal", rec_50w_1_other: null, rec_50w_2: null, rec_50w_2_other: null,
  audio_path: null, created_at: "2026-09-08T10:00:00Z", updated_at: "2026-09-08T10:00:00Z", edited_at: null,
  rep: { id: "r1", username: "rep.one", full_name: "Rep One" }, photos: [],
};
const media = {
  photos: [
    { kind: "front" as const, url: "https://x/f", storagePath: "r1/s1/front.jpg" },
    { kind: "inner" as const, url: "https://x/i0", storagePath: "r1/s1/inner-0.jpg" },
  ],
  audioUrl: null,
};

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
});

// updateSurveyMock is module-level; isolate call history between tests.
beforeEach(() => {
  updateSurveyMock.mockClear();
});

describe("SurveyEditForm", () => {
  it("prefills scalar fields from the survey", () => {
    render(<SurveyEditForm survey={survey} media={media} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/shop name/i)).toHaveValue("Al Madina");
    expect(screen.getByLabelText(/customer number/i)).toHaveValue("03001234567");
  });

  it("submits an update payload built from existing media plus edits", async () => {
    const onSaved = vi.fn();
    render(<SurveyEditForm survey={survey} media={media} onSaved={onSaved} />);
    await userEvent.clear(screen.getByLabelText(/shop name/i));
    await userEvent.type(screen.getByLabelText(/shop name/i), "Renamed Shop");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateSurveyMock).toHaveBeenCalledTimes(1);
    const [id, input] = updateSurveyMock.mock.calls[0];
    expect(id).toBe("s1");
    expect(input.values.shop_name).toBe("Renamed Shop");
    expect(input.media.front).toEqual({ keep: "r1/s1/front.jpg" });
    expect(input.media.inner).toEqual([{ keep: "r1/s1/inner-0.jpg" }]);
    expect(input.originalPhotoPaths.sort()).toEqual(["r1/s1/front.jpg", "r1/s1/inner-0.jpg"]);
    expect(onSaved).toHaveBeenCalled();
  });

  it("calls onDirty when a field changes", async () => {
    const onDirty = vi.fn();
    render(<SurveyEditForm survey={survey} media={media} onSaved={vi.fn()} onDirty={onDirty} />);
    await userEvent.type(screen.getByLabelText(/shop name/i), "x");
    expect(onDirty).toHaveBeenCalled();
  });

  it("blocks save when the only inner photo is removed", async () => {
    render(<SurveyEditForm survey={survey} media={media} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /remove r1\/s1\/inner-0\.jpg/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateSurveyMock).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one inner photo/i)).toBeInTheDocument();
  });
});
