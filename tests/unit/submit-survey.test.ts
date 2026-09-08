import { describe, it, expect, vi } from "vitest";

const uploadMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "rep-uid-1" } } }) },
    storage: { from: () => ({ upload: uploadMock }) },
    rpc: rpcMock,
  }),
}));

import { submitSurvey } from "@/lib/submitSurvey";
import type { SurveyFormValues } from "@/lib/validation";

const v: SurveyFormValues = {
  shop_name: "Al Madina", market: "Arambagh", shop_size: "Small",
  customer_name: "B", customer_number: "03001234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 10 },
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: "", rec_50w_1: "Royal", rec_50w_2: "",
  frontPhoto: new File(["x"], "front.jpg", { type: "image/jpeg" }),
  innerPhotos: [new File(["x"], "a.jpg", { type: "image/jpeg" }), new File(["y"], "b.jpg", { type: "image/jpeg" })],
  audio: null,
};

describe("submitSurvey", () => {
  it("uploads media then calls create_survey with mapped paths", async () => {
    uploadMock.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ data: "generated-id", error: null });
    vi.stubGlobal("crypto", { randomUUID: () => "abcd" });

    const id = await submitSurvey(v);
    expect(id).toBe("abcd");
    expect(uploadMock).toHaveBeenCalledTimes(3); // front + 2 inner
    const payload = rpcMock.mock.calls[0][1].payload;
    expect(payload.photos).toHaveLength(3);
    expect(payload.photos[0]).toEqual({ kind: "front", storage_path: "rep-uid-1/abcd/front.jpg", sort_order: 0 });
    vi.unstubAllGlobals();
  });

  it("throws and does not call the RPC when an upload fails", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "network" } });
    rpcMock.mockClear();
    vi.stubGlobal("crypto", { randomUUID: () => "efgh" });
    await expect(submitSurvey(v)).rejects.toThrow(/upload/i);
    expect(rpcMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
