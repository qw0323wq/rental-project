"use client";

import { useState } from "react";
import { RENTAL_TYPE_CONFIG } from "@/lib/constants";
import type {
  DistrictSocialData,
  CitySocialData,
  MarketRentInfo,
} from "./types";

interface SocialHousingRealTabProps {
  city?: string;
  district?: string;
  socialStats: DistrictSocialData | null;
  cityReal: CitySocialData | null;
  marketRent?: MarketRentInfo;
  wholeFlatRent?: MarketRentInfo;
}

/** Social housing real price tab — shows actual rental data from government records */
export default function SocialHousingRealTab({
  city,
  district,
  socialStats,
  cityReal,
  marketRent,
  wholeFlatRent,
}: SocialHousingRealTabProps) {
  const [selectedRentalType, setSelectedRentalType] = useState<string>("");

  if (!socialStats) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-3xl mb-2">🏘️</div>
        <p className="text-sm">選擇城市後顯示社宅實價資料</p>
      </div>
    );
  }

  const hasBreakdown =
    socialStats.by_rental_type &&
    Object.keys(socialStats.by_rental_type).length > 0;

  if (!hasBreakdown) {
    return (
      <CityLevelFallback
        city={city}
        district={district}
        socialStats={socialStats}
        cityReal={cityReal}
      />
    );
  }

  return (
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
        {Object.entries(socialStats.by_rental_type!)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([type, rtStats]) => {
            const config = RENTAL_TYPE_CONFIG[type] || {
              label: type,
              color: "#6B7280",
              icon: "🏠",
            };
            return (
              <button
                key={type}
                onClick={() =>
                  setSelectedRentalType(
                    type === selectedRentalType ? "" : type
                  )
                }
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  selectedRentalType === type
                    ? "text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={
                  selectedRentalType === type
                    ? { backgroundColor: config.color }
                    : {}
                }
              >
                {config.icon} {config.label} ({rtStats.count})
              </button>
            );
          })}
      </div>

      {/* Rental type cards */}
      <div className="space-y-3">
        {Object.entries(socialStats.by_rental_type!)
          .filter(
            ([type]) => !selectedRentalType || type === selectedRentalType
          )
          .sort((a, b) => b[1].count - a[1].count)
          .map(([type, stats]) => {
            const config = RENTAL_TYPE_CONFIG[type] || {
              label: type,
              color: "#6B7280",
              icon: "🏠",
            };
            const marketMedian =
              type === "整棟(戶)出租" && wholeFlatRent
                ? wholeFlatRent.median_rent
                : marketRent
                ? marketRent.median_rent
                : null;
            const discount =
              marketMedian && marketMedian > 0
                ? Math.round((stats.median_rent / marketMedian) * 100)
                : null;

            return (
              <RentalTypeCard
                key={type}
                config={config}
                stats={stats}
                marketMedian={marketMedian}
                discount={discount}
              />
            );
          })}
      </div>

      {/* Social type breakdown */}
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
                —{" "}
                {RENTAL_TYPE_CONFIG[selectedRentalType]?.label ||
                  selectedRentalType}
              </span>
            )}
          </h5>
          <div className="space-y-2">
            {socialStats.samples
              .filter(
                (s) =>
                  !selectedRentalType || s.rental_type === selectedRentalType
              )
              .slice(0, selectedRentalType ? 5 : 3)
              .map((sample, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg p-2"
                >
                  <span className="text-gray-400 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 truncate">{sample.address}</p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="font-bold text-blue-600">
                        ${sample.rent.toLocaleString()}/月
                      </span>
                      <span className="text-gray-500">
                        {RENTAL_TYPE_CONFIG[sample.rental_type]?.label ||
                          sample.rental_type}
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
  );
}

// --- Sub-components ---

interface RentalTypeCardProps {
  config: { label: string; color: string; icon: string };
  stats: { median_rent: number; avg_area_ping?: number; avg_rooms?: number; min_rent: number; max_rent: number; count: number };
  marketMedian: number | null;
  discount: number | null;
}

function RentalTypeCard({ config, stats, marketMedian, discount }: RentalTypeCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{config.icon}</span>
          <span className="text-sm font-bold text-gray-700">{config.label}</span>
          <span className="text-xs text-gray-400">({stats.count} 筆)</span>
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

      <div className="space-y-1.5">
        <RentBar label="社宅" rent={stats.median_rent} maxRent={Math.max(stats.median_rent, marketMedian || 0)} color={config.color} />
        {marketMedian && marketMedian > 0 && (
          <RentBar label="市場" rent={marketMedian} maxRent={marketMedian} color="#EF4444" opacity={0.7} />
        )}
      </div>

      <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
        {stats.avg_area_ping && (
          <span>均坪 <span className="font-medium text-gray-700">{stats.avg_area_ping}坪</span></span>
        )}
        {stats.avg_rooms && (
          <span>均房數 <span className="font-medium text-gray-700">{stats.avg_rooms}房</span></span>
        )}
        <span>範圍 ${stats.min_rent.toLocaleString()} ~ ${stats.max_rent.toLocaleString()}</span>
      </div>
    </div>
  );
}

interface RentBarProps {
  label: string;
  rent: number;
  maxRent: number;
  color: string;
  opacity?: number;
}

function RentBar({ label, rent, maxRent, color, opacity = 1 }: RentBarProps) {
  const widthPercent = Math.min((rent / maxRent) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-[56px] text-xs text-gray-500 text-right shrink-0">{label}</span>
      <div className="flex-1 relative">
        <div className="w-full bg-gray-200 rounded-full h-6">
          <div
            className="h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
            style={{ width: `${widthPercent}%`, backgroundColor: color, opacity, minWidth: "100px" }}
          >
            <span className="text-xs font-bold text-white">${rent.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CityLevelFallbackProps {
  city?: string;
  district?: string;
  socialStats: DistrictSocialData;
  cityReal: CitySocialData | null;
}

function CityLevelFallback({ city, district, socialStats, cityReal }: CityLevelFallbackProps) {
  return (
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

      {cityReal && (
        <div className="text-left">
          <h5 className="text-xs font-medium text-gray-500 mb-2">各區社宅租金中位數</h5>
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
            {Object.entries(cityReal.districts)
              .sort((a, b) => b[1].total_count - a[1].total_count)
              .slice(0, 12)
              .map(([dist, dstats]) => {
                const maxRent = Math.max(
                  ...Object.values(cityReal.districts).map((d) => d.median_rent)
                );
                return (
                  <div key={dist} className="flex items-center gap-2">
                    <span className="w-[52px] text-xs text-gray-600 text-right shrink-0">{dist}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5">
                      <div
                        className="h-5 rounded-full flex items-center justify-end pr-2"
                        style={{
                          width: `${(dstats.median_rent / maxRent) * 100}%`,
                          backgroundColor: dist === district ? "#1D4ED8" : "#60A5FA",
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
  );
}
