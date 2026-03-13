"use client";

interface DistrictData {
  median_rent: number;
  avg_rent: number;
  min_rent: number;
  max_rent: number;
  sample_count: number;
  avg_area_ping?: number;
  by_type?: Record<
    string,
    {
      median_rent: number;
      avg_rent: number;
      min_rent: number;
      max_rent: number;
      sample_count: number;
      avg_area_ping?: number;
    }
  >;
}

interface DistrictTableProps {
  districts: Record<string, DistrictData>;
  roomType?: string;
}

export default function DistrictTable({
  districts,
  roomType,
}: DistrictTableProps) {
  const rows = Object.entries(districts)
    .map(([name, data]) => {
      if (roomType && data.by_type?.[roomType]) {
        const t = data.by_type[roomType];
        return { name, ...t };
      }
      return { name, ...data };
    })
    .sort((a, b) => b.median_rent - a.median_rent);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
        {roomType ? `此區域沒有「${roomType}」的資料` : "沒有資料"}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-bold text-lg text-gray-800">
          各區租金明細 {roomType ? `(${roomType})` : ""}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                區域
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                中位數租金
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                平均租金
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                租金範圍 (P10~P90)
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                平均坪數
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                資料筆數
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.name}
                className={`border-t border-gray-100 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-blue-50 transition-colors`}
              >
                <td className="px-4 py-3 font-medium text-gray-800">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">
                  ${row.median_rent.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  ${row.avg_rent.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  ${row.min_rent.toLocaleString()} ~ $
                  {row.max_rent.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {row.avg_area_ping ? `${row.avg_area_ping} 坪` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {row.sample_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
