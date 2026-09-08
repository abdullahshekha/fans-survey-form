import { describe, it, expect, beforeEach } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";

function payload(id: string, over: Record<string, unknown> = {}) {
  return {
    id, shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
    customer_name: "Bilal", customer_number: "03001234567",
    gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
    most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null,
    rec_50w_1: "Royal", rec_50w_2: null, audio_path: null,
    photos: [
      { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
      { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
    ],
    ...over,
  };
}

describe("create_survey RPC", () => {
  beforeEach(async () => {
    await serviceClient().from("surveys").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  });

  it("inserts survey + photos and returns the id", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "55555555-5555-5555-5555-555555555555";
    const { data, error } = await rep.rpc("create_survey", { payload: payload(id) });
    expect(error).toBeNull();
    expect(data).toBe(id);
    const { data: photos } = await serviceClient().from("survey_photos").select("kind").eq("survey_id", id);
    expect(photos?.map((p) => p.kind).sort()).toEqual(["front", "inner"]);
  });

  it("forces rep_id to the caller", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "66666666-6666-6666-6666-666666666666";
    await rep.rpc("create_survey", { payload: payload(id) });
    const { data } = await serviceClient().from("surveys").select("rep_id").eq("id", id).single();
    expect(data?.rep_id).toBe(REP1);
  });

  it("rolls back entirely when there are zero inner photos", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "77777777-7777-7777-7777-777777777777";
    const { error } = await rep.rpc("create_survey", {
      payload: payload(id, { photos: [{ kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 }] }),
    });
    expect(error).not.toBeNull();
    const { count } = await serviceClient().from("surveys")
      .select("id", { count: "exact", head: true }).eq("id", id);
    expect(count).toBe(0);
  });

  it("rolls back when there are two front photos", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "88888888-8888-8888-8888-888888888888";
    const { error } = await rep.rpc("create_survey", {
      payload: payload(id, { photos: [
        { kind: "front", storage_path: "a", sort_order: 0 },
        { kind: "front", storage_path: "b", sort_order: 0 },
        { kind: "inner", storage_path: "c", sort_order: 0 },
      ] }),
    });
    expect(error).not.toBeNull();
  });
});
