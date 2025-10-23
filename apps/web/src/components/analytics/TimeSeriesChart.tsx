"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TimeSeriesData {
  date: string;
  count: number;
  approved?: number;
  pending?: number;
  rejected?: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  title: string;
  showBreakdown?: boolean;
}

export function TimeSeriesChart({ data, title, showBreakdown = false }: TimeSeriesChartProps) {
  // Format date for display
  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  if (showBreakdown) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="approved"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              name="Approved"
            />
            <Area
              type="monotone"
              dataKey="pending"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              name="Pending"
            />
            <Area
              type="monotone"
              dataKey="rejected"
              stackId="1"
              stroke="#ef4444"
              fill="#ef4444"
              name="Rejected"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Total Items"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
