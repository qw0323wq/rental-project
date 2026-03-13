"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DistrictData {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  by_type?: Record<
    string,
    {
      median_rent: number;
      avg_rent: number;
      min_rent: number;
      max_rent: number;
      sample_count: number;
      avg_area_ping?: number;
    }
  >;
}

interface RentChartProps {
  districts: Record<string, DistrictData>;
  roomType?: string;
}

export default function RentChart({ districts, roomType }: RentChartProps) {
  const chartData = Object.entries(districts)
    .map(([name, data]) => {
      if (roomType && data.by_type?.[roomType]) {
        const typeData = data.by_type[roomType];
        return {
          name: name.replace("區", "").replace("市", "").replace("鎮", ""),
          中位數: typeData.median_rent,
          均價: typeData.avg_rent,
          筆數: typeData.sample_count,
        };
      }
      return {
        name: name.replace("區", "").replace("市", "").replace("鎮", ""),
        中位數: data.median_rent,
        均價: data.avg_rent,
        筆數: data.sample_count,
      };
    })
    .sort((a, b) => b.中位數 - a.中位數)
    .slice(0, 15);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-bold text-lg text-gray-800 mb-4">
        各區域租金比較 {roomType ? `(${roomType})` : ""}
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
            labelFormatter={(label) => `${label}區`}
          />
          <Legend />
          <Bar dataKey="中位數" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="均價" fill="#93C5FD" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
