"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import BarTooltip from "./BarTooltip";
import type { SocialHousingOverviewData } from "./types";

interface SocialHousingOverviewTabProps {
  overviewData: SocialHousingOverviewData;
  city?: string;
}

/** Returns bar color based on housing unit count */
function getCityColor(units: number): string {
  if (units >= 10000) return "#1D4ED8";
  if (units >= 3000) return "#3B82F6";
  if (units >= 1000) return "#60A5FA";
  if (units >= 100) return "#93C5FD";
  return "#BFDBFE";
}

/** Overview tab — national social housing completion stats by city */
export default function SocialHousingOverviewTab({
  overviewData,
  city,
}: SocialHousingOverviewTabProps) {
  const cityData = Object.entries(overviewData.cities)
    .map(([name, info]) => ({
      name,
      units: info.completed_units,
      projects: info.projects,
    }))
    .sort((a, b) => b.units - a.units);

  return (
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
            <div className="text-sm font-bold text-green-600 mt-1">市價 8 折</div>
            <div className="text-xs text-gray-400">一般戶</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">優先戶折扣</div>
            <div className="text-sm font-bold text-green-600 mt-1">市價 5-7 折</div>
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
            <div className="text-xs text-gray-400">遠低於先進國家 5%+</div>
          </div>
        </div>
      </div>
    </>
  );
}
