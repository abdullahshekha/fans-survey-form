import { describe, it, expect } from "vitest";
import { toExportRows, buildCsv } from "@/lib/exportSurveys";

const survey = {
  id: "s1", created_at: "2026-09-05T10:00:00Z",
  shop_name: 'Al "Madina"', market: "Malir", shop_size: "Large",
  customer_name: "Bilal, Jr", customer_number: "03001234567",
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null, rec_50w_1: "Royal", rec_50w_2: null,
  gps_lat: 24.9, gps_lng: 67.1, gps_accuracy: 12,
  audio_path: "u/s1/comment.webm",
  profiles: { username: "rep.one" },
  survey_photos: [
    { kind: "front", storage_path: "u/s1/front.jpg", sort_order: 0 },
    { kind: "inner", storage_path: "u/s1/inner-0.jpg", sort_order: 0 },
    { kind: "inner", storage_path: "u/s1/inner-1.jpg", sort_order: 1 },
  ],
};
const signed = new Map([
  ["u/s1/front.jpg", "https://x/front"],
  ["u/s1/inner-0.jpg", "https://x/i0"],
  ["u/s1/inner-1.jpg", "https://x/i1"],
  ["u/s1/comment.webm", "https://x/audio"],
]);

describe("export", () => {
  it("flattens a survey into one export row", () => {
    const [row] = toExportRows([survey], signed);
    expect(row.rep).toBe("rep.one");
    expect(row.maps_link).toBe("https://www.google.com/maps?q=24.9,67.1");
    expect(row.front_photo_url).toBe("https://x/front");
    expect(row.inner_photo_urls).toBe("https://x/i0\nhttps://x/i1");
    expect(row.voice_note_url).toBe("https://x/audio");
    expect(row.rec_30w_2).toBe("");
  });

  it("quotes fields containing quotes, commas, and newlines in CSV", () => {
    const csv = buildCsv(toExportRows([survey], signed));
    expect(csv).toContain('"Al ""Madina"""');
    expect(csv).toContain('"Bilal, Jr"');
    expect(csv.split("\n")[0]).toContain("submitted_at");
  });
});
