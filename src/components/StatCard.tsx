"use client";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export default function StatCard({
  label,
  value,
  sub,
  color = "blue",
}: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    orange: "text-orange-600",
    purple: "text-purple-600",
    red: "text-red-600",
    amber: "text-amber-600",
    teal: "text-teal-600",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color] || colorMap.blue}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
