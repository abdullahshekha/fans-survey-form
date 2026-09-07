import { describe, it, expect } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

// Pins F3: a rep's storage policies grant INSERT + SELECT of their own prefix
// only. UPDATE and DELETE are not granted, so submitted media is immutable.

const REP1 = "10000000-0000-0000-0000-000000000002";
const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
const newBytes = new Blob([new Uint8Array([4, 5, 6, 7])], { type: "image/jpeg" });

describe("storage — rep media is immutable", () => {
  it("rep cannot delete their own storage object", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const ownPath = `${REP1}/immutable-test/front.jpg`;

    await rep1.storage.from("survey-photos").upload(ownPath, bytes);

    await rep1.storage.from("survey-photos").remove([ownPath]);

    // The object must still be there when checked with the service client.
    const { data, error } = await serviceClient().storage
      .from("survey-photos").download(ownPath);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("rep cannot overwrite their own storage object", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const ownPath = `${REP1}/immutable-test/overwrite.jpg`;

    await rep1.storage.from("survey-photos").upload(ownPath, bytes);

    // upsert needs the UPDATE privilege, which reps no longer have.
    const { error } = await rep1.storage.from("survey-photos")
      .upload(ownPath, newBytes, { upsert: true });
    expect(error).not.toBeNull();
  });
});
