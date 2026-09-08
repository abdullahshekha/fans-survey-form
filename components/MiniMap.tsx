"use client";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const Inner = dynamic(async () => {
  const { MapContainer, TileLayer, CircleMarker } = await import("react-leaflet");
  return function MapInner({ lat, lng }: { lat: number; lng: number }) {
    return (
      <MapContainer center={[lat, lng]} zoom={16} dragging={false} zoomControl={false}
        doubleClickZoom={false} scrollWheelZoom={false} touchZoom={false}
        style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors" />
        <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: "#0f172a" }} />
      </MapContainer>
    );
  };
}, { ssr: false });

export function MiniMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  return <div className={className ?? "h-40 w-full overflow-hidden rounded-lg border border-slate-200"}><Inner lat={lat} lng={lng} /></div>;
}
