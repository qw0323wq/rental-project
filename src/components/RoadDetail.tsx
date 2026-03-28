"use client";

import type { RoadData } from "@/types";

interface RoadDetailProps {
  road: string;
  data: RoadData;
}

export default function RoadDetail({ road, data }: RoadDetailProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <h3 className="font-bold text-lg text-gray-800 mb-4">
        📍 {road} 租金詳情
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">中位數租金</div>
          <div className="text-xl font-bold text-blue-600">
            ${data.median_rent.toLocaleString()}/月
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">平均租金</div>
          <div className="text-xl font-bold text-green-600">
            ${data.avg_rent.toLocaleString()}/月
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">租金範圍</div>
          <div className="text-lg font-medium text-gray-700">
            ${data.min_rent.toLocaleString()} ~ $
            {data.max_rent.toLocaleString()}
          </div>
        </div>
        {data.avg_area_ping && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">平均坪數</div>
            <div className="text-xl font-bold text-orange-600">
              {data.avg_area_ping} 坪
            </div>
          </div>
        )}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">資料筆數</div>
          <div className="text-xl font-bold text-purple-600">
            {data.sample_count} 筆
          </div>
        </div>
        {data.avg_area_ping && data.avg_area_ping > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">每坪單價</div>
            <div className="text-xl font-bold text-red-600">
              ${Math.round(data.median_rent / data.avg_area_ping).toLocaleString()}/坪
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
