"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface FilterControlsProps {
  statusCounts: Array<{ status: string; _count: number }>;
  typeCounts: Array<{ type: string; _count: number }>;
}

export function FilterControls({ statusCounts, typeCounts }: FilterControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusFilter = searchParams.get("status") || "";
  const typeFilter = searchParams.get("type") || "";

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    router.push(`/sources?${params.toString()}`);
  };

  const handleTypeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("type", value);
    } else {
      params.delete("type");
    }
    router.push(`/sources?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4">
      {/* Status Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">All Statuses</option>
          {statusCounts.map((stat) => (
            <option key={stat.status} value={stat.status}>
              {stat.status} ({stat._count})
            </option>
          ))}
        </select>
      </div>

      {/* Type Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type
        </label>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          <option value="">All Types</option>
          {typeCounts.map((stat) => (
            <option key={stat.type} value={stat.type}>
              {stat.type} ({stat._count})
            </option>
          ))}
        </select>
      </div>

      {(statusFilter || typeFilter) && (
        <div className="flex items-end">
          <button
            onClick={() => router.push("/sources")}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
