"use client";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { KARACHI_CENTER, KARACHI_ZOOM } from "@/lib/constants";

export type MapPoint = {
  id: string; lat: number; lng: number; shop_name: string; market: string; rep_username: string; created_at: string;
};

type MarketOption = { name: string; color: string };

const Inner = dynamic(async () => {
  const RL = await import("react-leaflet");
  const { MapContainer, TileLayer, CircleMarker, Popup, useMap } = RL;
  const L = await import("leaflet");

  function Fit({ points }: { points: MapPoint[] }) {
    const map = useMap();
    if (points.length) {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
    }
    return null;
  }

  return function MapInner({ points, colorByMarket }: { points: MapPoint[]; colorByMarket: Record<string, string> }) {
    return (
      <MapContainer center={KARACHI_CENTER} zoom={KARACHI_ZOOM} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors" />
        <Fit points={points} />
        {points.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={7}
            pathOptions={{ color: colorByMarket[p.market] ?? "#0f172a", fillOpacity: 0.85 }}>
            <Popup>
              <strong>{p.shop_name}</strong><br />
              {p.market} · {p.rep_username}<br />
              {new Date(p.created_at).toLocaleDateString("en-GB")}<br />
              <a href={`/survey/${p.id}`}>Open survey</a>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    );
  };
}, { ssr: false });

export function SurveysMap({ points, markets }: { points: MapPoint[]; markets: MarketOption[] }) {
  const colorByMarket = Object.fromEntries(markets.map((m) => [m.name, m.color]));
  return (
    <div className="flex flex-col gap-3">
      <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200">
        <Inner points={points} colorByMarket={colorByMarket} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {markets.map((m) => (
          <li key={m.name} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: m.color }} />
            {m.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
