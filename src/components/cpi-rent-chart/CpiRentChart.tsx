"use client";

import { useEffect, useState } from "react";
import CpiIndexTab from "./CpiIndexTab";
import CpiYoyTab from "./CpiYoyTab";
import CpiRegionalTab from "./CpiRegionalTab";
import type { CpiData, IndexDataPoint, YoyDataPoint, RegionalDataPoint, TabType } from "./types";

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: "index", label: "指數走勢", icon: "📈" },
  { key: "yoy", label: "年增率", icon: "📊" },
  { key: "regional", label: "區域比較", icon: "🗺️" },
];

/**
 * CPI housing rent index chart with three views:
 * - Index: historical trend line (base year 2021 = 100)
 * - YoY: year-over-year change bar chart
 * - Regional: north/central/south/east comparison
 */
export default function CpiRentChart() {
  const [data, setData] = useState<CpiData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("index");

  useEffect(() => {
    fetch("/data/cpi_rent.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return null;

  const indexData: IndexDataPoint[] = Object.keys(data.monthly_index)
    .sort()
    .map((year) => ({ year, index: data.monthly_index[year].annual || 0 }))
    .filter((d) => d.index > 0);

  const yoyData: YoyDataPoint[] = Object.keys(data.yoy_change)
    .sort()
    .map((year) => ({ year, yoy: data.yoy_change[year].annual || 0 }))
    .filter((d) => d.yoy !== undefined);

  const regionalData: RegionalDataPoint[] = Object.keys(data.regional_yoy)
    .sort()
    .map((year) => ({ year, ...data.regional_yoy[year] }));

  const latestYear = indexData[indexData.length - 1];
  const latestYoy = yoyData[yoyData.length - 1];
  const totalChange = indexData.length >= 2
    ? (((indexData[indexData.length - 1].index - indexData[0].index) / indexData[0].index) * 100).toFixed(1)
    : "0";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-lg text-gray-800">🏠 CPI 住宅租金指數</h3>
            <p className="text-xs text-gray-500 mt-1">資料來源：主計總處 | 基期：2021年 = 100</p>
          </div>
          <div className="flex items-center gap-3">
            {latestYear && (
              <div className="text-right">
                <div className="text-xs text-gray-500">{latestYear.year} 年指數</div>
                <div className="text-lg font-bold text-blue-600">{latestYear.index.toFixed(1)}</div>
              </div>
            )}
            {latestYoy && (
              <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                latestYoy.yoy > 1.5 ? "bg-red-50 text-red-600" : latestYoy.yoy > 0 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
              }`}>
                年增 {latestYoy.yoy > 0 ? "+" : ""}{latestYoy.yoy.toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      </div>

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

      <div className="p-4">
        {activeTab === "index" && <CpiIndexTab indexData={indexData} totalChange={totalChange} />}
        {activeTab === "yoy" && <CpiYoyTab yoyData={yoyData} />}
        {activeTab === "regional" && <CpiRegionalTab regionalData={regionalData} />}
      </div>
    </div>
  );
}
