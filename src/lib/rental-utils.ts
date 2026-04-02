import type { DistrictData, CityData, RoadData } from "@/types";

export interface RentSummary {
  median: number;
  avg: number;
  count: number;
  area?: number;
  rooms?: number;
}

/**
 * Compute the rent summary for the current search context.
 * Priority: road > rentalType > roomType > floorRange > rentRange > district > city
 *
 * CRITICAL: This function determines which statistics are shown as headline numbers.
 * Changing the priority order will affect what users see as the "main" rent figure.
 */
export function getRentSummary(params: {
  cityData: CityData | undefined;
  singleDistrict: DistrictData | null;
  singleRoad: RoadData | null;
  rentalType: string;
  roomType: string;
  floorRange: string;
  rentRange: string;
}): RentSummary | null {
  const { cityData, singleDistrict, singleRoad, rentalType, roomType, floorRange, rentRange } = params;

  if (singleRoad) {
    return {
      median: singleRoad.median_rent,
      avg: singleRoad.avg_rent,
      count: singleRoad.sample_count,
      area: singleRoad.avg_area_ping,
    };
  }

  if (singleDistrict) {
    if (rentalType && singleDistrict.by_rental_type?.[rentalType]) {
      const rt = singleDistrict.by_rental_type[rentalType];
      return { median: rt.median_rent, avg: rt.avg_rent, count: rt.sample_count, area: rt.avg_area_ping, rooms: rt.avg_rooms };
    }
    if (roomType && singleDistrict.by_type?.[roomType]) {
      const t = singleDistrict.by_type[roomType];
      return { median: t.median_rent, avg: t.avg_rent, count: t.sample_count, area: t.avg_area_ping };
    }
    if (floorRange && singleDistrict.by_floor?.[floorRange]) {
      const f = singleDistrict.by_floor[floorRange];
      return { median: f.median_rent, avg: f.avg_rent, count: f.sample_count, area: f.avg_area_ping };
    }
    if (rentRange && singleDistrict.by_rent_range?.[rentRange]) {
      const r = singleDistrict.by_rent_range[rentRange];
      return { median: r.median_rent, avg: r.avg_rent, count: r.sample_count, area: r.avg_area_ping };
    }
    return { median: singleDistrict.median_rent, avg: singleDistrict.avg_rent, count: singleDistrict.sample_count, area: singleDistrict.avg_area_ping };
  }

  if (cityData?.summary) {
    return { median: cityData.summary.median_rent, avg: cityData.summary.avg_rent, count: cityData.summary.sample_count };
  }

  return null;
}

/**
 * Filter districts by area range.
 * Returns only districts whose avg_area_ping falls within [min, max].
 */
export function filterDistrictsByArea(
  districts: Record<string, DistrictData>,
  areaRange: [number, number] | null
): Record<string, DistrictData> {
  if (!areaRange) return districts;
  return Object.fromEntries(
    Object.entries(districts).filter(([, d]) => {
      if (!d.avg_area_ping) return true;
      return d.avg_area_ping >= areaRange[0] && d.avg_area_ping <= areaRange[1];
    })
  );
}

/**
 * Filter roads by area range.
 */
export function filterRoadsByArea(
  roads: Record<string, RoadData>,
  areaRange: [number, number] | null
): Record<string, RoadData> {
  if (!areaRange) return roads;
  return Object.fromEntries(
    Object.entries(roads).filter(([, r]) => {
      if (!r.avg_area_ping) return true;
      return r.avg_area_ping >= areaRange[0] && r.avg_area_ping <= areaRange[1];
    })
  );
}
