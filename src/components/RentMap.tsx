"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

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

function getRentColor(rent: number): string {
  if (rent >= 50000) return "#7f1d1d";
  if (rent >= 30000) return "#dc2626";
  if (rent >= 20000) return "#ea580c";
  if (rent >= 15000) return "#d97706";
  if (rent >= 10000) return "#65a30d";
  if (rent >= 8000) return "#16a34a";
  if (rent >= 5000) return "#0891b2";
  return "#2563eb";
}

const LEGEND_ITEMS = [
  { color: "#2563eb", label: "<$5K" },
  { color: "#0891b2", label: "$5-8K" },
  { color: "#16a34a", label: "$8-10K" },
  { color: "#65a30d", label: "$10-15K" },
  { color: "#d97706", label: "$15-20K" },
  { color: "#ea580c", label: "$20-30K" },
  { color: "#dc2626", label: "$30-50K" },
  { color: "#7f1d1d", label: ">$50K" },
];

function getRadius(count: number): number {
  if (count >= 500) return 18;
  if (count >= 200) return 14;
  if (count >= 100) return 11;
  if (count >= 50) return 9;
  return 7;
}

// 熱力圖組件（用 CSS 漸層模擬，不依賴 leaflet.heat）
function HeatOverlay({ markers }: { markers: Array<{ name: string; position: [number, number]; rent: number; count: number }> }) {
  // 熱力圖用更大的半透明圓圈疊加
  return (
    <>
      {markers.map((m) => {
        const intensity = Math.min(m.count / 200, 1);
        const radius = 20 + intensity * 25;
        return (
          <CircleMarker
            key={`heat-${m.name}`}
            center={m.position}
            radius={radius}
            pathOptions={{
              color: "transparent",
              fillColor: getRentColor(m.rent),
              fillOpacity: 0.25 + intensity * 0.2,
              weight: 0,
            }}
          />
        );
      })}
    </>
  );
}

export default function RentMap({
  city,
  districts,
  onDistrictClick,
}: RentMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapMode, setMapMode] = useState<"marker" | "heat">("heat");

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

  let center: [number, number] = TAIWAN_CENTER;
  let zoom = 7;

  if (city && CITY_COORDS[city]) {
    center = CITY_COORDS[city];
    zoom = 12;
  }

  const markers: Array<{
    name: string;
    position: [number, number];
    rent: number;
    count: number;
  }> = [];

  if (city && districts) {
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
      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-lg text-gray-800">
            {city ? `${city} 各區租金地圖` : "全台租金分布"}
          </h3>
          {city && (
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setMapMode("heat")}
                className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                  mapMode === "heat"
                    ? "bg-white shadow text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                熱力圖
              </button>
              <button
                onClick={() => setMapMode("marker")}
                className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                  mapMode === "marker"
                    ? "bg-white shadow text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                標記圖
              </button>
            </div>
          )}
        </div>
        {city && (
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            {LEGEND_ITEMS.map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
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
        {/* 熱力圖模式：大圓圈疊加 */}
        {mapMode === "heat" && <HeatOverlay markers={markers} />}
        {/* 標記模式 + 熱力圖上方的小標記 */}
        {markers.map((m) => (
          <CircleMarker
            key={m.name}
            center={m.position}
            radius={mapMode === "heat" ? 6 : getRadius(m.count)}
            pathOptions={{
              color: getRentColor(m.rent),
              fillColor: getRentColor(m.rent),
              fillOpacity: mapMode === "heat" ? 0.9 : 0.7,
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
