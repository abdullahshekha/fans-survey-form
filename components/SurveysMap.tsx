"use client";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { KARACHI_CENTER, KARACHI_ZOOM } from "@/lib/constants";
import type { MarketBoundary } from "@/lib/markets";

export type MapPoint = {
  id: string; lat: number; lng: number; shop_name: string; market: string; rep_username: string; created_at: string;
};

type MarketOption = { name: string; color: string };

function ringToLatLngs(ring: GeoJSON.Position[]): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

function polygonLatLngs(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number][][] {
  return geom.type === "Polygon" ? geom.coordinates.map(ringToLatLngs) : geom.coordinates.flatMap((p) => p.map(ringToLatLngs));
}

function centroidOf(points: { lat: number; lng: number }[]): [number, number] | null {
  if (!points.length) return null;
  return [points.reduce((s, p) => s + p.lat, 0) / points.length, points.reduce((s, p) => s + p.lng, 0) / points.length];
}

const Inner = dynamic(async () => {
  const RL = await import("react-leaflet");
  const { MapContainer, TileLayer, CircleMarker, Polygon, Marker, Popup, useMap } = RL;
  const L = await import("leaflet");

  const starIcon = L.divIcon({
    html: `<span style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))">★</span>`,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  function Fit({ points }: { points: MapPoint[] }) {
    const map = useMap();
    if (points.length) {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
    }
    return null;
  }

  return function MapInner({ points, colorByMarket, boundaries, starMarkets }: {
    points: MapPoint[]; colorByMarket: Record<string, string>;
    boundaries: MarketBoundary[]; starMarkets: { market: string; center: [number, number] }[];
  }) {
    return (
      <MapContainer center={KARACHI_CENTER} zoom={KARACHI_ZOOM} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors" />
        <Fit points={points} />
        {/* Only OSM-sourced outlines render: with few/scattered survey points a
            convex hull comes out as a degenerate sliver or spike, which reads
            as broken rather than approximate. Those markets show markers only. */}
        {boundaries.filter((b) => b.boundary && b.boundary_source === "osm").map((b) => (
          polygonLatLngs(b.boundary!).map((ring, i) => (
            <Polygon key={`${b.name}-${i}`} positions={ring}
              pathOptions={{ color: b.color, weight: 2, fillOpacity: 0.1 }}>
              <Popup>
                <strong>{b.name}</strong><br />
                Approximate outline (OpenStreetMap boundary)
              </Popup>
            </Polygon>
          ))
        ))}
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
        {starMarkets.map((s) => (
          <Marker key={s.market} position={s.center} icon={starIcon}>
            <Popup>
              <strong>{s.market}</strong><br />
              Pak Fans has a better hold here than its citywide average
              (most-selling or recommended share).
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    );
  };
}, { ssr: false });

export function SurveysMap({ points, markets, boundaries, betterHoldMarkets }: {
  points: MapPoint[]; markets: MarketOption[]; boundaries: MarketBoundary[]; betterHoldMarkets: Set<string>;
}) {
  const colorByMarket = Object.fromEntries(markets.map((m) => [m.name, m.color]));
  const starMarkets = markets
    .filter((m) => betterHoldMarkets.has(m.name))
    .map((m) => ({ market: m.name, center: centroidOf(points.filter((p) => p.market === m.name)) }))
    .filter((s): s is { market: string; center: [number, number] } => s.center !== null);

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <Inner points={points} colorByMarket={colorByMarket} boundaries={boundaries} starMarkets={starMarkets} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
        {markets.map((m) => (
          <li key={m.name} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: m.color }} />
            {m.name}
            {betterHoldMarkets.has(m.name) ? <span title="Pak Fans has a better hold here">★</span> : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Shaded outlines are approximate OpenStreetMap boundaries, shown where one closely matches the market
        (not every market has one). ★ marks a market where Pak Fans over-indexes vs. its citywide share.
      </p>
    </div>
  );
}
