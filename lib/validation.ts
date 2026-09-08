import { BRANDS, MARKETS, SHOP_SIZES, MAX_INNER_PHOTOS } from "./constants";

export interface GpsFix { lat: number; lng: number; accuracy: number | null }

export interface SurveyFormValues {
  shop_name: string;
  market: string;
  shop_size: string;
  customer_name: string;
  customer_number: string;
  gps: GpsFix | null;
  most_selling_fan: string;
  rec_30w_1: string;
  rec_30w_2: string;
  rec_50w_1: string;
  rec_50w_2: string;
  frontPhoto: File | null;
  innerPhotos: File[];
  audio: Blob | null;
}

export interface SurveyRpcPayload {
  id: string;
  shop_name: string;
  market: string;
  shop_size: string;
  customer_name: string;
  customer_number: string;
  gps_lat: number;
  gps_lng: number;
  gps_accuracy: number | null;
  most_selling_fan: string;
  rec_30w_1: string;
  rec_30w_2: string | null;
  rec_50w_1: string;
  rec_50w_2: string | null;
  audio_path: string | null;
  photos: { kind: "front" | "inner"; storage_path: string; sort_order: number }[];
}

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  let m = digits.match(/^\+92(3\d{9})$/);
  if (m) return "0" + m[1];
  m = digits.match(/^(03\d{9})$/);
  if (m) return m[1];
  return null;
}

const isBrand = (v: string) => (BRANDS as readonly string[]).includes(v);

export function validateSurvey(v: SurveyFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.shop_name.trim()) e.shop_name = "Shop name is required";
  if (!(MARKETS as readonly string[]).includes(v.market)) e.market = "Select a market";
  if (!(SHOP_SIZES as readonly string[]).includes(v.shop_size)) e.shop_size = "Select a shop size";
  if (!v.customer_name.trim()) e.customer_name = "Customer name is required";
  if (!normalizePhone(v.customer_number)) e.customer_number = "Enter a valid Pakistani mobile number";
  if (!v.gps) e.gps = "Capture the shop location";
  if (!isBrand(v.most_selling_fan)) e.most_selling_fan = "Select the most selling fan";
  if (!isBrand(v.rec_30w_1)) e.rec_30w_1 = "Select a 30W recommendation";
  if (v.rec_30w_2 && !isBrand(v.rec_30w_2)) e.rec_30w_2 = "Invalid brand";
  if (!isBrand(v.rec_50w_1)) e.rec_50w_1 = "Select a 50W recommendation";
  if (v.rec_50w_2 && !isBrand(v.rec_50w_2)) e.rec_50w_2 = "Invalid brand";
  if (!v.frontPhoto) e.frontPhoto = "Add a front photo";
  if (v.innerPhotos.length < 1) e.innerPhotos = "Add at least one inner photo";
  else if (v.innerPhotos.length > MAX_INNER_PHOTOS) e.innerPhotos = `No more than ${MAX_INNER_PHOTOS} inner photos`;
  return e;
}

export function buildSurveyPayload(
  id: string,
  v: SurveyFormValues,
  paths: { front: string; inner: string[]; audio: string | null },
): SurveyRpcPayload {
  return {
    id,
    shop_name: v.shop_name.trim(),
    market: v.market,
    shop_size: v.shop_size,
    customer_name: v.customer_name.trim(),
    customer_number: normalizePhone(v.customer_number)!,
    gps_lat: v.gps!.lat,
    gps_lng: v.gps!.lng,
    gps_accuracy: v.gps!.accuracy,
    most_selling_fan: v.most_selling_fan,
    rec_30w_1: v.rec_30w_1,
    rec_30w_2: v.rec_30w_2 || null,
    rec_50w_1: v.rec_50w_1,
    rec_50w_2: v.rec_50w_2 || null,
    audio_path: paths.audio,
    photos: [
      { kind: "front", storage_path: paths.front, sort_order: 0 },
      ...paths.inner.map((p, i) => ({ kind: "inner" as const, storage_path: p, sort_order: i })),
    ],
  };
}
