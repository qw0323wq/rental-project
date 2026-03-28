"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

interface RoadInfo {
  city: string;
  district: string;
  road: string;
  median_rent: number;
  avg_rent: number;
  sample_count: number;
  avg_area_ping?: number;
}

import type { CityData } from "@/types";

interface RoadSearchProps {
  stats: Record<string, CityData>;
}

export default function RoadSearch({ stats }: RoadSearchProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const router = useRouter();

  // Build flat road index
  const allRoads = useMemo(() => {
    const roads: RoadInfo[] = [];
    for (const [city, cityData] of Object.entries(stats)) {
      if (!cityData.districts) continue;
      for (const [district, distData] of Object.entries(cityData.districts)) {
        if (!distData.roads) continue;
        for (const [road, roadData] of Object.entries(distData.roads)) {
          roads.push({
            city,
            district,
            road,
            median_rent: roadData.median_rent,
            avg_rent: roadData.avg_rent,
            sample_count: roadData.sample_count,
            avg_area_ping: roadData.avg_area_ping,
          });
        }
      }
    }
    return roads;
  }, [stats]);

  // Filter roads
  const results = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.trim();
    return allRoads
      .filter(
        (r) =>
          r.road.includes(q) ||
          r.district.includes(q) ||
          r.city.includes(q) ||
          `${r.city}${r.district}${r.road}`.includes(q)
      )
      .sort((a, b) => b.sample_count - a.sample_count)
      .slice(0, 20);
  }, [allRoads, query]);

  const handleSelect = useCallback(
    (r: RoadInfo) => {
      const params = new URLSearchParams({
        city: r.city,
        district: r.district,
        road: r.road,
      });
      router.push(`/search?${params.toString()}`);
      setShowResults(false);
      setQuery("");
    },
    [router]
  );

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="輸入路段名稱，例如：忠孝東路、中正路、光復南路..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 pl-10 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          📍
        </span>
      </div>

      {/* Dropdown results */}
      {showResults && query.length >= 1 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-gray-400 text-sm text-center">
              找不到「{query}」相關路段
            </div>
          ) : (
            <>
              <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-b">
                找到 {results.length} 條路段（顯示資料最多的前 20 條）
              </div>
              {results.map((r, i) => (
                <button
                  key={`${r.city}-${r.district}-${r.road}-${i}`}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(r);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-800">
                        {r.road}
                      </span>
                      <span className="text-gray-400 text-sm ml-2">
                        {r.city} {r.district}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-blue-600 text-sm">
                        ${r.median_rent.toLocaleString()}/月
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        {r.sample_count}筆
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
