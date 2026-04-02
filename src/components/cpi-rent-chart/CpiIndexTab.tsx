"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { IndexTooltip } from "./CpiTooltips";
import type { IndexDataPoint } from "./types";

interface CpiIndexTabProps {
  indexData: IndexDataPoint[];
  totalChange: string;
}

/** CPI index trend line chart tab */
export default function CpiIndexTab({ indexData, totalChange }: CpiIndexTabProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={indexData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12, fill: "#6B7280" }} tickLine={false} axisLine={false} />
          <Tooltip content={<IndexTooltip />} />
          <Legend wrapperStyle={{ fontSize: "13px" }} iconType="circle" />
          <Line
            type="monotone" dataKey="index" name="CPI 租金指數" stroke="#3B82F6" strokeWidth={2.5}
            dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 flex-wrap text-sm">
        <div>
          <span className="text-xs text-gray-400">期間累計漲幅</span>
          <p className={`font-bold ${Number(totalChange) > 0 ? "text-red-600" : "text-green-600"}`}>
            {Number(totalChange) > 0 ? "+" : ""}{totalChange}%
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
          <p className="font-medium text-gray-500">指數越高代表租金水準越高</p>
        </div>
      </div>
    </>
  );
}
