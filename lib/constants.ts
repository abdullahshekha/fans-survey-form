export const MARKETS = [
  "Arambagh", "MA Jinnah", "Waterpump", "Bohrapir", "Johar Mor", "UP",
  "Liaquatabad", "Shah Faisal Colony", "Orangi Town", "Baldia Town", "Malir", "Landhi/Korangi",
] as const;
export type Market = (typeof MARKETS)[number];

export const BRANDS = [
  "Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans",
] as const;
export type Brand = (typeof BRANDS)[number];

export const SHOP_SIZES = ["Small", "Medium", "Large"] as const;
export type ShopSize = (typeof SHOP_SIZES)[number];

export const MAX_INNER_PHOTOS = 10;
export const MAX_AUDIO_SECONDS = 120;
export const SIGNED_URL_TTL = 21600; // 6 hours

export const MARKET_COLORS: Record<Market, string> = {
  "Arambagh": "#e6194b", "MA Jinnah": "#3cb44b", "Waterpump": "#e6a700",
  "Bohrapir": "#4363d8", "Johar Mor": "#f58231", "UP": "#911eb4",
  "Liaquatabad": "#009fb0", "Shah Faisal Colony": "#f032e6", "Orangi Town": "#7a9a01",
  "Baldia Town": "#c26f9d", "Malir": "#469990", "Landhi/Korangi": "#9a6324",
};

export const KARACHI_CENTER: [number, number] = [24.86, 67.02];
export const KARACHI_ZOOM = 11;
