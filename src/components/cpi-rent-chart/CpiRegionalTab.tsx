"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { YoyTooltip } from "./CpiTooltips";
import type { RegionalDataPoint } from "./types";
import { REGION_LABELS, REGION_COLORS } from "./types";

interface CpiRegionalTabProps {
  regionalData: RegionalDataPoint[];
}

/** CPI regional year-over-year comparison line chart tab */
export default function CpiRegionalTab({ regionalData }: CpiRegionalTabProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={regionalData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
          <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<YoyTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "13px" }}
            iconType="circle"
            formatter={(value: string) => REGION_LABELS[value] || value}
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
              dot={{ r: key === "national" ? 4 : 3, fill: REGION_COLORS[key], strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6, fill: REGION_COLORS[key], stroke: "#fff", strokeWidth: 2 }}
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
  );
}
