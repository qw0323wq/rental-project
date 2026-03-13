"use client";

interface LiveabilityScoreProps {
  overall: number;
  transport: number;
  livability: number;
  demographics: number;
  safety: number;
}

// Clamp a value between 0 and 100
function clamp(val: number): number {
  return Math.min(100, Math.max(0, val ?? 0));
}

// Return fill colour hex based on score
function scoreColor(score: number): string {
  if (score >= 70) return "#22C55E"; // green-500
  if (score >= 40) return "#EAB308"; // yellow-500
  return "#EF4444"; // red-500
}

// Return Tailwind text-colour class based on score
function scoreTextClass(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

// Return Tailwind bar bg class based on score
function barBgClass(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-500";
}

// Return short label text
function scoreLabel(score: number): string {
  if (score >= 85) return "優異";
  if (score >= 70) return "良好";
  if (score >= 55) return "普通";
  if (score >= 40) return "偏低";
  return "待改善";
}

interface MiniScoreBarProps {
  label: string;
  score: number;
  icon: string;
}

function MiniScoreBar({ label, score, icon }: MiniScoreBarProps) {
  const clamped = clamp(score);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-4 shrink-0">{icon}</span>
      <span className="text-xs text-gray-500 w-10 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${barBgClass(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-7 text-right tabular-nums ${scoreTextClass(clamped)}`}>
        {Math.round(clamped)}
      </span>
    </div>
  );
}

// CSS-only circular score ring
interface ScoreRingProps {
  score: number;
  size?: number;
}

function ScoreRing({ score, size = 80 }: ScoreRingProps) {
  const clamped = clamp(score);
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const color = scoreColor(clamped);

  return (
    <div
      className="relative flex items-center justify-center mx-auto"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="6"
        />
        {/* Arc */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      {/* Score number */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xl font-bold leading-none tabular-nums"
          style={{ color }}
        >
          {Math.round(clamped)}
        </span>
        <span className="text-xs text-gray-400">分</span>
      </div>
    </div>
  );
}

export default function LiveabilityScore({
  overall,
  transport,
  livability,
  demographics,
  safety,
}: LiveabilityScoreProps) {
  const clamped = clamp(overall);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {/* Title */}
      <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
        宜居綜合評分
      </p>

      {/* Circular score */}
      <ScoreRing score={clamped} size={80} />

      {/* Score label below circle */}
      <p className={`text-center text-xs font-semibold mt-2 mb-4 ${scoreTextClass(clamped)}`}>
        {scoreLabel(clamped)}
      </p>

      {/* Category breakdown bars */}
      <div className="space-y-2">
        <MiniScoreBar icon="🚆" label="交通" score={transport} />
        <MiniScoreBar icon="🏪" label="生活" score={livability} />
        <MiniScoreBar icon="👥" label="人口" score={demographics} />
        <MiniScoreBar icon="🔒" label="治安" score={safety} />
      </div>

      {/* Min/max reference */}
      <div className="flex justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-300">0</span>
        <span className="text-xs text-gray-300">100</span>
      </div>
    </div>
  );
}
