"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type {
  DistrictData,
  CityData,
  CityInfo,
  AskingData,
  CityRentTrends,
} from "@/types";
import { RENTAL_TYPES, AREA_RANGES, RENT_RANGES, FLOORS } from "@/lib/constants";
import { getRentSummary, filterDistrictsByArea, filterRoadsByArea } from "@/lib/rental-utils";
import RentChart from "@/components/RentChart";
import RentTrendChart from "@/components/RentTrendChart";
import DistrictTable from "@/components/DistrictTable";
import DistrictProfileCard from "@/components/DistrictProfile";
import LiveabilityScore from "@/components/LiveabilityScore";
import SafetyBadge from "@/components/SafetyBadge";
import StatCard from "@/components/StatCard";
import BuildingInfo from "@/components/BuildingInfo";
import RoadTable from "@/components/RoadTable";
import RoadSearch from "@/components/RoadSearch";
import CpiRentChart from "@/components/cpi-rent-chart";
import SocialHousingCard from "@/components/social-housing";
import RentPricing from "@/components/RentPricing";
import AskingPriceComparison from "@/components/AskingPriceComparison";
import RentalTypeAnalysis from "@/components/RentalTypeAnalysis";
import SquareEfficiency from "@/components/SquareEfficiency";
import RoadDetail from "@/components/RoadDetail";

