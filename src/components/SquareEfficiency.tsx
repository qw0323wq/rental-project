"use client";

import type { RentalTypeStats } from "@/types";

interface SquareEfficiencyProps {
  byRentalType: Record<string, RentalTypeStats>;
}

export default function SquareEfficiency({ byRentalType }: SquareEfficiencyProps) {
  const whole = byRentalType["整棟(戶)出租"];
  const suite = byRentalType["分租套房"];
  const studio = byRentalType["獨立套房"];
  const room = byRentalType["分租雅房"];

  if (!whole || (!suite && !studio && !room)) return null;

  const wholePerPing = whole.avg_area_ping && whole.avg_area_ping > 0
    ? Math.round(whole.median_rent / whole.avg_area_ping) : 0;
  const wholePing = whole.avg_area_ping || 30;

  const subletTypes = [
    suite ? { name: "分租套房", ...suite } : null,
    studio ? { name: "獨立套房", ...studio } : null,
    room ? { name: "分租雅房", ...room } : null,
  ].filter(Boolean) as Array<{ name: string; median_rent: number; avg_area_ping?: number; avg_rooms?: number; sample_count: number }>;

  const bestSublet = subletTypes.reduce((best, cur) => {
    if (!cur.avg_area_ping || cur.avg_area_ping <= 0) return best;
    const totalIncome = Math.floor(wholePing / cur.avg_area_ping) * cur.median_rent;
    return totalIncome > (best?.totalIncome || 0)
      ? { ...cur, totalIncome, roomCount: Math.floor(wholePing / cur.avg_area_ping) }
      : best;
  }, null as null | (typeof subletTypes[0] & { totalIncome: number; roomCount: number }));

  if (!bestSublet) return null;

  const uplift = Math.round(((bestSublet.totalIncome - whole.median_rent) / whole.median_rent) * 100);

  return (
    <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💡</span>
        <h3 className="font-bold text-gray-800">坪效分析 — 整層出租 vs 分租</h3>
        <span className="text-xs text-gray-400 ml-auto">包租代管參考</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="bg-white rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">🏠 整層出租</div>
          <div className="text-xl font-bold text-blue-600">${whole.median_rent.toLocaleString()}/月</div>
          <div className="text-xs text-gray-400 mt-1">
            {wholePing} 坪
            {wholePerPing > 0 && `・每坪 $${wholePerPing.toLocaleString()}`}
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border-2 border-emerald-300">
          <div className="text-xs text-emerald-600 mb-1">
            🛏️ 改{bestSublet.name}（估算）
          </div>
          <div className="text-xl font-bold text-emerald-600">
            ${bestSublet.totalIncome.toLocaleString()}/月
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {bestSublet.roomCount} 間 × ${bestSublet.median_rent.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 flex flex-col items-center justify-center">
          <div className="text-xs text-gray-500 mb-1">分租增幅</div>
          <div className={`text-2xl font-bold ${uplift > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {uplift > 0 ? "+" : ""}{uplift}%
          </div>
          <div className="text-xs text-gray-400">
            {uplift > 0 ? `多賺 $${(bestSublet.totalIncome - whole.median_rent).toLocaleString()}` : "分租不划算"}
          </div>
        </div>
      </div>

      {subletTypes.length > 1 && (
        <div className="bg-white rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-2">各分租型態估算比較（以 {wholePing} 坪整層改造）：</div>
          <div className="space-y-1.5">
            {subletTypes.map((st) => {
              if (!st.avg_area_ping || st.avg_area_ping <= 0) return null;
              const rooms = Math.floor(wholePing / st.avg_area_ping);
              const total = rooms * st.median_rent;
              const diff = total - whole.median_rent;
              const pct = Math.round((diff / whole.median_rent) * 100);
              return (
                <div key={st.name} className="flex items-center gap-2 text-sm">
                  <span className="w-20 text-gray-600 shrink-0">{st.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5">
                    <div
                      className="h-5 rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${Math.min(Math.max((total / (bestSublet.totalIncome || 1)) * 100, 20), 100)}%`,
                        backgroundColor: diff > 0 ? "#10B981" : "#EF4444",
                        minWidth: "80px",
                      }}
                    >
                      <span className="text-xs font-medium text-white">
                        ${total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold w-14 text-right ${diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {diff > 0 ? "+" : ""}{pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2">
        * 估算方式：整層坪數 ÷ 各型態平均坪數 = 可分間數，× 各型態中位數租金 = 預估月收入。
        實際須考慮裝修成本、空置率、管理成本。
      </p>
    </div>
  );
}
