import { describe, it, expect, afterAll } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1_ID = "10000000-0000-0000-0000-000000000002";

describe("markets", () => {
  afterAll(async () => {
    const db = serviceClient();
    await db.from("markets").delete().eq("name", "Integration Test Market");
    await db.from("markets").update({ name: "UP" }).eq("name", "University Road");
  });

  it("a rep can read the markets list", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const { data, error } = await rep.from("markets").select("name");
    expect(error).toBeNull();
    expect(data?.some((m: any) => m.name === "Arambagh")).toBe(true);
  });

  it("a rep cannot insert a market", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep.from("markets").insert({ name: "Integration Test Market", color: "#000000", sort_order: 99 });
    expect(error).not.toBeNull();
  });

  it("a rep cannot rename a market", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep.from("markets").update({ name: "Should Not Work" }).eq("name", "MA Jinnah");
    expect(error).not.toBeNull();

    const db = serviceClient();
    const { data } = await db.from("markets").select("name").eq("name", "MA Jinnah");
    expect(data?.length).toBe(1);
  });

  it("the admin can insert a market", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { error } = await admin.from("markets").insert({ name: "Integration Test Market", color: "#000000", sort_order: 99 });
    expect(error).toBeNull();
  });

  it("renaming a market cascades to existing surveys referencing it", async () => {
    const db = serviceClient();
    const surveyId = "66666666-6666-6666-6666-666666666666";
    await db.from("surveys").insert({
      id: surveyId, rep_id: REP1_ID,
      shop_name: "Cascade Test", market: "UP", shop_size: "Small",
      customer_name: "c", customer_number: "03001234567",
      gps_lat: 24.9, gps_lng: 67.1, most_selling_fan: "GFC",
      rec_30w_1: "GFC", rec_50w_1: "GFC",
    });

    const admin = await signInAs("admin@survey.local", "test-pass-123");
    await admin.from("markets").update({ name: "University Road" }).eq("name", "UP");

    const { data } = await db.from("surveys").select("market").eq("id", surveyId).single();
    expect(data?.market).toBe("University Road");

    await db.from("surveys").delete().eq("id", surveyId);
    await admin.from("markets").update({ name: "UP" }).eq("name", "University Road");
  });

  it("deleting a market that has surveys attached is blocked by the FK", async () => {
    const db = serviceClient();
    // seed.sql's "Malir Fan House" survey references the Malir market.
    const { error } = await db.from("markets").delete().eq("name", "Malir");
    expect(error).not.toBeNull();
  });
});
