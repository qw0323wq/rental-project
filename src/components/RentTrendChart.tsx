"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface RentTrendChartProps {
  trends: Record<
    string,
    { median_rent: number; avg_rent: number; count: number }
  >;
  title?: string;
}

// CRITICAL: 實價登錄租賃 2021/7 才上路，早期樣本偏少且偏選包租代管/商辦類高價物件，
// 直接畫進趨勢圖會造成「歷年下降」的視覺誤導。100 是經驗門檻：
// 大縣市 2022 後普遍 > 1000，這個門檻幾乎只擋掉 2013-2021 的個位數樣本，
// 不會誤砍真正有意義的資料。小縣市若全年都 < 100，下方 fallback 會保留全部年份。
const MIN_SAMPLES_FOR_TREND = 100;

interface ChartDataPoint {
  year: string;
  中位數: number;
  均價: number;
  count: number;
  medianChange?: number;
  avgChange?: number;
  isPartial?: boolean;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0];
  const medianChange =
    payload.find((p) => p.name === "中位數") &&
    (payload[0] as TooltipPayloadItem & { payload?: ChartDataPoint }).payload
      ?.medianChange;

  const tooltipPoint = (
    payload[0] as TooltipPayloadItem & { payload?: ChartDataPoint }
  ).payload;
  const isPartial = tooltipPoint?.isPartial;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">
        {label} 年
        {isPartial && (
          <span className="ml-1 text-xs font-normal text-amber-600">
            （進行中）
          </span>
        )}
      </p>
      {payload.map((entry) => {
        const pointData = (
          entry as TooltipPayloadItem & { payload?: ChartDataPoint }
        ).payload;
        const change =
          entry.name === "中位數"
            ? pointData?.medianChange
            : pointData?.avgChange;
        return (
          <div key={entry.name} className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}：</span>
            <span className="font-semibold text-gray-800">
              ${Number(entry.value).toLocaleString()}
            </span>
            {change !== undefined && (
              <span
                className={`text-xs font-medium ${
                  change > 0
                    ? "text-red-500"
                    : change < 0
                    ? "text-green-500"
                    : "text-gray-400"
                }`}
              >
                {change > 0 ? "▲" : change < 0 ? "▼" : "—"}
                {Math.abs(change).toFixed(1)}%
              </span>
            )}
          </div>
        );
      })}
      {dataPoint && (
        <p className="text-xs text-gray-400 mt-1 border-t pt-1">
          樣本數：
          {(
            (dataPoint as TooltipPayloadItem & { payload?: ChartDataPoint })
              .payload?.count ?? 0
          ).toLocaleString()}{" "}
          筆
        </p>
      )}
    </div>
  );
}

