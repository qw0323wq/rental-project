"use client";

import { useState, useMemo } from "react";
import type { RoadData } from "@/types";

interface RoadTableProps {
  roads: Record<string, RoadData>;
  districtName: string;
}

export default function RoadTable({ roads, districtName }: RoadTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"median" | "count" | "name">("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filteredRoads = useMemo(() => {
    let entries = Object.entries(roads);

    // Filter by search term
    if (searchTerm) {
      entries = entries.filter(([name]) => name.includes(searchTerm));
    }

    // Sort
    entries.sort(([nameA, a], [nameB, b]) => {
      let cmp = 0;
      if (sortBy === "median") cmp = a.median_rent - b.median_rent;
      else if (sortBy === "count") cmp = a.sample_count - b.sample_count;
      else cmp = nameA.localeCompare(nameB, "zh-TW");

      return sortDir === "desc" ? -cmp : cmp;
    });

    return entries;
  }, [roads, searchTerm, sortBy, sortDir]);

  const toggleSort = (col: "median" | "count" | "name") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const sortIcon = (col: string) => {
    if (sortBy !== col) return " ↕";
    return sortDir === "desc" ? " ↓" : " ↑";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-bold text-lg text-gray-800">
            📍 {districtName} 路段租金明細
          </h3>
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋路段名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 pl-9 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              🔍
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          共 {Object.keys(roads).length} 條路段
          {searchTerm && `，符合「${searchTerm}」${filteredRoads.length} 條`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th
                className="text-left px-4 py-3 font-medium cursor-pointer hover:text-blue-600 select-none"
                onClick={() => toggleSort("name")}
              >
                路段{sortIcon("name")}
              </th>
              <th
                className="text-right px-4 py-3 font-medium cursor-pointer hover:text-blue-600 select-none"
                onClick={() => toggleSort("median")}
              >
                中位數租金{sortIcon("median")}
              </th>
              <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                平均租金
              </th>
              <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                租金範圍
              </th>
              <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">
                平均坪數
              </th>
              <th
                className="text-right px-4 py-3 font-medium cursor-pointer hover:text-blue-600 select-none"
                onClick={() => toggleSort("count")}
              >
                資料筆數{sortIcon("count")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRoads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {searchTerm ? `找不到「${searchTerm}」相關路段` : "暫無路段資料"}
                </td>
              </tr>
            )}
            {filteredRoads.map(([name, data]) => (
              <tr
                key={name}
                className="hover:bg-blue-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-800">
                  {name}
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">
                  ${data.median_rent.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                  ${data.avg_rent.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                  ${data.min_rent.toLocaleString()} ~ $
                  {data.max_rent.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">
                  {data.avg_area_ping ? `${data.avg_area_ping} 坪` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {data.sample_count} 筆
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
