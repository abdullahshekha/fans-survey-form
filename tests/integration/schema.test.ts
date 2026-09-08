import { describe, it, expect } from "vitest";
import { serviceClient } from "@/tests/setup/supabase-test-client";

describe("schema", () => {
  const db = serviceClient();

  it("rejects an unknown market", async () => {
    const { error } = await db.from("surveys").insert({
      id: "22222222-2222-2222-2222-222222222222",
      rep_id: "00000000-0000-0000-0000-000000000000",
      shop_name: "x", market: "Nowhere", shop_size: "Small",
      customer_name: "x", customer_number: "03001234567",
      gps_lat: 24, gps_lng: 67, most_selling_fan: "GFC",
      rec_30w_1: "GFC", rec_50w_1: "GFC",
    });
    expect(error?.message).toMatch(/surveys_market_check|violates check/i);
  });

  it("rejects a malformed phone number", async () => {
    const { error } = await db.from("surveys").insert({
      id: "33333333-3333-3333-3333-333333333333",
      rep_id: "00000000-0000-0000-0000-000000000000",
      shop_name: "x", market: "Malir", shop_size: "Small",
      customer_name: "x", customer_number: "12345",
      gps_lat: 24, gps_lng: 67, most_selling_fan: "GFC",
      rec_30w_1: "GFC", rec_50w_1: "GFC",
    });
    expect(error?.message).toMatch(/customer_number|violates check/i);
  });
});