export default function RentTrendChart({
  trends,
  title = "租金趨勢走勢",
}: RentTrendChartProps) {
  const sortedYears = Object.keys(trends).sort();

  if (sortedYears.length < 2) return null;

  const significantYears = sortedYears.filter(
    (y) => trends[y].count >= MIN_SAMPLES_FOR_TREND
  );
  const usableYears =
    significantYears.length >= 2 ? significantYears : sortedYears;
  const filteredOutCount = sortedYears.length - usableYears.length;
  const usingFallback = significantYears.length < 2;

  const currentYear = new Date().getFullYear();

  const chartData: ChartDataPoint[] = usableYears.map((year, index) => {
    const current = trends[year];
    const prev = index > 0 ? trends[usableYears[index - 1]] : null;

    const medianChange =
      prev && prev.median_rent > 0
        ? ((current.median_rent - prev.median_rent) / prev.median_rent) * 100
        : undefined;

    const avgChange =
      prev && prev.avg_rent > 0
        ? ((current.avg_rent - prev.avg_rent) / prev.avg_rent) * 100
        : undefined;

    return {
      year,
      中位數: current.median_rent,
      均價: current.avg_rent,
      count: current.count,
      medianChange,
      avgChange,
      isPartial: parseInt(year, 10) === currentYear,
    };
  });

  const allValues = chartData.flatMap((d) => [d.中位數, d.均價]);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const yPadding = (maxVal - minVal) * 0.15 || 1000;
  const yMin = Math.max(0, Math.floor((minVal - yPadding) / 1000) * 1000);
  const yMax = Math.ceil((maxVal + yPadding) / 1000) * 1000;

  // CRITICAL: 整體趨勢只用「完整年度」算 — 進行中年度（current year）樣本還沒收完，
  // 跟整年資料比是不公平比較，會讓「整體 -X%」變成失真的數字。
  const stableData = chartData.filter((d) => !d.isPartial);
  const trendBase = stableData.length >= 2 ? stableData : chartData;
  const firstData = trendBase[0];
  const lastData = trendBase[trendBase.length - 1];
  const latestData = chartData[chartData.length - 1];
  const overallChange =
    firstData.中位數 > 0
      ? ((lastData.中位數 - firstData.中位數) / firstData.中位數) * 100
      : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            整體趨勢（{firstData.year}–{lastData.year}）
          </span>
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded-full ${
              overallChange > 0
                ? "bg-red-50 text-red-600"
                : overallChange < 0
                ? "bg-green-50 text-green-600"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {overallChange > 0 ? "▲" : overallChange < 0 ? "▼" : "—"}
            {Math.abs(overallChange).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Data quality notice */}
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed space-y-1.5">
        <p>
          <span className="font-semibold">⚠ 中位數下降 ≠ 市場下跌。</span>
          實價登錄申報義務逐步擴大（2021/7 業者強制 → 2024/7 房東個人），
          早期樣本偏向業者管理的高單價物件，近年涵蓋全市場 → 中位數結構性下移。
          真實漲跌請看下方
          <span className="font-semibold">CPI 住宅租金指數</span>
          （主計總處 2022→2023 全國 +1.79%、北部連年正成長）。
        </p>
        <p className="text-amber-700/80">
          <span className="font-semibold">資料處理：</span>
          {filteredOutCount > 0 &&
            !usingFallback &&
            `已過濾 ${filteredOutCount} 個樣本 < ${MIN_SAMPLES_FOR_TREND} 筆的年份；`}
          {usingFallback && "本區樣本量普遍偏低，趨勢解讀宜謹慎；"}
          標 * 為進行中年度，樣本未滿全年。
        </p>
      </div>

      {/* Year-over-year change annotations */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {chartData.slice(1).map((point) => {
          const change = point.medianChange;
          if (change === undefined) return null;
          return (
            <div
              key={point.year}
              className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1"
            >
              <span className="text-xs text-gray-500">{point.year}</span>
              <span
                className={`text-xs font-semibold ${
                  change > 0
                    ? "text-red-500"
                    : change < 0
                    ? "text-green-500"
                    : "text-gray-400"
                }`}
              >
                {change > 0 ? "▲" : change < 0 ? "▼" : "—"}
                {Math.abs(change).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: "#6B7280" }}
            tickLine={false}
            axisLine={{ stroke: "#E5E7EB" }}
            tickFormatter={(v: string) =>
              parseInt(v, 10) === currentYear ? `${v}*` : v
            }
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 12, fill: "#6B7280" }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "13px", color: "#374151" }}
            iconType="circle"
          />
          {/* Zero reference baseline */}
          <ReferenceLine y={yMin} stroke="#E5E7EB" strokeWidth={1} />
          <Line
            type="monotone"
            dataKey="中位數"
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={{ r: 5, fill: "#3B82F6", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 7, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="均價"
            stroke="#93C5FD"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 4, fill: "#93C5FD", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#93C5FD", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Footer summary */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 flex-wrap">
        <div>
          <span className="text-xs text-gray-400">
            最新中位數{latestData.isPartial && "*"}
          </span>
          <p className="text-sm font-bold text-blue-600">
            ${latestData.中位數.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-400">
            最新均價{latestData.isPartial && "*"}
          </span>
          <p className="text-sm font-bold text-blue-300">
            ${latestData.均價.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-400">資料期間</span>
          <p className="text-sm font-medium text-gray-600">
            {chartData[0].year} – {latestData.year}
            {latestData.isPartial && "*"}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-400">最新樣本數</span>
          <p className="text-sm font-medium text-gray-600">
            {latestData.count.toLocaleString()} 筆
          </p>
        </div>
      </div>
    </div>
  );
}
