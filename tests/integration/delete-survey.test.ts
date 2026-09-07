import { describe, it, expect, beforeEach } from "vitest";
import { serviceClient } from "@/tests/setup/supabase-test-client";

// Exercises the same operations deleteSurvey performs, against local Supabase.
const REP1 = "10000000-0000-0000-0000-000000000002";
const db = serviceClient();

async function makeSurvey(id: string) {
  await db.from("surveys").insert({
    id, rep_id: REP1, shop_name: "x", market: "Malir", shop_size: "Small",
    customer_name: "c", customer_number: "03001234567", gps_lat: 24, gps_lng: 67,
    most_selling_fan: "GFC", rec_30w_1: "GFC", rec_50w_1: "GFC",
  });
  await db.from("survey_photos").insert([
    { survey_id: id, kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
    { survey_id: id, kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
  ]);
  await db.storage.from("survey-photos").upload(`${REP1}/${id}/front.jpg`, new Blob([new Uint8Array([1])]), { upsert: true });
}

describe("delete survey behaviour", () => {
  const id = "99999999-9999-9999-9999-999999999999";
  beforeEach(async () => {
    await db.from("surveys").delete().eq("id", id);
  });

  it("removes storage objects and cascades photo rows", async () => {
    await makeSurvey(id);
    const { data: files } = await db.storage.from("survey-photos").list(`${REP1}/${id}`);
    await db.storage.from("survey-photos").remove((files ?? []).map((f) => `${REP1}/${id}/${f.name}`));
    await db.from("surveys").delete().eq("id", id);

    const { count: photoRows } = await db.from("survey_photos")
      .select("id", { count: "exact", head: true }).eq("survey_id", id);
    const { data: after } = await db.storage.from("survey-photos").list(`${REP1}/${id}`);
    expect(photoRows).toBe(0);
    expect(after ?? []).toHaveLength(0);
  });
});
