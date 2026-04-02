/** CPI rent chart shared types */

export interface CpiData {
  monthly_index: Record<string, Record<string, number>>;
  yoy_change: Record<string, Record<string, number>>;
  regional_yoy: Record<
    string,
    {
      national: number;
      north: number;
      central: number;
      south: number;
      east: number;
    }
  >;
}

export interface IndexDataPoint {
  year: string;
  index: number;
}

export interface YoyDataPoint {
  year: string;
  yoy: number;
}

export interface RegionalDataPoint {
  year: string;
  national: number;
  north: number;
  central: number;
  south: number;
  east: number;
}

export interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export type TabType = "index" | "yoy" | "regional";

export const REGION_LABELS: Record<string, string> = {
  national: "全國",
  north: "北部",
  central: "中部",
  south: "南部",
  east: "東部",
};

export const REGION_COLORS: Record<string, string> = {
  national: "#3B82F6",
  north: "#EF4444",
  central: "#F59E0B",
  south: "#10B981",
  east: "#8B5CF6",
};
