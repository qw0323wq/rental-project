"use client";

import { useState, useEffect } from "react";

interface RentalTypeStats {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  avg_rooms?: number;
}

interface DistrictData {
  median_rent: number;
  avg_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  by_rental_type?: Record<string, RentalTypeStats>;
}

interface CityData {
  districts: Record<string, DistrictData>;
  summary: { median_rent: number; avg_rent: number };
}

interface RentPricingProps {
  stats: Record<string, CityData>;
  city?: string;
  district?: string;
}

const RENTAL_TYPES = [
  { label: "整戶出租", value: "整棟(戶)出租" },
  { label: "獨立套房", value: "獨立套房" },
  { label: "分租套房", value: "分租套房" },
  { label: "分租雅房", value: "分租雅房" },
];

export default function RentPricing({ stats, city, district }: RentPricingProps) {
  const [inputArea, setInputArea] = useState("");
  const [inputType, setInputType] = useState("整棟(戶)出租");
  const [inputFloor, setInputFloor] = useState("mid");
  const [inputAge, setInputAge] = useState("10");
  const [result, setResult] = useState<{
    suggested: number;
    low: number;
    high: number;
    perPing: number;
    basis: string;
    sampleCount: number;
  } | null>(null);

  const calculate = () => {
    const area = parseFloat(inputArea);
    if (!area || area <= 0 || !city) return;

    // 取得區域或城市層級的出租型態資料
    const distData = district ? stats[city]?.districts?.[district] : null;
    const cityData = stats[city];
    if (!cityData) return;

    // 優先用區域的 by_rental_type，沒有就用區域整體
    let baseRent = 0;
    let baseArea = 0;
    let sampleCount = 0;
    let basis = "";

    if (distData?.by_rental_type?.[inputType]) {
      const rt = distData.by_rental_type[inputType];
      baseRent = rt.median_rent;
      baseArea = rt.avg_area_ping || area;
      sampleCount = rt.sample_count;
      basis = `${district} ${RENTAL_TYPES.find(r => r.value === inputType)?.label}`;
    } else if (distData) {
      baseRent = distData.median_rent;
      baseArea = distData.avg_area_ping || area;
      sampleCount = distData.sample_count;
      basis = `${district} 全部類型`;
    } else {
      baseRent = cityData.summary.median_rent;
      baseArea = 25;
      sampleCount = cityData.summary.median_rent;
      basis = `${city} 全市`;
    }

    // 每坪單價
    const perPing = baseArea > 0 ? baseRent / baseArea : baseRent / 20;

    // 用每坪單價 × 輸入坪數 = 基礎估算
    let suggested = Math.round(perPing * area);

    // 樓層調整
    if (inputFloor === "high") suggested = Math.round(suggested * 1.05);
    if (inputFloor === "low") suggested = Math.round(suggested * 0.95);

    // 屋齡調整
    const age = parseInt(inputAge) || 10;
    if (age <= 5) suggested = Math.round(suggested * 1.08);
    else if (age <= 10) suggested = Math.round(suggested * 1.03);
    else if (age >= 30) suggested = Math.round(suggested * 0.9);
    else if (age >= 20) suggested = Math.round(suggested * 0.95);

    // 租金範圍（±15%）
    const low = Math.round(suggested * 0.85);
    const high = Math.round(suggested * 1.15);

    setResult({
      suggested,
      low,
      high,
      perPing: Math.round(perPing),
      basis,
      sampleCount,
    });
  };

  // 自動計算
  useEffect(() => {
    if (inputArea && city) calculate();
  }, [inputArea, inputType, inputFloor, inputAge, city, district]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏷️</span>
          <h3 className="font-bold text-lg text-gray-800">租金定價建議</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          根據{city || "所選區域"}的實價登錄資料，估算合理租金範圍
        </p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">坪數</label>
            <input
              type="number"
              value={inputArea}
              onChange={(e) => setInputArea(e.target.value)}
              placeholder="例：15"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">出租型態</label>
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {RENTAL_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">樓層</label>
            <select
              value={inputFloor}
              onChange={(e) => setInputFloor(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">低樓層（1-5F）</option>
              <option value="mid">中樓層（6-12F）</option>
              <option value="high">高樓層（13F+）</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">屋齡（年）</label>
            <input
              type="number"
              value={inputAge}
              onChange={(e) => setInputAge(e.target.value)}
              placeholder="例：10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {result ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
            <div className="text-center mb-3">
              <div className="text-sm text-gray-500 mb-1">建議租金</div>
              <div className="text-3xl font-bold text-blue-600">
                ${result.suggested.toLocaleString()}/月
              </div>
              <div className="text-sm text-gray-400 mt-1">
                合理範圍：${result.low.toLocaleString()} ~ ${result.high.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-xs text-green-600">偏低（快租）</div>
                <div className="font-bold text-green-700">${result.low.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center border-2 border-blue-300">
                <div className="text-xs text-blue-600">建議價</div>
                <div className="font-bold text-blue-700">${result.suggested.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-xs text-orange-600">偏高（慢租）</div>
                <div className="font-bold text-orange-700">${result.high.toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400 space-y-0.5">
              <p>每坪單價：${result.perPing.toLocaleString()}/坪 | 參考資料：{result.basis}（{result.sampleCount} 筆）</p>
              <p>* 估算基於實價登錄成交租金，實際租金受裝潢、設備、景觀等影響</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <div className="text-2xl mb-2">🏷️</div>
            <p className="text-sm">{city ? "輸入坪數即可取得租金建議" : "請先選擇縣市和區域"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
