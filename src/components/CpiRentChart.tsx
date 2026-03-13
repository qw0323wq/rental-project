"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface CpiData {
  monthly_index: Record<string, Record<string, number>>;
  yoy_change: Record<string, Record<string, number>>;
  regional_yoy: Record<
    string,
    {
      national: number;
      north: number;
      central: number;
      south: number;
      east: number;
    }
  >;
}

interface IndexDataPoint {
  year: string;
  index: number;
}

interface YoyDataPoint {
  year: string;
  yoy: number;
}

interface RegionalDataPoint {
  year: string;
  national: number;
  north: number;
  central: number;
  south: number;
  east: number;
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

const REGION_LABELS: Record<string, string> = {
  national: "全國",
  north: "北部",
  central: "中部",
  south: "南部",
  east: "東部",
};

const REGION_COLORS: Record<string, string> = {
  national: "#3B82F6",
  north: "#EF4444",
  central: "#F59E0B",
  south: "#10B981",
  east: "#8B5CF6",
};

function IndexTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label} 年</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}：</span>
          <span className="font-semibold text-gray-800">
            {Number(entry.value).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function YoyTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label} 年</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}：</span>
          <span
            className={`font-semibold ${
              entry.value > 1.5
                ? "text-red-600"
                : entry.value > 0
                ? "text-orange-600"
                : "text-green-600"
            }`}
          >
            {entry.value > 0 ? "+" : ""}
            {Number(entry.value).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

type TabType = "index" | "yoy" | "regional";

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

  // Build annual index data
  const indexData: IndexDataPoint[] = Object.keys(data.monthly_index)
    .sort()
    .map((year) => ({
      year,
      index: data.monthly_index[year].annual || 0,
    }))
    .filter((d) => d.index > 0);

  // Build annual YoY data
  const yoyData: YoyDataPoint[] = Object.keys(data.yoy_change)
    .sort()
    .map((year) => ({
      year,
      yoy: data.yoy_change[year].annual || 0,
    }))
    .filter((d) => d.yoy !== undefined);

  // Build regional YoY data
  const regionalData: RegionalDataPoint[] = Object.keys(data.regional_yoy)
    .sort()
    .map((year) => ({
      year,
      ...data.regional_yoy[year],
    }));

  // Latest stats
  const latestYear = indexData[indexData.length - 1];
  const latestYoy = yoyData[yoyData.length - 1];
  const totalChange =
    indexData.length >= 2
      ? (
          ((indexData[indexData.length - 1].index - indexData[0].index) /
            indexData[0].index) *
          100
        ).toFixed(1)
      : "0";

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: "index", label: "指數走勢", icon: "📈" },
    { key: "yoy", label: "年增率", icon: "📊" },
    { key: "regional", label: "區域比較", icon: "🗺️" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-lg text-gray-800">
              🏠 CPI 住宅租金指數
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              資料來源：主計總處 | 基期：2021年 = 100
            </p>
          </div>
          <div className="flex items-center gap-3">
            {latestYear && (
              <div className="text-right">
                <div className="text-xs text-gray-500">
                  {latestYear.year} 年指數
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {latestYear.index.toFixed(1)}
                </div>
              </div>
            )}
            {latestYoy && (
              <div
                className={`text-sm font-bold px-3 py-1 rounded-full ${
                  latestYoy.yoy > 1.5
                    ? "bg-red-50 text-red-600"
                    : latestYoy.yoy > 0
                    ? "bg-orange-50 text-orange-600"
                    : "bg-green-50 text-green-600"
                }`}
              >
                年增 {latestYoy.yoy > 0 ? "+" : ""}
                {latestYoy.yoy.toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      </div>

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
        {/* Index Line Chart */}
        {activeTab === "index" && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={indexData}
                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<IndexTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "13px" }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="index"
                  name="CPI 租金指數"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  dot={{
                    r: 4,
                    fill: "#3B82F6",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{
                    r: 6,
                    fill: "#3B82F6",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 flex-wrap text-sm">
              <div>
                <span className="text-xs text-gray-400">期間累計漲幅</span>
                <p
                  className={`font-bold ${
                    Number(totalChange) > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {Number(totalChange) > 0 ? "+" : ""}
                  {totalChange}%
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-400">資料期間</span>
                <p className="font-medium text-gray-600">
                  {indexData[0]?.year} – {indexData[indexData.length - 1]?.year}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-400">說明</span>
                <p className="font-medium text-gray-500">
                  指數越高代表租金水準越高
                </p>
              </div>
            </div>
          </>
        )}

        {/* YoY Bar Chart */}
        {activeTab === "yoy" && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={yoyData}
                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={<YoyTooltip />} />
                <Bar dataKey="yoy" name="年增率" radius={[4, 4, 0, 0]}>
                  {yoyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.yoy > 1.5
                          ? "#EF4444"
                          : entry.yoy > 1.0
                          ? "#F97316"
                          : entry.yoy > 0
                          ? "#F59E0B"
                          : "#10B981"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
              <div className="flex gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
                  <span className="text-gray-500">&gt;1.5% 高漲幅</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
                  <span className="text-gray-500">1.0-1.5% 中漲幅</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                  <span className="text-gray-500">&lt;1.0% 低漲幅</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
                  <span className="text-gray-500">下跌</span>
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                2022-2023年租金漲幅明顯加速，年增率突破2%
              </p>
            </div>
          </>
        )}

        {/* Regional YoY Comparison */}
        {activeTab === "regional" && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={regionalData}
                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={<YoyTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "13px" }}
                  iconType="circle"
                  formatter={(value: string) =>
                    REGION_LABELS[value] || value
                  }
                />
                {Object.keys(REGION_COLORS).map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={REGION_LABELS[key]}
                    stroke={REGION_COLORS[key]}
                    strokeWidth={key === "national" ? 2.5 : 1.8}
                    strokeDasharray={key === "national" ? undefined : "5 3"}
                    dot={{
                      r: key === "national" ? 4 : 3,
                      fill: REGION_COLORS[key],
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{
                      r: 6,
                      fill: REGION_COLORS[key],
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
              <p className="text-xs text-gray-400">
                各區域 CPI 住宅租金年增率比較（%）| 2022年南部地區漲幅最高達 2.05%
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
