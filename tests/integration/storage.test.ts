import { describe, it, expect } from "vitest";
import { signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";
const REP2 = "10000000-0000-0000-0000-000000000003";
const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });

describe("storage policies", () => {
  it("rep can upload under their own uid prefix", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep1.storage.from("survey-photos")
      .upload(`${REP1}/test-survey/front.jpg`, bytes);
    expect(error).toBeNull();
  });

  it("rep cannot upload under another rep's prefix", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep1.storage.from("survey-photos")
      .upload(`${REP2}/test-survey/front.jpg`, bytes);
    expect(error).not.toBeNull();
  });

  it("admin can download any rep's object", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { error } = await admin.storage.from("survey-photos")
      .download(`${REP1}/test-survey/front.jpg`);
    expect(error).toBeNull();
  });

  it("buckets are private (no public URL access)", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { data } = admin.storage.from("survey-photos").getPublicUrl(`${REP1}/test-survey/front.jpg`);
    const res = await fetch(data.publicUrl);
    expect(res.ok).toBe(false);
  });
});
