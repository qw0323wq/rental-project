"use client";

import { useEffect, useState } from "react";
import { RENTAL_TYPE_CONFIG } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// === Real social housing data interfaces ===

interface RentalTypeStats {
  count: number;
  median_rent: number;
  avg_rent: number;
  avg_area_ping?: number;
  avg_rooms?: number;
  min_rent: number;
  max_rent: number;
}

interface SocialTypeStats {
  count: number;
  median_rent: number;
  avg_rent: number;
}

interface SampleRecord {
  address: string;
  rent: number;
  rental_type: string;
  social_type: string;
  area_ping?: number;
  rooms?: number;
  floor?: number;
}

interface DistrictSocialData {
  total_count: number;
  median_rent: number;
  avg_rent: number;
  avg_area_ping?: number;
  by_rental_type?: Record<string, RentalTypeStats>;
  by_social_type?: Record<string, SocialTypeStats>;
  samples?: SampleRecord[];
}

interface CitySocialData {
  total_count: number;
  overall_stats: {
    median_rent: number;
    avg_rent: number;
    min_rent: number;
    max_rent: number;
    sample_count: number;
    avg_area_ping?: number;
  };
  by_social_type?: Record<string, SocialTypeStats>;
  districts: Record<string, DistrictSocialData>;
}

type SocialHousingRealData = Record<string, CitySocialData>;

// === Overview data interfaces (existing social_housing.json) ===

interface CityHousing {
  completed_units: number;
  projects: number;
  note: string;
}

interface SocialHousingData {
  total_units: number;
  total_housing_stock: number;
  ratio_percent: number;
  rent_discount: string;
  cities: Record<string, CityHousing>;
  future_plan: Record<string, number>;
  policy_target_2032: {
    direct_build: number;
    lease_manage: number;
    rent_subsidy: number;
  };
}

// === Tooltip types ===

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function BarTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}：</span>
          <span className="font-semibold text-gray-800">
            {Number(entry.value).toLocaleString()} 戶
          </span>
        </div>
      ))}
    </div>
  );
}

function getCityColor(units: number): string {
  if (units >= 10000) return "#1D4ED8";
  if (units >= 3000) return "#3B82F6";
  if (units >= 1000) return "#60A5FA";
  if (units >= 100) return "#93C5FD";
  return "#BFDBFE";
}

// === Props ===

interface MarketRentInfo {
  median_rent: number;
  avg_rent: number;
  label: string;
}

interface SocialHousingCardProps {
  city?: string;
  district?: string;
  marketRent?: MarketRentInfo;
  wholeFlatRent?: MarketRentInfo;
}

type TabType = "real" | "overview" | "future";

