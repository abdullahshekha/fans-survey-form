import { describe, it, expect, afterAll } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

// Pins F4: deactivating a rep binds at the DB layer, not just the UI.
// `surveys_rep_insert` requires an active profile row for auth.uid().

const REP2 = "10000000-0000-0000-0000-000000000003";

const survey = (id: string, rep_id: string) => ({
  id, rep_id, shop_name: "s", market: "Malir", shop_size: "Small",
  customer_name: "c", customer_number: "03001234567",
  gps_lat: 24.9, gps_lng: 67.1, most_selling_fan: "GFC",
  rec_30w_1: "GFC", rec_50w_1: "GFC",
});

describe("RLS — rep deactivation", () => {
  afterAll(async () => {
    // Always leave rep.two active for the rest of the suite.
    await serviceClient().from("profiles").update({ active: true }).eq("id", REP2);
    await serviceClient().from("surveys")
      .delete().eq("id", "55555555-5555-5555-5555-555555555555");
  });

  it("a deactivated rep cannot insert a survey", async () => {
    const db = serviceClient();
    await db.from("profiles").update({ active: false }).eq("id", REP2);

    const rep2 = await signInAs("rep.two@survey.local", "test-pass-123");
    const { error } = await rep2.from("surveys")
      .insert(survey("55555555-5555-5555-5555-555555555555", REP2));
    expect(error).not.toBeNull();

    const { count } = await db.from("surveys")
      .select("id", { count: "exact", head: true })
      .eq("id", "55555555-5555-5555-5555-555555555555");
    expect(count).toBe(0);
  });

  it("the rep can insert again once reactivated", async () => {
    const db = serviceClient();
    await db.from("profiles").update({ active: true }).eq("id", REP2);

    const rep2 = await signInAs("rep.two@survey.local", "test-pass-123");
    const { error } = await rep2.from("surveys")
      .insert(survey("55555555-5555-5555-5555-555555555555", REP2));
    expect(error).toBeNull();
  });
});
