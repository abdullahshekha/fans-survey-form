import {
  BRANDS, MARKETS, SHOP_SIZES, MAX_INNER_PHOTOS,
  MAX_QUOTATION_PHOTOS, MAX_OTHER_BRAND_LEN, OTHER_BRAND,
  MAX_AUDIO_UPLOAD_MB, ALLOWED_AUDIO_TYPES,
} from "./constants";

export interface GpsFix { lat: number; lng: number; accuracy: number | null }

export type ExistingMedia = { storagePath: string; url: string };

export function validateAudioUpload(file: File): string | null {
  if (!(ALLOWED_AUDIO_TYPES as readonly string[]).includes(file.type))
    return "Choose an audio file (mp3, m4a, wav, ogg, or webm).";
  if (file.size > MAX_AUDIO_UPLOAD_MB * 1024 * 1024)
    return `Audio must be ${MAX_AUDIO_UPLOAD_MB} MB or smaller.`;
  return null;
}

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
  most_selling_fan_other: string;
  rec_30w_1_other: string;
  rec_30w_2_other: string;
  rec_50w_1_other: string;
  rec_50w_2_other: string;
  frontPhoto: File | null;
  innerPhotos: File[];
  quotationPhotos: File[];
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
  most_selling_fan_other: string | null;
  rec_30w_1_other: string | null;
  rec_30w_2_other: string | null;
  rec_50w_1_other: string | null;
  rec_50w_2_other: string | null;
  photos: { kind: "front" | "inner" | "quotation"; storage_path: string; sort_order: number }[];
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

type BrandFieldResult = { field: "self" | "other"; msg: string } | null;
function brandCheck(brand: string, other: string, optional: boolean): BrandFieldResult {
  if (!brand) return optional ? null : { field: "self", msg: "Select a brand" };
  if (brand === OTHER_BRAND) {
    const t = other.trim();
    if (!t) return { field: "other", msg: "Enter the brand name" };
    if (t.length > MAX_OTHER_BRAND_LEN) return { field: "other", msg: `Use ${MAX_OTHER_BRAND_LEN} characters or fewer` };
    return null;
  }
  if (!isBrand(brand)) return { field: "self", msg: "Invalid brand" };
  return null;
}

export function validateScalarFields(v: SurveyFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.shop_name.trim()) e.shop_name = "Shop name is required";
  if (!(MARKETS as readonly string[]).includes(v.market)) e.market = "Select a market";
  if (!(SHOP_SIZES as readonly string[]).includes(v.shop_size)) e.shop_size = "Select a shop size";
  if (!v.customer_name.trim()) e.customer_name = "Customer name is required";
  if (!normalizePhone(v.customer_number)) e.customer_number = "Enter a valid Pakistani mobile number";
  if (!v.gps) e.gps = "Capture the shop location";
  for (const [name, brand, other, optional] of [
    ["most_selling_fan", v.most_selling_fan, v.most_selling_fan_other, false],
    ["rec_30w_1", v.rec_30w_1, v.rec_30w_1_other, false],
    ["rec_30w_2", v.rec_30w_2, v.rec_30w_2_other, true],
    ["rec_50w_1", v.rec_50w_1, v.rec_50w_1_other, false],
    ["rec_50w_2", v.rec_50w_2, v.rec_50w_2_other, true],
  ] as const) {
    const r = brandCheck(brand, other, optional);
    if (r) e[r.field === "self" ? name : `${name}_other`] = r.msg;
  }
  return e;
}

export function audioUploadError(audio: Blob | null): string | null {
  return audio instanceof File ? validateAudioUpload(audio) : null;
}

export function validateSurvey(v: SurveyFormValues): Record<string, string> {
  const e = validateScalarFields(v);
  if (!v.frontPhoto) e.frontPhoto = "Add a front photo";
  if (v.innerPhotos.length < 1) e.innerPhotos = "Add at least one inner photo";
  else if (v.innerPhotos.length > MAX_INNER_PHOTOS) e.innerPhotos = `No more than ${MAX_INNER_PHOTOS} inner photos`;
  if (v.quotationPhotos.length > MAX_QUOTATION_PHOTOS)
    e.quotationPhotos = `No more than ${MAX_QUOTATION_PHOTOS} quotation photos`;
  const a = audioUploadError(v.audio);
  if (a) e.audio = a;
  return e;
}

export function validateSurveyEdit(
  v: SurveyFormValues,
  counts: { front: number; inner: number; quotation: number },
): Record<string, string> {
  const e = validateScalarFields(v);
  if (counts.front !== 1) e.frontPhoto = "Add a front photo";
  if (counts.inner < 1) e.innerPhotos = "Add at least one inner photo";
  else if (counts.inner > MAX_INNER_PHOTOS) e.innerPhotos = `No more than ${MAX_INNER_PHOTOS} inner photos`;
  if (counts.quotation > MAX_QUOTATION_PHOTOS)
    e.quotationPhotos = `No more than ${MAX_QUOTATION_PHOTOS} quotation photos`;
  const a = audioUploadError(v.audio);
  if (a) e.audio = a;
  return e;
}

export function buildSurveyPayload(
  id: string,
  v: SurveyFormValues,
  paths: { front: string; inner: string[]; quotation: string[]; audio: string | null },
): SurveyRpcPayload {
  const otherOf = (brand: string, other: string) => (brand === OTHER_BRAND ? (other.trim() || null) : null);
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
    most_selling_fan_other: otherOf(v.most_selling_fan, v.most_selling_fan_other),
    rec_30w_1_other: otherOf(v.rec_30w_1, v.rec_30w_1_other),
    rec_30w_2_other: otherOf(v.rec_30w_2, v.rec_30w_2_other),
    rec_50w_1_other: otherOf(v.rec_50w_1, v.rec_50w_1_other),
    rec_50w_2_other: otherOf(v.rec_50w_2, v.rec_50w_2_other),
    photos: [
      { kind: "front", storage_path: paths.front, sort_order: 0 },
      ...paths.inner.map((p, i) => ({ kind: "inner" as const, storage_path: p, sort_order: i })),
      ...paths.quotation.map((p, i) => ({ kind: "quotation" as const, storage_path: p, sort_order: i })),
    ],
  };
}
