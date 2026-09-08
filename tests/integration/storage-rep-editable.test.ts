import { describe, it, expect } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

// After 0006 a rep may mutate objects under their OWN uid prefix (needed to
// replace/remove media while editing a survey), but still not another rep's.

const REP1 = "10000000-0000-0000-0000-000000000002";
const REP2 = "10000000-0000-0000-0000-000000000003";
const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
const newBytes = new Blob([new Uint8Array([4, 5, 6, 7])], { type: "image/jpeg" });

describe("storage — rep may edit their own media", () => {
  it("rep can overwrite their own object", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const path = `${REP1}/editable-test/overwrite.jpg`;
    await rep1.storage.from("survey-photos").upload(path, bytes, { upsert: true });
    const { error } = await rep1.storage.from("survey-photos").upload(path, newBytes, { upsert: true });
    expect(error).toBeNull();
  });

  it("rep can delete their own object", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const path = `${REP1}/editable-test/delete.jpg`;
    await rep1.storage.from("survey-photos").upload(path, bytes, { upsert: true });
    await rep1.storage.from("survey-photos").remove([path]);
    const { error } = await serviceClient().storage.from("survey-photos").download(path);
    expect(error).not.toBeNull(); // gone
  });

  it("rep cannot delete another rep's object", async () => {
    const other = `${REP2}/editable-test/theirs.jpg`;
    await serviceClient().storage.from("survey-photos").upload(other, bytes, { upsert: true });
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    await rep1.storage.from("survey-photos").remove([other]);
    const { data, error } = await serviceClient().storage.from("survey-photos").download(other);
    expect(error).toBeNull();
    expect(data).not.toBeNull(); // still there
  });

  it("survey-audio bucket rejects a non-audio content type", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const pdf = new Blob([new Uint8Array([1])], { type: "application/pdf" });
    const { error } = await rep1.storage.from("survey-audio")
      .upload(`${REP1}/editable-test/x.pdf`, pdf, { upsert: true });
    expect(error).not.toBeNull();
  });
});
