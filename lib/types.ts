import type { Brand, Market, ShopSize } from "./constants";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "rep";
  active: boolean;
  created_at: string;
}

export interface SurveyPhoto {
  id: string;
  survey_id: string;
  kind: "front" | "inner" | "quotation";
  storage_path: string;
  sort_order: number;
}

export interface Survey {
  id: string;
  rep_id: string;
  shop_name: string;
  market: Market;
  shop_size: ShopSize;
  customer_name: string;
  customer_number: string;
  gps_lat: number;
  gps_lng: number;
  gps_accuracy: number | null;
  most_selling_fan: Brand | "Other";
  most_selling_fan_other: string | null;
  rec_30w_1: Brand | "Other";
  rec_30w_1_other: string | null;
  rec_30w_2: Brand | "Other" | null;
  rec_30w_2_other: string | null;
  rec_50w_1: Brand | "Other";
  rec_50w_1_other: string | null;
  rec_50w_2: Brand | "Other" | null;
  rec_50w_2_other: string | null;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyWithRelations extends Survey {
  rep: Pick<Profile, "id" | "username" | "full_name">;
  photos: SurveyPhoto[];
}
