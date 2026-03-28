// Shared type definitions for rental-project

export interface RoadData {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
}

export interface RentalTypeStats {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  avg_rooms?: number;
}

export interface ByTypeStats {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
}

export interface DistrictData {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  avg_building_age?: number;
  has_manager_ratio?: number;
  has_elevator_ratio?: number;
  rental_type_breakdown?: Record<string, number>;
  floor_distribution?: Record<string, number>;
  by_type?: Record<string, ByTypeStats>;
  by_rental_type?: Record<string, RentalTypeStats>;
  by_floor?: Record<string, ByTypeStats>;
  by_rent_range?: Record<string, ByTypeStats>;
  roads?: Record<string, RoadData>;
  [key: string]: unknown;
}

export interface CityData {
  districts: Record<string, DistrictData>;
  summary: {
    median_rent: number;
    avg_rent: number;
    sample_count: number;
    district_count: number;
  };
}

export interface CityInfo {
  name: string;
  median_rent: number;
  sample_count: number;
  district_count: number;
  districts: string[];
}

export interface RentTrendYear {
  median_rent: number;
  avg_rent: number;
  count: number;
}

export interface CityRentTrends {
  city_trend?: Record<string, RentTrendYear>;
  districts?: Record<string, Record<string, RentTrendYear>>;
}

export interface DistrictProfile {
  overall_score: number;
  transport: { score: number };
  livability: { score: number };
  demographics: { score: number };
  safety: { score: number; crime_rate_per_1000?: number };
  nearest_mrt?: { station: string; walk_minutes: number };
  vacancy_rate?: number;
}

export interface AskingCityData {
  median_rent: number;
  total_count: number;
  by_type?: Record<string, { median_rent: number; count: number }>;
}

export interface AskingData {
  crawl_date: string;
  cities: Record<string, AskingCityData>;
}
