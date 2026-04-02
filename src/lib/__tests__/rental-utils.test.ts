import { describe, it, expect } from "vitest";
import { getRentSummary, filterDistrictsByArea, filterRoadsByArea } from "../rental-utils";
import type { CityData, DistrictData, RoadData } from "@/types";

// --- Test fixtures ---

const mockRoad: RoadData = {
  median_rent: 15000,
  avg_rent: 16000,
  min_rent: 8000,
  max_rent: 30000,
  sample_count: 42,
  avg_area_ping: 12,
};

const mockDistrict: DistrictData = {
  median_rent: 20000,
  avg_rent: 22000,
  min_rent: 5000,
  max_rent: 80000,
  sample_count: 500,
  avg_area_ping: 18,
  by_type: {
    "套房": { median_rent: 10000, avg_rent: 11000, min_rent: 5000, max_rent: 20000, sample_count: 200, avg_area_ping: 8 },
  },
  by_rental_type: {
    "獨立套房": { median_rent: 12000, avg_rent: 13000, min_rent: 6000, max_rent: 25000, sample_count: 150, avg_area_ping: 10, avg_rooms: 1 },
  },
  by_floor: {
    "3": { median_rent: 18000, avg_rent: 19000, min_rent: 8000, max_rent: 40000, sample_count: 50, avg_area_ping: 15 },
  },
  by_rent_range: {
    "10000-20000": { median_rent: 15000, avg_rent: 16000, min_rent: 10000, max_rent: 20000, sample_count: 300, avg_area_ping: 14 },
  },
  roads: { "忠孝東路": mockRoad },
};

const mockCityData: CityData = {
  districts: { "大安區": mockDistrict },
  summary: { median_rent: 25000, avg_rent: 28000, sample_count: 5000, district_count: 12 },
};

// --- getRentSummary ---

describe("getRentSummary", () => {
  const baseParams = {
    cityData: mockCityData,
    singleDistrict: mockDistrict,
    singleRoad: null as RoadData | null,
    rentalType: "",
    roomType: "",
    floorRange: "",
    rentRange: "",
  };

  it("returns road data when singleRoad is provided", () => {
    const result = getRentSummary({ ...baseParams, singleRoad: mockRoad });
    expect(result).toEqual({
      median: 15000,
      avg: 16000,
      count: 42,
      area: 12,
    });
  });

  it("returns rental type data when rentalType filter is active", () => {
    const result = getRentSummary({ ...baseParams, rentalType: "獨立套房" });
    expect(result?.median).toBe(12000);
    expect(result?.rooms).toBe(1);
  });

  it("returns room type data when roomType filter is active", () => {
    const result = getRentSummary({ ...baseParams, roomType: "套房" });
    expect(result?.median).toBe(10000);
    expect(result?.count).toBe(200);
  });

  it("returns floor data when floorRange filter is active", () => {
    const result = getRentSummary({ ...baseParams, floorRange: "3" });
    expect(result?.median).toBe(18000);
  });

  it("returns rent range data when rentRange filter is active", () => {
    const result = getRentSummary({ ...baseParams, rentRange: "10000-20000" });
    expect(result?.median).toBe(15000);
    expect(result?.count).toBe(300);
  });

  it("falls back to district data when no filter is active", () => {
    const result = getRentSummary(baseParams);
    expect(result?.median).toBe(20000);
    expect(result?.count).toBe(500);
  });

  it("falls back to city summary when no district", () => {
    const result = getRentSummary({ ...baseParams, singleDistrict: null });
    expect(result?.median).toBe(25000);
    expect(result?.count).toBe(5000);
  });

  it("returns null when no city data", () => {
    const result = getRentSummary({ ...baseParams, cityData: undefined, singleDistrict: null });
    expect(result).toBeNull();
  });

  it("prioritizes road over rentalType filter", () => {
    const result = getRentSummary({ ...baseParams, singleRoad: mockRoad, rentalType: "獨立套房" });
    expect(result?.median).toBe(15000); // road, not rental type
  });
});

// --- filterDistrictsByArea ---

describe("filterDistrictsByArea", () => {
  const districts: Record<string, DistrictData> = {
    "大安區": { ...mockDistrict, avg_area_ping: 25 },
    "中山區": { ...mockDistrict, avg_area_ping: 15 },
    "信義區": { ...mockDistrict, avg_area_ping: 35 },
  };

  it("returns all districts when areaRange is null", () => {
    const result = filterDistrictsByArea(districts, null);
    expect(Object.keys(result)).toHaveLength(3);
  });

  it("filters districts within area range", () => {
    const result = filterDistrictsByArea(districts, [20, 30]);
    expect(Object.keys(result)).toEqual(["大安區"]);
  });

  it("includes districts without avg_area_ping", () => {
    const withNull = { ...districts, "松山區": { ...mockDistrict, avg_area_ping: undefined } };
    const result = filterDistrictsByArea(withNull, [20, 30]);
    expect(Object.keys(result)).toContain("松山區");
  });
});

// --- filterRoadsByArea ---

describe("filterRoadsByArea", () => {
  const roads: Record<string, RoadData> = {
    "忠孝東路": { ...mockRoad, avg_area_ping: 12 },
    "仁愛路": { ...mockRoad, avg_area_ping: 25 },
    "信義路": { ...mockRoad, avg_area_ping: 8 },
  };

  it("returns all roads when areaRange is null", () => {
    const result = filterRoadsByArea(roads, null);
    expect(Object.keys(result)).toHaveLength(3);
  });

  it("filters roads within area range", () => {
    const result = filterRoadsByArea(roads, [10, 20]);
    expect(Object.keys(result)).toEqual(["忠孝東路"]);
  });
});
