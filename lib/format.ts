import { OTHER_BRAND } from "./constants";

/** A brand value for display: "Other" folds in the typed name. */
export function brandDisplay(brand: string | null, other: string | null): string {
  if (!brand) return "";
  return brand === OTHER_BRAND ? `Other — "${other ?? ""}"` : brand;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function relativeDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
