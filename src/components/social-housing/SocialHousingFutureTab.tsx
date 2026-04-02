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
  PieChart,
  Pie,
} from "recharts";
import BarTooltip from "./BarTooltip";
import type { SocialHousingOverviewData } from "./types";

interface SocialHousingFutureTabProps {
  overviewData: SocialHousingOverviewData;
}

/** Future plan tab — projected social housing completion + 2032 policy targets */
export default function SocialHousingFutureTab({
  overviewData,
}: SocialHousingFutureTabProps) {
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

  return (
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
                <span className="text-sm text-gray-600 w-20">{item.name}</span>
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
  );
}
