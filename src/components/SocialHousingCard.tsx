"use client";

import { useEffect, useState } from "react";
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

// Color based on unit count
function getCityColor(units: number): string {
  if (units >= 10000) return "#1D4ED8";
  if (units >= 3000) return "#3B82F6";
  if (units >= 1000) return "#60A5FA";
  if (units >= 100) return "#93C5FD";
  return "#BFDBFE";
}

interface MarketRentInfo {
  median_rent: number;
  avg_rent: number;
  label: string; // e.g. "整層住家" or "全部房型"
}

interface SocialHousingCardProps {
  city?: string;
  district?: string;
  marketRent?: MarketRentInfo;
  wholeFlatRent?: MarketRentInfo;
}

type TabType = "rent" | "overview" | "future";

export default function SocialHousingCard({
  city,
  district,
  marketRent,
  wholeFlatRent,
}: SocialHousingCardProps) {
  const [data, setData] = useState<SocialHousingData | null>(null);
  const hasRentData = !!(marketRent || wholeFlatRent);
  const [activeTab, setActiveTab] = useState<TabType>(
    hasRentData ? "rent" : "overview"
  );

  useEffect(() => {
    fetch("/data/social_housing.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return null;

  // Build city bar chart data
  const cityData = Object.entries(data.cities)
    .map(([name, info]) => ({
      name,
      units: info.completed_units,
      projects: info.projects,
    }))
    .sort((a, b) => b.units - a.units);

  // Current city highlight
  const currentCityData = city ? data.cities[city] : null;

  // Future plan bar data
  const futureData = Object.entries(data.future_plan)
    .map(([year, units]) => ({
      year: year.replace("_target", ""),
      units,
      isTarget: year.includes("target"),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Policy target pie data
  const policyData = [
    {
      name: "直接興建",
      value: data.policy_target_2032.direct_build,
      color: "#3B82F6",
    },
    {
      name: "包租代管",
      value: data.policy_target_2032.lease_manage,
      color: "#10B981",
    },
    {
      name: "租金補貼",
      value: data.policy_target_2032.rent_subsidy,
      color: "#F59E0B",
    },
  ];

  // Build rent comparison data
  const rentComparisons: Array<{
    label: string;
    market: number;
    general: number; // 8折
    priority70: number; // 7折
    priority50: number; // 5折
  }> = [];

  if (wholeFlatRent && wholeFlatRent.median_rent > 0) {
    rentComparisons.push({
      label: wholeFlatRent.label,
      market: wholeFlatRent.median_rent,
      general: Math.round(wholeFlatRent.median_rent * 0.8),
      priority70: Math.round(wholeFlatRent.median_rent * 0.7),
      priority50: Math.round(wholeFlatRent.median_rent * 0.5),
    });
  }
  if (
    marketRent &&
    marketRent.median_rent > 0 &&
    marketRent.label !== wholeFlatRent?.label
  ) {
    rentComparisons.push({
      label: marketRent.label,
      market: marketRent.median_rent,
      general: Math.round(marketRent.median_rent * 0.8),
      priority70: Math.round(marketRent.median_rent * 0.7),
      priority50: Math.round(marketRent.median_rent * 0.5),
    });
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    ...(hasRentData
      ? [{ key: "rent" as TabType, label: "租金比較", icon: "💰" }]
      : []),
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
              資料來源：社會住宅推動聯盟、內政部 | 更新：2025年6月
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">全國已完工</div>
              <div className="text-lg font-bold text-blue-600">
                {data.total_units.toLocaleString()} 戶
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">住宅存量佔比</div>
              <div className="text-lg font-bold text-orange-600">
                {data.ratio_percent}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current city highlight */}
      {city && currentCityData && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold">{city}</span>
              <span className="text-sm text-gray-600">
                社宅已完工{" "}
                <span className="font-bold text-blue-700">
                  {currentCityData.completed_units.toLocaleString()}
                </span>{" "}
                戶
              </span>
              <span className="text-sm text-gray-500">
                （{currentCityData.projects} 個案場）
              </span>
            </div>
            <div className="text-xs text-gray-500">
              租金優惠：{data.rent_discount}
            </div>
          </div>
          {currentCityData.note && (
            <p className="text-xs text-gray-500 mt-1">{currentCityData.note}</p>
          )}
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
        {/* Rent Comparison Tab */}
        {activeTab === "rent" && rentComparisons.length > 0 && (
          <>
            <h4 className="text-sm font-medium text-gray-600 mb-4">
              {district ? `${district}` : city} 市場租金 vs 社宅估算租金
            </h4>
            <div className="space-y-6">
              {rentComparisons.map((comp) => {
                const savings = comp.market - comp.general;
                const savingsPercent = Math.round(
                  (savings / comp.market) * 100
                );
                const barData = [
                  {
                    name: "市場行情",
                    rent: comp.market,
                    color: "#EF4444",
                  },
                  {
                    name: "社宅一般戶(8折)",
                    rent: comp.general,
                    color: "#3B82F6",
                  },
                  {
                    name: "社宅優先戶(7折)",
                    rent: comp.priority70,
                    color: "#10B981",
                  },
                  {
                    name: "社宅優先戶(5折)",
                    rent: comp.priority50,
                    color: "#059669",
                  },
                ];

                return (
                  <div key={comp.label}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-gray-700">
                        {comp.label}
                      </span>
                      <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-1 rounded-full">
                        一般戶可省 ${savings.toLocaleString()}/月（{savingsPercent}%）
                      </span>
                    </div>

                    {/* Horizontal bar comparison */}
                    <div className="space-y-2.5">
                      {barData.map((item) => {
                        const widthPercent = Math.min(
                          (item.rent / comp.market) * 100,
                          100
                        );
                        return (
                          <div key={item.name} className="flex items-center gap-3">
                            <div className="w-[120px] text-xs text-gray-600 text-right shrink-0">
                              {item.name}
                            </div>
                            <div className="flex-1 relative">
                              <div className="w-full bg-gray-100 rounded-full h-7">
                                <div
                                  className="h-7 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                                  style={{
                                    width: `${widthPercent}%`,
                                    backgroundColor: item.color,
                                    minWidth: "80px",
                                  }}
                                >
                                  <span className="text-xs font-bold text-white">
                                    ${item.rent.toLocaleString()}/月
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monthly savings summary */}
            {rentComparisons.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <h5 className="text-xs font-medium text-gray-500 mb-3">
                  💡 每月租金節省估算
                </h5>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600 font-medium">一般戶（8折）</div>
                    <div className="text-lg font-bold text-blue-700 mt-1">
                      省 ${(rentComparisons[0].market - rentComparisons[0].general).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-500 mt-0.5">
                      年省 ${((rentComparisons[0].market - rentComparisons[0].general) * 12).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-600 font-medium">優先戶（7折）</div>
                    <div className="text-lg font-bold text-green-700 mt-1">
                      省 ${(rentComparisons[0].market - rentComparisons[0].priority70).toLocaleString()}
                    </div>
                    <div className="text-xs text-green-500 mt-0.5">
                      年省 ${((rentComparisons[0].market - rentComparisons[0].priority70) * 12).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-emerald-600 font-medium">優先戶（5折）</div>
                    <div className="text-lg font-bold text-emerald-700 mt-1">
                      省 ${(rentComparisons[0].market - rentComparisons[0].priority50).toLocaleString()}
                    </div>
                    <div className="text-xs text-emerald-500 mt-0.5">
                      年省 ${((rentComparisons[0].market - rentComparisons[0].priority50) * 12).toLocaleString()}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  * 社宅租金為估算值，以該區域實價登錄中位數租金乘以折數計算。實際租金依各社宅案場公告為準。
                </p>
              </div>
            )}
          </>
        )}

        {/* Overview: City comparison bar chart */}
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
                    {(data.total_housing_stock / 10000).toFixed(0)} 萬戶
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">社宅佔比</div>
                  <div className="text-sm font-bold text-orange-600 mt-1">
                    {data.ratio_percent}%
                  </div>
                  <div className="text-xs text-gray-400">
                    遠低於先進國家 5%+
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Future plan */}
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
