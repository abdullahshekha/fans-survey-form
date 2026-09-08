import { describe, it, expect, vi } from "vitest";

const uploadMock = vi.fn(async () => ({ error: null }));
const rpcMock = vi.fn();
const removeMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "rep-uid-1" } } }) },
    storage: { from: () => ({ upload: uploadMock, remove: removeMock }) },
    rpc: rpcMock,
  }),
}));

import { updateSurvey, type SurveyEditInput } from "@/lib/submitSurvey";
import type { SurveyFormValues } from "@/lib/validation";

const values: SurveyFormValues = {
  shop_name: "Al Madina", market: "Arambagh", shop_size: "Small",
  customer_name: "B", customer_number: "03001234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 10 },
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: "", rec_50w_1: "Royal", rec_50w_2: "",
  most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "", rec_50w_1_other: "", rec_50w_2_other: "",
  frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
};

const baseInput: SurveyEditInput = {
  values,
  media: {
    front: { keep: "rep-uid-1/s1/front.jpg" },
    inner: [{ keep: "rep-uid-1/s1/inner-0.jpg" }],
    quotation: [],
    audio: null,
  },
  originalPhotoPaths: ["rep-uid-1/s1/front.jpg", "rep-uid-1/s1/inner-0.jpg", "rep-uid-1/s1/inner-1.jpg"],
  originalAudioPath: "rep-uid-1/s1/comment.webm",
};

describe("updateSurvey", () => {
  it("calls update_survey with the survey id and removes dropped media", async () => {
    rpcMock.mockResolvedValue({ data: "s1", error: null });
    removeMock.mockClear();
    await updateSurvey("s1", baseInput);
    const payload = rpcMock.mock.calls[0][1].payload;
    expect(payload.id).toBe("s1");
    expect(payload.photos).toHaveLength(2);
    // inner-1.jpg dropped, old audio dropped
    expect(removeMock).toHaveBeenCalledWith(["rep-uid-1/s1/inner-1.jpg"]);
    expect(removeMock).toHaveBeenCalledWith(["rep-uid-1/s1/comment.webm"]);
  });

  it("throws and skips cleanup on an RPC error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "not editable" } });
    removeMock.mockClear();
    await expect(updateSurvey("s1", baseInput)).rejects.toThrow(/Could not save your changes/);
    expect(removeMock).not.toHaveBeenCalled();
  });
});
