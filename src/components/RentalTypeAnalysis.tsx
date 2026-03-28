"use client";

import { useRouter } from "next/navigation";
import type { DistrictData } from "@/types";
import { RENTAL_TYPES, RENTAL_TYPE_ICONS } from "@/lib/constants";

interface RentalTypeAnalysisProps {
  districtData: DistrictData;
  city: string;
  district: string;
  rentalType: string;
  roomType: string;
}

export default function RentalTypeAnalysis({
  districtData,
  city,
  district,
  rentalType,
  roomType,
}: RentalTypeAnalysisProps) {
  const router = useRouter();
  const byRentalType = districtData.by_rental_type;
  if (!byRentalType) return null;

  return (
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
        {Object.entries(byRentalType)
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
          {Object.entries(byRentalType)
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
                    router.push(`/search?${params.toString()}`);
                  }}
                  className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{RENTAL_TYPE_ICONS[type] || "🏠"}</span>
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
                    {rtStats.avg_area_ping && rtStats.avg_area_ping > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">每坪租金</span>
                        <span className="font-medium text-red-600">
                          ${Math.round(rtStats.median_rent / rtStats.avg_area_ping).toLocaleString()}/坪
                        </span>
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
      {rentalType && byRentalType[rentalType] && (
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">
              {RENTAL_TYPE_ICONS[rentalType] || "🏢"}
            </span>
            <span className="font-bold text-purple-800">
              {RENTAL_TYPES.find((r) => r.value === rentalType)?.label || rentalType}
            </span>
            <span className="text-sm text-purple-500">
              {byRentalType[rentalType].sample_count} 筆資料
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">中位數租金</div>
              <div className="text-lg font-bold text-blue-600">
                ${byRentalType[rentalType].median_rent.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">平均租金</div>
              <div className="text-lg font-bold text-green-600">
                ${byRentalType[rentalType].avg_rent.toLocaleString()}
              </div>
            </div>
            {byRentalType[rentalType].avg_area_ping && (
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500">平均坪數</div>
                <div className="text-lg font-bold text-orange-600">
                  {byRentalType[rentalType].avg_area_ping} 坪
                </div>
              </div>
            )}
            {byRentalType[rentalType].avg_rooms && (
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500">平均房數</div>
                <div className="text-lg font-bold text-purple-600">
                  {byRentalType[rentalType].avg_rooms} 房
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-purple-400">
            租金範圍：${byRentalType[rentalType].min_rent.toLocaleString()} ~ ${byRentalType[rentalType].max_rent.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
