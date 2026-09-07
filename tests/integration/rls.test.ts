import { describe, it, expect, beforeAll } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";
const survey = (id: string, rep_id: string) => ({
  id, rep_id, shop_name: "s", market: "Malir", shop_size: "Small",
  customer_name: "c", customer_number: "03001234567",
  gps_lat: 24.9, gps_lng: 67.1, most_selling_fan: "GFC",
  rec_30w_1: "GFC", rec_50w_1: "GFC",
});

describe("RLS", () => {
  beforeAll(async () => {
    const db = serviceClient();
    await db.from("surveys").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("surveys").insert(survey("44444444-4444-4444-4444-444444444444", REP1));
  });

  it("rep can read own survey but not another rep's", async () => {
    const rep2 = await signInAs("rep.two@survey.local", "test-pass-123");
    const { data } = await rep2.from("surveys").select("id");
    expect(data).toEqual([]);
  });

  it("rep cannot update a survey", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep1.from("surveys")
      .update({ shop_name: "hacked" }).eq("id", "44444444-4444-4444-4444-444444444444");
    // no update policy -> zero rows affected, treated as success with 0 rows
    const { data } = await serviceClient().from("surveys")
      .select("shop_name").eq("id", "44444444-4444-4444-4444-444444444444").single();
    expect(data?.shop_name).toBe("s");
    expect(error).toBeNull();
  });

  it("rep cannot delete a survey", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    await rep1.from("surveys").delete().eq("id", "44444444-4444-4444-4444-444444444444");
    const { count } = await serviceClient().from("surveys")
      .select("id", { count: "exact", head: true }).eq("id", "44444444-4444-4444-4444-444444444444");
    expect(count).toBe(1);
  });

  it("admin can read every survey", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { data } = await admin.from("surveys").select("id");
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });
});