// CRITICAL: Leaflet requires `window` — must disable SSR or build will fail
const RentMap = dynamic(() => import("@/components/RentMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-100 rounded-xl h-[450px] flex items-center justify-center text-gray-400">
      地圖載入中...
    </div>
  ),
});

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

  const [stats, setStats] = useState<Record<string, CityData>>({});
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [rentTrends, setRentTrends] = useState<Record<string, CityRentTrends>>({});
  // CRITICAL: districtProfiles JSON shape is deeply nested and varies per district — typed as any intentionally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [districtProfiles, setDistrictProfiles] = useState<Record<string, Record<string, any>>>({});
  const [askingData, setAskingData] = useState<AskingData | null>(null);
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
      .then(([statsData, citiesData, trendsData, profilesData, askingDataResult]) => {
        setStats(statsData);
        setCities(citiesData);
        setRentTrends(trendsData);
        setDistrictProfiles(profilesData);
        setAskingData(askingDataResult);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

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

  const availableRoads =
    selectedCity &&
    selectedDistrict &&
    stats[selectedCity]?.districts?.[selectedDistrict]?.roads
      ? Object.entries(stats[selectedCity].districts[selectedDistrict].roads!)
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

  const singleDistrict: DistrictData | null =
    district && cityData?.districts?.[district]
      ? cityData.districts[district]
      : null;

  const areaRange = area
    ? (area.split("-").map(Number) as [number, number])
    : null;

  const displayDistricts = (() => {
    if (district) {
      return singleDistrict ? { [district]: cityData.districts[district] } : {};
    }
    return filterDistrictsByArea(cityData?.districts || {}, areaRange);
  })();

  const currentRoads = (() => {
    if (!singleDistrict?.roads) return null;
    return filterRoadsByArea(singleDistrict.roads, areaRange);
  })();

  const singleRoad = road && currentRoads ? currentRoads[road] : null;

  const summary = !loading && city
    ? getRentSummary({ cityData, singleDistrict, singleRoad, rentalType, roomType, floorRange, rentRange })
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-3">
          <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setSelectedDistrict(""); setSelectedRoad(""); }} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500">
            <option value="">選擇縣市</option>
            {cities.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
          </select>
          <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedRoad(""); }} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500" disabled={!selectedCity}>
            <option value="">全部區域</option>
            {(currentCityInfo?.districts || []).map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          <select value={selectedRoad} onChange={(e) => setSelectedRoad(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500" disabled={!selectedDistrict}>
            <option value="">全部路段</option>
            {availableRoads.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
          <select value={selectedRentalType} onChange={(e) => { setSelectedRentalType(e.target.value); setSelectedType(""); }} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500">
            <option value="">全部出租型態</option>
            {RENTAL_TYPES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
          <select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500">
            <option value="">全部樓層</option>
            {FLOORS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
          <select value={selectedRent} onChange={(e) => setSelectedRent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500">
            <option value="">全部租金</option>
            {RENT_RANGES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
          <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500">
            <option value="">全部坪數</option>
            {AREA_RANGES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
        </div>
        <button onClick={handleSearch} disabled={!selectedCity} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
          查詢
        </button>
      </div>

      {/* Road Search */}
      {!loading && Object.keys(stats).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
          <div className="text-sm text-gray-500 mb-2 font-medium">🔍 路段快速搜尋</div>
          <RoadSearch stats={stats} />
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="text-2xl text-gray-400 animate-pulse">載入資料中...</div>
        </div>
      )}

      {!loading && !city && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-xl">請選擇縣市或搜尋路段開始查詢</p>
        </div>
      )}

      {!loading && city && !cityData && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-xl">「{city}」目前沒有資料</p>
          <p className="mt-2">請選擇其他縣市</p>
        </div>
      )}

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
              {rentRange ? ` ${RENT_RANGES.find((r) => r.value === rentRange)?.label || rentRange}` : ""}{" "}
              租金行情
            </h1>
            {district && districtProfiles[city]?.[district] && (
              <SafetyBadge
                score={districtProfiles[city][district].safety.score}
                crimeRate={districtProfiles[city][district].safety.crime_rate_per_1000}
              />
            )}
            {district && districtProfiles[city]?.[district]?.nearest_mrt && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                🚇 {districtProfiles[city][district].nearest_mrt!.station}
                {districtProfiles[city][district].nearest_mrt!.walk_minutes > 0 && (
                  <span className="text-blue-500">
                    （步行{districtProfiles[city][district].nearest_mrt!.walk_minutes}分）
                  </span>
                )}
              </span>
            )}
            {district && districtProfiles[city]?.[district]?.vacancy_rate != null && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                districtProfiles[city][district].vacancy_rate! < 8
                  ? "bg-green-100 text-green-700"
                  : districtProfiles[city][district].vacancy_rate! < 12
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}>
                🏚️ 空屋率 {districtProfiles[city][district].vacancy_rate}%
              </span>
            )}
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
            <button onClick={() => router.push("/search")} className="hover:text-blue-600 transition-colors cursor-pointer">全台</button>
            <span>/</span>
            <button onClick={() => router.push(`/search?city=${encodeURIComponent(city)}`)} className={`hover:text-blue-600 transition-colors cursor-pointer ${!district && !road ? "text-blue-600 font-medium" : ""}`}>{city}</button>
            {district && (
              <>
                <span>/</span>
                <button onClick={() => router.push(`/search?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`)} className={`hover:text-blue-600 transition-colors cursor-pointer ${!road ? "text-blue-600 font-medium" : ""}`}>{district}</button>
              </>
            )}
            {road && (<><span>/</span><span className="text-blue-600 font-medium">{road}</span></>)}
          </div>

          {/* Summary Stats */}
          {summary && (() => {
            const trendData = district
              ? rentTrends[city]?.districts?.[district]
              : rentTrends[city]?.city_trend;
            const years = trendData ? Object.keys(trendData).sort() : [];
            const latestYear = years.length >= 1 ? years[years.length - 1] : null;
            const prevYear = years.length >= 2 ? years[years.length - 2] : null;
            const yoyChange = latestYear && prevYear && trendData![prevYear]?.median_rent
              ? Math.round(((trendData![latestYear].median_rent - trendData![prevYear].median_rent) / trendData![prevYear].median_rent) * 100)
              : null;

            return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="中位數月租" value={`$${summary.median.toLocaleString()}`} sub={yoyChange !== null ? `${yoyChange > 0 ? "↑" : yoyChange < 0 ? "↓" : "→"} 比${prevYear}年${yoyChange > 0 ? "漲" : yoyChange < 0 ? "跌" : "持平"} ${Math.abs(yoyChange)}%` : "50% 的租金低於此價"} color="blue" />
              <StatCard label="平均月租" value={`$${summary.avg.toLocaleString()}`} color="green" />
              <StatCard label="資料筆數" value={`${summary.count.toLocaleString()} 筆`} sub="實價登錄租賃紀錄" color="purple" />
              {summary.area && <StatCard label="平均坪數" value={`${summary.area} 坪`} color="orange" />}
              {summary.area && summary.area > 0 && <StatCard label="每坪租金" value={`$${Math.round(summary.median / summary.area).toLocaleString()}/坪`} sub="月租÷坪數" color="red" />}
              {(summary as { rooms?: number }).rooms && <StatCard label="平均房數" value={`${(summary as { rooms?: number }).rooms} 房`} sub={rentalType ? (RENTAL_TYPES.find((r) => r.value === rentalType)?.label || rentalType) : ""} color="orange" />}
              {!summary.area && !district && <StatCard label="涵蓋區域" value={`${cityData.summary.district_count} 區`} color="orange" />}
              {singleDistrict?.avg_building_age !== undefined && <StatCard label="平均屋齡" value={`${singleDistrict.avg_building_age} 年`} sub="建築完成至今" color="orange" />}
              {singleDistrict?.has_manager_ratio !== undefined && <StatCard label="管理員比例" value={`${Math.round((singleDistrict.has_manager_ratio || 0) * 100)}%`} sub="有管理組織" color="blue" />}
              {singleDistrict?.has_elevator_ratio !== undefined && <StatCard label="電梯比例" value={`${Math.round((singleDistrict.has_elevator_ratio || 0) * 100)}%`} sub="有電梯設備" color="green" />}
            </div>
            );
          })()}

          {/* 591 Asking Price Comparison */}
          {summary && askingData && (
            <AskingPriceComparison askingData={askingData} city={city} summaryMedian={summary.median} />
          )}

          {/* Rental Type Analysis */}
          {singleDistrict?.by_rental_type && (
            <RentalTypeAnalysis districtData={singleDistrict} city={city} district={district} rentalType={rentalType} roomType={roomType} />
          )}

          {/* Square Efficiency Analysis */}
          {singleDistrict?.by_rental_type && (
            <SquareEfficiency byRentalType={singleDistrict.by_rental_type} />
          )}

          {/* Chart / Map / Trend Toggle */}
          {!district && Object.keys(displayDistricts).length > 1 && (
            <div className="mb-4">
              <div className="flex border-b border-gray-200">
                {(["chart", "trend", "map"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                    {tab === "chart" ? "📊 圖表" : tab === "trend" ? "📈 趨勢" : "🗺️ 地圖"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!district && Object.keys(displayDistricts).length > 1 && activeTab === "chart" && (
            <div className="mb-8"><RentChart districts={displayDistricts} roomType={roomType} /></div>
          )}
          {!district && Object.keys(displayDistricts).length > 1 && activeTab === "trend" && rentTrends[city]?.city_trend && (
            <div className="mb-8"><RentTrendChart trends={rentTrends[city].city_trend!} title={`${city} 歷年租金走勢`} /></div>
          )}
          {!district && Object.keys(displayDistricts).length > 1 && activeTab === "map" && (
            <div className="mb-8"><RentMap city={city} districts={displayDistricts} onDistrictClick={handleDistrictClick} /></div>
          )}

          {/* District-level map */}
          {singleDistrict && (
            <div className="mb-8">
              <RentMap city={city} districts={{ [district]: cityData.districts[district] }} onDistrictClick={() => {}} />
            </div>
          )}

          {/* District Trend + Livability */}
          {singleDistrict && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {rentTrends[city]?.districts?.[district] && (
                <RentTrendChart trends={rentTrends[city].districts![district]} title={`${district} 歷年租金走勢`} />
              )}
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

          {/* District Profile */}
          {singleDistrict && districtProfiles[city]?.[district] && (
            <div className="mb-8">
              <DistrictProfileCard profile={districtProfiles[city][district]} districtName={district} />
            </div>
          )}

          {/* Building Info */}
          {singleDistrict && (
            <BuildingInfo
              avgBuildingAge={singleDistrict.avg_building_age}
              hasManagerRatio={singleDistrict.has_manager_ratio}
              hasElevatorRatio={singleDistrict.has_elevator_ratio}
              rentalTypeBreakdown={singleDistrict.rental_type_breakdown}
              floorDistribution={singleDistrict.floor_distribution}
              districtName={district}
            />
          )}

          {/* Room type cards */}
          {singleDistrict && !roomType && singleDistrict.by_type && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h3 className="font-bold text-lg text-gray-800 mb-4">{district} 各房型租金比較</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(singleDistrict.by_type).map(([type, data]) => (
                  <div key={type} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => { const params = new URLSearchParams({ city, district, type }); router.push(`/search?${params.toString()}`); }}>
                    <h4 className="font-bold text-gray-800 mb-2">{type}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">中位數</span><span className="font-bold text-blue-600">${data.median_rent.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">均價</span><span>${data.avg_rent.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">範圍</span><span className="text-gray-600">${data.min_rent.toLocaleString()} ~ ${data.max_rent.toLocaleString()}</span></div>
                      {data.avg_area_ping && <div className="flex justify-between"><span className="text-gray-500">平均坪數</span><span>{data.avg_area_ping} 坪</span></div>}
                      <div className="flex justify-between"><span className="text-gray-500">資料筆數</span><span>{data.sample_count} 筆</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Road Table */}
          {singleDistrict && currentRoads && !road && (
            <div className="mb-8"><RoadTable roads={currentRoads} districtName={district} /></div>
          )}

          {/* Single Road Detail */}
          {singleRoad && <RoadDetail road={road} data={singleRoad} />}

          {/* District Table */}
          {!district && <DistrictTable districts={displayDistricts} roomType={roomType} />}

          {/* CPI & Social Housing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 mb-8">
            <CpiRentChart />
            <SocialHousingCard
              city={city}
              district={district || undefined}
              marketRent={summary ? { median_rent: summary.median, avg_rent: summary.avg, label: district ? roomType || "全部房型" : "全市中位數" } : undefined}
              wholeFlatRent={(() => {
                if (!singleDistrict) return undefined;
                const wholeFlat = singleDistrict.by_type?.["整層"];
                if (!wholeFlat) return undefined;
                return { median_rent: wholeFlat.median_rent, avg_rent: wholeFlat.avg_rent, label: "整層住家" };
              })()}
            />
          </div>

          {/* Rent Pricing Tool */}
          {city && (
            <div className="mt-8 mb-8">
              <RentPricing stats={stats} city={city} district={district || undefined} />
            </div>
          )}

          {/* Data Note */}
          <div className="mt-8 text-sm text-gray-400 text-center">
            <p>資料來源：內政部不動產交易實價查詢服務（實價登錄 2.0）、主計總處 CPI、社會住宅推動聯盟</p>
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
          <div className="text-2xl text-gray-400 animate-pulse">載入中...</div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
