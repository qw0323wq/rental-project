"use client";

import type { AskingData } from "@/types";

interface AskingPriceComparisonProps {
  askingData: AskingData;
  city: string;
  summaryMedian: number;
}

export default function AskingPriceComparison({
  askingData,
  city,
  summaryMedian,
}: AskingPriceComparisonProps) {
  const cityAsking = askingData.cities[city];
  if (!cityAsking) return null;

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <h3 className="font-bold text-gray-800">租屋網 當前問價 vs 實價登錄成交價</h3>
        <span className="text-xs text-gray-400 ml-auto">
          租屋網 資料更新：{askingData.crawl_date}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-xs text-red-500 mb-1">租屋網 問價中位數</div>
          <div className="text-lg font-bold text-red-600">
            ${cityAsking.median_rent?.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-xs text-blue-500 mb-1">實價登錄成交中位數</div>
          <div className="text-lg font-bold text-blue-600">
            ${summaryMedian.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">問價 vs 成交</div>
          <div className={`text-lg font-bold ${
            cityAsking.median_rent > summaryMedian
              ? "text-red-600"
              : "text-green-600"
          }`}>
            {cityAsking.median_rent > summaryMedian ? "+" : ""}
            {Math.round(((cityAsking.median_rent - summaryMedian) / summaryMedian) * 100)}%
          </div>
          <div className="text-xs text-gray-400">
            {cityAsking.median_rent > summaryMedian ? "問價高於成交" : "問價低於成交"}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">租屋網 物件數</div>
          <div className="text-lg font-bold text-orange-600">
            {cityAsking.total_count} 筆
          </div>
          <div className="text-xs text-gray-400">當前掛牌中</div>
        </div>
      </div>
      {cityAsking.by_type && Object.keys(cityAsking.by_type).length > 0 && (
        <div className="mt-3 pt-3 border-t border-orange-100">
          <div className="text-xs text-gray-500 mb-2">租屋網 各類型問價中位數：</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(cityAsking.by_type)
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
        * 租屋網 為當前掛牌問價，實價登錄為過去成交價。問價通常高於成交價。
      </p>
    </div>
  );
}
