import type { GpsFix } from "./validation";

export function getCurrentPosition(opts: PositionOptions = { enableHighAccuracy: true, timeout: 15000 }): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      }),
      (err) => {
        const map: Record<number, string> = { 1: "permission-denied", 2: "unavailable", 3: "timeout" };
        reject(new Error(map[err.code] ?? "unavailable"));
      },
      opts,
    );
  });
}
