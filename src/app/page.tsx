"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RoadSearch from "@/components/RoadSearch";

interface CityInfo {
  name: string;
  median_rent: number;
  sample_count: number;
  district_count: number;
  districts: string[];
}

export default function HomePage() {
  const router = useRouter();
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedRoad, setSelectedRoad] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);

  const AREA_RANGES = [
    { label: "10坪以下", value: "0-10" },
    { label: "10-20坪", value: "10-20" },
    { label: "20-30坪", value: "20-30" },
    { label: "30-40坪", value: "30-40" },
    { label: "40坪以上", value: "40-999" },
  ];

  useEffect(() => {
    Promise.all([
      fetch("/data/cities.json").then((r) => r.json()),
      fetch("/data/rental_stats.json").then((r) => r.json()),
    ])
      .then(([citiesData, statsData]) => {
        setCities(citiesData);
        setStats(statsData);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const city = cities.find((c) => c.name === selectedCity);
    setDistricts(city?.districts || []);
    setSelectedDistrict("");
    setSelectedRoad("");
  }, [selectedCity, cities]);

  // Available roads for selected district
  const typedStats = stats as Record<
    string,
    {
      districts: Record<
        string,
        {
          roads?: Record<string, { sample_count: number }>;
        }
      >;
    }
  >;

  const availableRoads =
    selectedCity &&
    selectedDistrict &&
    typedStats[selectedCity]?.districts?.[selectedDistrict]?.roads
      ? Object.entries(
          typedStats[selectedCity].districts[selectedDistrict].roads!
        )
          .sort(([, a], [, b]) => b.sample_count - a.sample_count)
          .map(([name]) => name)
      : [];

  const handleSearch = () => {
    if (!selectedCity) return;
    const params = new URLSearchParams({ city: selectedCity });
    if (selectedDistrict) params.set("district", selectedDistrict);
    if (selectedRoad) params.set("road", selectedRoad);
    if (selectedType) params.set("type", selectedType);
    if (selectedArea) params.set("area", selectedArea);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">
            全台租金行情，一查就知道
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            基於內政部實價登錄公開資料，提供全台灣各縣市租金行情查詢
          </p>

          {/* Search Form */}
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                  縣市
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedDistrict("");
                    setSelectedRoad("");
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">選擇縣市</option>
                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                  鄉鎮市區
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setSelectedRoad("");
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!selectedCity}
                >
                  <option value="">全部區域</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                  路段
                </label>
                <select
                  value={selectedRoad}
                  onChange={(e) => setSelectedRoad(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!selectedDistrict}
                >
                  <option value="">全部路段</option>
                  {availableRoads.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                  房型
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部房型</option>
                  <option value="套房">套房</option>
                  <option value="雅房">雅房</option>
                  <option value="整層">整層住家</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                  坪數
                </label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部坪數</option>
                  {AREA_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={!selectedCity}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg cursor-pointer disabled:cursor-not-allowed"
            >
              查詢租金行情
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">或搜尋路段名稱</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Road Search */}
            {Object.keys(stats).length > 0 && (
              <RoadSearch stats={stats as Record<string, { districts: Record<string, { roads?: Record<string, { median_rent: number; avg_rent: number; sample_count: number; avg_area_ping?: number }> }> }>} />
            )}
          </div>
        </div>
      </section>

      {/* City Overview Cards */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          各縣市租金概覽
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cities.map((city) => (
            <button
              key={city.name}
              onClick={() => {
                router.push(`/search?city=${city.name}`);
              }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all text-left cursor-pointer"
            >
              <h3 className="font-bold text-lg text-gray-800">{city.name}</h3>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">中位數租金</span>
                  <span className="font-bold text-blue-600">
                    ${city.median_rent.toLocaleString()}/月
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">資料筆數</span>
                  <span className="text-gray-700">
                    {city.sample_count.toLocaleString()} 筆
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">涵蓋區域</span>
                  <span className="text-gray-700">
                    {city.district_count} 區
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">
            為什麼使用我們的工具？
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-bold text-lg mb-2">政府公開資料</h3>
              <p className="text-gray-600">
                資料來源為內政部實價登錄，真實交易紀錄，不是自行估算
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <h3 className="font-bold text-lg mb-2">地圖視覺化</h3>
              <p className="text-gray-600">
                互動式地圖顯示各區租金分布，一目了然各地行情
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">📍</div>
              <h3 className="font-bold text-lg mb-2">路段級查詢</h3>
              <p className="text-gray-600">
                精細到路段，查詢忠孝東路、中正路等具體道路的租金行情
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">💰</div>
              <h3 className="font-bold text-lg mb-2">完全免費</h3>
              <p className="text-gray-600">
                免註冊、免費使用，隨時查詢，幫助你做出更好的租屋決策
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
