"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DistributionData {
  name: string;
  value: number;
  percentage?: number;
}

interface PieChartCardProps {
  data: DistributionData[];
  title: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#6366f1", // indigo
];

export function PieChartCard({ data, title, colors = DEFAULT_COLORS }: PieChartCardProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  // Convert to format Recharts expects
  const chartData = data.map(item => ({
    ...item,
    name: item.name,
    value: item.value,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name} (${percentage}%)`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center text-sm">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-gray-700">
              {item.name}: <span className="font-semibold">{item.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
