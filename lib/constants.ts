export const BRANDS = [
  "Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans",
] as const;
export type Brand = (typeof BRANDS)[number];

export const OTHER_BRAND = "Other" as const;
export const BRAND_SELECT_OPTIONS = [...BRANDS, OTHER_BRAND] as const;
export const MAX_OTHER_BRAND_LEN = 40;

export const SHOP_SIZES = ["Small", "Medium", "Large"] as const;
export type ShopSize = (typeof SHOP_SIZES)[number];

export const MAX_INNER_PHOTOS = 10;
export const MAX_QUOTATION_PHOTOS = 2;
export const MAX_AUDIO_SECONDS = 120;
export const MAX_AUDIO_UPLOAD_MB = 25;
export const ALLOWED_AUDIO_TYPES = [
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/aac",
  "audio/ogg", "audio/wav", "audio/x-m4a",
] as const;
export const SIGNED_URL_TTL = 21600; // 6 hours

export const MAX_MARKET_NAME_LEN = 40;
export const MARKET_COLOR_PALETTE = [
  "#e6194b", "#3cb44b", "#e6a700", "#4363d8", "#f58231", "#911eb4",
  "#009fb0", "#f032e6", "#7a9a01", "#c26f9d", "#469990", "#9a6324",
  "#000075", "#808000", "#aaffc3", "#ffd8b1", "#808080", "#fabed4",
] as const;

export const KARACHI_CENTER: [number, number] = [24.86, 67.02];
export const KARACHI_ZOOM = 11;

/** External estimate of Karachi's total annual fan market, in units. Not
 * derived from survey data — used only to scale a citywide brand share into
 * an approximate unit figure on the admin overview. */
export const KARACHI_ANNUAL_FAN_MARKET_UNITS = 1_200_000;
