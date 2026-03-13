import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const district = searchParams.get("district");
  const roomType = searchParams.get("type");

  try {
    const dataPath = path.join(process.cwd(), "public", "data", "rental_stats.json");
    const rawData = fs.readFileSync(dataPath, "utf-8");
    const stats = JSON.parse(rawData);

    // No city specified - return overview
    if (!city) {
      const overview: Record<string, unknown> = {};
      for (const [cityName, cityData] of Object.entries(stats)) {
        const cd = cityData as { summary: Record<string, unknown> };
        overview[cityName] = cd.summary;
      }
      return NextResponse.json({
        success: true,
        data: overview,
        meta: { total_cities: Object.keys(overview).length },
      });
    }

    // City not found
    const cityData = stats[city];
    if (!cityData) {
      return NextResponse.json(
        { success: false, error: `找不到「${city}」的資料` },
        { status: 404 }
      );
    }

    // Specific district
    if (district) {
      const districtData = cityData.districts?.[district];
      if (!districtData) {
        return NextResponse.json(
          {
            success: false,
            error: `找不到「${city} ${district}」的資料`,
          },
          { status: 404 }
        );
      }

      // Specific room type
      if (roomType && districtData.by_type?.[roomType]) {
        return NextResponse.json({
          success: true,
          data: {
            city,
            district,
            room_type: roomType,
            ...districtData.by_type[roomType],
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: { city, district, ...districtData },
      });
    }

    // City level
    return NextResponse.json({
      success: true,
      data: {
        city,
        summary: cityData.summary,
        districts: cityData.districts,
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { success: false, error: "伺服器錯誤" },
      { status: 500 }
    );
  }
}
