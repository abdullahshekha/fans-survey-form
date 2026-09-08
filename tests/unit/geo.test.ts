import { describe, it, expect, vi, afterEach } from "vitest";
import { getCurrentPosition } from "@/lib/geo";

afterEach(() => vi.unstubAllGlobals());

function stubGeo(impl: (ok: PositionCallback, err: PositionErrorCallback) => void) {
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: impl } });
}

describe("getCurrentPosition", () => {
  it("resolves lat/lng/accuracy", async () => {
    stubGeo((ok) => ok({ coords: { latitude: 24.86, longitude: 67.02, accuracy: 8 } } as GeolocationPosition));
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 24.86, lng: 67.02, accuracy: 8 });
  });
  it("maps PERMISSION_DENIED to 'permission-denied'", async () => {
    stubGeo((_ok, err) => err({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError));
    await expect(getCurrentPosition()).rejects.toThrow("permission-denied");
  });
  it("rejects with 'unsupported' when geolocation is absent", async () => {
    vi.stubGlobal("navigator", {});
    await expect(getCurrentPosition()).rejects.toThrow("unsupported");
  });
});
