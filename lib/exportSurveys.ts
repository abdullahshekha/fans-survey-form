import { OTHER_BRAND } from "@/lib/constants";

export interface ExportRow {
  submitted_at: string; edited_at: string; rep: string; shop_name: string; market: string; shop_size: string;
  customer_name: string; customer_number: string; most_selling_fan: string;
  rec_30w_1: string; rec_30w_2: string; rec_50w_1: string; rec_50w_2: string;
  gps_lat: string; gps_lng: string; gps_accuracy: string; maps_link: string;
  front_photo_url: string; inner_photo_urls: string; quotation_photo_urls: string; voice_note_url: string;
}

export const EXPORT_COLUMNS: (keyof ExportRow)[] = [
  "submitted_at", "edited_at", "rep", "shop_name", "market", "shop_size", "customer_name", "customer_number",
  "most_selling_fan", "rec_30w_1", "rec_30w_2", "rec_50w_1", "rec_50w_2",
  "gps_lat", "gps_lng", "gps_accuracy", "maps_link", "front_photo_url", "inner_photo_urls", "quotation_photo_urls", "voice_note_url",
];

export function toExportRows(surveys: any[], signedByPath: Map<string, string>): ExportRow[] {
  const brandCell = (b: string | null, o: string | null) =>
    b === OTHER_BRAND ? `Other: ${o ?? ""}` : (b ?? "");

  return surveys.map((s) => {
    const inner = (s.survey_photos ?? [])
      .filter((p: any) => p.kind === "inner")
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((p: any) => signedByPath.get(p.storage_path) ?? "")
      .filter(Boolean);
    const quotation = (s.survey_photos ?? [])
      .filter((p: any) => p.kind === "quotation")
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((p: any) => signedByPath.get(p.storage_path) ?? "")
      .filter(Boolean);
    const front = (s.survey_photos ?? []).find((p: any) => p.kind === "front");
    return {
      submitted_at: s.created_at,
      edited_at: s.edited_at ?? "",
      rep: s.profiles?.username ?? "",
      shop_name: s.shop_name,
      market: s.market,
      shop_size: s.shop_size,
      customer_name: s.customer_name,
      customer_number: s.customer_number,
      most_selling_fan: brandCell(s.most_selling_fan, s.most_selling_fan_other),
      rec_30w_1: brandCell(s.rec_30w_1, s.rec_30w_1_other),
      rec_30w_2: brandCell(s.rec_30w_2, s.rec_30w_2_other),
      rec_50w_1: brandCell(s.rec_50w_1, s.rec_50w_1_other),
      rec_50w_2: brandCell(s.rec_50w_2, s.rec_50w_2_other),
      gps_lat: String(s.gps_lat),
      gps_lng: String(s.gps_lng),
      gps_accuracy: s.gps_accuracy == null ? "" : String(s.gps_accuracy),
      maps_link: `https://www.google.com/maps?q=${s.gps_lat},${s.gps_lng}`,
      front_photo_url: front ? (signedByPath.get(front.storage_path) ?? "") : "",
      inner_photo_urls: inner.join("\n"),
      quotation_photo_urls: quotation.join("\n"),
      voice_note_url: s.audio_path ? (signedByPath.get(s.audio_path) ?? "") : "",
    };
  });
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [header, ...body].join("\n");
}
