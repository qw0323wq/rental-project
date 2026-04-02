import type { CustomTooltipProps } from "./types";

/** Tooltip for CPI index line chart */
export function IndexTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label} 年</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-800">{Number(entry.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

/** Tooltip for YoY change bar/line chart */
export function YoyTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label} 年</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className={`font-semibold ${entry.value > 1.5 ? "text-red-600" : entry.value > 0 ? "text-orange-600" : "text-green-600"}`}>
            {entry.value > 0 ? "+" : ""}{Number(entry.value).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
