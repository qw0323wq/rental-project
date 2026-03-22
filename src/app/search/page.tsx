"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import RentChart from "@/components/RentChart";
import RentTrendChart from "@/components/RentTrendChart";
import DistrictTable from "@/components/DistrictTable";
import DistrictProfile from "@/components/DistrictProfile";
import LiveabilityScore from "@/components/LiveabilityScore";
import SafetyBadge from "@/components/SafetyBadge";
import StatCard from "@/components/StatCard";
import BuildingInfo from "@/components/BuildingInfo";
import RoadTable from "@/components/RoadTable";
import RoadSearch from "@/components/RoadSearch";
import CpiRentChart from "@/components/CpiRentChart";
import SocialHousingCard from "@/components/SocialHousingCard";

// Dynamic import for map (SSR-safe)
const RentMap = dynamic(() => import("@/components/RentMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-100 rounded-xl h-[450px] flex items-center justify-center text-gray-400">
      地圖載入中...
    </div>
  ),
});

interface RoadData {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
}

interface DistrictData {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  avg_building_age?: number;
  has_manager_ratio?: number;
  has_elevator_ratio?: number;
  rental_type_breakdown?: Record<string, number>;
  floor_distribution?: Record<string, number>;
  by_type?: Record<
    string,
    {
      median_rent: number;
      avg_rent: number;
      min_rent: number;
      max_rent: number;
      sample_count: number;
      avg_area_ping?: number;
    }
  >;
  by_rental_type?: Record<
    string,
    {
      median_rent: number;
      avg_rent: number;
      min_rent: number;
      max_rent: number;
      sample_count: number;
      avg_area_ping?: number;
      avg_rooms?: number;
    }
  >;
  by_floor?: Record<
    string,
    {
      median_rent: number;
      avg_rent: number;
      min_rent: number;
      max_rent: number;
      sample_count: number;
      avg_area_ping?: number;
    }
  >;
  by_rent_range?: Record<
    string,
    {
      median_rent: number;
      avg_rent: number;
      min_rent: number;
      max_rent: number;
      sample_count: number;
      avg_area_ping?: number;
    }
  >;
  roads?: Record<string, RoadData>;
  [key: string]: unknown;
}

interface CityData {
  districts: Record<string, DistrictData>;
  summary: {
    median_rent: number;
    avg_rent: number;
    sample_count: number;
    district_count: number;
  };
}

interface CityInfo {
  name: string;
  median_rent: number;
  sample_count: number;
  district_count: number;
  districts: string[];
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const city = searchParams.get("city") || "";
  const district = searchParams.get("district") || "";
  const roomType = searchParams.get("type") || "";
  const rentalType = searchParams.get("rentalType") || "";
  const road = searchParams.get("road") || "";
  const area = searchParams.get("area") || "";
  const floorRange = searchParams.get("floor") || "";
  const rentRange = searchParams.get("rent") || "";

  const RENTAL_TYPES = [
    { label: "整戶出租", value: "整棟(戶)出租" },
    { label: "獨立套房", value: "獨立套房" },
    { label: "分租套房", value: "分租套房" },
    { label: "分租雅房", value: "分租雅房" },
    { label: "分層出租", value: "分層出租" },
  ];

  const AREA_RANGES = [
    { label: "10坪以下", value: "0-10" },
    { label: "10-20坪", value: "10-20" },
    { label: "20-30坪", value: "20-30" },
    { label: "30-40坪", value: "30-40" },
    { label: "40坪以上", value: "40-999" },
  ];

  const RENT_RANGES = [
    { label: "5千以下", value: "0-5000" },
    { label: "5千-1萬", value: "5000-10000" },
    { label: "1萬-2萬", value: "10000-20000" },
    { label: "2萬-3萬", value: "20000-30000" },
    { label: "3萬-5萬", value: "30000-50000" },
    { label: "5萬以上", value: "50000+" },
  ];

