"use client";

interface TransportData {
  has_mrt: boolean;
  mrt_lines: string[];
  bus_routes: number;
  score: number;
}

interface LiveabilityData {
  convenience_store_density: number;
  school_count: number;
  hospital_count: number;
  park_count: number;
  score: number;
}

interface DemographicsData {
  population: number;
  population_density: number;
  median_income: number;
  young_ratio: number;
  score: number;
}

interface SafetyData {
  crime_rate_per_1000: number;
  score: number;
}

interface DistrictProfileProps {
  profile: {
    transport: TransportData;
    livability: LiveabilityData;
    demographics: DemographicsData;
    safety: SafetyData;
    overall_score: number;
  };
  districtName: string;
}

// Clamp a score between 0 and 100
function clamp(val: number): number {
  return Math.min(100, Math.max(0, val));
}

// Return Tailwind color classes based on score thresholds
function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function scoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-50";
  if (score >= 40) return "bg-yellow-50";
  return "bg-red-50";
}

// Score label text
function scoreLabel(score: number): string {
  if (score >= 85) return "優異";
  if (score >= 70) return "良好";
  if (score >= 55) return "普通";
  if (score >= 40) return "偏低";
  return "待改善";
}

interface ScoreBarProps {
  score: number;
  label: string;
}

function ScoreBar({ score, label }: ScoreBarProps) {
  const clamped = clamp(score);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-12 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-7 text-right ${scoreTextColor(clamped)}`}>
        {Math.round(clamped)}
      </span>
    </div>
  );
}

interface CategoryCardProps {
  icon: string;
  title: string;
  score: number;
  children: React.ReactNode;
}

function CategoryCard({ icon, title, score, children }: CategoryCardProps) {
  const clamped = clamp(score);
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBgColor(clamped)} ${scoreTextColor(clamped)}`}
        >
          {scoreLabel(clamped)}
        </span>
      </div>
      <ScoreBar score={clamped} label="評分" />
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  );
}

// CSS-only circular progress indicator
interface CircularProgressProps {
  score: number;
  size?: number;
}

function CircularProgress({ score, size = 96 }: CircularProgressProps) {
  const clamped = clamp(score);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  let strokeColor = "#22C55E"; // green
  if (clamped < 40) strokeColor = "#EF4444"; // red
  else if (clamped < 70) strokeColor = "#EAB308"; // yellow

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="7"
        />
        {/* Progress arc */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {/* Score text in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold leading-none"
          style={{ color: strokeColor }}
        >
          {Math.round(clamped)}
        </span>
        <span className="text-xs text-gray-400 mt-0.5">分</span>
      </div>
    </div>
  );
}

export default function DistrictProfile({
  profile,
  districtName,
}: DistrictProfileProps) {
  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-400">
        暫無區域資料
      </div>
    );
  }

  const { transport, livability, demographics, safety, overall_score } = profile;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header: overall score */}
      <div className="flex items-center gap-5 mb-6 pb-5 border-b border-gray-100">
        <CircularProgress score={overall_score} size={96} />
        <div>
          <h3 className="text-xl font-bold text-gray-800">{districtName}</h3>
          <p className="text-sm text-gray-500 mt-0.5">區域綜合評分</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full ${scoreBgColor(overall_score)} ${scoreTextColor(overall_score)}`}
            >
              {scoreLabel(overall_score)}
            </span>
            <span className="text-xs text-gray-400">
              （滿分 100 分）
            </span>
          </div>
        </div>
      </div>

      {/* 2x2 category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Transport */}
        <CategoryCard icon="🚆" title="交通便利" score={transport.score}>
          <InfoRow
            label="捷運路線"
            value={
              transport.has_mrt
                ? transport.mrt_lines.length > 0
                  ? transport.mrt_lines.join("、")
                  : "有捷運"
                : "無捷運"
            }
          />
          <InfoRow
            label="公車路線"
            value={`${transport.bus_routes} 條`}
          />
          <InfoRow
            label="交通評分"
            value={`${Math.round(clamp(transport.score))} 分`}
          />
        </CategoryCard>

        {/* Livability */}
        <CategoryCard icon="🏪" title="生活機能" score={livability.score}>
          <InfoRow
            label="便利商店密度"
            value={`${livability.convenience_store_density.toFixed(1)} 家/km²`}
          />
          <InfoRow
            label="學校數量"
            value={`${livability.school_count} 所`}
          />
          <InfoRow
            label="醫療院所"
            value={`${livability.hospital_count} 家`}
          />
          <InfoRow
            label="公園綠地"
            value={`${livability.park_count} 處`}
          />
        </CategoryCard>

        {/* Demographics */}
        <CategoryCard icon="👥" title="人口特徵" score={demographics.score}>
          <InfoRow
            label="人口數"
            value={demographics.population.toLocaleString()}
          />
          <InfoRow
            label="人口密度"
            value={`${demographics.population_density.toLocaleString()} 人/km²`}
          />
          <InfoRow
            label="家戶所得中位數"
            value={`$${demographics.median_income.toLocaleString()}`}
          />
          <InfoRow
            label="青壯年比例"
            value={`${(demographics.young_ratio * 100).toFixed(1)}%`}
          />
        </CategoryCard>

        {/* Safety */}
        <CategoryCard icon="🔒" title="治安安全" score={safety.score}>
          <InfoRow
            label="犯罪率"
            value={`${safety.crime_rate_per_1000.toFixed(2)} 件/千人`}
          />
          <InfoRow
            label="治安評分"
            value={`${Math.round(clamp(safety.score))} 分`}
          />
          <div className="mt-2">
            <div
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                ${safety.score >= 70 ? "bg-green-50 text-green-600" : safety.score >= 40 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"}`}
            >
              {safety.score >= 70 ? "🟢 治安良好" : safety.score >= 40 ? "🟡 治安普通" : "🔴 治安需注意"}
            </div>
          </div>
        </CategoryCard>
      </div>

      {/* Bottom: mini score summary bar */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2">各項細項對比</p>
        <div className="space-y-2">
          <ScoreBar score={transport.score} label="交通" />
          <ScoreBar score={livability.score} label="生活" />
          <ScoreBar score={demographics.score} label="人口" />
          <ScoreBar score={safety.score} label="治安" />
        </div>
      </div>
    </div>
  );
}
