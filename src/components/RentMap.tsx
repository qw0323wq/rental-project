"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Leaflet needs to be loaded client-side only
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip),
  { ssr: false }
);

import {
  CITY_COORDS,
  DISTRICT_COORDS,
  TAIWAN_CENTER,
} from "@/lib/coordinates";

interface DistrictData {
  median_rent: number;
  avg_rent: number;
  sample_count: number;
  [key: string]: unknown;
}

interface RentMapProps {
  city?: string;
  districts?: Record<string, DistrictData>;
  onDistrictClick?: (district: string) => void;
}

// 租金顏色漸層
function getRentColor(rent: number): string {
  if (rent >= 20000) return "#dc2626"; // red
  if (rent >= 15000) return "#ea580c"; // orange
  if (rent >= 12000) return "#d97706"; // amber
  if (rent >= 10000) return "#65a30d"; // lime
  if (rent >= 8000) return "#16a34a"; // green
  if (rent >= 6000) return "#0891b2"; // cyan
  return "#2563eb"; // blue
}

function getRadius(count: number): number {
  if (count >= 500) return 18;
  if (count >= 200) return 14;
  if (count >= 100) return 11;
  if (count >= 50) return 9;
  return 7;
}

export default function RentMap({
  city,
  districts,
  onDistrictClick,
}: RentMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-gray-100 rounded-xl h-[450px] flex items-center justify-center text-gray-400">
        地圖載入中...
      </div>
    );
  }

  // Determine center and zoom
  let center: [number, number] = TAIWAN_CENTER;
  let zoom = 7;

  if (city && CITY_COORDS[city]) {
    center = CITY_COORDS[city];
    zoom = 12;
  }

  // Build markers
  const markers: Array<{
    name: string;
    position: [number, number];
    rent: number;
    count: number;
  }> = [];

  if (city && districts) {
    // District level markers for a single city
    const cityDistricts = DISTRICT_COORDS[city] || {};
    for (const [distName, data] of Object.entries(districts)) {
      const pos = cityDistricts[distName];
      if (pos) {
        markers.push({
          name: distName,
          position: pos,
          rent: data.median_rent,
          count: data.sample_count,
        });
      }
    }
  } else {
    // City level markers
    for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
      markers.push({
        name: cityName,
        position: coords,
        rent: 0,
        count: 0,
      });
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-lg text-gray-800">
          {city ? `${city} 各區租金地圖` : "全台租金分布"}
        </h3>
        {city && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: "#2563eb" }}
              />
              &lt;$8K
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: "#16a34a" }}
              />
              $8-12K
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: "#d97706" }}
              />
              $12-15K
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: "#dc2626" }}
              />
              &gt;$15K
            </span>
          </div>
        )}
      </div>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "450px", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <CircleMarker
            key={m.name}
            center={m.position}
            radius={getRadius(m.count)}
            pathOptions={{
              color: getRentColor(m.rent),
              fillColor: getRentColor(m.rent),
              fillOpacity: 0.7,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onDistrictClick?.(m.name),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div className="text-center">
                <div className="font-bold">{m.name}</div>
                {m.rent > 0 && (
                  <div>中位數 ${m.rent.toLocaleString()}/月</div>
                )}
                {m.count > 0 && <div>{m.count} 筆資料</div>}
              </div>
            </Tooltip>
            <Popup>
              <div className="text-center min-w-[120px]">
                <div className="font-bold text-base mb-1">{m.name}</div>
                {m.rent > 0 && (
                  <div className="text-blue-600 font-bold">
                    ${m.rent.toLocaleString()}/月
                  </div>
                )}
                {m.count > 0 && (
                  <div className="text-gray-500 text-sm">
                    {m.count} 筆資料
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
