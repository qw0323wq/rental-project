"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { YoyTooltip } from "./CpiTooltips";
import type { YoyDataPoint } from "./types";

interface CpiYoyTabProps {
  yoyData: YoyDataPoint[];
}

/** CPI year-over-year change bar chart tab */
export default function CpiYoyTab({ yoyData }: CpiYoyTabProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={yoyData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
          <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<YoyTooltip />} />
          <Bar dataKey="yoy" name="年增率" radius={[4, 4, 0, 0]}>
            {yoyData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.yoy > 1.5 ? "#EF4444" : entry.yoy > 1.0 ? "#F97316" : entry.yoy > 0 ? "#F59E0B" : "#10B981"}
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
  );
}
