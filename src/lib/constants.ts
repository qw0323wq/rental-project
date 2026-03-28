// Shared constants for rental-project

export const RENTAL_TYPES = [
  { label: "整戶出租", value: "整棟(戶)出租" },
  { label: "獨立套房", value: "獨立套房" },
  { label: "分租套房", value: "分租套房" },
  { label: "分租雅房", value: "分租雅房" },
  { label: "分層出租", value: "分層出租" },
] as const;

export const AREA_RANGES = [
  { label: "10坪以下", value: "0-10" },
  { label: "10-20坪", value: "10-20" },
  { label: "20-30坪", value: "20-30" },
  { label: "30-40坪", value: "30-40" },
  { label: "40坪以上", value: "40-999" },
] as const;

export const RENT_RANGES = [
  { label: "5千以下", value: "0-5000" },
  { label: "5千-1萬", value: "5000-10000" },
  { label: "1萬-2萬", value: "10000-20000" },
  { label: "2萬-3萬", value: "20000-30000" },
  { label: "3萬-5萬", value: "30000-50000" },
  { label: "5萬以上", value: "50000+" },
] as const;

export const FLOORS = Array.from({ length: 25 }, (_, i) => ({
  label: `${i + 1}樓`,
  value: String(i + 1),
}));

export const RENTAL_TYPE_ICONS: Record<string, string> = {
  "整棟(戶)出租": "🏠",
  "獨立套房": "🚪",
  "分租套房": "🛏️",
  "分租雅房": "📦",
  "分層出租": "🏢",
};

export const RENTAL_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  "整棟(戶)出租": { label: "整戶出租", color: "#3B82F6", icon: "🏠" },
  "獨立套房": { label: "獨立套房", color: "#8B5CF6", icon: "🚪" },
  "分租套房": { label: "分租套房", color: "#EC4899", icon: "🛏️" },
  "分租雅房": { label: "分租雅房", color: "#F97316", icon: "📦" },
  "分層出租": { label: "分層出租", color: "#14B8A6", icon: "🏢" },
};
