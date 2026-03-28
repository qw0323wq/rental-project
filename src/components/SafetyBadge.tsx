"use client";

interface SafetyBadgeProps {
  score: number;
  crimeRate?: number;
}

// Clamp value between 0 and 100
function clamp(val: number): number {
  return Math.min(100, Math.max(0, val ?? 0));
}

interface BadgeConfig {
  dot: string;
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

function getBadgeConfig(score: number): BadgeConfig {
  if (score >= 70) {
    return {
      dot: "🟢",
      label: "安全",
      textClass: "text-green-700",
      bgClass: "bg-green-50",
      borderClass: "border-green-200",
    };
  }
  if (score >= 40) {
    return {
      dot: "🟡",
      label: "普通",
      textClass: "text-yellow-700",
      bgClass: "bg-yellow-50",
      borderClass: "border-yellow-200",
    };
  }
  return {
    dot: "🔴",
    label: "注意",
    textClass: "text-red-700",
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
  };
}

export default function SafetyBadge({ score, crimeRate }: SafetyBadgeProps) {
  const clamped = clamp(score);
  const { dot, label, textClass, bgClass, borderClass } = getBadgeConfig(clamped);

  // Guard against invalid crimeRate
  const displayRate =
    typeof crimeRate === "number" && isFinite(crimeRate)
      ? crimeRate.toFixed(2)
      : "—";

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      {/* Main badge */}
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${bgClass} ${textClass} ${borderClass}`}
      >
        <span className="leading-none" aria-hidden="true">
          {dot}
        </span>
        {label}
      </span>

      {/* Crime rate sub-label */}
      <span className="text-xs text-gray-400 tabular-nums">
        {displayRate} 件/千人
      </span>
    </div>
  );
}