export default function SocialHousingCard({
  city,
  district,
  marketRent,
  wholeFlatRent,
}: SocialHousingCardProps) {
  const [overviewData, setOverviewData] = useState<SocialHousingData | null>(null);
  const [realData, setRealData] = useState<SocialHousingRealData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("real");
  const [selectedRentalType, setSelectedRentalType] = useState<string>("");

  useEffect(() => {
    fetch("/data/social_housing.json")
      .then((r) => r.json())
      .then(setOverviewData)
      .catch(console.error);
    fetch("/data/social_housing_real.json")
      .then((r) => r.json())
      .then(setRealData)
      .catch(console.error);
  }, []);

  if (!overviewData || !realData) return null;

  // Get city & district-level social housing data
  const cityReal = city ? realData[city] : null;
  const districtReal =
    cityReal && district ? cityReal.districts[district] : null;

  // For the real tab, use district data if available, else city data
  const socialStats = districtReal || (cityReal ? {
    total_count: cityReal.total_count,
    median_rent: cityReal.overall_stats.median_rent,
    avg_rent: cityReal.overall_stats.avg_rent,
    avg_area_ping: cityReal.overall_stats.avg_area_ping,
    by_rental_type: undefined, // city-level doesn't have by_rental_type breakdown
    by_social_type: cityReal.by_social_type,
    samples: undefined,
  } as DistrictSocialData : null);

  // Build city bar chart data for overview
  const cityData = Object.entries(overviewData.cities)
    .map(([name, info]) => ({
      name,
      units: info.completed_units,
      projects: info.projects,
    }))
    .sort((a, b) => b.units - a.units);

  const currentCityData = city ? overviewData.cities[city] : null;

  // Future plan data
  const futureData = Object.entries(overviewData.future_plan)
    .map(([year, units]) => ({
      year: year.replace("_target", ""),
      units,
      isTarget: year.includes("target"),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const policyData = [
    { name: "直接興建", value: overviewData.policy_target_2032.direct_build, color: "#3B82F6" },
    { name: "包租代管", value: overviewData.policy_target_2032.lease_manage, color: "#10B981" },
    { name: "租金補貼", value: overviewData.policy_target_2032.rent_subsidy, color: "#F59E0B" },
  ];

  const hasRealData = !!socialStats;

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: "real", label: "社宅實價", icon: "💰" },
    { key: "overview", label: "現況總覽", icon: "🏘️" },
    { key: "future", label: "未來規劃", icon: "📋" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-lg text-gray-800">
              🏘️ 社會住宅統計
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              資料來源：實價登錄社宅租金 + 社會住宅推動聯盟
            </p>
          </div>
          <div className="flex items-center gap-4">
            {cityReal && (
              <div className="text-right">
                <div className="text-xs text-gray-500">{city} 社宅租賃</div>
                <div className="text-lg font-bold text-blue-600">
                  {cityReal.total_count.toLocaleString()} 筆
                </div>
              </div>
            )}
            <div className="text-right">
              <div className="text-xs text-gray-500">全國已完工</div>
              <div className="text-lg font-bold text-orange-600">
                {overviewData.total_units.toLocaleString()} 戶
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* District highlight */}
      {districtReal && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold">{district}</span>
              <span className="text-sm text-gray-600">
                社宅實價{" "}
                <span className="font-bold text-blue-700">
                  {districtReal.total_count.toLocaleString()}
                </span>{" "}
                筆
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">中位數</span>{" "}
              <span className="font-bold text-blue-700">
                ${districtReal.median_rent.toLocaleString()}/月
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "border-b-2 border-blue-600 text-blue-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* === Real Social Housing Tab === */}
        {activeTab === "real" && (
          <>
            {hasRealData && socialStats ? (
              <>
                {/* Rental type breakdown */}
                {socialStats.by_rental_type && Object.keys(socialStats.by_rental_type).length > 0 ? (
                  <>
                    <h4 className="text-sm font-medium text-gray-600 mb-3">
                      {district || city} 社宅實價 — 依出租型態
                    </h4>

                    {/* Rental type filter pills */}
                    <div className="flex gap-2 flex-wrap mb-4">
                      <button
                        onClick={() => setSelectedRentalType("")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                          !selectedRentalType
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        全部型態
                      </button>
                      {Object.entries(socialStats.by_rental_type)
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([type, rtStats]) => {
                          const config = RENTAL_TYPE_CONFIG[type] || { label: type, color: "#6B7280", icon: "🏠" };
                          return (
                            <button
                              key={type}
                              onClick={() => setSelectedRentalType(type === selectedRentalType ? "" : type)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                selectedRentalType === type
                                  ? "text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                              style={selectedRentalType === type ? { backgroundColor: config.color } : {}}
                            >
                              {config.icon} {config.label} ({rtStats.count})
                            </button>
                          );
                        })}
                    </div>

                    <div className="space-y-3">
                      {Object.entries(socialStats.by_rental_type)
                        .filter(([type]) => !selectedRentalType || type === selectedRentalType)
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([type, stats]) => {
                          const config = RENTAL_TYPE_CONFIG[type] || {
                            label: type,
                            color: "#6B7280",
                            icon: "🏠",
                          };
                          // Find corresponding market rent for comparison
                          const marketMedian =
                            type === "整棟(戶)出租" && wholeFlatRent
                              ? wholeFlatRent.median_rent
                              : marketRent
                              ? marketRent.median_rent
                              : null;
                          const discount =
                            marketMedian && marketMedian > 0
                              ? Math.round(
                                  (stats.median_rent / marketMedian) * 100
                                )
                              : null;

                          return (
                            <div
                              key={type}
                              className="bg-gray-50 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span>{config.icon}</span>
                                  <span className="text-sm font-bold text-gray-700">
                                    {config.label}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    ({stats.count} 筆)
                                  </span>
                                </div>
                                {discount !== null && (
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                      discount <= 70
                                        ? "bg-green-100 text-green-700"
                                        : discount <= 85
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-orange-100 text-orange-700"
                                    }`}
                                  >
                                    約市價 {discount}%
                                  </span>
                                )}
                              </div>

                              {/* Horizontal bar: social vs market */}
                              <div className="space-y-1.5">
                                {/* Social housing rent bar */}
                                <div className="flex items-center gap-2">
                                  <span className="w-[56px] text-xs text-gray-500 text-right shrink-0">
                                    社宅
                                  </span>
                                  <div className="flex-1 relative">
                                    <div className="w-full bg-gray-200 rounded-full h-6">
                                      <div
                                        className="h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                                        style={{
                                          width: `${Math.min(
                                            (stats.median_rent /
                                              Math.max(
                                                stats.median_rent,
                                                marketMedian || 0
                                              )) *
                                              100,
                                            100
                                          )}%`,
                                          backgroundColor: config.color,
                                          minWidth: "100px",
                                        }}
                                      >
                                        <span className="text-xs font-bold text-white">
                                          ${stats.median_rent.toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Market rent bar (if available) */}
                                {marketMedian && marketMedian > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="w-[56px] text-xs text-gray-500 text-right shrink-0">
                                      市場
                                    </span>
                                    <div className="flex-1 relative">
                                      <div className="w-full bg-gray-200 rounded-full h-6">
                                        <div
                                          className="h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                                          style={{
                                            width: "100%",
                                            backgroundColor: "#EF4444",
                                            opacity: 0.7,
                                            minWidth: "100px",
                                          }}
                                        >
                                          <span className="text-xs font-bold text-white">
                                            ${marketMedian.toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Stats row */}
                              <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                                {stats.avg_area_ping && (
                                  <span>
                                    均坪{" "}
                                    <span className="font-medium text-gray-700">
                                      {stats.avg_area_ping}坪
                                    </span>
                                  </span>
                                )}
                                {stats.avg_rooms && (
                                  <span>
                                    均房數{" "}
                                    <span className="font-medium text-gray-700">
                                      {stats.avg_rooms}房
                                    </span>
                                  </span>
                                )}
                                <span>
                                  範圍 ${stats.min_rent.toLocaleString()} ~ $
                                  {stats.max_rent.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Social type breakdown (包租轉租 vs 代管) */}
                    {socialStats.by_social_type &&
                      Object.keys(socialStats.by_social_type).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <h5 className="text-xs font-medium text-gray-500 mb-2">
                            社宅方案類型
                          </h5>
                          <div className="flex gap-3">
                            {Object.entries(socialStats.by_social_type).map(
                              ([type, stats]) => (
                                <div
                                  key={type}
                                  className="flex-1 bg-blue-50 rounded-lg p-2.5 text-center"
                                >
                                  <div className="text-xs text-blue-600 font-medium">
                                    {type}
                                  </div>
                                  <div className="text-sm font-bold text-blue-800 mt-0.5">
                                    {stats.count} 筆
                                  </div>
                                  <div className="text-xs text-blue-500">
                                    中位數 ${stats.median_rent.toLocaleString()}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Sample records */}
                    {socialStats.samples && socialStats.samples.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <h5 className="text-xs font-medium text-gray-500 mb-2">
                          📍 社宅實例
                          {selectedRentalType && (
                            <span className="ml-1 text-blue-500">
                              — {RENTAL_TYPE_CONFIG[selectedRentalType]?.label || selectedRentalType}
                            </span>
                          )}
                        </h5>
                        <div className="space-y-2">
                          {socialStats.samples
                            .filter((s) => !selectedRentalType || s.rental_type === selectedRentalType)
                            .slice(0, selectedRentalType ? 5 : 3)
                            .map((sample, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg p-2"
                            >
                              <span className="text-gray-400 shrink-0">
                                {i + 1}.
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-700 truncate">
                                  {sample.address}
                                </p>
                                <div className="flex gap-3 mt-1 flex-wrap">
                                  <span className="font-bold text-blue-600">
                                    ${sample.rent.toLocaleString()}/月
                                  </span>
                                  <span className="text-gray-500">
                                    {
                                      RENTAL_TYPE_CONFIG[sample.rental_type]
                                        ?.label || sample.rental_type
                                    }
                                  </span>
                                  {sample.area_ping && (
                                    <span className="text-gray-500">
                                      {sample.area_ping}坪
                                    </span>
                                  )}
                                  {sample.rooms && (
                                    <span className="text-gray-500">
                                      {sample.rooms}房
                                    </span>
                                  )}
                                  {sample.floor && (
                                    <span className="text-gray-500">
                                      {sample.floor}F
                                    </span>
                                  )}
                                  <span className="text-gray-400">
                                    {sample.social_type}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          * 資料來自實價登錄，含社會住宅包租代管案件
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  /* City-level fallback when no district selected */
                  <div className="text-center py-6">
                    <div className="text-3xl mb-3">🏘️</div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">
                      {city || "全國"} 社宅包租代管實價
                    </h4>
                    <div className="flex justify-center gap-6 mb-4">
                      <div>
                        <div className="text-xs text-gray-500">中位數租金</div>
                        <div className="text-xl font-bold text-blue-600">
                          ${socialStats.median_rent.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">總筆數</div>
                        <div className="text-xl font-bold text-gray-700">
                          {socialStats.total_count.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* City districts overview */}
                    {cityReal && (
                      <div className="text-left">
                        <h5 className="text-xs font-medium text-gray-500 mb-2">
                          各區社宅租金中位數
                        </h5>
                        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                          {Object.entries(cityReal.districts)
                            .sort((a, b) => b[1].total_count - a[1].total_count)
                            .slice(0, 12)
                            .map(([dist, dstats]) => {
                              const maxRent = Math.max(
                                ...Object.values(cityReal.districts).map(
                                  (d) => d.median_rent
                                )
                              );
                              return (
                                <div
                                  key={dist}
                                  className="flex items-center gap-2"
                                >
                                  <span className="w-[52px] text-xs text-gray-600 text-right shrink-0">
                                    {dist}
                                  </span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-5">
                                    <div
                                      className="h-5 rounded-full flex items-center justify-end pr-2"
                                      style={{
                                        width: `${
                                          (dstats.median_rent / maxRent) * 100
                                        }%`,
                                        backgroundColor:
                                          dist === district
                                            ? "#1D4ED8"
                                            : "#60A5FA",
                                        minWidth: "70px",
                                      }}
                                    >
                                      <span className="text-xs font-medium text-white">
                                        ${dstats.median_rent.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-400 w-[36px] text-right">
                                    {dstats.total_count}筆
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-3">
                      選擇區域可查看各出租型態（套房/雅房/整戶）的社宅實價
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">🏘️</div>
                <p className="text-sm">選擇城市後顯示社宅實價資料</p>
              </div>
            )}
          </>
        )}

        {/* === Overview Tab === */}
        {activeTab === "overview" && (
          <>
            <h4 className="text-sm font-medium text-gray-600 mb-3">
              各縣市社會住宅已完工戶數
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={cityData}
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#F3F4F6"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                  }
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12, fill: "#374151" }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="units" name="已完工戶數" radius={[0, 4, 4, 0]}>
                  {cityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        city && entry.name === city
                          ? "#1D4ED8"
                          : getCityColor(entry.units)
                      }
                      stroke={
                        city && entry.name === city ? "#1E40AF" : undefined
                      }
                      strokeWidth={city && entry.name === city ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">租金折扣</div>
                  <div className="text-sm font-bold text-green-600 mt-1">
                    市價 8 折
                  </div>
                  <div className="text-xs text-gray-400">一般戶</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">優先戶折扣</div>
                  <div className="text-sm font-bold text-green-600 mt-1">
                    市價 5-7 折
                  </div>
                  <div className="text-xs text-gray-400">弱勢族群</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">全國住宅存量</div>
                  <div className="text-sm font-bold text-gray-700 mt-1">
                    {(overviewData.total_housing_stock / 10000).toFixed(0)} 萬戶
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">社宅佔比</div>
                  <div className="text-sm font-bold text-orange-600 mt-1">
                    {overviewData.ratio_percent}%
                  </div>
                  <div className="text-xs text-gray-400">
                    遠低於先進國家 5%+
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* === Future Plan Tab === */}
        {activeTab === "future" && (
          <>
            <h4 className="text-sm font-medium text-gray-600 mb-3">
              社宅未來年度完工計畫
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={futureData}
                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                  tickFormatter={(v: string) => `${v}年`}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 10000
                      ? `${(v / 10000).toFixed(1)}萬`
                      : v >= 1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : String(v)
                  }
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="units" name="計畫完工" radius={[4, 4, 0, 0]}>
                  {futureData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isTarget ? "#F59E0B" : "#3B82F6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Policy 2032 target */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-600 mb-3">
                2032 年政策目標
              </h4>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="w-[160px] h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={policyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {policyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {policyData.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600 w-20">
                        {item.name}
                      </span>
                      <span className="text-sm font-bold text-gray-800">
                        {(item.value / 10000).toFixed(0)} 萬戶
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      總目標：
                      <span className="font-bold text-gray-800">100 萬戶</span>
                      （直接興建 + 包租代管 + 租金補貼）
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
