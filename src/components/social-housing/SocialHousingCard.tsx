"use client";

import { useEffect, useState } from "react";
import SocialHousingRealTab from "./SocialHousingRealTab";
import SocialHousingOverviewTab from "./SocialHousingOverviewTab";
import SocialHousingFutureTab from "./SocialHousingFutureTab";
import type {
  SocialHousingOverviewData,
  SocialHousingRealData,
  DistrictSocialData,
  MarketRentInfo,
  TabType,
} from "./types";

interface SocialHousingCardProps {
  city?: string;
  district?: string;
  marketRent?: MarketRentInfo;
  wholeFlatRent?: MarketRentInfo;
}

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: "real", label: "社宅實價", icon: "💰" },
  { key: "overview", label: "現況總覽", icon: "🏘️" },
  { key: "future", label: "未來規劃", icon: "📋" },
];

/**
 * Social housing statistics card with three tabs:
 * - Real: actual rental prices from government records
 * - Overview: national completion stats by city
 * - Future: projected plans and 2032 policy targets
 */
export default function SocialHousingCard({
  city,
  district,
  marketRent,
  wholeFlatRent,
}: SocialHousingCardProps) {
  const [overviewData, setOverviewData] = useState<SocialHousingOverviewData | null>(null);
  const [realData, setRealData] = useState<SocialHousingRealData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("real");

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

  const cityReal = city ? realData[city] : null;
  const districtReal = cityReal && district ? cityReal.districts[district] : null;

  // CRITICAL: For the real tab, use district data if available, else city-level fallback
  const socialStats: DistrictSocialData | null = districtReal || (cityReal ? {
    total_count: cityReal.total_count,
    median_rent: cityReal.overall_stats.median_rent,
    avg_rent: cityReal.overall_stats.avg_rent,
    avg_area_ping: cityReal.overall_stats.avg_area_ping,
    by_rental_type: undefined,
    by_social_type: cityReal.by_social_type,
    samples: undefined,
  } : null);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-lg text-gray-800">🏘️ 社會住宅統計</h3>
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
        {TABS.map((tab) => (
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

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "real" && (
          <SocialHousingRealTab
            city={city}
            district={district}
            socialStats={socialStats}
            cityReal={cityReal}
            marketRent={marketRent}
            wholeFlatRent={wholeFlatRent}
          />
        )}
        {activeTab === "overview" && (
          <SocialHousingOverviewTab overviewData={overviewData} city={city} />
        )}
        {activeTab === "future" && (
          <SocialHousingFutureTab overviewData={overviewData} />
        )}
      </div>
    </div>
  );
}
