"use client";

interface BuildingInfoProps {
  avgBuildingAge?: number;
  hasManagerRatio?: number;
  hasElevatorRatio?: number;
  rentalTypeBreakdown?: Record<string, number>;
  floorDistribution?: Record<string, number>;
  districtName: string;
}

function PercentBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 text-gray-600 shrink-0 truncate" title={label}>
        {label}
      </span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <span className="w-20 text-right text-gray-500 shrink-0">
        {count.toLocaleString()} ({pct.toFixed(0)}%)
      </span>
    </div>
  );
}

function RatioRing({
  label,
  ratio,
  icon,
  color,
}: {
  label: string;
  ratio: number;
  icon: string;
  color: string;
}) {
  const pct = Math.round(ratio * 100);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (ratio * circumference);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            strokeWidth="6"
            fill="none"
            className="stroke-gray-100"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            strokeWidth="6"
            fill="none"
            className={color}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-gray-700">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-lg mr-1">{icon}</span>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
    </div>
  );
}

export default function BuildingInfo({
  avgBuildingAge,
  hasManagerRatio,
  hasElevatorRatio,
  rentalTypeBreakdown,
  floorDistribution,
  districtName,
}: BuildingInfoProps) {
  const hasRatios =
    hasManagerRatio !== undefined || hasElevatorRatio !== undefined;
  const hasBreakdown =
    rentalTypeBreakdown && Object.keys(rentalTypeBreakdown).length > 0;
  const hasFloors =
    floorDistribution && Object.keys(floorDistribution).length > 0;

  if (!hasRatios && !hasBreakdown && !hasFloors && avgBuildingAge === undefined) {
    return null;
  }

  const rentalTotal = hasBreakdown
    ? Object.values(rentalTypeBreakdown!).reduce((a, b) => a + b, 0)
    : 0;
  const floorTotal = hasFloors
    ? Object.values(floorDistribution!).reduce((a, b) => a + b, 0)
    : 0;

  const rentalTypeColors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
  ];
  const floorColors = [
    "bg-sky-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-pink-500",
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <h3 className="font-bold text-lg text-gray-800 mb-5">
        🏢 {districtName} 建物資訊總覽
      </h3>

      {/* Top row: Building age + ratios */}
      {(avgBuildingAge !== undefined || hasRatios) && (
        <div className="flex flex-wrap items-center justify-around gap-6 mb-6 pb-6 border-b border-gray-100">
          {avgBuildingAge !== undefined && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold text-amber-600">
                {avgBuildingAge}
                <span className="text-lg font-normal text-gray-500 ml-1">
                  年
                </span>
              </span>
              <span className="text-sm text-gray-500">🏗️ 平均屋齡</span>
            </div>
          )}
          {hasManagerRatio !== undefined && (
            <RatioRing
              label="有管理員"
              ratio={hasManagerRatio}
              icon="👮"
              color="stroke-blue-500"
            />
          )}
          {hasElevatorRatio !== undefined && (
            <RatioRing
              label="有電梯"
              ratio={hasElevatorRatio}
              icon="🛗"
              color="stroke-emerald-500"
            />
          )}
        </div>
      )}

      {/* Bottom row: Rental type breakdown + Floor distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rental Type Breakdown */}
        {hasBreakdown && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">
              📋 出租型態分布
            </h4>
            <div className="space-y-2">
              {Object.entries(rentalTypeBreakdown!)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count], i) => (
                  <PercentBar
                    key={type}
                    label={type}
                    count={count}
                    total={rentalTotal}
                    color={rentalTypeColors[i % rentalTypeColors.length]}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Floor Distribution */}
        {hasFloors && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">
              📐 樓層分布
            </h4>
            <div className="space-y-2">
              {Object.entries(floorDistribution!).map(
                ([range, count], i) => (
                  <PercentBar
                    key={range}
                    label={range}
                    count={count}
                    total={floorTotal}
                    color={floorColors[i % floorColors.length]}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
