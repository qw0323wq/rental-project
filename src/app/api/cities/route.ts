import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "public", "data", "cities.json");
    const rawData = fs.readFileSync(dataPath, "utf-8");
    const cities = JSON.parse(rawData);

    return NextResponse.json({
      success: true,
      data: cities,
      meta: { total: cities.length },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { success: false, error: "伺服器錯誤" },
      { status: 500 }
    );
  }
}
