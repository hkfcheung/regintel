"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DistributionData {
  name: string;
  value: number;
  percentage?: number;
}

interface BarChartCardProps {
  data: DistributionData[];
  title: string;
  color?: string;
  horizontal?: boolean;
}

export function BarChartCard({ data, title, color = "#3b82f6", horizontal = false }: BarChartCardProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  // Truncate long names for better display
  const formattedData = data.map((item) => ({
    ...item,
    displayName: item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name,
  }));

  if (horizontal) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, formattedData.length * 30)}>
          <BarChart data={formattedData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12 }} width={150} />
            <Tooltip />
            <Bar dataKey="value" fill={color}>
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`${color}${Math.floor(255 - (index / formattedData.length) * 100).toString(16).padStart(2, "0")}`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayName" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
