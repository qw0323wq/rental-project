/** Social housing component shared types */

export interface RentalTypeStats {
  count: number;
  median_rent: number;
  avg_rent: number;
  avg_area_ping?: number;
  avg_rooms?: number;
  min_rent: number;
  max_rent: number;
}

export interface SocialTypeStats {
  count: number;
  median_rent: number;
  avg_rent: number;
}

export interface SampleRecord {
  address: string;
  rent: number;
  rental_type: string;
  social_type: string;
  area_ping?: number;
  rooms?: number;
  floor?: number;
}

export interface DistrictSocialData {
  total_count: number;
  median_rent: number;
  avg_rent: number;
  avg_area_ping?: number;
  by_rental_type?: Record<string, RentalTypeStats>;
  by_social_type?: Record<string, SocialTypeStats>;
  samples?: SampleRecord[];
}

export interface CitySocialData {
  total_count: number;
  overall_stats: {
    median_rent: number;
    avg_rent: number;
    min_rent: number;
    max_rent: number;
    sample_count: number;
    avg_area_ping?: number;
  };
  by_social_type?: Record<string, SocialTypeStats>;
  districts: Record<string, DistrictSocialData>;
}

export type SocialHousingRealData = Record<string, CitySocialData>;

export interface CityHousing {
  completed_units: number;
  projects: number;
  note: string;
}

export interface SocialHousingOverviewData {
  total_units: number;
  total_housing_stock: number;
  ratio_percent: number;
  rent_discount: string;
  cities: Record<string, CityHousing>;
  future_plan: Record<string, number>;
  policy_target_2032: {
    direct_build: number;
    lease_manage: number;
    rent_subsidy: number;
  };
}

export interface MarketRentInfo {
  median_rent: number;
  avg_rent: number;
  label: string;
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

export type TabType = "real" | "overview" | "future";
