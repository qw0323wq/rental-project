/**
 * 台灣租金行情查詢 MCP Server
 * 讓 AI 助理能直接查詢實價登錄租金資料
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// === 資料載入 ===

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "public", "data");

function loadJSON<T>(filename: string): T {
  const content = readFileSync(join(DATA_DIR, filename), "utf-8");
  return JSON.parse(content) as T;
}

// 型別定義
interface CityInfo {
  name: string;
  median_rent: number;
  sample_count: number;
  district_count: number;
  districts: string[];
}

interface RentStats {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  avg_building_age?: number;
  has_manager_ratio?: number;
  has_elevator_ratio?: number;
  avg_rooms?: number;
}

interface DistrictData {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  avg_building_age?: number;
  has_manager_ratio?: number;
  has_elevator_ratio?: number;
  by_type?: Record<string, RentStats>;
  by_rental_type?: Record<string, RentStats>;
  rental_type_breakdown?: Record<string, number>;
  roads?: Record<string, RentStats>;
}

interface CityData {
  summary: RentStats & { district_count: number };
  districts: Record<string, DistrictData>;
}

interface RentalRecord {
  city: string;
  district: string;
  address: string;
  road: string;
  monthly_rent: number;
  room_type: string;
  area_ping?: number;
  floor?: number;
  total_floors?: number;
  has_manager?: boolean;
  has_elevator?: boolean;
  has_furniture?: boolean;
  rental_type?: string;
  building_age?: number;
}

interface SocialHousingSample {
  address: string;
  rent: number;
  rental_type: string;
  social_type: string;
  area_ping?: number;
  rooms?: number;
  floor?: number;
}

interface SocialDistrictData {
  total_count: number;
  median_rent: number;
  avg_rent: number;
  avg_area_ping?: number;
  by_rental_type?: Record<string, RentStats & { count: number }>;
  by_social_type?: Record<string, { count: number; median_rent: number; avg_rent: number }>;
  samples?: SocialHousingSample[];
}

interface SocialCityData {
  total_count: number;
  overall_stats: RentStats;
  by_social_type?: Record<string, { count: number; median_rent: number; avg_rent: number }>;
  districts: Record<string, SocialDistrictData>;
}

// 載入所有資料
console.error("載入租金資料...");
const cities = loadJSON<CityInfo[]>("cities.json");
const rentalStats = loadJSON<Record<string, CityData>>("rental_stats.json");
const socialHousing = loadJSON<Record<string, SocialCityData>>("social_housing_real.json");
const records = loadJSON<RentalRecord[]>("records.json");
const districtProfiles = loadJSON<Record<string, Record<string, Record<string, unknown>>>>("district_profiles.json");
console.error(`載入完成：${cities.length} 城市, ${records.length} 筆紀錄`);

// === 工具函式 ===

function formatRent(rent: number): string {
  return `$${rent.toLocaleString()}/月`;
}

function formatStats(stats: RentStats, label?: string): string {
  const lines: string[] = [];
  if (label) lines.push(`【${label}】`);
  lines.push(`中位數租金：${formatRent(stats.median_rent)}`);
  lines.push(`平均租金：${formatRent(stats.avg_rent)}`);
  lines.push(`租金範圍：${formatRent(stats.min_rent)} ~ ${formatRent(stats.max_rent)}`);
  lines.push(`資料筆數：${stats.sample_count.toLocaleString()} 筆`);
  if (stats.avg_area_ping) lines.push(`平均坪數：${stats.avg_area_ping} 坪`);
  if (stats.avg_rooms) lines.push(`平均房數：${stats.avg_rooms} 房`);
  if (stats.avg_building_age) lines.push(`平均屋齡：${stats.avg_building_age} 年`);
  if (stats.has_manager_ratio != null) lines.push(`管理員比例：${Math.round(stats.has_manager_ratio * 100)}%`);
  if (stats.has_elevator_ratio != null) lines.push(`電梯比例：${Math.round(stats.has_elevator_ratio * 100)}%`);
  return lines.join("\n");
}

// === MCP Server ===

const server = new McpServer({
  name: "taiwan-rental-query",
  version: "1.0.0",
});

// --- Tool 1: list_cities ---
server.tool(
  "list_cities",
  "列出台灣所有縣市的租金概覽（中位數租金、資料筆數、區域數）",
  {},
  async () => {
    const sorted = [...cities].sort((a, b) => b.sample_count - a.sample_count);
    const lines = sorted.map(
      (c) =>
        `${c.name}：中位數 ${formatRent(c.median_rent)}，${c.sample_count.toLocaleString()} 筆，${c.district_count} 區`
    );
    return {
      content: [
        {
          type: "text" as const,
          text: `台灣租金行情 — ${cities.length} 個縣市\n${"=".repeat(40)}\n${lines.join("\n")}\n\n資料來源：內政部實價登錄`,
        },
      ],
    };
  }
);

// --- Tool 2: query_rent ---
server.tool(
  "query_rent",
  "查詢台灣租金行情。可依縣市、區域、房型、出租型態篩選。回傳中位數/平均租金、坪數、房數等統計。",
  {
    city: z.string().describe("縣市名稱，如「台北市」「新北市」"),
    district: z.string().optional().describe("區域名稱，如「大安區」「中山區」"),
    roomType: z.string().optional().describe("房型：套房、雅房、整層、電梯大樓"),
    rentalType: z.string().optional().describe("出租型態：整棟(戶)出租、獨立套房、分租套房、分租雅房、分層出租"),
  },
  async ({ city, district, roomType, rentalType }) => {
    const cityData = rentalStats[city];
    if (!cityData) {
      return {
        content: [{ type: "text" as const, text: `找不到「${city}」的資料。可用 list_cities 查看所有縣市。` }],
      };
    }

    const lines: string[] = [];

    if (district) {
      const distData = cityData.districts[district];
      if (!distData) {
        const availableDistricts = Object.keys(cityData.districts).join("、");
        return {
          content: [{ type: "text" as const, text: `「${city}」沒有「${district}」的資料。\n可用區域：${availableDistricts}` }],
        };
      }

      // 出租型態篩選
      if (rentalType && distData.by_rental_type?.[rentalType]) {
        const rtStats = distData.by_rental_type[rentalType];
        lines.push(`${city} ${district} — ${rentalType}`);
        lines.push("=".repeat(40));
        lines.push(formatStats(rtStats));
      }
      // 房型篩選
      else if (roomType && distData.by_type?.[roomType]) {
        const typeStats = distData.by_type[roomType];
        lines.push(`${city} ${district} — ${roomType}`);
        lines.push("=".repeat(40));
        lines.push(formatStats(typeStats));
      }
      // 區域總覽
      else {
        lines.push(`${city} ${district} 租金行情`);
        lines.push("=".repeat(40));
        lines.push(formatStats(distData));

        // 出租型態分佈
        if (distData.by_rental_type && Object.keys(distData.by_rental_type).length > 0) {
          lines.push("\n📋 出租型態：");
          for (const [type, stats] of Object.entries(distData.by_rental_type)
            .sort((a, b) => b[1].sample_count - a[1].sample_count)) {
            lines.push(`  ${type}：中位數 ${formatRent(stats.median_rent)}（${stats.sample_count} 筆${stats.avg_rooms ? `，均 ${stats.avg_rooms} 房` : ""}）`);
          }
        }

        // 房型分佈
        if (distData.by_type && Object.keys(distData.by_type).length > 0) {
          lines.push("\n🏠 房型：");
          for (const [type, stats] of Object.entries(distData.by_type)
            .sort((a, b) => b[1].sample_count - a[1].sample_count)) {
            lines.push(`  ${type}：中位數 ${formatRent(stats.median_rent)}（${stats.sample_count} 筆）`);
          }
        }

        // 路段前 10
        if (distData.roads && Object.keys(distData.roads).length > 0) {
          lines.push("\n🛣️ 熱門路段（前 10）：");
          const topRoads = Object.entries(distData.roads)
            .sort((a, b) => b[1].sample_count - a[1].sample_count)
            .slice(0, 10);
          for (const [road, stats] of topRoads) {
            lines.push(`  ${road}：中位數 ${formatRent(stats.median_rent)}（${stats.sample_count} 筆${stats.avg_area_ping ? `，均 ${stats.avg_area_ping} 坪` : ""}）`);
          }
        }
      }
    } else {
      // 城市總覽
      lines.push(`${city} 租金行情`);
      lines.push("=".repeat(40));
      lines.push(formatStats(cityData.summary));
      lines.push(`涵蓋區域：${cityData.summary.district_count} 區`);

      // 各區排行
      lines.push("\n📊 各區中位數租金排行：");
      const sortedDistricts = Object.entries(cityData.districts)
        .sort((a, b) => b[1].median_rent - a[1].median_rent)
        .slice(0, 15);
      for (const [dist, stats] of sortedDistricts) {
        lines.push(`  ${dist}：${formatRent(stats.median_rent)}（${stats.sample_count} 筆）`);
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") + "\n\n資料來源：內政部實價登錄" }],
    };
  }
);

// --- Tool 3: query_social_housing ---
server.tool(
  "query_social_housing",
  "查詢社會住宅（包租代管）的租金資料。可依縣市、區域、出租型態篩選。含市場比較和範例地址。",
  {
    city: z.string().describe("縣市名稱，如「台北市」"),
    district: z.string().optional().describe("區域名稱，如「大安區」"),
    rentalType: z.string().optional().describe("出租型態：整棟(戶)出租、獨立套房、分租套房、分租雅房"),
  },
  async ({ city, district, rentalType }) => {
    const cityData = socialHousing[city];
    if (!cityData) {
      const availableCities = Object.keys(socialHousing).join("、");
      return {
        content: [{ type: "text" as const, text: `「${city}」沒有社宅資料。\n有社宅資料的縣市：${availableCities}` }],
      };
    }

    const lines: string[] = [];

    if (district) {
      const distData = cityData.districts[district];
      if (!distData) {
        const availableDistricts = Object.keys(cityData.districts).join("、");
        return {
          content: [{ type: "text" as const, text: `「${city} ${district}」沒有社宅資料。\n有社宅的區域：${availableDistricts}` }],
        };
      }

      lines.push(`${city} ${district} 社會住宅租金`);
      lines.push("=".repeat(40));
      lines.push(`社宅筆數：${distData.total_count} 筆`);
      lines.push(`中位數租金：${formatRent(distData.median_rent)}`);
      lines.push(`平均租金：${formatRent(distData.avg_rent)}`);
      if (distData.avg_area_ping) lines.push(`平均坪數：${distData.avg_area_ping} 坪`);

      // 市場租金比較
      const marketData = rentalStats[city]?.districts[district];
      if (marketData) {
        const discount = Math.round((distData.median_rent / marketData.median_rent) * 100);
        lines.push(`\n📊 市場比較：`);
        lines.push(`  市場中位數：${formatRent(marketData.median_rent)}`);
        lines.push(`  社宅中位數：${formatRent(distData.median_rent)}`);
        lines.push(`  社宅約為市價 ${discount}%`);
      }

      // 出租型態
      if (distData.by_rental_type) {
        const typesToShow = rentalType
          ? Object.entries(distData.by_rental_type).filter(([t]) => t === rentalType)
          : Object.entries(distData.by_rental_type).sort((a, b) => b[1].count - a[1].count);

        lines.push("\n📋 出租型態：");
        for (const [type, stats] of typesToShow) {
          lines.push(`  ${type}：中位數 ${formatRent(stats.median_rent)}（${stats.count} 筆${stats.avg_rooms ? `，均 ${stats.avg_rooms} 房` : ""}${stats.avg_area_ping ? `，均 ${stats.avg_area_ping} 坪` : ""}）`);
        }
      }

      // 社宅方案類型
      if (distData.by_social_type) {
        lines.push("\n🏘️ 方案類型：");
        for (const [type, stats] of Object.entries(distData.by_social_type)) {
          lines.push(`  ${type}：${stats.count} 筆，中位數 ${formatRent(stats.median_rent)}`);
        }
      }

      // 範例
      if (distData.samples && distData.samples.length > 0) {
        const filtered = rentalType
          ? distData.samples.filter((s) => s.rental_type === rentalType)
          : distData.samples;
        if (filtered.length > 0) {
          lines.push("\n📍 社宅實例：");
          for (const s of filtered.slice(0, 5)) {
            const details = [
              formatRent(s.rent),
              s.rental_type,
              s.area_ping ? `${s.area_ping}坪` : "",
              s.rooms ? `${s.rooms}房` : "",
              s.floor ? `${s.floor}F` : "",
              s.social_type,
            ]
              .filter(Boolean)
              .join("、");
            lines.push(`  ${s.address}（${details}）`);
          }
        }
      }
    } else {
      // 城市總覽
      lines.push(`${city} 社會住宅租金概覽`);
      lines.push("=".repeat(40));
      lines.push(`社宅筆數：${cityData.total_count.toLocaleString()} 筆`);
      lines.push(`中位數租金：${formatRent(cityData.overall_stats.median_rent)}`);
      lines.push(`平均租金：${formatRent(cityData.overall_stats.avg_rent)}`);
      lines.push(`租金範圍：${formatRent(cityData.overall_stats.min_rent)} ~ ${formatRent(cityData.overall_stats.max_rent)}`);
      if (cityData.overall_stats.avg_area_ping) {
        lines.push(`平均坪數：${cityData.overall_stats.avg_area_ping} 坪`);
      }

      // 方案類型
      if (cityData.by_social_type) {
        lines.push("\n🏘️ 方案類型：");
        for (const [type, stats] of Object.entries(cityData.by_social_type)) {
          lines.push(`  ${type}：${stats.count.toLocaleString()} 筆，中位數 ${formatRent(stats.median_rent)}`);
        }
      }

      // 各區排行
      lines.push("\n📊 各區社宅租金：");
      const sortedDistricts = Object.entries(cityData.districts)
        .sort((a, b) => b[1].total_count - a[1].total_count)
        .slice(0, 15);
      for (const [dist, stats] of sortedDistricts) {
        lines.push(`  ${dist}：中位數 ${formatRent(stats.median_rent)}（${stats.total_count} 筆）`);
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") + "\n\n資料來源：內政部實價登錄（社宅包租代管案件）" }],
    };
  }
);

// --- Tool 4: search_address ---
server.tool(
  "search_address",
  "用地址或路段關鍵字搜尋租賃紀錄。回傳匹配的租金、坪數、房型等。",
  {
    keyword: z.string().describe("搜尋關鍵字，如「忠孝東路」「信義路」「中正路」"),
    city: z.string().optional().describe("限定縣市，如「台北市」"),
    limit: z.number().optional().default(10).describe("回傳筆數上限，預設 10"),
  },
  async ({ keyword, city, limit }) => {
    const maxResults = Math.min(limit ?? 10, 20);
    const results = records.filter((r) => {
      if (city && r.city !== city) return false;
      return r.address.includes(keyword) || r.road.includes(keyword);
    });

    if (results.length === 0) {
      return {
        content: [{ type: "text" as const, text: `找不到包含「${keyword}」的租賃紀錄。${city ? `（限定 ${city}）` : ""}` }],
      };
    }

    // 統計摘要
    const rents = results.map((r) => r.monthly_rent).sort((a, b) => a - b);
    const median = rents[Math.floor(rents.length / 2)];
    const avg = Math.round(rents.reduce((a, b) => a + b, 0) / rents.length);

    const lines: string[] = [];
    lines.push(`搜尋「${keyword}」${city ? ` (${city})` : ""} — 找到 ${results.length} 筆`);
    lines.push("=".repeat(40));
    lines.push(`中位數：${formatRent(median)}，平均：${formatRent(avg)}`);
    lines.push(`範圍：${formatRent(rents[0])} ~ ${formatRent(rents[rents.length - 1])}`);
    lines.push("");

    // 個別紀錄
    const shown = results.slice(0, maxResults);
    for (const r of shown) {
      const details = [
        formatRent(r.monthly_rent),
        r.room_type,
        r.rental_type || "",
        r.area_ping ? `${r.area_ping}坪` : "",
        r.floor ? `${r.floor}F` : "",
        r.has_elevator ? "有電梯" : "",
      ]
        .filter(Boolean)
        .join("、");
      lines.push(`${r.city} ${r.district} ${r.address}`);
      lines.push(`  → ${details}`);
    }

    if (results.length > maxResults) {
      lines.push(`\n...還有 ${results.length - maxResults} 筆未顯示`);
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// --- Tool 5: get_district_profile ---
server.tool(
  "get_district_profile",
  "取得區域的宜居分數、安全評分、交通、人口統計等概覽資訊。",
  {
    city: z.string().describe("縣市名稱"),
    district: z.string().describe("區域名稱"),
  },
  async ({ city, district }) => {
    const cityProfiles = districtProfiles[city];
    if (!cityProfiles) {
      return {
        content: [{ type: "text" as const, text: `「${city}」沒有區域概覽資料。` }],
      };
    }

    const profile = cityProfiles[district] as Record<string, unknown> | undefined;
    if (!profile) {
      return {
        content: [{ type: "text" as const, text: `「${city} ${district}」沒有概覽資料。` }],
      };
    }

    const lines: string[] = [];
    lines.push(`${city} ${district} 區域概覽`);
    lines.push("=".repeat(40));

    // Overall score
    if (profile.overall_score != null) {
      lines.push(`綜合評分：${profile.overall_score}/100`);
    }

    // Transport
    const transport = profile.transport as Record<string, unknown> | undefined;
    if (transport) {
      lines.push("\n🚇 交通：");
      if (transport.score != null) lines.push(`  交通評分：${transport.score}/100`);
      if (transport.has_mrt != null) lines.push(`  有捷運：${transport.has_mrt ? "是" : "否"}`);
      if (transport.bus_routes != null) lines.push(`  公車路線：${transport.bus_routes} 條`);
    }

    // Livability
    const livability = profile.livability as Record<string, unknown> | undefined;
    if (livability) {
      lines.push("\n🏪 生活機能：");
      if (livability.score != null) lines.push(`  宜居評分：${livability.score}/100`);
      if (livability.convenience_stores != null) lines.push(`  便利商店：${livability.convenience_stores} 間`);
      if (livability.schools != null) lines.push(`  學校：${livability.schools} 間`);
      if (livability.hospitals != null) lines.push(`  醫院：${livability.hospitals} 間`);
      if (livability.parks != null) lines.push(`  公園：${livability.parks} 個`);
    }

    // Safety
    const safety = profile.safety as Record<string, unknown> | undefined;
    if (safety) {
      lines.push("\n🔒 安全：");
      if (safety.score != null) lines.push(`  安全評分：${safety.score}/100`);
      if (safety.crime_rate_per_1000 != null) lines.push(`  犯罪率：${safety.crime_rate_per_1000}‰`);
    }

    // Demographics
    const demographics = profile.demographics as Record<string, unknown> | undefined;
    if (demographics) {
      lines.push("\n👥 人口：");
      if (demographics.population != null) lines.push(`  人口：${Number(demographics.population).toLocaleString()} 人`);
      if (demographics.density != null) lines.push(`  密度：${Number(demographics.density).toLocaleString()} 人/km²`);
      if (demographics.median_income != null) lines.push(`  家庭中位數所得：$${Number(demographics.median_income).toLocaleString()}`);
      if (demographics.young_ratio != null) lines.push(`  青年比例：${Math.round(Number(demographics.young_ratio) * 100)}%`);
    }

    // 附帶租金資訊
    const rentData = rentalStats[city]?.districts[district];
    if (rentData) {
      lines.push("\n💰 租金：");
      lines.push(`  中位數：${formatRent(rentData.median_rent)}`);
      lines.push(`  平均：${formatRent(rentData.avg_rent)}`);
      lines.push(`  筆數：${rentData.sample_count} 筆`);
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// === 啟動 ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("租金查詢 MCP Server 已啟動");
}

main().catch(console.error);