  const FLOORS = Array.from({ length: 25 }, (_, i) => ({
    label: `${i + 1}樓`,
    value: String(i + 1),
  }));

  const [stats, setStats] = useState<Record<string, CityData>>({});
  const [cities, setCities] = useState<CityInfo[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rentTrends, setRentTrends] = useState<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [districtProfiles, setDistrictProfiles] = useState<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data591, setData591] = useState<Record<string, any> | null>(null);
  const [selectedCity, setSelectedCity] = useState(city);
  const [selectedDistrict, setSelectedDistrict] = useState(district);
  const [selectedType, setSelectedType] = useState(roomType);
  const [selectedRentalType, setSelectedRentalType] = useState(rentalType);
  const [selectedRoad, setSelectedRoad] = useState(road);
  const [selectedArea, setSelectedArea] = useState(area);
  const [selectedFloor, setSelectedFloor] = useState(floorRange);
  const [selectedRent, setSelectedRent] = useState(rentRange);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"chart" | "map" | "trend">("chart");

  useEffect(() => {
    Promise.all([
      fetch("/data/rental_stats.json").then((r) => r.json()),
      fetch("/data/cities.json").then((r) => r.json()),
      fetch("/data/rent_trends.json").then((r) => r.json()).catch(() => ({})),
      fetch("/data/district_profiles.json").then((r) => r.json()).catch(() => ({})),
      fetch("/data/rental_591.json").then((r) => r.json()).catch(() => null),
    ])
      .then(([statsData, citiesData, trendsData, profilesData, data591Result]) => {
        setStats(statsData);
        setCities(citiesData);
        setRentTrends(trendsData);
        setDistrictProfiles(profilesData);
        setData591(data591Result);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  // Sync selectedCity/District when URL params change
  useEffect(() => {
    setSelectedCity(city);
    setSelectedDistrict(district);
    setSelectedType(roomType);
    setSelectedRentalType(rentalType);
    setSelectedRoad(road);
    setSelectedArea(area);
    setSelectedFloor(floorRange);
    setSelectedRent(rentRange);
  }, [city, district, roomType, rentalType, road, area, floorRange, rentRange]);

  // Available roads for selected district
  const availableRoads =
    selectedCity &&
    selectedDistrict &&
    stats[selectedCity]?.districts?.[selectedDistrict]?.roads
      ? Object.entries(
          stats[selectedCity].districts[selectedDistrict].roads!
        )
          .sort(([, a], [, b]) => b.sample_count - a.sample_count)
          .map(([name]) => name)
      : [];

  const handleSearch = () => {
    if (!selectedCity) return;
    const params = new URLSearchParams({ city: selectedCity });
    if (selectedDistrict) params.set("district", selectedDistrict);
    if (selectedRoad) params.set("road", selectedRoad);
    if (selectedType) params.set("type", selectedType);
    if (selectedRentalType) params.set("rentalType", selectedRentalType);
    if (selectedArea) params.set("area", selectedArea);
    if (selectedFloor) params.set("floor", selectedFloor);
    if (selectedRent) params.set("rent", selectedRent);
    router.push(`/search?${params.toString()}`);
  };

  const handleDistrictClick = (distName: string) => {
    if (city) {
      const params = new URLSearchParams({ city, district: distName });
      if (roomType) params.set("type", roomType);
      router.push(`/search?${params.toString()}`);
    }
  };

  const cityData = stats[city];
  const currentCityInfo = cities.find((c) => c.name === selectedCity);

  // Single district view
  const singleDistrict = district && cityData?.districts?.[district];

  // Parse area range for filtering
  const areaRange = area
    ? (area.split("-").map(Number) as [number, number])
    : null;

  // Get display data (filtered by area if selected)
  const displayDistricts = (() => {
    if (district) {
      return singleDistrict
        ? { [district]: cityData.districts[district] }
        : {};
    }
    const allDistricts = cityData?.districts || {};
    if (!areaRange) return allDistricts;
    return Object.fromEntries(
      Object.entries(allDistricts).filter(([, d]) => {
        if (!d.avg_area_ping) return true;
        return d.avg_area_ping >= areaRange[0] && d.avg_area_ping <= areaRange[1];
      })
    );
  })();

  // Road data for current district (filtered by area if selected)
  const currentRoads = (() => {
    if (!singleDistrict || !(singleDistrict as DistrictData).roads) return null;
    const roads = (singleDistrict as DistrictData).roads!;
    if (!areaRange) return roads;
    return Object.fromEntries(
      Object.entries(roads).filter(([, r]) => {
        if (!r.avg_area_ping) return true;
        return r.avg_area_ping >= areaRange[0] && r.avg_area_ping <= areaRange[1];
      })
    );
  })();

  // Single road info
  const singleRoad = road && currentRoads ? currentRoads[road] : null;

  // Summary stats
  const getSummary = () => {
    // If specific road is selected
    if (singleRoad) {
      return {
        median: singleRoad.median_rent,
        avg: singleRoad.avg_rent,
        count: singleRoad.sample_count,
        area: singleRoad.avg_area_ping,
      };
    }
    if (singleDistrict) {
      const d = singleDistrict as DistrictData;
      // Rental type filter (出租型態) takes priority
      if (rentalType && d.by_rental_type?.[rentalType]) {
        const rt = d.by_rental_type[rentalType];
        return {
          median: rt.median_rent,
          avg: rt.avg_rent,
          count: rt.sample_count,
          area: rt.avg_area_ping,
          rooms: rt.avg_rooms,
        };
      }
      // Room type filter
      if (roomType && d.by_type?.[roomType]) {
        const t = d.by_type[roomType];
        return {
          median: t.median_rent,
          avg: t.avg_rent,
          count: t.sample_count,
          area: t.avg_area_ping,
        };
      }
      // Floor filter
      if (floorRange && d.by_floor?.[floorRange]) {
        const f = d.by_floor[floorRange];
        return {
          median: f.median_rent,
          avg: f.avg_rent,
          count: f.sample_count,
          area: f.avg_area_ping,
        };
      }
      // Rent range filter
      if (rentRange && d.by_rent_range?.[rentRange]) {
        const r = d.by_rent_range[rentRange];
        return {
          median: r.median_rent,
          avg: r.avg_rent,
          count: r.sample_count,
          area: r.avg_area_ping,
        };
      }
      return {
        median: d.median_rent,
        avg: d.avg_rent,
        count: d.sample_count,
        area: d.avg_area_ping,
      };
    }
    if (cityData?.summary) {
      return {
        median: cityData.summary.median_rent,
        avg: cityData.summary.avg_rent,
        count: cityData.summary.sample_count,
        area: undefined,
      };
    }
    return null;
  };

  const summary = !loading && city ? getSummary() : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Search Bar - always visible */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-3">
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              setSelectedDistrict("");
              setSelectedRoad("");
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選擇縣市</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              setSelectedRoad("");
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
            disabled={!selectedCity}
          >
            <option value="">全部區域</option>
            {(currentCityInfo?.districts || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={selectedRoad}
            onChange={(e) => setSelectedRoad(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
            disabled={!selectedDistrict}
          >
            <option value="">全部路段</option>
            {availableRoads.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部房型</option>
            <option value="套房">套房</option>
            <option value="雅房">雅房</option>
            <option value="整層">整層住家</option>
            <option value="電梯大樓">電梯大樓</option>
          </select>

          <select
            value={selectedRentalType}
            onChange={(e) => setSelectedRentalType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部出租型態</option>
            {RENTAL_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部樓層</option>
            {FLOORS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={selectedRent}
            onChange={(e) => setSelectedRent(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部租金</option>
            {RENT_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部坪數</option>
            {AREA_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSearch}
          disabled={!selectedCity}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          查詢
        </button>
      </div>

      {/* Road Search */}
      {!loading && Object.keys(stats).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
          <div className="text-sm text-gray-500 mb-2 font-medium">
            🔍 路段快速搜尋
          </div>
          <RoadSearch stats={stats} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="text-2xl text-gray-400 animate-pulse">
            載入資料中...
          </div>
        </div>
      )}

      {/* No city selected */}
      {!loading && !city && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-xl">請選擇縣市或搜尋路段開始查詢</p>
        </div>
      )}

      {/* City not found */}
      {!loading && city && !cityData && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-xl">「{city}」目前沒有資料</p>
          <p className="mt-2">請選擇其他縣市</p>
        </div>
      )}

      {/* Results */}
      {!loading && city && cityData && (
        <>
          {/* Title */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-800">
              {city}
              {district ? ` ${district}` : ""}
              {road ? ` ${road}` : ""}
              {rentalType ? ` ${RENTAL_TYPES.find((r) => r.value === rentalType)?.label || rentalType}` : ""}
              {roomType ? ` ${roomType}` : ""}
              {floorRange ? ` ${floorRange}樓` : ""}
              {rentRange
                ? ` ${RENT_RANGES.find((r) => r.value === rentRange)?.label || rentRange}`
                : ""}{" "}
              租金行情
            </h1>
            {district && districtProfiles[city]?.[district] && (
              <SafetyBadge
                score={districtProfiles[city][district].safety.score}
                crimeRate={districtProfiles[city][district].safety.crime_rate_per_1000}
              />
            )}
          </div>

          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
            <button
              onClick={() => router.push("/search")}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              全台
            </button>
            <span>/</span>
            <button
              onClick={() =>
                router.push(`/search?city=${encodeURIComponent(city)}`)
              }
              className={`hover:text-blue-600 transition-colors cursor-pointer ${
                !district && !road ? "text-blue-600 font-medium" : ""
              }`}
            >
              {city}
            </button>
            {district && (
              <>
                <span>/</span>
                <button
                  onClick={() =>
                    router.push(
                      `/search?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`
                    )
                  }
                  className={`hover:text-blue-600 transition-colors cursor-pointer ${
                    !road ? "text-blue-600 font-medium" : ""
                  }`}
                >
                  {district}
                </button>
              </>
            )}
            {road && (
              <>
                <span>/</span>
                <span className="text-blue-600 font-medium">{road}</span>
              </>
            )}
          </div>

          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="中位數月租"
                value={`$${summary.median.toLocaleString()}`}
                sub="50% 的租金低於此價"
                color="blue"
              />
              <StatCard
                label="平均月租"
                value={`$${summary.avg.toLocaleString()}`}
                color="green"
              />
              <StatCard
                label="資料筆數"
                value={`${summary.count.toLocaleString()} 筆`}
                sub="實價登錄租賃紀錄"
                color="purple"
              />
              {summary.area && (
                <StatCard
                  label="平均坪數"
                  value={`${summary.area} 坪`}
                  color="orange"
                />
              )}
              {(summary as { rooms?: number }).rooms && (
                <StatCard
                  label="平均房數"
                  value={`${(summary as { rooms?: number }).rooms} 房`}
                  sub={rentalType ? (RENTAL_TYPES.find((r) => r.value === rentalType)?.label || rentalType) : ""}
                  color="orange"
                />
              )}
              {!summary.area && !district && (
                <StatCard
                  label="涵蓋區域"
                  value={`${cityData.summary.district_count} 區`}
                  color="orange"
                />
              )}
              {/* New stats for district view */}
              {singleDistrict && (singleDistrict as DistrictData).avg_building_age !== undefined && (
                <StatCard
                  label="平均屋齡"
                  value={`${(singleDistrict as DistrictData).avg_building_age} 年`}
                  sub="建築完成至今"
                  color="orange"
                />
              )}
              {singleDistrict && (singleDistrict as DistrictData).has_manager_ratio !== undefined && (
                <StatCard
                  label="管理員比例"
                  value={`${Math.round(((singleDistrict as DistrictData).has_manager_ratio || 0) * 100)}%`}
                  sub="有管理組織"
                  color="blue"
                />
              )}
              {singleDistrict && (singleDistrict as DistrictData).has_elevator_ratio !== undefined && (
                <StatCard
                  label="電梯比例"
                  value={`${Math.round(((singleDistrict as DistrictData).has_elevator_ratio || 0) * 100)}%`}
                  sub="有電梯設備"
                  color="green"
                />
              )}
            </div>
          )}

          {/* 591 問價比較 */}
          {summary && data591?.cities?.[city] && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📊</span>
                <h3 className="font-bold text-gray-800">591 當前問價 vs 實價登錄成交價</h3>
                <span className="text-xs text-gray-400 ml-auto">
                  591 資料更新：{data591.crawl_date}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-xs text-red-500 mb-1">591 問價中位數</div>
                  <div className="text-lg font-bold text-red-600">
                    ${data591.cities[city].median_rent?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-xs text-blue-500 mb-1">實價登錄成交中位數</div>
                  <div className="text-lg font-bold text-blue-600">
                    ${summary.median.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">問價 vs 成交</div>
                  <div className={`text-lg font-bold ${
                    data591.cities[city].median_rent > summary.median
                      ? "text-red-600"
                      : "text-green-600"
                  }`}>
                    {data591.cities[city].median_rent > summary.median ? "+" : ""}
                    {Math.round(((data591.cities[city].median_rent - summary.median) / summary.median) * 100)}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {data591.cities[city].median_rent > summary.median ? "問價高於成交" : "問價低於成交"}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">591 物件數</div>
                  <div className="text-lg font-bold text-orange-600">
                    {data591.cities[city].total_count} 筆
                  </div>
                  <div className="text-xs text-gray-400">當前掛牌中</div>
                </div>
              </div>
              {data591.cities[city].by_type && Object.keys(data591.cities[city].by_type).length > 0 && (
                <div className="mt-3 pt-3 border-t border-orange-100">
                  <div className="text-xs text-gray-500 mb-2">591 各類型問價中位數：</div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(data591.cities[city].by_type as Record<string, { median_rent: number; count: number }>)
                      .filter(([type]) => type !== "未分類")
                      .sort(([, a], [, b]) => b.count - a.count)
                      .map(([type, typeStats]) => (
                        <span
                          key={type}
                          className="bg-white px-3 py-1.5 rounded-full text-xs border border-orange-200"
                        >
                          {type}{" "}
                          <span className="font-bold text-orange-600">
                            ${typeStats.median_rent.toLocaleString()}
                          </span>
                          <span className="text-gray-400 ml-1">({typeStats.count})</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                * 591 為當前掛牌問價，實價登錄為過去成交價。問價通常高於成交價。
              </p>
            </div>
          )}

          {/* Room Type Quick Buttons */}
          {singleDistrict && (singleDistrict as DistrictData).by_type && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                按房型查看：
              </h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      city,
                      district,
                    });
                    router.push(`/search?${params.toString()}`);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                    !roomType
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  全部
                </button>
                {Object.keys(
                  (singleDistrict as DistrictData).by_type || {}
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      const params = new URLSearchParams({
                        city,
                        district,
                        type,
                      });
                      router.push(`/search?${params.toString()}`);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                      roomType === type
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rental Type Quick Buttons (出租型態) */}
          {singleDistrict && (singleDistrict as DistrictData).by_rental_type && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                📋 按出租型態查看：
              </h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const params = new URLSearchParams({ city, district });
                    if (roomType) params.set("type", roomType);
                    router.push(`/search?${params.toString()}`);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                    !rentalType
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  全部型態
                </button>
                {Object.entries(
                  (singleDistrict as DistrictData).by_rental_type || {}
                )
                  .sort(([, a], [, b]) => b.sample_count - a.sample_count)
                  .map(([type, rtStats]) => {
                    const label = RENTAL_TYPES.find((r) => r.value === type)?.label || type;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          const params = new URLSearchParams({
                            city,
                            district,
                            rentalType: type,
                          });
                          if (roomType) params.set("type", roomType);
                          router.push(`/search?${params.toString()}`);
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                          rentalType === type
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                        <span className="ml-1 text-xs opacity-70">
                          ({rtStats.sample_count})
                        </span>
                      </button>
                    );
                  })}
              </div>

              {/* Rental Type Detail Cards */}
              {!rentalType && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(
                    (singleDistrict as DistrictData).by_rental_type || {}
                  )
                    .sort(([, a], [, b]) => b.sample_count - a.sample_count)
                    .map(([type, rtStats]) => {
                      const label = RENTAL_TYPES.find((r) => r.value === type)?.label || type;
                      const iconMap: Record<string, string> = {
                        "整棟(戶)出租": "🏠",
                        "獨立套房": "🚪",
                        "分租套房": "🛏️",
                        "分租雅房": "📦",
                        "分層出租": "🏢",
                      };
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            const params = new URLSearchParams({
                              city,
                              district,
                              rentalType: type,
                            });
                            router.push(`/search?${params.toString()}`);
                          }}
                          className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{iconMap[type] || "🏠"}</span>
                            <span className="font-bold text-gray-800">{label}</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">中位數租金</span>
                              <span className="font-bold text-blue-600">
                                ${rtStats.median_rent.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">資料筆數</span>
                              <span className="text-gray-700">{rtStats.sample_count} 筆</span>
                            </div>
                            {rtStats.avg_area_ping && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">平均坪數</span>
                                <span className="text-gray-700">{rtStats.avg_area_ping} 坪</span>
                              </div>
                            )}
                            {rtStats.avg_rooms && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">平均房數</span>
                                <span className="font-medium text-orange-600">
                                  {rtStats.avg_rooms} 房
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>
                                ${rtStats.min_rent.toLocaleString()} ~ ${rtStats.max_rent.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Selected Rental Type Detail */}
              {rentalType && (singleDistrict as DistrictData).by_rental_type?.[rentalType] && (
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">
                      {rentalType === "整棟(戶)出租" ? "🏠" :
                       rentalType === "獨立套房" ? "🚪" :
                       rentalType === "分租套房" ? "🛏️" :
                       rentalType === "分租雅房" ? "📦" : "🏢"}
                    </span>
                    <span className="font-bold text-purple-800">
                      {RENTAL_TYPES.find((r) => r.value === rentalType)?.label || rentalType}
                    </span>
                    <span className="text-sm text-purple-500">
                      {(singleDistrict as DistrictData).by_rental_type![rentalType].sample_count} 筆資料
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">中位數租金</div>
                      <div className="text-lg font-bold text-blue-600">
                        ${(singleDistrict as DistrictData).by_rental_type![rentalType].median_rent.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">平均租金</div>
                      <div className="text-lg font-bold text-green-600">
                        ${(singleDistrict as DistrictData).by_rental_type![rentalType].avg_rent.toLocaleString()}
                      </div>
                    </div>
                    {(singleDistrict as DistrictData).by_rental_type![rentalType].avg_area_ping && (
                      <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500">平均坪數</div>
                        <div className="text-lg font-bold text-orange-600">
                          {(singleDistrict as DistrictData).by_rental_type![rentalType].avg_area_ping} 坪
                        </div>
                      </div>
                    )}
                    {(singleDistrict as DistrictData).by_rental_type![rentalType].avg_rooms && (
                      <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500">平均房數</div>
                        <div className="text-lg font-bold text-purple-600">
                          {(singleDistrict as DistrictData).by_rental_type![rentalType].avg_rooms} 房
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-purple-400">
                    租金範圍：${(singleDistrict as DistrictData).by_rental_type![rentalType].min_rent.toLocaleString()} ~ ${(singleDistrict as DistrictData).by_rental_type![rentalType].max_rent.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chart / Map / Trend Toggle (city level) */}
          {!district && Object.keys(displayDistricts).length > 1 && (
            <div className="mb-4">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("chart")}
                  className={`px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === "chart"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📊 圖表
                </button>
                <button
                  onClick={() => setActiveTab("trend")}
                  className={`px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === "trend"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📈 趨勢
                </button>
                <button
                  onClick={() => setActiveTab("map")}
                  className={`px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === "map"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🗺️ 地圖
                </button>
              </div>
            </div>
          )}

          {/* Chart */}
          {!district &&
            Object.keys(displayDistricts).length > 1 &&
            activeTab === "chart" && (
              <div className="mb-8">
                <RentChart districts={displayDistricts} roomType={roomType} />
              </div>
            )}

          {/* Trend Chart (city level) */}
          {!district &&
            Object.keys(displayDistricts).length > 1 &&
            activeTab === "trend" &&
            rentTrends[city]?.city_trend && (
              <div className="mb-8">
                <RentTrendChart
                  trends={rentTrends[city].city_trend}
                  title={`${city} 歷年租金走勢`}
                />
              </div>
            )}

          {/* Map */}
          {!district &&
            Object.keys(displayDistricts).length > 1 &&
            activeTab === "map" && (
              <div className="mb-8">
                <RentMap
                  city={city}
                  districts={displayDistricts}
                  onDistrictClick={handleDistrictClick}
                />
              </div>
            )}

          {/* District-level map (when viewing a single district) */}
          {singleDistrict && (
            <div className="mb-8">
              <RentMap
                city={city}
                districts={{ [district]: cityData.districts[district] }}
                onDistrictClick={() => {}}
              />
            </div>
          )}

          {/* District Trend + Profile (when viewing a single district) */}
          {singleDistrict && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Rent Trend for this district */}
              {rentTrends[city]?.districts?.[district] && (
                <RentTrendChart
                  trends={rentTrends[city].districts[district]}
                  title={`${district} 歷年租金走勢`}
                />
              )}
              {/* Livability Score */}
              {districtProfiles[city]?.[district] && (
                <LiveabilityScore
                  overall={districtProfiles[city][district].overall_score}
                  transport={districtProfiles[city][district].transport.score}
                  livability={districtProfiles[city][district].livability.score}
                  demographics={districtProfiles[city][district].demographics.score}
                  safety={districtProfiles[city][district].safety.score}
                />
              )}
            </div>
          )}

          {/* District Profile Card (full detail) */}
          {singleDistrict && districtProfiles[city]?.[district] && (
            <div className="mb-8">
              <DistrictProfile
                profile={districtProfiles[city][district]}
                districtName={district}
              />
            </div>
          )}

          {/* Building Info (district level) */}
          {singleDistrict && (
            <BuildingInfo
              avgBuildingAge={(singleDistrict as DistrictData).avg_building_age}
              hasManagerRatio={(singleDistrict as DistrictData).has_manager_ratio}
              hasElevatorRatio={(singleDistrict as DistrictData).has_elevator_ratio}
              rentalTypeBreakdown={(singleDistrict as DistrictData).rental_type_breakdown}
              floorDistribution={(singleDistrict as DistrictData).floor_distribution}
              districtName={district}
            />
          )}

          {/* Single District Detail - room type cards */}
          {singleDistrict &&
            !roomType &&
            (singleDistrict as DistrictData).by_type && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                <h3 className="font-bold text-lg text-gray-800 mb-4">
                  {district} 各房型租金比較
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(
                    (singleDistrict as DistrictData).by_type || {}
                  ).map(([type, data]) => (
                    <div
                      key={type}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                      onClick={() => {
                        const params = new URLSearchParams({
                          city,
                          district,
                          type,
                        });
                        router.push(`/search?${params.toString()}`);
                      }}
                    >
                      <h4 className="font-bold text-gray-800 mb-2">{type}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">中位數</span>
                          <span className="font-bold text-blue-600">
                            ${data.median_rent.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">均價</span>
                          <span>${data.avg_rent.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">範圍</span>
                          <span className="text-gray-600">
                            ${data.min_rent.toLocaleString()} ~ $
                            {data.max_rent.toLocaleString()}
                          </span>
                        </div>
                        {data.avg_area_ping && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">平均坪數</span>
                            <span>{data.avg_area_ping} 坪</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-500">資料筆數</span>
                          <span>{data.sample_count} 筆</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Road Table - shown when viewing a specific district */}
          {singleDistrict && currentRoads && !road && (
            <div className="mb-8">
              <RoadTable roads={currentRoads} districtName={district} />
            </div>
          )}

          {/* Single Road Detail */}
          {singleRoad && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h3 className="font-bold text-lg text-gray-800 mb-4">
                📍 {road} 租金詳情
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">中位數租金</div>
                  <div className="text-xl font-bold text-blue-600">
                    ${singleRoad.median_rent.toLocaleString()}/月
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">平均租金</div>
                  <div className="text-xl font-bold text-green-600">
                    ${singleRoad.avg_rent.toLocaleString()}/月
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">租金範圍</div>
                  <div className="text-lg font-medium text-gray-700">
                    ${singleRoad.min_rent.toLocaleString()} ~ $
                    {singleRoad.max_rent.toLocaleString()}
                  </div>
                </div>
                {singleRoad.avg_area_ping && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">平均坪數</div>
                    <div className="text-xl font-bold text-orange-600">
                      {singleRoad.avg_area_ping} 坪
                    </div>
                  </div>
                )}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">資料筆數</div>
                  <div className="text-xl font-bold text-purple-600">
                    {singleRoad.sample_count} 筆
                  </div>
                </div>
                {singleRoad.avg_area_ping &&
                  singleRoad.avg_area_ping > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-500 mb-1">
                        每坪單價
                      </div>
                      <div className="text-xl font-bold text-red-600">
                        $
                        {Math.round(
                          singleRoad.median_rent / singleRoad.avg_area_ping
                        ).toLocaleString()}
                        /坪
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* District Table (city-level only) */}
          {!district && (
            <DistrictTable
              districts={displayDistricts}
              roomType={roomType}
            />
          )}

          {/* CPI Rent Index & Social Housing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 mb-8">
            <CpiRentChart />
            <SocialHousingCard
              city={city}
              district={district || undefined}
              marketRent={
                summary
                  ? {
                      median_rent: summary.median,
                      avg_rent: summary.avg,
                      label: district
                        ? roomType || "全部房型"
                        : "全市中位數",
                    }
                  : undefined
              }
              wholeFlatRent={(() => {
                if (!singleDistrict) return undefined;
                const d = singleDistrict as DistrictData;
                const wholeFlat = d.by_type?.["整層"];
                if (!wholeFlat) return undefined;
                return {
                  median_rent: wholeFlat.median_rent,
                  avg_rent: wholeFlat.avg_rent,
                  label: "整層住家",
                };
              })()}
            />
          </div>

          {/* Data Note */}
          <div className="mt-8 text-sm text-gray-400 text-center">
            <p>
              資料來源：內政部不動產交易實價查詢服務（實價登錄
              2.0）、主計總處 CPI、社會住宅推動聯盟
            </p>
            <p>租金範圍顯示的是 P10 ~ P90（排除極端值後的範圍）</p>
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="text-2xl text-gray-400 animate-pulse">
            載入中...
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
