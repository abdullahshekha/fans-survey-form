import { describe, it, expect, beforeEach } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";
const REP2 = "10000000-0000-0000-0000-000000000003";

function createPayload(id: string, over: Record<string, unknown> = {}) {
  return {
    id, shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
    customer_name: "Bilal", customer_number: "03001234567",
    gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
    most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null,
    rec_50w_1: "Royal", rec_50w_2: null, audio_path: null,
    most_selling_fan_other: null, rec_30w_1_other: null, rec_30w_2_other: null,
    rec_50w_1_other: null, rec_50w_2_other: null,
    photos: [
      { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
      { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
    ],
    ...over,
  };
}

async function seedSurvey(rep: Awaited<ReturnType<typeof signInAs>>, id: string) {
  const { error } = await rep.rpc("create_survey", { payload: createPayload(id) });
  expect(error).toBeNull();
}

describe("update_survey RPC", () => {
  beforeEach(async () => {
    await serviceClient().from("surveys").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await serviceClient().from("profiles").update({ active: true }).in("id", [REP1, REP2]);
  });

  it("updates fields and stamps edited_at without touching created_at / rep_id", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000001";
    await seedSurvey(rep, id);
    const before = await serviceClient().from("surveys")
      .select("created_at, edited_at, rep_id").eq("id", id).single();
    expect(before.data?.edited_at).toBeNull();

    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "New Name", most_selling_fan: "SK" }),
    });
    expect(error).toBeNull();

    const after = await serviceClient().from("surveys")
      .select("shop_name, most_selling_fan, created_at, edited_at, rep_id").eq("id", id).single();
    expect(after.data?.shop_name).toBe("New Name");
    expect(after.data?.most_selling_fan).toBe("SK");
    expect(after.data?.created_at).toBe(before.data?.created_at);
    expect(after.data?.rep_id).toBe(REP1);
    expect(after.data?.edited_at).not.toBeNull();
  });

  it("reconciles photo rows to the payload", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000002";
    await seedSurvey(rep, id);
    await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [
        { kind: "front", storage_path: `${REP1}/${id}/front-new.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-1.jpg`, sort_order: 1 },
      ] }),
    });
    const { data } = await serviceClient().from("survey_photos")
      .select("kind, storage_path").eq("survey_id", id).order("storage_path");
    expect(data?.map((p) => p.kind).sort()).toEqual(["front", "inner", "inner"]);
    expect(data?.some((p) => p.storage_path === `${REP1}/${id}/front-new.jpg`)).toBe(true);
  });

  it("rejects an 'Other' brand with no typed name and rolls back", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000003";
    await seedSurvey(rep, id);
    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "Rolled Back", most_selling_fan: "Other", most_selling_fan_other: "" }),
    });
    expect(error).not.toBeNull();
    const { data } = await serviceClient().from("surveys").select("shop_name").eq("id", id).single();
    expect(data?.shop_name).toBe("Al Madina");
  });

  it("rejects bad photo counts", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000004";
    await seedSurvey(rep, id);
    const zeroInner = await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [{ kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 }] }),
    });
    expect(zeroInner.error).not.toBeNull();
    const threeQuote = await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [
        { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
        { kind: "quotation", storage_path: `${REP1}/${id}/q0.jpg`, sort_order: 0 },
        { kind: "quotation", storage_path: `${REP1}/${id}/q1.jpg`, sort_order: 1 },
        { kind: "quotation", storage_path: `${REP1}/${id}/q2.jpg`, sort_order: 2 },
      ] }),
    });
    expect(threeQuote.error).not.toBeNull();
  });

  it("rejects a storage_path outside the caller prefix", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000005";
    await seedSurvey(rep, id);
    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [
        { kind: "front", storage_path: `${REP2}/${id}/front.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
      ] }),
    });
    expect(error).not.toBeNull();
  });

  it("does not let a rep edit another rep's survey", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000006";
    await seedSurvey(rep1, id);
    const rep2 = await signInAs("rep.two@survey.local", "test-pass-123");
    const { error } = await rep2.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "Hijacked" }),
    });
    expect(error).not.toBeNull(); // "survey not found or not editable"
    const { data } = await serviceClient().from("surveys").select("shop_name").eq("id", id).single();
    expect(data?.shop_name).toBe("Al Madina");
  });

  it("does not let a deactivated rep edit their own survey", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000007";
    await seedSurvey(rep, id);
    await serviceClient().from("profiles").update({ active: false }).eq("id", REP1);
    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "While Inactive" }),
    });
    expect(error).not.toBeNull();
    await serviceClient().from("profiles").update({ active: true }).eq("id", REP1);
  });
});
